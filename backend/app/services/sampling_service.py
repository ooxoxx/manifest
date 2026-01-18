"""Sampling service for dataset building."""

import random
from dataclasses import dataclass
from typing import Any, TypeVar

from sqlalchemy import Select
from sqlmodel import select

from app.models import (
    Annotation,
    AnnotationStatus,
    FilterParams,
    Sample,
    SampleStatus,
    SampleTag,
)

T = TypeVar("T")


@dataclass
class ClassAchievement:
    """Achievement status for a class target."""
    target: int
    actual: int
    status: str  # "achieved" | "partial"


@dataclass
class SamplingResult:
    """Result of a sampling operation."""
    selected_samples: list[Any]
    target_achievement: dict[str, ClassAchievement] | None
    total_selected: int


def build_sample_filter_query(filters: FilterParams) -> Select:
    """Build a filter query for samples.

    Returns a SQLModel Select object that can be executed by the caller.
    This allows the service to remain session-agnostic.
    """
    query = select(Sample).where(Sample.status == SampleStatus.active)

    if filters.minio_instance_id:
        query = query.where(Sample.minio_instance_id == filters.minio_instance_id)

    if filters.bucket:
        query = query.where(Sample.bucket == filters.bucket)

    if filters.prefix:
        query = query.where(Sample.object_key.startswith(filters.prefix))

    if filters.date_from:
        query = query.where(Sample.created_at >= filters.date_from)

    if filters.date_to:
        query = query.where(Sample.created_at <= filters.date_to)

    if filters.annotation_status:
        query = query.where(Sample.annotation_status == filters.annotation_status)

    if filters.tags_include:
        query = query.join(SampleTag).where(SampleTag.tag_id.in_(filters.tags_include))

    if filters.tags_exclude:
        subq = select(SampleTag.sample_id).where(SampleTag.tag_id.in_(filters.tags_exclude))
        query = query.where(Sample.id.notin_(subq))

    if filters.annotation_classes:
        query = query.join(Annotation).where(
            Annotation.class_counts.has_any(keys=filters.annotation_classes)
        )

    if filters.object_count_min is not None:
        query = query.join(Annotation, isouter=True).where(
            Annotation.object_count >= filters.object_count_min
        )

    if filters.object_count_max is not None:
        query = query.join(Annotation, isouter=True).where(
            Annotation.object_count <= filters.object_count_max
        )

    return query


def random_sample(
    candidates: list[T],
    count: int,
    seed: int | None = None,
) -> list[T]:
    """Randomly sample from candidates.

    Args:
        candidates: List of items to sample from
        count: Number of items to select
        seed: Optional seed for reproducibility

    Returns:
        List of randomly selected items
    """
    if seed is not None:
        random.seed(seed)
    return random.sample(candidates, min(count, len(candidates)))


def sample_by_class_targets(
    candidates: list[Any],
    class_targets: dict[str, int],
) -> SamplingResult:
    """Select samples to achieve class target counts using greedy algorithm.

    Args:
        candidates: List of samples with class_counts attribute
        class_targets: Target count for each class {"person": 1000, "car": 500}

    Returns:
        SamplingResult with selected samples and achievement stats
    """
    if not candidates:
        achievement = {
            cls: ClassAchievement(target=target, actual=0, status="partial")
            for cls, target in class_targets.items()
        }
        return SamplingResult(
            selected_samples=[],
            target_achievement=achievement,
            total_selected=0,
        )

    remaining = class_targets.copy()
    selected = []
    candidate_list = list(candidates)

    def get_class_counts(sample) -> dict[str, int]:
        """Get class counts from sample, handling different structures."""
        if hasattr(sample, "class_counts") and sample.class_counts:
            return sample.class_counts
        if hasattr(sample, "annotation") and sample.annotation:
            return sample.annotation.class_counts or {}
        return {}

    def calculate_score(sample) -> float:
        """Calculate contribution score for a sample."""
        class_counts = get_class_counts(sample)
        if not class_counts:
            return 0.0
        score = 0.0
        for cls, target in remaining.items():
            if target > 0:
                contribution = min(class_counts.get(cls, 0), target)
                score += contribution / target
        return score

    while any(v > 0 for v in remaining.values()) and candidate_list:
        # Sort by score and select best
        candidate_list.sort(key=calculate_score, reverse=True)

        if calculate_score(candidate_list[0]) == 0:
            break  # No more useful candidates

        best = candidate_list.pop(0)
        selected.append(best)

        # Update remaining targets
        class_counts = get_class_counts(best)
        for cls, count in class_counts.items():
            if cls in remaining:
                remaining[cls] = max(0, remaining[cls] - count)

    # Calculate achievement
    achievement = {}
    for cls, target in class_targets.items():
        actual = sum(
            get_class_counts(s).get(cls, 0) for s in selected
        )
        achievement[cls] = ClassAchievement(
            target=target,
            actual=actual,
            status="achieved" if actual >= target else "partial",
        )

    return SamplingResult(
        selected_samples=selected,
        target_achievement=achievement,
        total_selected=len(selected),
    )
