"""Tests for Samples Import API endpoints."""

import uuid
from io import BytesIO

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import ImportTask, MinIOInstance, Sample


def test_preview_import_csv_requires_authentication(client: TestClient) -> None:
    """Preview endpoint should require authentication."""
    csv_content = b"object_key,tags\nimages/sample.jpg,tag1\n"
    files = {"file": ("test.csv", BytesIO(csv_content), "text/csv")}

    r = client.post(f"{settings.API_V1_STR}/samples/import/preview", files=files)

    assert r.status_code == 401


def test_preview_import_csv_rejects_non_csv_file(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    """Preview should reject non-CSV files."""
    content = b"some content"
    files = {"file": ("test.txt", BytesIO(content), "text/plain")}

    r = client.post(
        f"{settings.API_V1_STR}/samples/import/preview",
        headers=superuser_token_headers,
        files=files,
    )

    assert r.status_code == 400
    assert "CSV" in r.json()["detail"]


def test_preview_import_csv_returns_preview_data(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    """Preview should return CSV analysis data."""
    csv_content = b"""object_key,tags
images/2024/sample001.jpg,"cat/persian,trained"
images/2024/sample002.png,dog
labels/sample001.xml,
"""
    files = {"file": ("test.csv", BytesIO(csv_content), "text/csv")}

    r = client.post(
        f"{settings.API_V1_STR}/samples/import/preview",
        headers=superuser_token_headers,
        files=files,
    )

    assert r.status_code == 200
    data = r.json()
    assert data["total_rows"] == 3
    assert "object_key" in data["columns"]
    assert "tags" in data["columns"]
    assert data["has_tags_column"] is True
    assert data["image_count"] == 2
    assert data["annotation_count"] == 1
    assert len(data["sample_rows"]) <= 5


def test_preview_import_csv_handles_empty_csv(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    """Preview should handle empty CSV with only headers."""
    csv_content = b"object_key,tags\n"
    files = {"file": ("test.csv", BytesIO(csv_content), "text/csv")}

    r = client.post(
        f"{settings.API_V1_STR}/samples/import/preview",
        headers=superuser_token_headers,
        files=files,
    )

    assert r.status_code == 200
    data = r.json()
    assert data["total_rows"] == 0
    assert data["image_count"] == 0


def test_import_requires_authentication(client: TestClient) -> None:
    """Import endpoint should require authentication."""
    csv_content = b"object_key\nimages/sample.jpg\n"
    files = {"file": ("test.csv", BytesIO(csv_content), "text/csv")}
    data = {"minio_instance_id": str(uuid.uuid4()), "bucket": "test-bucket"}

    r = client.post(f"{settings.API_V1_STR}/samples/import", files=files, data=data)

    assert r.status_code == 401


def test_import_rejects_non_csv_file(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    """Import should reject non-CSV files."""
    content = b"some content"
    files = {"file": ("test.txt", BytesIO(content), "text/plain")}
    data = {"minio_instance_id": str(uuid.uuid4()), "bucket": "test-bucket"}

    r = client.post(
        f"{settings.API_V1_STR}/samples/import",
        headers=superuser_token_headers,
        files=files,
        data=data,
    )

    assert r.status_code == 400
    assert "CSV" in r.json()["detail"]


def test_import_rejects_invalid_minio_instance(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    """Import should reject unknown MinIO instance ID."""
    csv_content = b"object_key\nimages/sample.jpg\n"
    files = {"file": ("test.csv", BytesIO(csv_content), "text/csv")}
    data = {"minio_instance_id": str(uuid.uuid4()), "bucket": "test-bucket"}

    r = client.post(
        f"{settings.API_V1_STR}/samples/import",
        headers=superuser_token_headers,
        files=files,
        data=data,
    )

    assert r.status_code == 404
    assert "MinIO instance not found" in r.json()["detail"]


def test_get_import_status_requires_authentication(client: TestClient) -> None:
    """Get import status should require authentication."""
    task_id = uuid.uuid4()
    r = client.get(f"{settings.API_V1_STR}/samples/import/{task_id}")
    assert r.status_code == 401


def test_get_import_status_returns_404_for_unknown_task(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    """Get import status should return 404 for unknown task."""
    task_id = uuid.uuid4()
    r = client.get(
        f"{settings.API_V1_STR}/samples/import/{task_id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_list_import_tasks_requires_authentication(client: TestClient) -> None:
    """List import tasks should require authentication."""
    r = client.get(f"{settings.API_V1_STR}/samples/import")
    assert r.status_code == 401


def test_list_import_tasks_returns_empty_list(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    """List import tasks should return empty list when no tasks exist."""
    r = client.get(
        f"{settings.API_V1_STR}/samples/import",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


# =============================================================================
# Integration tests with MinIO (requires MinIO instance setup)
# =============================================================================


def test_import_creates_task_record(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    """Import should create an ImportTask record even if import fails."""
    from app.core.encryption import encrypt_value

    # Create a test MinIO instance (without real connection)
    # Get user ID from token
    r = client.get(
        f"{settings.API_V1_STR}/users/me", headers=superuser_token_headers
    )
    user_id = uuid.UUID(r.json()["id"])

    minio_instance = MinIOInstance(
        name="test-minio",
        endpoint="127.0.0.1:9000",
        access_key_encrypted=encrypt_value("test-key"),
        secret_key_encrypted=encrypt_value("test-secret"),
        secure=False,
        owner_id=user_id,
    )
    db.add(minio_instance)
    db.commit()
    db.refresh(minio_instance)

    csv_content = b"object_key\nimages/nonexistent.jpg\n"
    files = {"file": ("test.csv", BytesIO(csv_content), "text/csv")}
    data = {
        "minio_instance_id": str(minio_instance.id),
        "bucket": "test-bucket",
        "validate_files": "false",  # Skip file validation
    }

    r = client.post(
        f"{settings.API_V1_STR}/samples/import",
        headers=superuser_token_headers,
        files=files,
        data=data,
    )

    # Import should complete (might fail due to bucket not existing, but task is created)
    assert r.status_code == 200
    task_data = r.json()
    assert "id" in task_data
    assert task_data["total_rows"] == 1

    # Verify task exists in database
    task = db.get(ImportTask, uuid.UUID(task_data["id"]))
    assert task is not None
    assert task.owner_id == user_id

    # Cleanup
    db.delete(minio_instance)
    if task:
        db.delete(task)
    db.commit()


def test_import_task_can_be_retrieved_after_creation(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    """Created import task should be retrievable via GET endpoint."""
    from app.core.encryption import encrypt_value

    # Get user ID from token
    r = client.get(
        f"{settings.API_V1_STR}/users/me", headers=superuser_token_headers
    )
    user_id = uuid.UUID(r.json()["id"])

    minio_instance = MinIOInstance(
        name="test-minio-2",
        endpoint="127.0.0.1:9000",
        access_key_encrypted=encrypt_value("test-key"),
        secret_key_encrypted=encrypt_value("test-secret"),
        secure=False,
        owner_id=user_id,
    )
    db.add(minio_instance)
    db.commit()
    db.refresh(minio_instance)

    csv_content = b"object_key\nimages/test.jpg\n"
    files = {"file": ("test.csv", BytesIO(csv_content), "text/csv")}
    data = {
        "minio_instance_id": str(minio_instance.id),
        "bucket": "test-bucket",
        "validate_files": "false",
    }

    # Create import task
    r = client.post(
        f"{settings.API_V1_STR}/samples/import",
        headers=superuser_token_headers,
        files=files,
        data=data,
    )
    assert r.status_code == 200
    task_id = r.json()["id"]

    # Retrieve task
    r = client.get(
        f"{settings.API_V1_STR}/samples/import/{task_id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    task_data = r.json()
    assert task_data["id"] == task_id

    # Cleanup
    task = db.get(ImportTask, uuid.UUID(task_id))
    if task:
        db.delete(task)
    db.delete(minio_instance)
    db.commit()


def test_import_task_appears_in_list(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    """Created import task should appear in task list."""
    from app.core.encryption import encrypt_value

    # Get user ID from token
    r = client.get(
        f"{settings.API_V1_STR}/users/me", headers=superuser_token_headers
    )
    user_id = uuid.UUID(r.json()["id"])

    minio_instance = MinIOInstance(
        name="test-minio-3",
        endpoint="127.0.0.1:9000",
        access_key_encrypted=encrypt_value("test-key"),
        secret_key_encrypted=encrypt_value("test-secret"),
        secure=False,
        owner_id=user_id,
    )
    db.add(minio_instance)
    db.commit()
    db.refresh(minio_instance)

    csv_content = b"object_key\nimages/test.jpg\n"
    files = {"file": ("test.csv", BytesIO(csv_content), "text/csv")}
    data = {
        "minio_instance_id": str(minio_instance.id),
        "bucket": "test-bucket",
        "validate_files": "false",
    }

    # Create import task
    r = client.post(
        f"{settings.API_V1_STR}/samples/import",
        headers=superuser_token_headers,
        files=files,
        data=data,
    )
    assert r.status_code == 200
    task_id = r.json()["id"]

    # List tasks
    r = client.get(
        f"{settings.API_V1_STR}/samples/import",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    tasks = r.json()
    task_ids = [t["id"] for t in tasks]
    assert task_id in task_ids

    # Cleanup
    task = db.get(ImportTask, uuid.UUID(task_id))
    if task:
        db.delete(task)
    db.delete(minio_instance)
    db.commit()


def test_import_task_not_accessible_by_other_user(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    normal_user_token_headers: dict[str, str],
    db: Session,
) -> None:
    """Import task created by one user should not be accessible by another."""
    from app.core.encryption import encrypt_value

    # Get superuser ID
    r = client.get(
        f"{settings.API_V1_STR}/users/me", headers=superuser_token_headers
    )
    superuser_id = uuid.UUID(r.json()["id"])

    minio_instance = MinIOInstance(
        name="test-minio-4",
        endpoint="127.0.0.1:9000",
        access_key_encrypted=encrypt_value("test-key"),
        secret_key_encrypted=encrypt_value("test-secret"),
        secure=False,
        owner_id=superuser_id,
    )
    db.add(minio_instance)
    db.commit()
    db.refresh(minio_instance)

    csv_content = b"object_key\nimages/test.jpg\n"
    files = {"file": ("test.csv", BytesIO(csv_content), "text/csv")}
    data = {
        "minio_instance_id": str(minio_instance.id),
        "bucket": "test-bucket",
        "validate_files": "false",
    }

    # Create import task as superuser
    r = client.post(
        f"{settings.API_V1_STR}/samples/import",
        headers=superuser_token_headers,
        files=files,
        data=data,
    )
    assert r.status_code == 200
    task_id = r.json()["id"]

    # Try to access as normal user
    r = client.get(
        f"{settings.API_V1_STR}/samples/import/{task_id}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403

    # Cleanup
    task = db.get(ImportTask, uuid.UUID(task_id))
    if task:
        db.delete(task)
    db.delete(minio_instance)
    db.commit()
