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
