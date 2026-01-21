"""Samples API routes."""

import json
import uuid
from datetime import date, datetime, timedelta
from io import BytesIO
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlalchemy import func as sa_func
from sqlalchemy import or_
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Annotation,
    AnnotationStatus,
    BatchTagRequest,
    CSVPreviewResponse,
    ImportTask,
    ImportTaskPublic,
    ImportTaskStatus,
    Message,
    MinIOInstance,
    Sample,
    SampleHistory,
    SampleHistoryAction,
    SampleHistoryPublic,
    SampleListResponse,
    SamplePreviewAnnotation,
    SamplePreviewResponse,
    SamplePublic,
    SampleStatus,
    SampleTag,
    SampleThumbnail,
    SampleThumbnailsRequest,
    SampleWithTags,
    Tag,
)
from app.services.import_service import (
    ImportResult,
    import_samples_from_csv,
    preview_csv,
)
from app.services.minio_service import MinIOService

router = APIRouter(prefix="/samples", tags=["samples"])


@router.get("/", response_model=SampleListResponse)
def read_samples(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 50,
    status: SampleStatus | None = None,
    minio_instance_id: uuid.UUID | None = None,
    bucket: str | None = None,
    tag_id: uuid.UUID | None = None,
    search: str | None = None,
    # New filtering parameters for sample browser
    tag_filter: str | None = None,  # JSON: [[uuid1,uuid2],[uuid3]] for DNF logic
    date_from: date | None = None,
    date_to: date | None = None,
    annotation_status: AnnotationStatus | None = None,
    sort: str = "-created_at",  # Sorting field with direction prefix
) -> Any:
    """Retrieve samples with filtering.

    Supports advanced filtering with:
    - tag_filter: DNF logic - JSON array like [[uuid1,uuid2],[uuid3]] = (A AND B) OR C
    - date_from/date_to: Date range filter
    - annotation_status: Filter by annotation status (none, linked, conflict, error)
    - search: Fuzzy search on file_name
    - sort: Field to sort by, prefix with - for descending (default: -created_at)
    """
    # Build base query
    query = select(Sample).where(Sample.owner_id == current_user.id)

    # Apply status filter (default to active)
    if status:
        query = query.where(Sample.status == status)
    else:
        query = query.where(Sample.status == SampleStatus.active)

    if minio_instance_id:
        query = query.where(Sample.minio_instance_id == minio_instance_id)
    if bucket:
        query = query.where(Sample.bucket == bucket)
    if search:
        query = query.where(col(Sample.file_name).ilike(f"%{search}%"))

    # Legacy single tag filter
    if tag_id:
        query = query.join(SampleTag).where(SampleTag.tag_id == tag_id)

    # DNF tag filter: [[tagA, tagB], [tagC]] = (A AND B) OR C
    if tag_filter:
        try:
            tag_groups = json.loads(tag_filter)
            if tag_groups and isinstance(tag_groups, list):
                or_conditions = []
                for tag_group in tag_groups:
                    if tag_group and isinstance(tag_group, list):
                        # Each group: sample must have ALL tags in the group (AND)
                        tag_uuids = [uuid.UUID(t) for t in tag_group]
                        subquery = (
                            select(SampleTag.sample_id)
                            .where(col(SampleTag.tag_id).in_(tag_uuids))
                            .group_by(col(SampleTag.sample_id))
                            .having(sa_func.count(col(SampleTag.tag_id)) == len(tag_uuids))
                        )
                        or_conditions.append(col(Sample.id).in_(subquery))
                if or_conditions:
                    # Groups are connected by OR
                    query = query.where(or_(*or_conditions))
        except (json.JSONDecodeError, ValueError):
            pass  # Invalid JSON, ignore filter

    # Date range filters
    if date_from:
        query = query.where(Sample.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.where(Sample.created_at <= datetime.combine(date_to, datetime.max.time()))

    # Annotation status filter
    if annotation_status:
        query = query.where(Sample.annotation_status == annotation_status)

    # Get count
    count_query = select(func.count()).select_from(query.subquery())
    count = session.exec(count_query).one()

    # Apply sorting
    if sort.startswith("-"):
        sort_field = sort[1:]
        descending = True
    else:
        sort_field = sort
        descending = False

    # Map sort field to column
    sort_columns = {
        "created_at": Sample.created_at,
        "file_name": Sample.file_name,
        "file_size": Sample.file_size,
    }
    sort_column = sort_columns.get(sort_field, Sample.created_at)
    if descending:
        query = query.order_by(col(sort_column).desc())
    else:
        query = query.order_by(col(sort_column).asc())

    # Apply pagination
    query = query.offset(skip).limit(limit)
    samples = session.exec(query).all()

    return SampleListResponse(
        items=[SamplePublic.model_validate(s) for s in samples],
        total=count,
        has_more=(skip + len(samples)) < count,
    )


@router.post("/thumbnails", response_model=list[SampleThumbnail])
def get_sample_thumbnails(
    session: SessionDep,
    current_user: CurrentUser,
    request: SampleThumbnailsRequest,
) -> Any:
    """Batch get sample thumbnails with presigned URLs.

    Returns thumbnail data for multiple samples at once, optimized for grid view.
    Includes presigned URLs, file metadata, and annotation class counts.
    """
    if not request.sample_ids:
        return []

    # Get samples with their annotations
    samples = session.exec(
        select(Sample)
        .where(col(Sample.id).in_(request.sample_ids))
        .where(Sample.owner_id == current_user.id)
    ).all()

    if not samples:
        return []

    # Get annotations for all samples in one query
    sample_ids = [s.id for s in samples]
    annotations = session.exec(
        select(Annotation).where(col(Annotation.sample_id).in_(sample_ids))
    ).all()
    annotation_map = {a.sample_id: a for a in annotations}

    # Get MinIO instances for URL generation
    minio_instance_ids = {s.minio_instance_id for s in samples}
    minio_instances = session.exec(
        select(MinIOInstance).where(col(MinIOInstance.id).in_(minio_instance_ids))
    ).all()
    minio_map = {m.id: m for m in minio_instances}

    # Build response
    results = []
    for sample in samples:
        # Generate presigned URL
        minio_instance = minio_map.get(sample.minio_instance_id)
        if not minio_instance:
            continue

        try:
            presigned_url = MinIOService.get_presigned_url(
                instance=minio_instance,
                bucket=sample.bucket,
                object_key=sample.object_key,
                expires=timedelta(hours=1),
            )
        except Exception:
            continue  # Skip samples we can't get URLs for

        # Get class counts from annotation if available
        annotation = annotation_map.get(sample.id)
        class_counts = annotation.class_counts if annotation else None

        results.append(
            SampleThumbnail(
                id=sample.id,
                presigned_url=presigned_url,
                file_name=sample.file_name,
                file_size=sample.file_size,
                created_at=sample.created_at,
                annotation_status=sample.annotation_status,
                class_counts=class_counts,
            )
        )

    return results


@router.get("/import", response_model=list[ImportTaskPublic])
def list_import_tasks(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 20,
) -> Any:
    """List import tasks for current user.

    Returns:
        List of import tasks ordered by creation date (newest first)
    """
    tasks = session.exec(
        select(ImportTask)
        .where(ImportTask.owner_id == current_user.id)
        .order_by(col(ImportTask.created_at).desc())
        .offset(skip)
        .limit(limit)
    ).all()

    return tasks


@router.get("/import/{task_id}", response_model=ImportTaskPublic)
def get_import_status(
    session: SessionDep,
    current_user: CurrentUser,
    task_id: uuid.UUID,
) -> Any:
    """Get import task status.

    Args:
        task_id: Import task ID

    Returns:
        Import task with current status and results
    """
    task = session.get(ImportTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Import task not found")
    if task.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    return task


@router.post("/import/preview", response_model=CSVPreviewResponse)
async def preview_import_csv(
    _current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    """Preview CSV file content before import.

    Returns:
        CSV preview with row counts, columns, and sample data
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="File must be a CSV file",
        )

    try:
        content = await file.read()
        preview = preview_csv(BytesIO(content))
        return CSVPreviewResponse(
            total_rows=preview.total_rows,
            columns=preview.columns,
            sample_rows=preview.sample_rows,
            has_tags_column=preview.has_tags_column,
            image_count=preview.image_count,
            annotation_count=preview.annotation_count,
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse CSV: {str(e)}",
        )


@router.post("/import", response_model=ImportTaskPublic)
async def import_samples(
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    minio_instance_id: uuid.UUID = Form(...),
    bucket: str | None = Form(None),
    validate_files: bool = Form(True),
) -> Any:
    """Import samples from CSV file.

    This endpoint creates an import task and processes the CSV file.
    For MVP, this is synchronous. Will be upgraded to async with Redis later.

    Args:
        file: CSV file with object_key column (required), tags column (optional)
        minio_instance_id: MinIO instance to import from
        bucket: Default bucket name (optional if bucket column exists in CSV)
        validate_files: Whether to validate file existence via HEAD request

    Returns:
        Import task with results
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="File must be a CSV file",
        )

    # Verify MinIO instance ownership
    minio_instance = session.get(MinIOInstance, minio_instance_id)
    if not minio_instance or minio_instance.owner_id != current_user.id:
        raise HTTPException(
            status_code=404,
            detail="MinIO instance not found",
        )

    # Read CSV content
    content = await file.read()

    # Get total rows for task tracking
    try:
        preview = preview_csv(BytesIO(content))
        total_rows = preview.total_rows
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse CSV: {str(e)}",
        )

    # Create import task record
    task = ImportTask(
        owner_id=current_user.id,
        minio_instance_id=minio_instance_id,
        bucket=bucket,
        status=ImportTaskStatus.running,
        total_rows=total_rows,
    )
    session.add(task)
    session.commit()
    session.refresh(task)

    try:
        # Process import synchronously (will be async with Redis in future)
        result: ImportResult = import_samples_from_csv(
            session=session,
            file=BytesIO(content),
            minio_instance_id=minio_instance_id,
            owner_id=current_user.id,
            bucket=bucket,
            validate_files=validate_files,
        )

        # Update task with results
        task.status = ImportTaskStatus.completed
        task.progress = 100
        task.created = result.created
        task.skipped = result.skipped
        task.errors = result.errors
        task.annotations_linked = result.annotations_linked
        task.tags_created = result.tags_created
        task.error_details = result.error_details
        task.completed_at = datetime.utcnow()
        task.updated_at = datetime.utcnow()
        session.add(task)
        session.commit()
        session.refresh(task)

    except Exception as e:
        # Mark task as failed
        task.status = ImportTaskStatus.failed
        task.error_details = [str(e)]
        task.updated_at = datetime.utcnow()
        session.add(task)
        session.commit()
        session.refresh(task)

    return task


# ============================================================================
# Sample CRUD Endpoints
# ============================================================================


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


@router.get("/{id}/preview", response_model=SamplePreviewResponse)
def get_sample_preview(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    expires_hours: int = 1,
) -> Any:
    """Get sample preview with presigned URL, annotation, and tags.

    This endpoint combines sample info, presigned URL for image access,
    annotation data (bounding boxes), and tags in a single response.
    Optimized for the sample viewer/reviewer components.
    """
    sample = session.get(Sample, id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    if sample.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Get MinIO instance for presigned URL
    instance = session.get(MinIOInstance, sample.minio_instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="MinIO instance not found")

    # Generate presigned URL
    try:
        presigned_url = MinIOService.get_presigned_url(
            instance=instance,
            bucket=sample.bucket,
            object_key=sample.object_key,
            expires=timedelta(hours=expires_hours),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate URL: {str(e)}")

    # Get annotation data
    annotation_data = None
    annotation = session.exec(
        select(Annotation).where(Annotation.sample_id == sample.id)
    ).first()
    if annotation:
        annotation_data = SamplePreviewAnnotation(
            objects=annotation.objects,
            class_counts=annotation.class_counts,
            image_width=annotation.image_width,
            image_height=annotation.image_height,
        )

    # Get tags
    tags_query = (
        select(Tag)
        .join(SampleTag)
        .where(SampleTag.sample_id == sample.id)
    )
    tags = session.exec(tags_query).all()

    return SamplePreviewResponse(
        presigned_url=presigned_url,
        expires_in=expires_hours * 3600,
        annotation=annotation_data,
        tags=tags,
        sample=SamplePublic(**sample.model_dump()),
    )


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
