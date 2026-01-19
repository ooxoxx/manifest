# Phase 4 Dataset Building - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement dataset intelligent building with multi-dimensional filtering and proportional sampling.

**Architecture:** Query builder pattern for filters (service layer returns SQLAlchemy Select), greedy algorithm for class-target sampling, 3-step wizard for new datasets, single page for adding samples.

**Tech Stack:** FastAPI, SQLModel, React, TanStack Query, shadcn/ui

---

## Task 1: Add Data Models

**Files:**
- Modify: `backend/app/models.py`

**Step 1: Write the model definitions**

Add after line ~635 (after SampleHistoryAction):

```python
class SamplingMode(str, Enum):
    """Sampling mode for dataset building."""
    all = "all"
    random = "random"
    class_targets = "class_targets"


class FilterParams(SQLModel):
    """Parameters for filtering samples."""
    tags_include: list[uuid.UUID] | None = None
    tags_exclude: list[uuid.UUID] | None = None
    minio_instance_id: uuid.UUID | None = None
    bucket: str | None = None
    prefix: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    annotation_classes: list[str] | None = None
    object_count_min: int | None = None
    object_count_max: int | None = None
    annotation_status: AnnotationStatus | None = None


class SamplingConfig(SQLModel):
    """Configuration for sampling strategy."""
    mode: SamplingMode = SamplingMode.all
    count: int | None = None
    class_targets: dict[str, int] | None = None
    seed: int | None = None


class ClassAchievement(SQLModel):
    """Achievement status for a single class."""
    target: int
    actual: int
    status: str  # "achieved" | "partial"


class SamplingResultResponse(SQLModel):
    """Response for sampling operations."""
    added_count: int
    mode: SamplingMode
    target_achievement: dict[str, ClassAchievement] | None = None


class DatasetBuildRequest(SQLModel):
    """Request for building a new dataset."""
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    filters: FilterParams
    sampling: SamplingConfig


class DatasetAddSamplesRequest(SQLModel):
    """Request for adding samples to existing dataset."""
    filters: FilterParams
    sampling: SamplingConfig


class FilterPreviewResponse(SQLModel):
    """Response for filter preview."""
    count: int
    samples: list["SamplePublic"]
```

**Step 2: Add import for date**

At top of file, ensure `from datetime import date, datetime` exists.

**Step 3: Verify syntax**

Run: `cd /Users/leo/Development/repo/manifest/.worktrees/feature-mvp-phase4 && docker compose exec backend python -c "from app.models import SamplingMode, FilterParams; print('OK')"`

Expected: `OK`

**Step 4: Commit**

```bash
git add backend/app/models.py
git commit -m "feat: add Phase 4 data models for dataset building"
```

---

## Task 2: Create SamplingService - Query Builder

**Files:**
- Create: `backend/app/services/sampling_service.py`
- Create: `backend/tests/services/test_sampling_service.py`

**Step 1: Write the failing test for query builder**

Create `backend/tests/services/test_sampling_service.py`:

