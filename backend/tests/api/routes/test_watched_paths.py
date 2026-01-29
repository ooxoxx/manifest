"""Tests for WatchedPath API routes."""

import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import (
    MinIOInstance,
    Sample,
    SampleSource,
    SampleStatus,
    User,
    WatchedPath,
)


@pytest.fixture
def test_user(db: Session):
    """Create a test user for watched paths."""
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email=f"watched_path_test_{user_id}@example.com",
        hashed_password="fakehash",
        full_name="Watched Path Test User",
        is_superuser=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    yield user
    # Cleanup
    db.delete(user)
    db.commit()


@pytest.fixture
def test_minio_instance(db: Session, test_user: User):
    """Create a test MinIO instance."""
    instance = MinIOInstance(
        id=uuid.uuid4(),
        owner_id=test_user.id,
        name="Test MinIO WatchedPath",
        endpoint="127.0.0.1:9000",
        access_key_encrypted="encrypted_minioadmin",
        secret_key_encrypted="encrypted_minioadmin",
        secure=False,
    )
    db.add(instance)
    db.commit()
    db.refresh(instance)
    yield instance
    # Cleanup
    db.delete(instance)
    db.commit()


@pytest.fixture
def test_watched_path(db: Session, test_minio_instance: MinIOInstance):
    """Create a test watched path."""
    path = WatchedPath(
        id=uuid.uuid4(),
        minio_instance_id=test_minio_instance.id,
        bucket="test-bucket",
        prefix="images/",
        description="Test watched path",
        is_active=True,
    )
    db.add(path)
    db.commit()
    db.refresh(path)
    yield path
    # Cleanup
    db.delete(path)
    db.commit()


# =============================================================================
# WatchedPath CRUD Tests
# =============================================================================


