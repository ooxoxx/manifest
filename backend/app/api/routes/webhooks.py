"""Webhook routes for receiving MinIO events."""

import logging
import os
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from sqlmodel import select

from app.api.deps import SessionDep
from app.models import (
    Annotation,
    AnnotationFormat,
    AnnotationStatus,
    MinIOInstance,
    Sample,
    SampleHistory,
    SampleHistoryAction,
    SampleSource,
    SampleStatus,
)
from app.services.annotation_service import parse_voc_xml
from app.services.matching_service import extract_file_stem

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Image file extensions
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp"}
# Annotation file extensions
ANNOTATION_EXTENSIONS = {".xml"}


def _is_image_file(object_key: str) -> bool:
    """Check if the object is an image file."""
    ext = os.path.splitext(object_key.lower())[1]
    return ext in IMAGE_EXTENSIONS


def _is_annotation_file(object_key: str) -> bool:
    """Check if the object is an annotation file."""
    ext = os.path.splitext(object_key.lower())[1]
    return ext in ANNOTATION_EXTENSIONS


def get_minio_client(instance: MinIOInstance) -> Any:
    """Get MinIO client for instance. Placeholder for actual implementation."""
    from minio import Minio

    # Decrypt credentials
    from app.core.encryption import decrypt_value

    access_key = decrypt_value(instance.access_key_encrypted)
    secret_key = decrypt_value(instance.secret_key_encrypted)

    return Minio(
        instance.endpoint,
        access_key=access_key,
        secret_key=secret_key,
        secure=instance.secure,
    )


def find_and_link_annotation(
    session: SessionDep,
    sample: Sample,
    instance: MinIOInstance,
) -> bool:
    """Find and link annotation file for a sample.

    Returns True if annotation was found and linked.
    """
    if not sample.file_stem:
        return False

    try:
        client = get_minio_client(instance)

        # List objects in bucket looking for matching XML
        objects = client.list_objects(sample.bucket, recursive=True)

        for obj in objects:
            if not _is_annotation_file(obj.object_name):
                continue

            obj_stem = extract_file_stem(obj.object_name)
            if obj_stem == sample.file_stem:
                # Found matching annotation
                annotation_key = obj.object_name
                annotation_hash = obj.etag.strip('"') if obj.etag else None

                # Parse the annotation
                try:
                    response = client.get_object(sample.bucket, annotation_key)
                    xml_content = response.read()
                    response.close()
                    response.release_conn()

                    parsed = parse_voc_xml(xml_content)
                    if parsed:
                        # Create Annotation record
                        annotation = Annotation(
                            sample_id=sample.id,
                            format=AnnotationFormat.voc,
                            image_width=parsed.image_width,
                            image_height=parsed.image_height,
                            object_count=parsed.object_count,
                            class_counts=parsed.class_counts,
                            objects=parsed.objects,
                        )
                        session.add(annotation)
                        session.flush()  # Flush to get annotation.id

                        # Update sample
                        sample.annotation_key = annotation_key
                        sample.annotation_hash = annotation_hash
                        sample.annotation_status = AnnotationStatus.linked
                        sample.annotation_id = annotation.id
                        sample.updated_at = datetime.utcnow()
                        session.add(sample)

                        # Add history
                        history = SampleHistory(
                            sample_id=sample.id,
                            action=SampleHistoryAction.annotation_linked,
                            details={
                                "annotation_key": annotation_key,
                                "object_count": parsed.object_count,
                            },
                        )
                        session.add(history)
                        session.commit()
                        return True
                except Exception as e:
                    logger.warning(f"Failed to parse annotation {annotation_key}: {e}")
                    sample.annotation_status = AnnotationStatus.error
                    session.add(sample)
                    session.commit()

                return False

    except Exception as e:
        logger.warning(f"Failed to search for annotation: {e}")

    return False


