"""Tests for sampling service."""

import uuid
from collections.abc import Generator
from datetime import date, datetime

import pytest
from sqlmodel import Session, select

from app.core.db import engine
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
from app.services.sampling_service import (
    build_sample_filter_query,
    random_sample,
    sample_by_class_targets,
    SamplingResult,
)


@pytest.fixture(scope="module")
def db() -> Generator[Session, None, None]:
    """Override the parent conftest db fixture to provide a real database session."""
    with Session(engine) as session:
        yield session


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
