"""MinIO instances API routes."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    BucketObjectInfo,
    BucketObjectsResponse,
    Message,
    MinIOInstance,
    MinIOInstanceCreate,
    MinIOInstancePublic,
    MinIOInstancesPublic,
    MinIOInstanceUpdate,
)
from app.services.minio_service import (
    MinIOService,
    create_minio_instance,
    update_minio_instance,
)

router = APIRouter(prefix="/minio-instances", tags=["minio-instances"])


@router.get("/", response_model=MinIOInstancesPublic)
def read_minio_instances(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Retrieve MinIO instances."""
    count_statement = (
        select(func.count())
        .select_from(MinIOInstance)
        .where(MinIOInstance.owner_id == current_user.id)
    )
    count = session.exec(count_statement).one()

    statement = (
        select(MinIOInstance)
        .where(MinIOInstance.owner_id == current_user.id)
        .offset(skip)
        .limit(limit)
    )
    instances = session.exec(statement).all()

    return MinIOInstancesPublic(data=instances, count=count)


@router.post("/", response_model=MinIOInstancePublic)
def create_minio_instance_endpoint(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    instance_in: MinIOInstanceCreate,
) -> Any:
    """Create new MinIO instance."""
    instance = create_minio_instance(
        session=session,
        instance_in=instance_in,
        owner_id=current_user.id,
    )
    return instance


@router.get("/{id}", response_model=MinIOInstancePublic)
def read_minio_instance(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Any:
    """Get MinIO instance by ID."""
    instance = session.get(MinIOInstance, id)
    if not instance:
        raise HTTPException(status_code=404, detail="MinIO instance not found")
    if instance.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return instance


@router.put("/{id}", response_model=MinIOInstancePublic)
def update_minio_instance_endpoint(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    instance_in: MinIOInstanceUpdate,
) -> Any:
    """Update a MinIO instance."""
    instance = session.get(MinIOInstance, id)
    if not instance:
        raise HTTPException(status_code=404, detail="MinIO instance not found")
    if instance.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    instance = update_minio_instance(
        session=session,
        db_instance=instance,
        instance_in=instance_in,
    )
    return instance


@router.delete("/{id}")
def delete_minio_instance(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Message:
    """Delete a MinIO instance."""
    instance = session.get(MinIOInstance, id)
    if not instance:
        raise HTTPException(status_code=404, detail="MinIO instance not found")
    if instance.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    session.delete(instance)
    session.commit()
    return Message(message="MinIO instance deleted successfully")


@router.post("/{id}/test")
def test_minio_connection(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> dict:
    """Test connection to MinIO instance."""
    instance = session.get(MinIOInstance, id)
    if not instance:
        raise HTTPException(status_code=404, detail="MinIO instance not found")
    if instance.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    success, message = MinIOService.test_connection(instance)
    return {"success": success, "message": message}


@router.get("/{id}/buckets")
def list_minio_buckets(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> dict:
    """List buckets in MinIO instance."""
    instance = session.get(MinIOInstance, id)
    if not instance:
        raise HTTPException(status_code=404, detail="MinIO instance not found")
    if instance.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    try:
        buckets = MinIOService.list_buckets(instance)
        return {"buckets": buckets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{id}/buckets/{bucket}/objects", response_model=BucketObjectsResponse)
def list_bucket_objects(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    bucket: str,
    prefix: str = "",
) -> BucketObjectsResponse:
    """List objects and folders in a bucket for directory browsing.

    Returns folders (common prefixes) and objects at the specified prefix level.
    Use this endpoint to build a directory browser UI.
    """
    instance = session.get(MinIOInstance, id)
    if not instance:
        raise HTTPException(status_code=404, detail="MinIO instance not found")
    if instance.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    try:
        objects_data, folders = MinIOService.list_objects_with_prefixes(
            instance=instance,
            bucket=bucket,
            prefix=prefix,
        )

        objects = [
            BucketObjectInfo(
                name=obj["name"],
                key=obj["object_key"],
                is_folder=False,
                size=obj.get("size"),
                last_modified=obj.get("last_modified"),
            )
            for obj in objects_data
        ]

        return BucketObjectsResponse(
            bucket=bucket,
            prefix=prefix,
            folders=folders,
            objects=objects,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
