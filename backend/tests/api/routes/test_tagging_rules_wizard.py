"""Tests for tagging rules wizard API endpoints.

Tagging rules use full-path regex matching against: {bucket}/{object_key}
Example: test-bucket/train/images/IMG_001.jpg
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import (
    MinIOInstance,
    Sample,
    SampleSource,
    Tag,
    TagCategory,
    TaggingRule,
    User,
)


@pytest.fixture(scope="module")
def superuser(db: Session) -> User:
    """Get the superuser from database."""
    user = db.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    assert user is not None, "Superuser not found in database"
    return user


@pytest.fixture(scope="function")
def test_minio_instance(db: Session, superuser: User) -> MinIOInstance:
    """Create a test MinIO instance."""
    instance = MinIOInstance(
        id=uuid.uuid4(),
        owner_id=superuser.id,
        name=f"wizard_test_minio_{uuid.uuid4().hex[:8]}",
        endpoint="minio:9000",
        access_key_encrypted="test_key",
        secret_key_encrypted="test_secret",
        secure=False,
    )
    db.add(instance)
    db.commit()
    db.refresh(instance)
    yield instance
    # Cleanup
    try:
        db.delete(instance)
        db.commit()
    except Exception:
        db.rollback()


@pytest.fixture(scope="function")
def test_samples(
    db: Session, superuser: User, test_minio_instance: MinIOInstance
) -> list[Sample]:
    """Create test samples for pattern preview."""
    samples = [
        Sample(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            minio_instance_id=test_minio_instance.id,
            object_key="train/images/IMG_001.jpg",
            bucket="test-bucket",
            file_name="IMG_001.jpg",
            file_size=1024,
            content_type="image/jpeg",
            source=SampleSource.sync,
        ),
        Sample(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            minio_instance_id=test_minio_instance.id,
            object_key="train/images/IMG_002.jpg",
            bucket="test-bucket",
            file_name="IMG_002.jpg",
            file_size=2048,
            content_type="image/jpeg",
            source=SampleSource.sync,
        ),
        Sample(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            minio_instance_id=test_minio_instance.id,
            object_key="validation/images/VAL_001.png",
            bucket="test-bucket",
            file_name="VAL_001.png",
            file_size=3072,
            content_type="image/png",
            source=SampleSource.sync,
        ),
        Sample(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            minio_instance_id=test_minio_instance.id,
            object_key="test/data/test_file.gif",
            bucket="other-bucket",
            file_name="test_file.gif",
            file_size=512,
            content_type="image/gif",
            source=SampleSource.manual,
        ),
    ]
    for sample in samples:
        db.add(sample)
    db.commit()
    for sample in samples:
        db.refresh(sample)
    yield samples
    # Cleanup
    for sample in samples:
        try:
            db.delete(sample)
        except Exception:
            pass
    db.commit()


@pytest.fixture(scope="function")
def test_tags(db: Session, superuser: User) -> list[Tag]:
    """Create test tags for wizard tests."""
    tags = [
        Tag(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            name=f"wizard_tag_1_{uuid.uuid4().hex[:8]}",
            category=TagCategory.user,
        ),
        Tag(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            name=f"wizard_tag_2_{uuid.uuid4().hex[:8]}",
            category=TagCategory.user,
        ),
    ]
    for tag in tags:
        db.add(tag)
    db.commit()
    for tag in tags:
        db.refresh(tag)
    yield tags
    # Cleanup
    for tag in tags:
        try:
            db.delete(tag)
        except Exception:
            pass
    db.commit()


class TestPreviewPattern:
    """Tests for preview pattern endpoint (without creating a rule first).

    All patterns are full-path regex matching against: {bucket}/{object_key}
    """

    def test_preview_full_path_pattern(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_samples: list[Sample],
    ):
        """Should preview samples matching a full-path regex pattern."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/preview-pattern",
            headers=superuser_token_headers,
            json={
                "pattern": r"test-bucket/train/.*",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_matched" in data
        assert "samples" in data
        assert data["total_matched"] == 2
        assert len(data["samples"]) == 2
        # Verify matched samples are from train directory
        for sample in data["samples"]:
            assert sample["object_key"].startswith("train/")

    def test_preview_filename_pattern(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_samples: list[Sample],
    ):
        """Should preview samples matching filename in full path."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/preview-pattern",
            headers=superuser_token_headers,
            json={
                "pattern": r".*/IMG_.*\.jpg$",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_matched"] == 2
        for sample in data["samples"]:
            assert sample["file_name"].startswith("IMG_")

    def test_preview_bucket_pattern(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_samples: list[Sample],
    ):
        """Should preview samples matching bucket prefix."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/preview-pattern",
            headers=superuser_token_headers,
            json={
                "pattern": r"^other-bucket/.*",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_matched"] == 1
        assert data["samples"][0]["bucket"] == "other-bucket"

    def test_preview_extension_pattern(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_samples: list[Sample],
    ):
        """Should preview samples matching file extension."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/preview-pattern",
            headers=superuser_token_headers,
            json={
                "pattern": r".*\.png$",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_matched"] == 1
        assert data["samples"][0]["file_name"].endswith(".png")

    def test_preview_with_pagination(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_samples: list[Sample],
    ):
        """Should support pagination with skip and limit."""
        # First page
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/preview-pattern?skip=0&limit=1",
            headers=superuser_token_headers,
            json={
                "pattern": r".*/IMG_.*\.jpg$",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_matched"] == 2
        assert len(data["samples"]) == 1

        # Second page
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/preview-pattern?skip=1&limit=1",
            headers=superuser_token_headers,
            json={
                "pattern": r".*/IMG_.*\.jpg$",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_matched"] == 2
        assert len(data["samples"]) == 1

    def test_preview_empty_result(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_samples: list[Sample],
    ):
        """Should return empty result for non-matching pattern."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/preview-pattern",
            headers=superuser_token_headers,
            json={
                "pattern": r"^NONEXISTENT_.*$",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_matched"] == 0
        assert len(data["samples"]) == 0

    def test_preview_invalid_regex(
        self,
        client: TestClient,
        superuser_token_headers: dict,
    ):
        """Should return 400 for invalid regex pattern."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/preview-pattern",
            headers=superuser_token_headers,
            json={
                "pattern": r"[invalid(regex",
            },
        )

        assert response.status_code == 400
        assert "Invalid regex pattern" in response.json()["detail"]


class TestCreateWithExecuteImmediately:
    """Tests for create tagging rule with execute_immediately option.

    All patterns are full-path regex matching against: {bucket}/{object_key}
    """

    def test_create_and_execute_immediately(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
        test_samples: list[Sample],
        db: Session,
    ):
        """Should create rule and execute immediately when flag is set."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/?execute_immediately=true",
            headers=superuser_token_headers,
            json={
                "name": f"wizard_test_rule_{uuid.uuid4().hex[:8]}",
                "pattern": r".*/IMG_.*\.jpg$",
                "tag_ids": [str(test_tags[0].id)],
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Should return rule info
        assert "rule" in data
        assert data["rule"]["name"].startswith("wizard_test_rule_")

        # Should return execution result
        assert "execution_result" in data
        assert data["execution_result"] is not None
        assert data["execution_result"]["matched"] == 2
        assert data["execution_result"]["tagged"] >= 0

        # Cleanup
        rule_id = data["rule"]["id"]
        client.delete(
            f"{settings.API_V1_STR}/tagging-rules/{rule_id}",
            headers=superuser_token_headers,
        )

    def test_create_without_execute(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should create rule without executing when flag is false."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/?execute_immediately=false",
            headers=superuser_token_headers,
            json={
                "name": f"wizard_test_rule_no_exec_{uuid.uuid4().hex[:8]}",
                "pattern": r".*\.jpg$",
                "tag_ids": [str(test_tags[0].id)],
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Should return rule info
        assert "rule" in data

        # Should NOT have execution result
        assert "execution_result" in data
        assert data["execution_result"] is None

        # Cleanup
        rule_id = data["rule"]["id"]
        client.delete(
            f"{settings.API_V1_STR}/tagging-rules/{rule_id}",
            headers=superuser_token_headers,
        )

    def test_create_default_no_execute(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should not execute by default (backwards compatibility)."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/",
            headers=superuser_token_headers,
            json={
                "name": f"wizard_test_rule_default_{uuid.uuid4().hex[:8]}",
                "pattern": r"^test-bucket/.*",
                "tag_ids": [str(test_tags[0].id)],
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Should return rule info
        assert "rule" in data

        # Should NOT have execution result by default
        assert "execution_result" in data
        assert data["execution_result"] is None

        # Cleanup
        rule_id = data["rule"]["id"]
        client.delete(
            f"{settings.API_V1_STR}/tagging-rules/{rule_id}",
            headers=superuser_token_headers,
        )