class TestWatchedPathCRUD:
    """Tests for WatchedPath CRUD operations."""

    @patch("app.api.routes.watched_paths.NotificationService.configure_bucket_notification")
    def test_create_watched_path_success(
        self,
        mock_configure: patch,
        client: TestClient,
        db: Session,
        test_user: User,
        test_minio_instance: MinIOInstance,
        superuser_token_headers: dict[str, str],
    ):
        """Creating a watched path should succeed and configure notification."""
        mock_configure.return_value = True

        response = client.post(
            "/api/v1/watched-paths/",
            headers=superuser_token_headers,
            json={
                "minio_instance_id": str(test_minio_instance.id),
                "bucket": "test-bucket",
                "prefix": "train/images/",
                "description": "Training images",
                "is_active": True,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["bucket"] == "test-bucket"
        assert data["prefix"] == "train/images/"
        assert data["description"] == "Training images"
        assert data["is_active"] is True
        assert "id" in data

        # Verify notification was configured
        mock_configure.assert_called_once()

        # Cleanup
        created_path = db.get(WatchedPath, uuid.UUID(data["id"]))
        if created_path:
            db.delete(created_path)
            db.commit()

    def test_create_watched_path_invalid_instance(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
    ):
        """Creating a watched path with invalid instance ID should return 404."""
        response = client.post(
            "/api/v1/watched-paths/",
            headers=superuser_token_headers,
            json={
                "minio_instance_id": str(uuid.uuid4()),
                "bucket": "test-bucket",
                "prefix": "",
            },
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_list_watched_paths(
        self,
        client: TestClient,
        db: Session,
        test_user: User,
        test_watched_path: WatchedPath,
        superuser_token_headers: dict[str, str],
    ):
        """Listing watched paths should return user's paths."""
        response = client.get(
            "/api/v1/watched-paths/",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "count" in data

    def test_list_watched_paths_filter_by_instance(
        self,
        client: TestClient,
        db: Session,
        test_user: User,
        test_minio_instance: MinIOInstance,
        test_watched_path: WatchedPath,
        superuser_token_headers: dict[str, str],
    ):
        """Listing watched paths with instance filter should work."""
        response = client.get(
            f"/api/v1/watched-paths/?minio_instance_id={test_minio_instance.id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "data" in data

    @patch("app.api.routes.watched_paths.NotificationService.remove_bucket_notification")
    def test_delete_watched_path(
        self,
        mock_remove: patch,
        client: TestClient,
        db: Session,
        test_user: User,
        test_minio_instance: MinIOInstance,
        superuser_token_headers: dict[str, str],
    ):
        """Deleting a watched path should succeed and remove notification."""
        mock_remove.return_value = True

        # Create a path to delete
        path = WatchedPath(
            id=uuid.uuid4(),
            minio_instance_id=test_minio_instance.id,
            bucket="test-bucket",
            prefix="to-delete/",
            is_active=True,
        )
        db.add(path)
        db.commit()

        response = client.delete(
            f"/api/v1/watched-paths/{path.id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

        # Verify notification removal was called
        mock_remove.assert_called_once()

    def test_delete_watched_path_not_found(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
    ):
        """Deleting a non-existent watched path should return 404."""
        response = client.delete(
            f"/api/v1/watched-paths/{uuid.uuid4()}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 404


# =============================================================================
# WatchedPath Sync Tests
# =============================================================================


class TestWatchedPathSync:
    """Tests for WatchedPath sync operations."""

    @patch("app.api.routes.watched_paths.MinIOService.list_objects")
    def test_sync_watched_path_creates_samples(
        self,
        mock_list_objects: patch,
        client: TestClient,
        db: Session,
        test_user: User,
        test_minio_instance: MinIOInstance,
        test_watched_path: WatchedPath,
        superuser_token_headers: dict[str, str],
    ):
        """Syncing a watched path should create samples for new objects."""
        mock_list_objects.return_value = [
            {
                "object_key": "images/sample001.jpg",
                "size": 12345,
                "etag": "abc123",
                "content_type": "image/jpeg",
            },
            {
                "object_key": "images/sample002.jpg",
                "size": 23456,
                "etag": "def456",
                "content_type": "image/jpeg",
            },
        ]

        response = client.post(
            f"/api/v1/watched-paths/{test_watched_path.id}/sync",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["created"] == 2
        assert data["skipped"] == 0

        # Cleanup created samples
        from sqlmodel import select
        samples = db.exec(
            select(Sample).where(
                Sample.minio_instance_id == test_minio_instance.id,
                Sample.bucket == "test-bucket",
            )
        ).all()
        for sample in samples:
            db.delete(sample)
        db.commit()

    @patch("app.api.routes.watched_paths.MinIOService.list_objects")
    def test_sync_watched_path_skips_existing(
        self,
        mock_list_objects: patch,
        client: TestClient,
        db: Session,
        test_user: User,
        test_minio_instance: MinIOInstance,
        test_watched_path: WatchedPath,
        superuser_token_headers: dict[str, str],
    ):
        """Syncing should skip samples that already exist."""
        # Create an existing sample
        existing_sample = Sample(
            id=uuid.uuid4(),
            minio_instance_id=test_minio_instance.id,
            owner_id=test_user.id,
            bucket="test-bucket",
            object_key="images/existing.jpg",
            file_name="existing.jpg",
            file_size=1000,
            source=SampleSource.sync,
            status=SampleStatus.active,
        )
        db.add(existing_sample)
        db.commit()

        mock_list_objects.return_value = [
            {
                "object_key": "images/existing.jpg",
                "size": 1000,
                "etag": "existing123",
                "content_type": "image/jpeg",
            },
            {
                "object_key": "images/new.jpg",
                "size": 2000,
                "etag": "new456",
                "content_type": "image/jpeg",
            },
        ]

        response = client.post(
            f"/api/v1/watched-paths/{test_watched_path.id}/sync",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["created"] == 1
        assert data["skipped"] == 1

        # Cleanup
        from sqlmodel import select
        samples = db.exec(
            select(Sample).where(
                Sample.minio_instance_id == test_minio_instance.id,
                Sample.bucket == "test-bucket",
            )
        ).all()
        for sample in samples:
            db.delete(sample)
        db.commit()

    def test_sync_watched_path_not_found(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
    ):
        """Syncing a non-existent watched path should return 404."""
        response = client.post(
            f"/api/v1/watched-paths/{uuid.uuid4()}/sync",
            headers=superuser_token_headers,
        )

        assert response.status_code == 404
