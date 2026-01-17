"""Watched paths API routes."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Message,
    MinIOInstance,
    Sample,
    SampleHistory,
    SampleHistoryAction,
    SampleSource,
    SampleStatus,
    WatchedPath,
    WatchedPathCreate,
    WatchedPathPublic,
    WatchedPathsPublic,
    WatchedPathUpdate,
)
from app.services.minio_service import MinIOService

router = APIRouter(prefix="/watched-paths", tags=["watched-paths"])


@router.get("/", response_model=WatchedPathsPublic)
def read_watched_paths(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    minio_instance_id: uuid.UUID | None = None,
) -> Any:
    """Retrieve watched paths."""
    # Get user's MinIO instances
    instances_query = select(MinIOInstance.id).where(
        MinIOInstance.owner_id == current_user.id
    )
    instance_ids = session.exec(instances_query).all()

    query = select(WatchedPath).where(
        WatchedPath.minio_instance_id.in_(instance_ids)
    )

    if minio_instance_id:
        query = query.where(WatchedPath.minio_instance_id == minio_instance_id)

    count_query = select(func.count()).select_from(query.subquery())
    count = session.exec(count_query).one()

    paths = session.exec(query.offset(skip).limit(limit)).all()
    return WatchedPathsPublic(data=paths, count=count)


@router.post("/", response_model=WatchedPathPublic)
def create_watched_path(
    session: SessionDep,
    current_user: CurrentUser,
    path_in: WatchedPathCreate,
) -> Any:
    """Create a new watched path."""
    instance = session.get(MinIOInstance, path_in.minio_instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="MinIO instance not found")
    if instance.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    path = WatchedPath(
        bucket=path_in.bucket,
        prefix=path_in.prefix,
        description=path_in.description,
        is_active=path_in.is_active,
        minio_instance_id=path_in.minio_instance_id,
    )
    session.add(path)
    session.commit()
    session.refresh(path)
    return path


@router.put("/{id}", response_model=WatchedPathPublic)
def update_watched_path(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    path_in: WatchedPathUpdate,
) -> Any:
    """Update a watched path."""
    path = session.get(WatchedPath, id)
    if not path:
        raise HTTPException(status_code=404, detail="Watched path not found")

    instance = session.get(MinIOInstance, path.minio_instance_id)
    if not instance or instance.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    update_data = path_in.model_dump(exclude_unset=True)
    path.sqlmodel_update(update_data)
    path.updated_at = datetime.utcnow()
    session.add(path)
    session.commit()
    session.refresh(path)
    return path


@router.delete("/{id}")
def delete_watched_path(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Message:
    """Delete a watched path."""
    path = session.get(WatchedPath, id)
    if not path:
        raise HTTPException(status_code=404, detail="Watched path not found")

    instance = session.get(MinIOInstance, path.minio_instance_id)
    if not instance or instance.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    session.delete(path)
    session.commit()
    return Message(message="Watched path deleted successfully")


@router.post("/{id}/sync")
def sync_watched_path(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> dict:
    """Trigger sync for a watched path."""
    path = session.get(WatchedPath, id)
    if not path:
        raise HTTPException(status_code=404, detail="Watched path not found")

    instance = session.get(MinIOInstance, path.minio_instance_id)
    if not instance or instance.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # List objects from MinIO
    try:
        objects = MinIOService.list_objects(
            instance=instance,
            bucket=path.bucket,
            prefix=path.prefix,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    created = 0
    skipped = 0

    for obj in objects:
        # Check if sample exists
        existing = session.exec(
            select(Sample).where(
                Sample.minio_instance_id == instance.id,
                Sample.bucket == path.bucket,
                Sample.object_key == obj["object_key"],
            )
        ).first()

        if existing:
            skipped += 1
            continue

        # Create sample
        file_name = obj["object_key"].split("/")[-1]
        sample = Sample(
            minio_instance_id=instance.id,
            owner_id=current_user.id,
            bucket=path.bucket,
            object_key=obj["object_key"],
            file_name=file_name,
            file_size=obj.get("size", 0),
            etag=obj.get("etag"),
            content_type=obj.get("content_type"),
            source=SampleSource.sync,
            status=SampleStatus.active,
        )
        session.add(sample)
        created += 1

    # Update last sync time
    path.last_sync_at = datetime.utcnow()
    session.add(path)
    session.commit()

    return {"created": created, "skipped": skipped}
