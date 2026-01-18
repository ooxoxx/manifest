"""Sampling service for dataset building."""

from dataclasses import dataclass
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
