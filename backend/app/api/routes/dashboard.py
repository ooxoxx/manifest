"""Dashboard API routes."""

from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    DailyStats,
    DashboardOverview,
    Dataset,
    MinIOInstance,
    Sample,
    SampleStatus,
    SampleTag,
    Tag,
    TagDistribution,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=DashboardOverview)
def get_dashboard_overview(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Get dashboard overview statistics."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    # Total samples
    total_samples = session.exec(
        select(func.count()).select_from(Sample).where(
            Sample.owner_id == current_user.id,
            Sample.status == SampleStatus.active,
        )
    ).one()

    # Total datasets
    total_datasets = session.exec(
        select(func.count()).select_from(Dataset).where(
            Dataset.owner_id == current_user.id
        )
    ).one()

    # Total tags
    total_tags = session.exec(
        select(func.count()).select_from(Tag).where(
            Tag.owner_id == current_user.id
        )
    ).one()

    # Total MinIO instances
    total_minio = session.exec(
        select(func.count()).select_from(MinIOInstance).where(
            MinIOInstance.owner_id == current_user.id
        )
    ).one()

    # Samples today
    samples_today = session.exec(
        select(func.count()).select_from(Sample).where(
            Sample.owner_id == current_user.id,
            Sample.created_at >= today_start,
        )
    ).one()

    # Samples this week
    samples_week = session.exec(
        select(func.count()).select_from(Sample).where(
            Sample.owner_id == current_user.id,
            Sample.created_at >= week_start,
        )
    ).one()

    return DashboardOverview(
        total_samples=total_samples,
        total_datasets=total_datasets,
        total_tags=total_tags,
        total_minio_instances=total_minio,
        samples_today=samples_today,
        samples_this_week=samples_week,
    )


@router.get("/daily-stats", response_model=list[DailyStats])
def get_daily_stats(
    session: SessionDep,
    current_user: CurrentUser,
    days: int = 30,
) -> Any:
    """Get daily sample statistics."""
    now = datetime.utcnow()
    start_date = now - timedelta(days=days)

    # Get samples grouped by date
    samples = session.exec(
        select(Sample).where(
            Sample.owner_id == current_user.id,
            Sample.created_at >= start_date,
        )
    ).all()

    # Group by date
    date_counts: dict[str, int] = {}
    for sample in samples:
        date_str = sample.created_at.strftime("%Y-%m-%d")
        date_counts[date_str] = date_counts.get(date_str, 0) + 1

    # Fill missing dates
    result = []
    for i in range(days):
        date = (now - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        result.append(DailyStats(date=date, count=date_counts.get(date, 0)))

    return result


@router.get("/tag-distribution", response_model=list[TagDistribution])
def get_tag_distribution(
    session: SessionDep,
    current_user: CurrentUser,
    limit: int = 10,
) -> Any:
    """Get tag distribution statistics."""
    tags = session.exec(
        select(Tag).where(Tag.owner_id == current_user.id)
    ).all()

    result = []
    for tag in tags:
        count = session.exec(
            select(func.count()).select_from(SampleTag).where(
                SampleTag.tag_id == tag.id
            )
        ).one()
        result.append(TagDistribution(
            tag_id=tag.id,
            tag_name=tag.name,
            count=count,
        ))

    # Sort by count and limit
    result.sort(key=lambda x: x.count, reverse=True)
    return result[:limit]
