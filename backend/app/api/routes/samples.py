"""Samples API routes."""

import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    BatchTagRequest,
    Message,
    MinIOInstance,
    Sample,
    SampleHistory,
    SampleHistoryAction,
    SampleHistoryPublic,
    SamplePublic,
    SamplesPublic,
    SampleStatus,
    SampleTag,
    SampleUpdate,
    SampleWithTags,
    Tag,
    TagPublic,
)
from app.services.minio_service import MinIOService

router = APIRouter(prefix="/samples", tags=["samples"])


@router.get("/", response_model=SamplesPublic)
def read_samples(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    status: SampleStatus | None = None,
    minio_instance_id: uuid.UUID | None = None,
    bucket: str | None = None,
    tag_id: uuid.UUID | None = None,
    search: str | None = None,
) -> Any:
    """Retrieve samples with filtering."""
    # Build base query
    query = select(Sample).where(Sample.owner_id == current_user.id)

    # Apply filters
    if status:
        query = query.where(Sample.status == status)
    if minio_instance_id:
        query = query.where(Sample.minio_instance_id == minio_instance_id)
    if bucket:
        query = query.where(Sample.bucket == bucket)
    if search:
        query = query.where(col(Sample.file_name).ilike(f"%{search}%"))
    if tag_id:
        query = query.join(SampleTag).where(SampleTag.tag_id == tag_id)

    # Get count
    count_query = select(func.count()).select_from(query.subquery())
    count = session.exec(count_query).one()

    # Get samples
    query = query.order_by(col(Sample.created_at).desc()).offset(skip).limit(limit)
    samples = session.exec(query).all()

    return SamplesPublic(data=samples, count=count)


@router.get("/{id}", response_model=SampleWithTags)
def read_sample(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Any:
    """Get sample by ID with tags."""
    sample = session.get(Sample, id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    if sample.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Get tags
    tags_query = (
        select(Tag)
        .join(SampleTag)
        .where(SampleTag.sample_id == sample.id)
    )
    tags = session.exec(tags_query).all()

    return SampleWithTags(**sample.model_dump(), tags=tags)


@router.get("/{id}/preview-url")
def get_sample_preview_url(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    expires_hours: int = 1,
) -> dict:
    """Get presigned URL for sample preview."""
    sample = session.get(Sample, id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    if sample.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    instance = session.get(MinIOInstance, sample.minio_instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="MinIO instance not found")

    try:
        url = MinIOService.get_presigned_url(
            instance=instance,
            bucket=sample.bucket,
            object_key=sample.object_key,
            expires=timedelta(hours=expires_hours),
        )
        return {"url": url, "expires_in": expires_hours * 3600}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{id}/history", response_model=list[SampleHistoryPublic])
def get_sample_history(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Any:
    """Get sample operation history."""
    sample = session.get(Sample, id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    if sample.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    history = session.exec(
        select(SampleHistory)
        .where(SampleHistory.sample_id == id)
        .order_by(col(SampleHistory.created_at).desc())
    ).all()

    return history


@router.post("/batch-tag")
def batch_tag_samples(
    session: SessionDep,
    current_user: CurrentUser,
    request: BatchTagRequest,
) -> dict:
    """Batch add tags to samples."""
    tagged_count = 0

    for sample_id in request.sample_ids:
        sample = session.get(Sample, sample_id)
        if not sample or sample.owner_id != current_user.id:
            continue

        for tag_id in request.tag_ids:
            tag = session.get(Tag, tag_id)
            if not tag or tag.owner_id != current_user.id:
                continue

            # Check if already tagged
            existing = session.exec(
                select(SampleTag).where(
                    SampleTag.sample_id == sample_id,
                    SampleTag.tag_id == tag_id,
                )
            ).first()

            if not existing:
                sample_tag = SampleTag(
                    sample_id=sample_id,
                    tag_id=tag_id,
                )
                session.add(sample_tag)
                tagged_count += 1

    session.commit()
    return {"tagged": tagged_count}


@router.delete("/{id}")
def delete_sample(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Message:
    """Soft delete a sample."""
    sample = session.get(Sample, id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    if sample.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    sample.status = SampleStatus.deleted
    sample.deleted_at = datetime.utcnow()
    sample.updated_at = datetime.utcnow()
    session.add(sample)

    # Add history
    history = SampleHistory(
        sample_id=sample.id,
        action=SampleHistoryAction.deleted,
        details={"source": "manual"},
    )
    session.add(history)
    session.commit()

    return Message(message="Sample deleted successfully")