```python
"""Tests for sampling service."""

import uuid
from datetime import date, datetime

import pytest
from sqlmodel import Session, select

from app.models import (
    AnnotationStatus,
    FilterParams,
    MinIOInstance,
    Sample,
    SampleSource,
    SampleStatus,
    SampleTag,
    Tag,
    User,
)
from app.services.sampling_service import build_sample_filter_query


@pytest.fixture
def test_user(db: Session):
    """Create test user."""
    user = User(
        id=uuid.uuid4(),
        email=f"sampling_test_{uuid.uuid4()}@example.com",
        hashed_password="fakehash",
        full_name="Sampling Test User",
        is_superuser=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    yield user
    db.delete(user)
    db.commit()


@pytest.fixture
def test_minio(db: Session, test_user: User):
    """Create test MinIO instance."""
    instance = MinIOInstance(
        id=uuid.uuid4(),
        owner_id=test_user.id,
        name="Test MinIO Sampling",
        endpoint="127.0.0.1:9000",
        access_key_encrypted="encrypted_key",
        secret_key_encrypted="encrypted_secret",
        secure=False,
    )
    db.add(instance)
    db.commit()
    db.refresh(instance)
    yield instance
    db.delete(instance)
    db.commit()


@pytest.fixture
def test_samples(db: Session, test_minio: MinIOInstance):
    """Create test samples."""
    samples = []
    for i in range(5):
        sample = Sample(
            id=uuid.uuid4(),
            minio_instance_id=test_minio.id,
            owner_id=test_minio.owner_id,
            bucket="test-bucket",
            object_key=f"images/sample_{i}.jpg",
            file_name=f"sample_{i}.jpg",
            file_size=1000,
            file_stem=f"sample_{i}",
            source=SampleSource.manual,
            status=SampleStatus.active,
            annotation_status=AnnotationStatus.linked if i % 2 == 0 else AnnotationStatus.none,
            created_at=datetime(2024, 1, i + 1),
        )
        samples.append(sample)
        db.add(sample)
    db.commit()
    yield samples
    for s in samples:
        db.delete(s)
    db.commit()


class TestBuildSampleFilterQuery:
    """Tests for build_sample_filter_query function."""

    def test_returns_all_active_samples_with_empty_filters(
        self, db: Session, test_samples: list[Sample]
    ):
        """Empty filters should return all active samples."""
        filters = FilterParams()
        query = build_sample_filter_query(filters)
        results = db.exec(query).all()

        assert len(results) >= 5

    def test_filters_by_minio_instance(
        self, db: Session, test_samples: list[Sample], test_minio: MinIOInstance
    ):
        """Should filter by MinIO instance ID."""
        filters = FilterParams(minio_instance_id=test_minio.id)
        query = build_sample_filter_query(filters)
        results = db.exec(query).all()

        assert len(results) == 5
        assert all(s.minio_instance_id == test_minio.id for s in results)

    def test_filters_by_bucket(
        self, db: Session, test_samples: list[Sample]
    ):
        """Should filter by bucket name."""
        filters = FilterParams(bucket="test-bucket")
        query = build_sample_filter_query(filters)
        results = db.exec(query).all()

        assert len(results) >= 5
        assert all(s.bucket == "test-bucket" for s in results)

    def test_filters_by_prefix(
        self, db: Session, test_samples: list[Sample]
    ):
        """Should filter by object key prefix."""
        filters = FilterParams(prefix="images/")
        query = build_sample_filter_query(filters)
        results = db.exec(query).all()

        assert all(s.object_key.startswith("images/") for s in results)

    def test_filters_by_annotation_status(
        self, db: Session, test_samples: list[Sample]
    ):
        """Should filter by annotation status."""
        filters = FilterParams(annotation_status=AnnotationStatus.linked)
        query = build_sample_filter_query(filters)
        results = db.exec(query).all()

        assert all(s.annotation_status == AnnotationStatus.linked for s in results)
```

**Step 2: Run test to verify it fails**

Run: `docker compose exec backend pytest tests/services/test_sampling_service.py -v --tb=short`

Expected: FAIL with "cannot import name 'build_sample_filter_query'"

**Step 3: Write minimal implementation**

Create `backend/app/services/sampling_service.py`:

```python
"""Sampling service for dataset building."""

from dataclasses import dataclass
from sqlmodel import Select, select

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
```

**Step 4: Run test to verify it passes**

Run: `docker compose exec backend pytest tests/services/test_sampling_service.py -v --tb=short`

Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add backend/app/services/sampling_service.py backend/tests/services/test_sampling_service.py
git commit -m "feat: add sampling service with query builder"
```

---

## Task 3: Add Sampling Algorithms

**Files:**
- Modify: `backend/app/services/sampling_service.py`
- Modify: `backend/tests/services/test_sampling_service.py`

**Step 1: Write failing tests for sampling algorithms**

Add to `backend/tests/services/test_sampling_service.py`:

```python
from app.services.sampling_service import (
    build_sample_filter_query,
    random_sample,
    sample_by_class_targets,
    SamplingResult,
)


class TestRandomSample:
    """Tests for random_sample function."""

    def test_returns_correct_count(self):
        """Should return exactly the requested count."""
        samples = [f"sample_{i}" for i in range(10)]
        result = random_sample(samples, 5)
        assert len(result) == 5

    def test_returns_all_if_count_exceeds(self):
        """Should return all samples if count exceeds available."""
        samples = [f"sample_{i}" for i in range(3)]
        result = random_sample(samples, 10)
        assert len(result) == 3

    def test_with_seed_is_reproducible(self):
        """Same seed should produce same results."""
        samples = [f"sample_{i}" for i in range(10)]
        result1 = random_sample(samples, 5, seed=42)
        result2 = random_sample(samples, 5, seed=42)
        assert result1 == result2

    def test_different_seeds_produce_different_results(self):
        """Different seeds should produce different results."""
        samples = [f"sample_{i}" for i in range(10)]
        result1 = random_sample(samples, 5, seed=42)
        result2 = random_sample(samples, 5, seed=123)
        assert result1 != result2


