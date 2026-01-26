"""Tests for tags API endpoints."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import Tag, TagCategory, User


@pytest.fixture
def test_user(db: Session):
    """Create test user for tags."""
    user = User(
        id=uuid.uuid4(),
        email=f"tags_test_{uuid.uuid4()}@example.com",
        hashed_password="fakehash",
        full_name="Tags Test User",
        is_superuser=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    yield user
    db.delete(user)
    db.commit()


@pytest.fixture
def test_tags(db: Session, test_user: User):
    """Create test tags across all categories."""
    tags = [
        Tag(
            id=uuid.uuid4(),
            owner_id=test_user.id,
            name="已标注",
            category=TagCategory.system,
            is_system_managed=True,
        ),
        Tag(
            id=uuid.uuid4(),
            owner_id=test_user.id,
            name="待审核",
            category=TagCategory.system,
            is_system_managed=True,
        ),
        Tag(
            id=uuid.uuid4(),
            owner_id=test_user.id,
            name="输电",
            category=TagCategory.business,
        ),
        Tag(
            id=uuid.uuid4(),
            owner_id=test_user.id,
            name="通道监拍",
            category=TagCategory.business,
        ),
        Tag(
            id=uuid.uuid4(),
            owner_id=test_user.id,
            name="自定义标签1",
            category=TagCategory.user,
        ),
        Tag(
            id=uuid.uuid4(),
            owner_id=test_user.id,
            name="自定义标签2",
            category=TagCategory.user,
        ),
    ]
    for tag in tags:
        db.add(tag)
    db.commit()
    yield tags
    for tag in tags:
        db.delete(tag)
    db.commit()


class TestReadTags:
    """Tests for read tags endpoint."""

    def test_read_all_tags(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should return all tags."""
        response = client.get(
            f"{settings.API_V1_STR}/tags/",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "count" in data
        assert data["count"] >= 6

    def test_filter_by_category_system(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should filter tags by system category."""
        response = client.get(
            f"{settings.API_V1_STR}/tags/?category=system",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["count"] >= 2
        for tag in data["data"]:
            assert tag["category"] == "system"

    def test_filter_by_category_business(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should filter tags by business category."""
        response = client.get(
            f"{settings.API_V1_STR}/tags/?category=business",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["count"] >= 2
        for tag in data["data"]:
            assert tag["category"] == "business"

    def test_filter_by_category_user(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should filter tags by user category."""
        response = client.get(
            f"{settings.API_V1_STR}/tags/?category=user",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["count"] >= 2
        for tag in data["data"]:
            assert tag["category"] == "user"


class TestGetTagsByCategory:
    """Tests for get tags by category endpoint."""

    def test_returns_grouped_tags(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should return tags grouped by category."""
        response = client.get(
            f"{settings.API_V1_STR}/tags/by-category",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "system" in data
        assert "business" in data
        assert "user" in data
        assert len(data["system"]) >= 2
        assert len(data["business"]) >= 2
        assert len(data["user"]) >= 2


class TestCreateTag:
    """Tests for create tag endpoint."""

    def test_create_tag_with_default_category(
        self,
        client: TestClient,
        superuser_token_headers: dict,
    ):
        """Should create tag with default user category."""
        response = client.post(
            f"{settings.API_V1_STR}/tags/",
            headers=superuser_token_headers,
            json={"name": "新标签"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "新标签"
        assert data["category"] == "user"
        assert data["is_system_managed"] is False

    def test_create_tag_with_business_category(
        self,
        client: TestClient,
        superuser_token_headers: dict,
    ):
        """Should create tag with specified category."""
        response = client.post(
            f"{settings.API_V1_STR}/tags/",
            headers=superuser_token_headers,
            json={"name": "新业务标签", "category": "business"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "新业务标签"
        assert data["category"] == "business"


class TestUpdateTag:
    """Tests for update tag endpoint."""

    def test_update_tag_category(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should update tag category for non-system-managed tags."""
        user_tag = next(t for t in test_tags if t.category == TagCategory.user)
        response = client.put(
            f"{settings.API_V1_STR}/tags/{user_tag.id}",
            headers=superuser_token_headers,
            json={"category": "business"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "business"

    def test_cannot_change_system_managed_tag_category(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should not allow changing category of system-managed tags."""
        system_tag = next(t for t in test_tags if t.is_system_managed)
        response = client.put(
            f"{settings.API_V1_STR}/tags/{system_tag.id}",
            headers=superuser_token_headers,
            json={"category": "user"},
        )

        assert response.status_code == 403
        assert "system-managed" in response.json()["detail"]


class TestDeleteTag:
    """Tests for delete tag endpoint."""

    def test_delete_user_tag(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should delete non-system-managed tags."""
        user_tag = next(t for t in test_tags if t.category == TagCategory.user)
        response = client.delete(
            f"{settings.API_V1_STR}/tags/{user_tag.id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200

    def test_cannot_delete_system_managed_tag(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should not allow deleting system-managed tags."""
        system_tag = next(t for t in test_tags if t.is_system_managed)
        response = client.delete(
            f"{settings.API_V1_STR}/tags/{system_tag.id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 403
        assert "system-managed" in response.json()["detail"]
