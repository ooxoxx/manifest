"""Datasets API routes."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Annotation,
    ClassStat,
    ClassStatsResponse,
    Dataset,
    DatasetAddSamplesRequest,
    DatasetBuildRequest,
    DatasetCreate,
    DatasetPublic,
    DatasetSample,
    DatasetSamplesRequest,
    DatasetsPublic,
    DatasetUpdate,
    FilterParams,
    Message,
    Sample,
    SamplesPublic,
    SampleStatus,
    SampleTag,
    SamplingConfig,
    SamplingMode,
    SamplingResultResponse,
)
from app.services.sampling_service import (
    SamplingResult,
    build_sample_filter_query,
    random_sample,
    sample_by_class_targets,
)

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.get("/", response_model=DatasetsPublic)
def read_datasets(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Retrieve datasets."""
    count_query = (
        select(func.count())
        .select_from(Dataset)
        .where(Dataset.owner_id == current_user.id)
    )
    count = session.exec(count_query).one()

    query = (
        select(Dataset)
        .where(Dataset.owner_id == current_user.id)
        .order_by(col(Dataset.created_at).desc())
        .offset(skip)
        .limit(limit)
    )
    datasets = session.exec(query).all()

    return DatasetsPublic(data=datasets, count=count)


@router.post("/filter-preview")
def filter_preview(
    session: SessionDep,
    current_user: CurrentUser,
    filters: FilterParams,
    skip: int = 0,
    limit: int = 20,
) -> dict:
    """Preview samples matching filter criteria."""
    query = build_sample_filter_query(filters)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = session.exec(count_query).one()

    # Get paginated samples
    samples = session.exec(query.offset(skip).limit(limit)).all()

    return {"count": total, "samples": samples}


@router.post("/filter-class-stats", response_model=ClassStatsResponse)
def filter_class_stats(
    session: SessionDep,
    current_user: CurrentUser,
    filters: FilterParams,
) -> ClassStatsResponse:
    """Get class statistics for samples matching filter criteria."""
    query = build_sample_filter_query(filters)

    # Get all samples matching the filter
    samples = session.exec(query).all()
    sample_ids = [s.id for s in samples]

    if not sample_ids:
        return ClassStatsResponse(classes=[], total_samples=0, total_objects=0)

    # Get annotations for these samples
    annotations = session.exec(
        select(Annotation).where(col(Annotation.sample_id).in_(sample_ids))
    ).all()

    # Aggregate class counts
    class_counts: dict[str, int] = {}
    total_objects = 0
    for ann in annotations:
        if ann.class_counts:
            for cls_name, count in ann.class_counts.items():
                class_counts[cls_name] = class_counts.get(cls_name, 0) + count
                total_objects += count

    # Sort by count descending
    sorted_classes = sorted(class_counts.items(), key=lambda x: x[1], reverse=True)
    classes = [ClassStat(name=name, count=count) for name, count in sorted_classes]

    return ClassStatsResponse(
        classes=classes,
        total_samples=len(sample_ids),
        total_objects=total_objects,
    )


@router.post("/build")
def build_new_dataset(
    session: SessionDep,
    current_user: CurrentUser,
    request: DatasetBuildRequest,
) -> dict:
    """Create a new dataset with filtered and sampled data."""
    # Create the dataset
    dataset = Dataset(
        name=request.name,
        description=request.description,
        owner_id=current_user.id,
    )
    session.add(dataset)
    session.flush()

    # Get filtered candidates
    query = build_sample_filter_query(request.filters)
    candidates = session.exec(query).all()

    # Apply sampling
    result = _apply_sampling(candidates, request.sampling)

    # Add samples to dataset
    for sample in result.selected_samples:
        ds = DatasetSample(dataset_id=dataset.id, sample_id=sample.id)
        session.add(ds)

    dataset.sample_count = result.total_selected
    session.commit()
    session.refresh(dataset)

    return {
        "dataset": dataset,
        "result": SamplingResultResponse(
            added_count=result.total_selected,
            mode=request.sampling.mode,
            target_achievement={
                k: {"target": v.target, "actual": v.actual, "status": v.status}
                for k, v in result.target_achievement.items()
            } if result.target_achievement else None,
        ),
    }


