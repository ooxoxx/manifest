"""Webhook routes for receiving MinIO events."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from sqlmodel import select

from app.api.deps import SessionDep
from app.models import (
    MinIOInstance,
    Sample,
    SampleHistory,
    SampleHistoryAction,
    SampleSource,
    SampleStatus,
)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


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
            processed += _handle_object_created(
                session=session,
                instance=instance,
                bucket=bucket,
                object_key=object_key,
                object_info=object_info,
            )

        # Handle object removed events
        elif event_name.startswith("s3:ObjectRemoved"):
            processed += _handle_object_removed(
                session=session,
                instance=instance,
                bucket=bucket,
                object_key=object_key,
            )

    return {"processed": processed}


def _handle_object_created(
    session: SessionDep,
    instance: MinIOInstance,
    bucket: str,
    object_key: str,
    object_info: dict,
) -> int:
    """Handle object created event."""
    # Check if sample already exists
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
            session.add(existing)
            session.commit()
            return 1
        return 0

    # Create new sample
    file_name = object_key.split("/")[-1]
    sample = Sample(
        minio_instance_id=instance.id,
        owner_id=instance.owner_id,
        bucket=bucket,
        object_key=object_key,
        file_name=file_name,
        file_size=object_info.get("size", 0),
        etag=object_info.get("eTag", "").strip('"'),
        content_type=object_info.get("contentType"),
        source=SampleSource.webhook,
        status=SampleStatus.active,
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

    return 1


def _handle_object_removed(
    session: SessionDep,
    instance: MinIOInstance,
    bucket: str,
    object_key: str,
) -> int:
    """Handle object removed event."""
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