class TestSampleByClassTargets:
    """Tests for sample_by_class_targets function."""

    def test_achieves_all_targets(self):
        """Should achieve all targets when possible."""
        # Create mock samples with class_counts
        class MockSample:
            def __init__(self, id, class_counts):
                self.id = id
                self.class_counts = class_counts

        candidates = [
            MockSample(1, {"person": 100, "car": 50}),
            MockSample(2, {"person": 150, "car": 30}),
            MockSample(3, {"person": 80, "car": 100}),
        ]

        targets = {"person": 200, "car": 100}
        result = sample_by_class_targets(candidates, targets)

        assert result.target_achievement["person"].status == "achieved"
        assert result.target_achievement["person"].actual >= 200

    def test_partial_achievement(self):
        """Should report partial when targets cannot be met."""
        class MockSample:
            def __init__(self, id, class_counts):
                self.id = id
                self.class_counts = class_counts

        candidates = [
            MockSample(1, {"person": 10}),
        ]

        targets = {"person": 100}
        result = sample_by_class_targets(candidates, targets)

        assert result.target_achievement["person"].status == "partial"
        assert result.target_achievement["person"].actual == 10

    def test_empty_candidates(self):
        """Should handle empty candidates gracefully."""
        result = sample_by_class_targets([], {"person": 100})

        assert result.total_selected == 0
        assert result.target_achievement["person"].actual == 0