@router.post("/{dataset_id}/add-samples")
def add_filtered_samples_to_dataset(
    session: SessionDep,
    current_user: CurrentUser,
    dataset_id: uuid.UUID,
    request: DatasetAddSamplesRequest,
) -> dict:
    """Add samples to an existing dataset using filters and sampling."""
    dataset = session.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if dataset.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get filtered candidates
    query = build_sample_filter_query(request.filters)
    candidates = session.exec(query).all()

    # Exclude already-added samples
    existing_ids = set(
        session.exec(
            select(DatasetSample.sample_id).where(
                DatasetSample.dataset_id == dataset_id
            )
        ).all()
    )
    candidates = [s for s in candidates if s.id not in existing_ids]

    # Apply sampling
    result = _apply_sampling(candidates, request.sampling)

    # Add samples to dataset
    for sample in result.selected_samples:
        ds = DatasetSample(dataset_id=dataset.id, sample_id=sample.id)
        session.add(ds)

    dataset.sample_count = (dataset.sample_count or 0) + result.total_selected
    session.commit()
    session.refresh(dataset)

    return {
        "dataset": dataset,
        "result": SamplingResultResponse(
            added_count=result.total_selected,
            mode=request.sampling.mode,
            target_achievement={
                k: {"target": v.target, "actual": v.actual, "status": v.status}
                for k, v in result.target_achievement.items()
            } if result.target_achievement else None,
        ),
    }


def _apply_sampling(candidates: list, config: SamplingConfig) -> SamplingResult:
    """Apply sampling strategy to candidates."""
    if config.mode == SamplingMode.all:
        return SamplingResult(
            selected_samples=candidates,
            target_achievement=None,
            total_selected=len(candidates),
        )
    elif config.mode == SamplingMode.random:
        selected = random_sample(candidates, config.count or 0, config.seed)
        return SamplingResult(
            selected_samples=selected,
            target_achievement=None,
            total_selected=len(selected),
        )
    else:  # class_targets
        return sample_by_class_targets(candidates, config.class_targets or {})


@router.post("/", response_model=DatasetPublic)
def create_dataset(
    session: SessionDep,
    current_user: CurrentUser,
    dataset_in: DatasetCreate,
) -> Any:
    """Create a new dataset."""
    dataset = Dataset(
        name=dataset_in.name,
        description=dataset_in.description,
        is_public=dataset_in.is_public,
        owner_id=current_user.id,
    )
    session.add(dataset)
    session.commit()
    session.refresh(dataset)
    return dataset