@router.post("/minio/{instance_id}")
async def receive_minio_webhook(
    request: Request,
    session: SessionDep,
    instance_id: uuid.UUID,
) -> dict:
    """Receive MinIO webhook events."""
    # Get the MinIO instance
    instance = session.get(MinIOInstance, instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="MinIO instance not found")

    # Parse the webhook payload
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # Process events
    records = payload.get("Records", [])
    processed = 0

    for record in records:
        event_name = record.get("eventName", "")
        s3_info = record.get("s3", {})
        bucket_info = s3_info.get("bucket", {})
        object_info = s3_info.get("object", {})

        bucket = bucket_info.get("name")
        object_key = object_info.get("key")

        if not bucket or not object_key:
            continue

        # Handle object created events
        if event_name.startswith("s3:ObjectCreated"):
            if _is_image_file(object_key):
                processed += _handle_image_created(
                    session=session,
                    instance=instance,
                    bucket=bucket,
                    object_key=object_key,
                    object_info=object_info,
                )
            elif _is_annotation_file(object_key):
                processed += _handle_annotation_created(
                    session=session,
                    instance=instance,
                    bucket=bucket,
                    object_key=object_key,
                    object_info=object_info,
                )

        # Handle object removed events
        elif event_name.startswith("s3:ObjectRemoved"):
            if _is_image_file(object_key):
                processed += _handle_image_removed(
                    session=session,
                    instance=instance,
                    bucket=bucket,
                    object_key=object_key,
                )
            elif _is_annotation_file(object_key):
                processed += _handle_annotation_removed(
                    session=session,
                    instance=instance,
                    bucket=bucket,
                    object_key=object_key,
                )

    return {"processed": processed}


def _handle_image_created(
    session: SessionDep,
    instance: MinIOInstance,
    bucket: str,
    object_key: str,
    object_info: dict,
) -> int:
    """Handle image file created event with Phase 3 enhancements."""
    # Extract file hash from ETag
    etag = object_info.get("eTag", "").strip('"')
    file_hash = etag if etag else None

    # Check for duplicate by file_hash first (Phase 3: MD5 deduplication)
    if file_hash:
        existing_by_hash = session.exec(
            select(Sample).where(
                Sample.minio_instance_id == instance.id,
                Sample.file_hash == file_hash,
                Sample.status == SampleStatus.active,
            )
        ).first()
        if existing_by_hash:
            logger.info(f"Skipping duplicate image by hash: {object_key}")
            return 0

    # Check if sample already exists by path
    existing = session.exec(
        select(Sample).where(
            Sample.minio_instance_id == instance.id,
            Sample.bucket == bucket,
            Sample.object_key == object_key,
        )
    ).first()

    if existing:
        # Update existing sample if it was deleted
        if existing.status == SampleStatus.deleted:
            existing.status = SampleStatus.active
            existing.deleted_at = None
            existing.updated_at = datetime.utcnow()
            existing.file_hash = file_hash
            existing.file_stem = extract_file_stem(object_key)
            session.add(existing)
            session.commit()

            # Try to find annotation
            find_and_link_annotation(session, existing, instance)
            return 1
        return 0

    # Extract file_stem for annotation matching
    file_stem = extract_file_stem(object_key)
    file_name = object_key.split("/")[-1]

    # Create new sample
    sample = Sample(
        minio_instance_id=instance.id,
        owner_id=instance.owner_id,
        bucket=bucket,
        object_key=object_key,
        file_name=file_name,
        file_size=object_info.get("size", 0),
        etag=etag,
        content_type=object_info.get("contentType"),
        source=SampleSource.webhook,
        status=SampleStatus.active,
        # Phase 3 enhancements
        file_hash=file_hash,
        file_stem=file_stem,
        annotation_status=AnnotationStatus.none,
    )
    session.add(sample)
    session.commit()
    session.refresh(sample)

    # Add history record
    history = SampleHistory(
        sample_id=sample.id,
        action=SampleHistoryAction.created,
        details={"source": "webhook", "event": "s3:ObjectCreated"},
    )
    session.add(history)
    session.commit()

    # Try to find and link annotation
    find_and_link_annotation(session, sample, instance)

    return 1


