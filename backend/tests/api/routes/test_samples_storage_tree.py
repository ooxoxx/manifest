"""Tests for Samples Storage Tree API endpoint."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.core.encryption import encrypt_value
from app.models import MinIOInstance, Sample, SampleStatus, User


def create_test_minio_instance(session: Session, owner_id: uuid.UUID, name: str) -> MinIOInstance:
    """Create a test MinIO instance."""
    instance = MinIOInstance(
        name=name,
        endpoint="minio:9000",
        access_key_encrypted=encrypt_value("test"),
        secret_key_encrypted=encrypt_value("test"),
        secure=False,
        owner_id=owner_id,
    )
    session.add(instance)
    session.commit()
    session.refresh(instance)
    return instance


def create_test_sample(
    session: Session,
    owner_id: uuid.UUID,
    minio_instance_id: uuid.UUID,
    bucket: str,
    object_key: str,
) -> Sample:
    """Create a test sample."""
    sample = Sample(
        object_key=object_key,
        bucket=bucket,
        file_name=object_key.split("/")[-1],
        owner_id=owner_id,
        minio_instance_id=minio_instance_id,
        status=SampleStatus.active,
    )
    session.add(sample)
    session.commit()
    session.refresh(sample)
    return sample


def test_storage_tree_requires_authentication(client: TestClient) -> None:
    """Storage tree endpoint should require authentication."""
    r = client.get(f"{settings.API_V1_STR}/samples/storage-tree")
    assert r.status_code == 401


def test_storage_tree_returns_empty_for_no_samples(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    """Storage tree should return empty list when user has no samples."""
    r = client.get(
        f"{settings.API_V1_STR}/samples/storage-tree",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_storage_tree_returns_instance_bucket_folder_hierarchy(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    """Storage tree should return hierarchical structure: instance > bucket > folders."""
    # Get the superuser
    from app.models import User
    user = db.query(User).filter(User.email == settings.FIRST_SUPERUSER).first()
    assert user is not None

    # Create test MinIO instance
    instance = create_test_minio_instance(db, user.id, "test-storage-instance")

    # Create samples with different paths
    samples_data = [
        ("test-bucket", "images/2024/01/sample1.jpg"),
        ("test-bucket", "images/2024/01/sample2.jpg"),
        ("test-bucket", "images/2024/02/sample3.jpg"),
        ("test-bucket", "labels/sample1.xml"),
        ("other-bucket", "data/file.png"),
    ]

    created_samples = []
    for bucket, object_key in samples_data:
        sample = create_test_sample(db, user.id, instance.id, bucket, object_key)
        created_samples.append(sample)

    try:
        r = client.get(
            f"{settings.API_V1_STR}/samples/storage-tree",
            headers=superuser_token_headers,
        )
        assert r.status_code == 200
        data = r.json()

        # Should have at least one instance node
        assert len(data) >= 1

        # Find our test instance
        test_instance_node = None
        for node in data:
            if node["name"] == "test-storage-instance":
                test_instance_node = node
                break

        assert test_instance_node is not None
        assert test_instance_node["type"] == "instance"
        assert test_instance_node["count"] == 5  # Total samples under this instance

        # Check buckets
        buckets = test_instance_node["children"]
        bucket_names = [b["name"] for b in buckets]
        assert "test-bucket" in bucket_names
        assert "other-bucket" in bucket_names

        # Find test-bucket and check its structure
        test_bucket = next(b for b in buckets if b["name"] == "test-bucket")
        assert test_bucket["type"] == "bucket"
        assert test_bucket["count"] == 4  # 4 samples in test-bucket

        # Check folder structure
        folder_names = [f["name"] for f in test_bucket["children"]]
        assert "images" in folder_names
        assert "labels" in folder_names

    finally:
        # Cleanup
        for sample in created_samples:
            db.delete(sample)
        db.delete(instance)
        db.commit()


def test_storage_tree_node_has_correct_path_for_filtering(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    """Each tree node should have a path field usable for filtering."""
    from app.models import User
    user = db.query(User).filter(User.email == settings.FIRST_SUPERUSER).first()
    assert user is not None

    instance = create_test_minio_instance(db, user.id, "path-test-instance")
    sample = create_test_sample(
        db, user.id, instance.id, "mybucket", "folder/subfolder/file.jpg"
    )

    try:
        r = client.get(
            f"{settings.API_V1_STR}/samples/storage-tree",
            headers=superuser_token_headers,
        )
        assert r.status_code == 200
        data = r.json()

        # Find our instance
        instance_node = next(
            (n for n in data if n["name"] == "path-test-instance"), None
        )
        assert instance_node is not None
        assert "path" in instance_node

        # Check bucket path
        bucket_node = instance_node["children"][0]
        assert bucket_node["name"] == "mybucket"
        assert "path" in bucket_node

        # Check folder path
        folder_node = bucket_node["children"][0]
        assert folder_node["name"] == "folder"
        assert folder_node["type"] == "folder"
        assert "path" in folder_node

    finally:
        db.delete(sample)
        db.delete(instance)
        db.commit()


def test_storage_tree_excludes_deleted_samples(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    """Storage tree should not count deleted samples."""
    from app.models import User
    user = db.query(User).filter(User.email == settings.FIRST_SUPERUSER).first()
    assert user is not None

    instance = create_test_minio_instance(db, user.id, "deleted-test-instance")

    # Create active and deleted samples
    active_sample = create_test_sample(
        db, user.id, instance.id, "bucket", "active.jpg"
    )
    deleted_sample = create_test_sample(
        db, user.id, instance.id, "bucket", "deleted.jpg"
    )
    deleted_sample.status = SampleStatus.deleted
    db.commit()

    try:
        r = client.get(
            f"{settings.API_V1_STR}/samples/storage-tree",
            headers=superuser_token_headers,
        )
        assert r.status_code == 200
        data = r.json()

        instance_node = next(
            (n for n in data if n["name"] == "deleted-test-instance"), None
        )
        assert instance_node is not None
        # Should only count the active sample
        assert instance_node["count"] == 1

    finally:
        db.delete(active_sample)
        db.delete(deleted_sample)
        db.delete(instance)
        db.commit()