```

**Step 2: Run test to verify it fails**

Run: `docker compose exec backend pytest tests/services/test_sampling_service.py::TestRandomSample -v --tb=short`

Expected: FAIL with "cannot import name 'random_sample'"

**Step 3: Write implementation**

Add to `backend/app/services/sampling_service.py`:

```python
import random
from typing import Any, TypeVar

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
```

**Step 4: Run tests to verify they pass**

Run: `docker compose exec backend pytest tests/services/test_sampling_service.py -v --tb=short`

Expected: PASS (12 tests)

**Step 5: Commit**

```bash
git add backend/app/services/sampling_service.py backend/tests/services/test_sampling_service.py
git commit -m "feat: add random and class-target sampling algorithms"
```

---

## Task 4: Add API Endpoints

**Files:**
- Modify: `backend/app/api/routes/datasets.py`
- Create: `backend/tests/api/routes/test_datasets_build.py`

**Step 1: Write failing tests for API endpoints**

Create `backend/tests/api/routes/test_datasets_build.py`:

```python
"""Tests for dataset building API endpoints."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import (
    AnnotationStatus,
    MinIOInstance,
    Sample,
    SampleSource,
    SampleStatus,
    User,
)


@pytest.fixture
def test_user(db: Session):
    """Create test user."""
    user = User(
        id=uuid.uuid4(),
        email=f"dataset_build_test_{uuid.uuid4()}@example.com",
        hashed_password="fakehash",
        full_name="Dataset Build Test",
        is_superuser=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    yield user
    db.delete(user)
    db.commit()


@pytest.fixture
def test_minio(db: Session, test_user: User):
    """Create test MinIO instance."""
    instance = MinIOInstance(
        id=uuid.uuid4(),
        owner_id=test_user.id,
        name="Test MinIO Build",
        endpoint="127.0.0.1:9000",
        access_key_encrypted="encrypted_key",
        secret_key_encrypted="encrypted_secret",
        secure=False,
    )
    db.add(instance)
    db.commit()
    db.refresh(instance)
    yield instance
    db.delete(instance)
    db.commit()


@pytest.fixture
def test_samples(db: Session, test_minio: MinIOInstance):
    """Create test samples."""
    samples = []
    for i in range(10):
        sample = Sample(
            id=uuid.uuid4(),
            minio_instance_id=test_minio.id,
            owner_id=test_minio.owner_id,
            bucket="test-bucket",
            object_key=f"images/build_sample_{i}.jpg",
            file_name=f"build_sample_{i}.jpg",
            file_size=1000,
            file_stem=f"build_sample_{i}",
            source=SampleSource.manual,
            status=SampleStatus.active,
            annotation_status=AnnotationStatus.none,
        )
        samples.append(sample)
        db.add(sample)
    db.commit()
    yield samples
    for s in samples:
        db.delete(s)
    db.commit()


class TestFilterPreview:
    """Tests for filter preview endpoint."""

    def test_returns_count_and_samples(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_samples: list[Sample],
        test_minio: MinIOInstance,
    ):
        """Should return matching count and sample list."""
        response = client.post(
            "/api/v1/datasets/filter-preview",
            headers=superuser_token_headers,
            json={
                "minio_instance_id": str(test_minio.id),
                "bucket": "test-bucket",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert "samples" in data
        assert data["count"] >= 10


class TestBuildDataset:
    """Tests for dataset build endpoint."""

    def test_creates_dataset_with_all_mode(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_samples: list[Sample],
        test_minio: MinIOInstance,
    ):
        """Should create dataset with all matching samples."""
        response = client.post(
            "/api/v1/datasets/build",
            headers=superuser_token_headers,
            json={
                "name": "Test Build Dataset",
                "description": "Built via API",
                "filters": {
                    "minio_instance_id": str(test_minio.id),
                    "bucket": "test-bucket",
                },
                "sampling": {
                    "mode": "all",
                },
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["dataset"]["name"] == "Test Build Dataset"
        assert data["result"]["added_count"] >= 10
        assert data["result"]["mode"] == "all"

    def test_creates_dataset_with_random_mode(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_samples: list[Sample],
        test_minio: MinIOInstance,
    ):
        """Should create dataset with random sample subset."""
        response = client.post(
            "/api/v1/datasets/build",
            headers=superuser_token_headers,
            json={
                "name": "Test Random Dataset",
                "filters": {
                    "minio_instance_id": str(test_minio.id),
                },
                "sampling": {
                    "mode": "random",
                    "count": 5,
                    "seed": 42,
                },
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["result"]["added_count"] == 5
        assert data["result"]["mode"] == "random"
```

**Step 2: Run tests to verify they fail**

Run: `docker compose exec backend pytest tests/api/routes/test_datasets_build.py -v --tb=short`

Expected: FAIL with 404 (endpoints don't exist)

**Step 3: Write API implementation**

Add to `backend/app/api/routes/datasets.py` (after existing endpoints):

```python
from sqlmodel import func

from app.models import (
    DatasetAddSamplesRequest,
    DatasetBuildRequest,
    DatasetSample,
    FilterParams,
    FilterPreviewResponse,
    SamplingConfig,
    SamplingMode,
    SamplingResultResponse,
)
from app.services.sampling_service import (
    build_sample_filter_query,
    random_sample,
    sample_by_class_targets,
    SamplingResult,
)


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


@router.post("/build")
def build_dataset(
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
def add_samples_to_dataset(
    session: SessionDep,
    current_user: CurrentUser,
    dataset_id: uuid.UUID,
    request: DatasetAddSamplesRequest,
) -> dict:
    """Add samples to an existing dataset."""
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
    from app.services.sampling_service import ClassAchievement

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
```

**Step 4: Run tests to verify they pass**

Run: `docker compose exec backend pytest tests/api/routes/test_datasets_build.py -v --tb=short`

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add backend/app/api/routes/datasets.py backend/tests/api/routes/test_datasets_build.py
git commit -m "feat: add dataset filter-preview, build, and add-samples endpoints"
```

---

## Task 5: Create FilterPanel Component

**Files:**
- Create: `frontend/src/components/Datasets/FilterPanel.tsx`

**Step 1: Create the component**

Create `frontend/src/components/Datasets/FilterPanel.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { MultiSelect } from "@/components/ui/multi-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readTags, readMinioInstances } from "@/client";

export interface FilterParams {
  tags_include?: string[];
  tags_exclude?: string[];
  minio_instance_id?: string;
  bucket?: string;
  prefix?: string;
  date_from?: string;
  date_to?: string;
  annotation_classes?: string[];
  object_count_min?: number;
  object_count_max?: number;
  annotation_status?: "none" | "linked" | "conflict" | "error";
}

interface FilterPanelProps {
  value: FilterParams;
  onChange: (filters: FilterParams) => void;
  onPreview?: () => void;
  previewCount?: number;
  loading?: boolean;
}

export function FilterPanel({
  value,
  onChange,
  onPreview,
  previewCount,
  loading,
}: FilterPanelProps) {
  // Fetch tags for multi-select
  const { data: tagsData } = useQuery({
    queryKey: ["tags"],
    queryFn: () => readTags({ limit: 1000 }),
  });

  // Fetch MinIO instances
  const { data: minioData } = useQuery({
    queryKey: ["minio-instances"],
    queryFn: () => readMinioInstances({ limit: 100 }),
  });

  const tagOptions = useMemo(() => {
    return (tagsData?.data || []).map((tag) => ({
      value: tag.id,
      label: tag.full_path || tag.name,
    }));
  }, [tagsData]);

  const minioOptions = useMemo(() => {
    return (minioData?.data || []).map((instance) => ({
      value: instance.id,
      label: instance.name,
    }));
  }, [minioData]);

  const handleChange = (key: keyof FilterParams, val: any) => {
    onChange({ ...value, [key]: val || undefined });
  };

  const handleReset = () => {
    onChange({});
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">筛选条件</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            重置
          </Button>
          {onPreview && (
            <Button size="sm" onClick={onPreview} disabled={loading}>
              预览
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tags */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>标签（包含）</Label>
            <MultiSelect
              options={tagOptions}
              selected={value.tags_include || []}
              onChange={(val) => handleChange("tags_include", val)}
              placeholder="选择标签..."
            />
          </div>
          <div className="space-y-2">
            <Label>标签（排除）</Label>
            <MultiSelect
              options={tagOptions}
              selected={value.tags_exclude || []}
              onChange={(val) => handleChange("tags_exclude", val)}
              placeholder="选择要排除的标签..."
            />
          </div>
        </div>

        {/* MinIO & Bucket */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>MinIO 实例</Label>
            <Select
              value={value.minio_instance_id || ""}
              onValueChange={(val) => handleChange("minio_instance_id", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择实例" />
              </SelectTrigger>
              <SelectContent>
                {minioOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>桶名</Label>
            <Input
              value={value.bucket || ""}
              onChange={(e) => handleChange("bucket", e.target.value)}
              placeholder="bucket-name"
            />
          </div>
          <div className="space-y-2">
            <Label>路径前缀</Label>
            <Input
              value={value.prefix || ""}
              onChange={(e) => handleChange("prefix", e.target.value)}
              placeholder="images/2024/"
            />
          </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>开始日期</Label>
            <DatePicker
              date={value.date_from ? new Date(value.date_from) : undefined}
              onSelect={(date) =>
                handleChange("date_from", date?.toISOString().split("T")[0])
              }
            />
          </div>
          <div className="space-y-2">
            <Label>结束日期</Label>
            <DatePicker
              date={value.date_to ? new Date(value.date_to) : undefined}
              onSelect={(date) =>
                handleChange("date_to", date?.toISOString().split("T")[0])
              }
            />
          </div>
        </div>

        {/* Annotation Filters */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>目标数量（最小）</Label>
            <Input
              type="number"
              value={value.object_count_min || ""}
              onChange={(e) =>
                handleChange("object_count_min", parseInt(e.target.value) || undefined)
              }
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>目标数量（最大）</Label>
            <Input
              type="number"
              value={value.object_count_max || ""}
              onChange={(e) =>
                handleChange("object_count_max", parseInt(e.target.value) || undefined)
              }
              placeholder="100"
            />
          </div>
          <div className="space-y-2">
            <Label>标注状态</Label>
            <Select
              value={value.annotation_status || ""}
              onValueChange={(val) =>
                handleChange("annotation_status", val || undefined)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="linked">已标注</SelectItem>
                <SelectItem value="none">无标注</SelectItem>
                <SelectItem value="conflict">冲突</SelectItem>
                <SelectItem value="error">错误</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Preview Count */}
        {previewCount !== undefined && (
          <div className="pt-2 border-t text-sm text-muted-foreground">
            匹配样本数: <span className="font-semibold text-foreground">{previewCount.toLocaleString()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Export from index**

Add to `frontend/src/components/Datasets/index.ts` (create if not exists):

```typescript
export { FilterPanel } from "./FilterPanel";
export type { FilterParams } from "./FilterPanel";
```

**Step 3: Verify build**

Run: `cd /Users/leo/Development/repo/manifest/.worktrees/feature-mvp-phase4/frontend && pnpm build 2>&1 | tail -20`

Expected: Build succeeds (may have type errors to fix)

**Step 4: Commit**

```bash
git add frontend/src/components/Datasets/
git commit -m "feat: add FilterPanel component for dataset building"
```

---

## Task 6: Create SamplingConfig Component

**Files:**
- Create: `frontend/src/components/Datasets/SamplingConfig.tsx`

**Step 1: Create the component**

Create `frontend/src/components/Datasets/SamplingConfig.tsx`:

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X } from "lucide-react";

export type SamplingMode = "all" | "random" | "class_targets";

export interface SamplingConfigValue {
  mode: SamplingMode;
  count?: number;
  class_targets?: Record<string, number>;
  seed?: number;
}

interface SamplingConfigProps {
  value: SamplingConfigValue;
  onChange: (config: SamplingConfigValue) => void;
  totalCount: number;
  availableClasses?: Record<string, number>;
}

export function SamplingConfig({
  value,
  onChange,
  totalCount,
  availableClasses,
}: SamplingConfigProps) {
  const [newClassName, setNewClassName] = useState("");

  const handleModeChange = (mode: SamplingMode) => {
    onChange({ ...value, mode });
  };

  const handleCountChange = (count: number) => {
    onChange({ ...value, count });
  };

  const handleClassTargetChange = (className: string, target: number) => {
    const newTargets = { ...(value.class_targets || {}), [className]: target };
    onChange({ ...value, class_targets: newTargets });
  };

  const handleAddClass = () => {
    if (newClassName.trim()) {
      handleClassTargetChange(newClassName.trim(), 100);
      setNewClassName("");
    }
  };

  const handleRemoveClass = (className: string) => {
    const newTargets = { ...(value.class_targets || {}) };
    delete newTargets[className];
    onChange({ ...value, class_targets: newTargets });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">采样模式</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup value={value.mode} onValueChange={handleModeChange}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all" id="mode-all" />
            <Label htmlFor="mode-all">
              全部添加 ({totalCount.toLocaleString()} 个样本)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <RadioGroupItem value="random" id="mode-random" />
            <Label htmlFor="mode-random" className="flex items-center gap-2">
              随机抽取
              {value.mode === "random" && (
                <Input
                  type="number"
                  value={value.count || ""}
                  onChange={(e) => handleCountChange(parseInt(e.target.value) || 0)}
                  className="w-24 h-8"
                  placeholder="数量"
                />
              )}
              个样本
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <RadioGroupItem value="class_targets" id="mode-targets" />
            <Label htmlFor="mode-targets">按类别配比</Label>
          </div>
        </RadioGroup>

        {/* Class Targets Table */}
        {value.mode === "class_targets" && (
          <div className="mt-4 border rounded-lg">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 text-sm font-medium">类别</th>
                  <th className="text-left p-2 text-sm font-medium">目标数量</th>
                  <th className="text-left p-2 text-sm font-medium">当前可用</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(value.class_targets || {}).map(([cls, target]) => (
                  <tr key={cls} className="border-t">
                    <td className="p-2">{cls}</td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={target}
                        onChange={(e) =>
                          handleClassTargetChange(cls, parseInt(e.target.value) || 0)
                        }
                        className="w-24 h-8"
                      />
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {availableClasses?.[cls]?.toLocaleString() || "-"}
                    </td>
                    <td className="p-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRemoveClass(cls)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t">
                  <td className="p-2" colSpan={4}>
                    <div className="flex gap-2">
                      <Input
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        placeholder="添加类别名称..."
                        className="h-8"
                        onKeyDown={(e) => e.key === "Enter" && handleAddClass()}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddClass}
                        disabled={!newClassName.trim()}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        添加
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Export from index**

Update `frontend/src/components/Datasets/index.ts`:

```typescript
export { FilterPanel } from "./FilterPanel";
export type { FilterParams } from "./FilterPanel";
export { SamplingConfig } from "./SamplingConfig";
export type { SamplingConfigValue, SamplingMode } from "./SamplingConfig";
```

**Step 3: Commit**

```bash
git add frontend/src/components/Datasets/
git commit -m "feat: add SamplingConfig component for dataset building"
```

---

## Task 7: Create Dataset Wizard Page

**Files:**
- Create: `frontend/src/routes/_layout/datasets/new.tsx`

**Step 1: Create the wizard page**

Create directory and file `frontend/src/routes/_layout/datasets/new.tsx`:

```tsx
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FilterPanel, FilterParams } from "@/components/Datasets/FilterPanel";
import { SamplingConfig, SamplingConfigValue } from "@/components/Datasets/SamplingConfig";
import { buildDataset, filterPreview } from "@/client";

export const Route = createFileRoute("/_layout/datasets/new")({
  component: DatasetNewWizard,
});

function DatasetNewWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filters, setFilters] = useState<FilterParams>({});
  const [sampling, setSampling] = useState<SamplingConfigValue>({ mode: "all" });
  const [previewCount, setPreviewCount] = useState<number | undefined>();

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: () => filterPreview({ requestBody: filters }),
    onSuccess: (data) => {
      setPreviewCount(data.count);
    },
  });

  // Build mutation
  const buildMutation = useMutation({
    mutationFn: () =>
      buildDataset({
        requestBody: {
          name,
          description,
          filters,
          sampling,
        },
      }),
    onSuccess: (data) => {
      toast({
        title: "数据集创建成功",
        description: `已添加 ${data.result.added_count} 个样本`,
      });
      navigate({ to: "/datasets" });
    },
    onError: (error) => {
      toast({
        title: "创建失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleNext = () => {
    if (step === 2) {
      previewMutation.mutate();
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleCreate = () => {
    buildMutation.mutate();
  };

  return (
    <div className="container max-w-4xl py-6">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            步骤 {step}/3
          </span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">数据集名称 *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：训练集v1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="描述这个数据集的用途..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Filter Samples */}
      {step === 2 && (
        <FilterPanel
          value={filters}
          onChange={setFilters}
          onPreview={() => previewMutation.mutate()}
          previewCount={previewCount}
          loading={previewMutation.isPending}
        />
      )}

      {/* Step 3: Confirm & Sampling */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>确认创建</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                <div className="flex">
                  <dt className="w-24 text-muted-foreground">名称:</dt>
                  <dd className="font-medium">{name}</dd>
                </div>
                {description && (
                  <div className="flex">
                    <dt className="w-24 text-muted-foreground">描述:</dt>
                    <dd>{description}</dd>
                  </div>
                )}
                <div className="flex">
                  <dt className="w-24 text-muted-foreground">匹配样本:</dt>
                  <dd className="font-medium">{previewCount?.toLocaleString() || "-"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <SamplingConfig
            value={sampling}
            onChange={setSampling}
            totalCount={previewCount || 0}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between mt-6">
        <div>
          {step > 1 && (
            <Button variant="outline" onClick={handleBack}>
              上一步
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/datasets" })}>
            取消
          </Button>
          {step < 3 ? (
            <Button onClick={handleNext} disabled={step === 1 && !name.trim()}>
              下一步
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={buildMutation.isPending}>
              {buildMutation.isPending ? "创建中..." : "创建数据集"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/leo/Development/repo/manifest/.worktrees/feature-mvp-phase4/frontend && pnpm build 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add frontend/src/routes/_layout/datasets/
git commit -m "feat: add dataset creation wizard page"
```

---

## Task 8: Create Add Samples Page

**Files:**
- Create: `frontend/src/routes/_layout/datasets/$id.add.tsx`

**Step 1: Create the page**

Create `frontend/src/routes/_layout/datasets/$id.add.tsx`:

```tsx
import { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FilterPanel, FilterParams } from "@/components/Datasets/FilterPanel";
import { SamplingConfig, SamplingConfigValue } from "@/components/Datasets/SamplingConfig";
import { readDataset, filterPreview, addSamplesToDataset } from "@/client";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_layout/datasets/$id/add")({
  component: DatasetAddSamples,
});

function DatasetAddSamples() {
  const { id } = useParams({ from: "/_layout/datasets/$id/add" });
  const navigate = useNavigate();
  const { toast } = useToast();

  const [filters, setFilters] = useState<FilterParams>({});
  const [sampling, setSampling] = useState<SamplingConfigValue>({ mode: "all" });
  const [previewCount, setPreviewCount] = useState<number | undefined>();

  // Fetch dataset info
  const { data: dataset } = useQuery({
    queryKey: ["dataset", id],
    queryFn: () => readDataset({ id }),
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: () => filterPreview({ requestBody: filters }),
    onSuccess: (data) => {
      setPreviewCount(data.count);
    },
  });

  // Add samples mutation
  const addMutation = useMutation({
    mutationFn: () =>
      addSamplesToDataset({
        datasetId: id,
        requestBody: {
          filters,
          sampling,
        },
      }),
    onSuccess: (data) => {
      toast({
        title: "样本添加成功",
        description: `已添加 ${data.result.added_count} 个样本`,
      });
      navigate({ to: "/datasets" });
    },
    onError: (error) => {
      toast({
        title: "添加失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    addMutation.mutate();
  };

  const estimatedTotal = (dataset?.sample_count || 0) + (
    sampling.mode === "all" ? (previewCount || 0) :
    sampling.mode === "random" ? (sampling.count || 0) :
    (previewCount || 0)  // For class_targets, estimate conservatively
  );

  return (
    <div className="container max-w-4xl py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/datasets" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">添加样本</h1>
          <p className="text-muted-foreground">
            为数据集 "{dataset?.name}" 添加样本
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Filter Panel */}
        <FilterPanel
          value={filters}
          onChange={setFilters}
          onPreview={() => previewMutation.mutate()}
          previewCount={previewCount}
          loading={previewMutation.isPending}
        />

        {/* Sampling Config */}
        <SamplingConfig
          value={sampling}
          onChange={setSampling}
          totalCount={previewCount || 0}
        />

        {/* Summary */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="text-muted-foreground">当前数据集: </span>
                <span className="font-medium">{dataset?.sample_count || 0} 样本</span>
                <span className="mx-2">→</span>
                <span className="text-muted-foreground">添加后预计: </span>
                <span className="font-medium">{estimatedTotal.toLocaleString()} 样本</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/datasets" })}
                >
                  取消
                </Button>
                <Button onClick={handleAdd} disabled={addMutation.isPending}>
                  {addMutation.isPending ? "添加中..." : "添加样本"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/routes/_layout/datasets/
git commit -m "feat: add samples to dataset page"
```

---

## Task 9: Update Datasets List Page

**Files:**
- Modify: `frontend/src/routes/_layout/datasets.tsx`

**Step 1: Add "新建数据集" button linking to wizard**

Update button in the datasets list page to link to `/datasets/new`:

```tsx
// Find the "Create Dataset" or "AddDataset" button and change it to:
<Button onClick={() => navigate({ to: "/datasets/new" })}>
  新建数据集
</Button>
```

**Step 2: Add "添加样本" action to table columns**

Update `frontend/src/components/Datasets/columns.tsx` to add an action:

```tsx
// Add to the actions column:
<DropdownMenuItem onClick={() => navigate({ to: `/datasets/${row.original.id}/add` })}>
  添加样本
</DropdownMenuItem>
```

**Step 3: Commit**

```bash
git add frontend/src/routes/_layout/datasets.tsx frontend/src/components/Datasets/columns.tsx
git commit -m "feat: update datasets page with links to new wizard and add samples"
```

---

## Task 10: E2E Tests

**Files:**
- Create: `frontend/tests/datasets-build.spec.ts`

**Step 1: Create E2E test file**

Create `frontend/tests/datasets-build.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Dataset Building", () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@example.com");
    await page.getByLabel("Password").fill("changethis");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/");
  });

  test("create dataset wizard completes all steps", async ({ page }) => {
    await page.goto("/datasets");
    await page.getByRole("button", { name: "新建数据集" }).click();

    // Step 1: Basic info
    await expect(page.getByText("步骤 1/3")).toBeVisible();
    await page.getByLabel("数据集名称").fill("E2E Test Dataset");
    await page.getByRole("button", { name: "下一步" }).click();

    // Step 2: Filters
    await expect(page.getByText("步骤 2/3")).toBeVisible();
    await page.getByRole("button", { name: "下一步" }).click();

    // Step 3: Confirm
    await expect(page.getByText("步骤 3/3")).toBeVisible();
    await expect(page.getByText("E2E Test Dataset")).toBeVisible();
    await page.getByRole("button", { name: "创建数据集" }).click();

    // Should redirect to datasets list
    await expect(page).toHaveURL("/datasets");
  });

  test("filter panel updates preview count", async ({ page }) => {
    await page.goto("/datasets/new");
    await page.getByLabel("数据集名称").fill("Filter Test");
    await page.getByRole("button", { name: "下一步" }).click();

    // Click preview
    await page.getByRole("button", { name: "预览" }).click();

    // Should show count
    await expect(page.getByText(/匹配样本数:/)).toBeVisible();
  });
});
```

**Step 2: Commit**

```bash
git add frontend/tests/datasets-build.spec.ts
git commit -m "test: add E2E tests for dataset building"
```

---

## Final: Verify All Tests Pass

**Run backend tests:**
```bash
docker compose exec backend pytest tests/services/test_sampling_service.py tests/api/routes/test_datasets_build.py -v
```

**Run frontend build:**
```bash
cd frontend && pnpm build
```

**Run E2E tests:**
```bash
cd frontend && npx playwright test tests/datasets-build.spec.ts
```

---

**Summary of commits:**
1. `feat: add Phase 4 data models for dataset building`
2. `feat: add sampling service with query builder`
3. `feat: add random and class-target sampling algorithms`
4. `feat: add dataset filter-preview, build, and add-samples endpoints`
5. `feat: add FilterPanel component for dataset building`
6. `feat: add SamplingConfig component for dataset building`
7. `feat: add dataset creation wizard page`
8. `feat: add samples to dataset page`
9. `feat: update datasets page with links to new wizard and add samples`
10. `test: add E2E tests for dataset building`