@router.get("/{id}", response_model=DatasetPublic)
def read_dataset(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Any:
    """Get dataset by ID."""
    dataset = session.get(Dataset, id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.owner_id != current_user.id and not dataset.is_public:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return dataset


@router.get("/{id}/class-stats", response_model=ClassStatsResponse)
def get_dataset_class_stats(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> ClassStatsResponse:
    """Get class statistics for samples in a dataset."""
    dataset = session.get(Dataset, id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.owner_id != current_user.id and not dataset.is_public:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Get all sample IDs in dataset
    sample_ids = list(
        session.exec(
            select(DatasetSample.sample_id).where(DatasetSample.dataset_id == id)
        ).all()
    )

    if not sample_ids:
        return ClassStatsResponse(classes=[], total_samples=0, total_objects=0)

    # Get annotations for these samples
    annotations = session.exec(
        select(Annotation).where(col(Annotation.sample_id).in_(sample_ids))
    ).all()

    # Aggregate class counts
    class_counts: dict[str, int] = {}
    total_objects = 0
    for ann in annotations:
        if ann.class_counts:
            for cls_name, count in ann.class_counts.items():
                class_counts[cls_name] = class_counts.get(cls_name, 0) + count
                total_objects += count

    # Sort by count descending
    sorted_classes = sorted(class_counts.items(), key=lambda x: x[1], reverse=True)
    classes = [ClassStat(name=name, count=count) for name, count in sorted_classes]

    return ClassStatsResponse(
        classes=classes,
        total_samples=len(sample_ids),
        total_objects=total_objects,
    )


@router.get("/{id}/samples", response_model=SamplesPublic)
def get_dataset_samples(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    class_filter: str | None = None,
) -> Any:
    """Get samples in a dataset.

    Args:
        class_filter: Optional class name to filter samples containing that class.
    """
    dataset = session.get(Dataset, id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.owner_id != current_user.id and not dataset.is_public:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Base query for samples in dataset
    base_query = (
        select(Sample)
        .join(DatasetSample, DatasetSample.sample_id == Sample.id)
        .where(DatasetSample.dataset_id == id)
    )

    # Apply class filter if provided
    if class_filter:
        # Join with Annotation and filter by class_counts containing the class
        base_query = base_query.join(
            Annotation, Annotation.sample_id == Sample.id
        ).where(
            Annotation.class_counts.op("??")(class_filter)
        )

    # Count total samples matching the filter
    count_query = select(func.count()).select_from(base_query.subquery())
    count = session.exec(count_query).one()

    # Get samples with pagination
    query = base_query.order_by(col(Sample.created_at).desc()).offset(skip).limit(limit)
    samples = session.exec(query).all()

    return SamplesPublic(data=samples, count=count)


@router.put("/{id}", response_model=DatasetPublic)
def update_dataset(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    dataset_in: DatasetUpdate,
) -> Any:
    """Update a dataset."""
    dataset = session.get(Dataset, id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    update_data = dataset_in.model_dump(exclude_unset=True)
    dataset.sqlmodel_update(update_data)
    dataset.updated_at = datetime.utcnow()
    session.add(dataset)
    session.commit()
    session.refresh(dataset)
    return dataset


@router.delete("/{id}")
def delete_dataset(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Message:
    """Delete a dataset."""
    dataset = session.get(Dataset, id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    session.delete(dataset)
    session.commit()
    return Message(message="Dataset deleted successfully")


@router.post("/{id}/samples")
def add_samples_to_dataset(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    request: DatasetSamplesRequest,
) -> dict:
    """Add samples to dataset."""
    dataset = session.get(Dataset, id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    added = 0
    for sample_id in request.sample_ids:
        sample = session.get(Sample, sample_id)
        if not sample or sample.owner_id != current_user.id:
            continue

        existing = session.exec(
            select(DatasetSample).where(
                DatasetSample.dataset_id == id,
                DatasetSample.sample_id == sample_id,
            )
        ).first()

        if not existing:
            ds = DatasetSample(dataset_id=id, sample_id=sample_id)
            session.add(ds)
            added += 1

    dataset.sample_count += added
    session.add(dataset)
    session.commit()

    return {"added": added}


@router.delete("/{id}/samples")
def remove_samples_from_dataset(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    request: DatasetSamplesRequest,
) -> dict:
    """Remove samples from dataset."""
    dataset = session.get(Dataset, id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    removed = 0
    for sample_id in request.sample_ids:
        ds = session.exec(
            select(DatasetSample).where(
                DatasetSample.dataset_id == id,
                DatasetSample.sample_id == sample_id,
            )
        ).first()

        if ds:
            session.delete(ds)
            removed += 1

    dataset.sample_count = max(0, dataset.sample_count - removed)
    session.add(dataset)
    session.commit()

    return {"removed": removed}


@router.post("/{id}/build")
def build_dataset(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    request: DatasetBuildRequest,
) -> dict:
    """Build dataset from conditions."""
    dataset = session.get(Dataset, id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Build query
    query = select(Sample).where(
        Sample.owner_id == current_user.id,
        Sample.status == SampleStatus.active,
    )

    if request.minio_instance_id:
        query = query.where(Sample.minio_instance_id == request.minio_instance_id)
    if request.bucket:
        query = query.where(Sample.bucket == request.bucket)
    if request.prefix:
        query = query.where(col(Sample.object_key).startswith(request.prefix))
    if request.created_after:
        query = query.where(Sample.created_at >= request.created_after)
    if request.created_before:
        query = query.where(Sample.created_at <= request.created_before)
    if request.tag_ids:
        query = query.join(SampleTag).where(SampleTag.tag_id.in_(request.tag_ids))

    samples = session.exec(query).all()

    added = 0
    for sample in samples:
        existing = session.exec(
            select(DatasetSample).where(
                DatasetSample.dataset_id == id,
                DatasetSample.sample_id == sample.id,
            )
        ).first()

        if not existing:
            ds = DatasetSample(dataset_id=id, sample_id=sample.id)
            session.add(ds)
            added += 1

    dataset.sample_count += added
    session.add(dataset)
    session.commit()

    return {"added": added, "total": dataset.sample_count}