def _handle_annotation_created(
    session: SessionDep,
    instance: MinIOInstance,
    bucket: str,
    object_key: str,
    object_info: dict,
) -> int:
    """Handle annotation file created event."""
    # Extract file stem to find matching image
    file_stem = extract_file_stem(object_key)
    annotation_hash = object_info.get("eTag", "").strip('"')

    # Find sample with matching file_stem
    sample = session.exec(
        select(Sample).where(
            Sample.minio_instance_id == instance.id,
            Sample.bucket == bucket,
            Sample.file_stem == file_stem,
            Sample.status == SampleStatus.active,
        )
    ).first()

    if not sample:
        # No matching image, ignore annotation
        logger.info(f"No matching image for annotation: {object_key}")
        return 0

    # Check if sample already has an annotation
    if sample.annotation_status == AnnotationStatus.linked:
        # Check if it's the same annotation (by hash)
        if sample.annotation_hash == annotation_hash:
            logger.info(f"Skipping duplicate annotation by hash: {object_key}")
            return 0

        # Different annotation - mark as conflict
        sample.annotation_status = AnnotationStatus.conflict
        sample.updated_at = datetime.utcnow()
        session.add(sample)

        # Add conflict history
        history = SampleHistory(
            sample_id=sample.id,
            action=SampleHistoryAction.annotation_conflict,
            details={
                "old_annotation": sample.annotation_key,
                "new_annotation": object_key,
                "old_hash": sample.annotation_hash,
                "new_hash": annotation_hash,
            },
        )
        session.add(history)
        session.commit()
        return 1

    # No existing annotation - link it
    try:
        client = get_minio_client(instance)
        response = client.get_object(bucket, object_key)
        xml_content = response.read()
        response.close()
        response.release_conn()

        parsed = parse_voc_xml(xml_content)
        if parsed:
            # Create Annotation record
            annotation = Annotation(
                sample_id=sample.id,
                format=AnnotationFormat.voc,
                image_width=parsed.image_width,
                image_height=parsed.image_height,
                object_count=parsed.object_count,
                class_counts=parsed.class_counts,
                objects=parsed.objects,
            )
            session.add(annotation)
            session.flush()  # Flush to get annotation.id

            # Update sample
            sample.annotation_key = object_key
            sample.annotation_hash = annotation_hash
            sample.annotation_status = AnnotationStatus.linked
            sample.annotation_id = annotation.id
            sample.updated_at = datetime.utcnow()
            session.add(sample)

            # Add history
            history = SampleHistory(
                sample_id=sample.id,
                action=SampleHistoryAction.annotation_linked,
                details={
                    "annotation_key": object_key,
                    "object_count": parsed.object_count,
                },
            )
            session.add(history)
            session.commit()
            return 1
        else:
            sample.annotation_status = AnnotationStatus.error
            session.add(sample)
            session.commit()
            return 0

    except Exception as e:
        logger.warning(f"Failed to parse annotation {object_key}: {e}")
        sample.annotation_status = AnnotationStatus.error
        session.add(sample)
        session.commit()
        return 0


def _handle_image_removed(
    session: SessionDep,
    instance: MinIOInstance,
    bucket: str,
    object_key: str,
) -> int:
    """Handle image file removed event."""
    sample = session.exec(
        select(Sample).where(
            Sample.minio_instance_id == instance.id,
            Sample.bucket == bucket,
            Sample.object_key == object_key,
        )
    ).first()

    if not sample:
        return 0

    # Soft delete the sample
    sample.status = SampleStatus.deleted
    sample.deleted_at = datetime.utcnow()
    sample.updated_at = datetime.utcnow()
    session.add(sample)
    session.commit()

    # Add history record
    history = SampleHistory(
        sample_id=sample.id,
        action=SampleHistoryAction.deleted,
        details={"source": "webhook", "event": "s3:ObjectRemoved"},
    )
    session.add(history)
    session.commit()

    return 1


def _handle_annotation_removed(
    session: SessionDep,
    instance: MinIOInstance,
    bucket: str,
    object_key: str,
) -> int:
    """Handle annotation file removed event."""
    # Find sample with this annotation
    sample = session.exec(
        select(Sample).where(
            Sample.minio_instance_id == instance.id,
            Sample.bucket == bucket,
            Sample.annotation_key == object_key,
        )
    ).first()

    if not sample:
        return 0

    # Delete the Annotation record if exists
    annotation = session.exec(
        select(Annotation).where(Annotation.sample_id == sample.id)
    ).first()
    if annotation:
        session.delete(annotation)

    # Clear annotation fields from sample
    sample.annotation_key = None
    sample.annotation_hash = None
    sample.annotation_status = AnnotationStatus.none
    sample.annotation_id = None
    sample.updated_at = datetime.utcnow()
    session.add(sample)

    # Add history record
    history = SampleHistory(
        sample_id=sample.id,
        action=SampleHistoryAction.annotation_removed,
        details={"source": "webhook", "event": "s3:ObjectRemoved", "annotation": object_key},
    )
    session.add(history)
    session.commit()

    return 1
