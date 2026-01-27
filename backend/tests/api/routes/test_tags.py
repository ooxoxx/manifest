"""Tests for tags API endpoints."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import Tag, TagCategory, User


@pytest.fixture(scope="module")
def superuser(db: Session) -> User:
    """Get the superuser from database."""
    user = db.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    assert user is not None, "Superuser not found in database"
    return user


@pytest.fixture(scope="module")
def global_tags(db: Session):
    """Create global system/business tags (owner_id=None)."""
    tags = [
        Tag(
            id=uuid.uuid4(),
            owner_id=None,
            name=f"系统标签_{uuid.uuid4().hex[:8]}",
            category=TagCategory.system,
            is_system_managed=True,
        ),
        Tag(
            id=uuid.uuid4(),
            owner_id=None,
            name=f"系统标签_{uuid.uuid4().hex[:8]}",
            category=TagCategory.system,
            is_system_managed=True,
        ),
        Tag(
            id=uuid.uuid4(),
            owner_id=None,
            name=f"业务标签_{uuid.uuid4().hex[:8]}",
            category=TagCategory.business,
            is_system_managed=True,
        ),
        Tag(
            id=uuid.uuid4(),
            owner_id=None,
            name=f"业务标签_{uuid.uuid4().hex[:8]}",
            category=TagCategory.business,
            is_system_managed=True,
        ),
    ]
    for tag in tags:
        db.add(tag)
    db.commit()
    for tag in tags:
        db.refresh(tag)
    yield tags
    for tag in tags:
        db.delete(tag)
    db.commit()


@pytest.fixture(scope="module")
def user_tags(db: Session, superuser: User):
    """Create user-owned tags for the superuser."""
    tags = [
        Tag(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            name=f"用户标签_{uuid.uuid4().hex[:8]}",
            category=TagCategory.user,
        ),
        Tag(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            name=f"用户标签_{uuid.uuid4().hex[:8]}",
            category=TagCategory.user,
        ),
    ]
    for tag in tags:
        db.add(tag)
    db.commit()
    for tag in tags:
        db.refresh(tag)
    yield tags
    for tag in tags:
        db.delete(tag)
    db.commit()


@pytest.fixture(scope="module")
def test_tags(global_tags: list[Tag], user_tags: list[Tag]):
    """Combined fixture for all test tags."""
    return global_tags + user_tags


class TestReadTags:
    """Tests for read tags endpoint."""

    def test_read_all_tags(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should return all tags including global and user-owned."""
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

    def test_create_user_tag(
        self,
        client: TestClient,
        superuser_token_headers: dict,
    ):
        """Should create tag with user category."""
        response = client.post(
            f"{settings.API_V1_STR}/tags/",
            headers=superuser_token_headers,
            json={"name": "新用户标签", "category": "user"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "新用户标签"
        assert data["category"] == "user"
        assert data["is_system_managed"] is False

    def test_cannot_create_business_tag(
        self,
        client: TestClient,
        superuser_token_headers: dict,
    ):
        """Should reject creating business tags."""
        response = client.post(
            f"{settings.API_V1_STR}/tags/",
            headers=superuser_token_headers,
            json={"name": "新业务标签", "category": "business"},
        )

        assert response.status_code == 403

    def test_cannot_create_system_tag(
        self,
        client: TestClient,
        superuser_token_headers: dict,
    ):
        """Should reject creating system tags."""
        response = client.post(
            f"{settings.API_V1_STR}/tags/",
            headers=superuser_token_headers,
            json={"name": "新系统标签", "category": "system"},
        )

        assert response.status_code == 403


class TestUpdateTag:
    """Tests for update tag endpoint."""

    def test_update_user_tag_name(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        user_tags: list[Tag],
    ):
        """Should update user tag name."""
        user_tag = user_tags[0]
        response = client.put(
            f"{settings.API_V1_STR}/tags/{user_tag.id}",
            headers=superuser_token_headers,
            json={"name": "更新后的标签名"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "更新后的标签名"

    def test_cannot_change_user_tag_to_business(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        user_tags: list[Tag],
    ):
        """Should not allow changing user tag category to business."""
        user_tag = user_tags[1]
        response = client.put(
            f"{settings.API_V1_STR}/tags/{user_tag.id}",
            headers=superuser_token_headers,
            json={"category": "business"},
        )

        assert response.status_code == 403

    def test_cannot_modify_global_system_tag(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        global_tags: list[Tag],
    ):
        """Should not allow modifying global system tags."""
        system_tag = next(t for t in global_tags if t.category == TagCategory.system)
        response = client.put(
            f"{settings.API_V1_STR}/tags/{system_tag.id}",
            headers=superuser_token_headers,
            json={"name": "尝试修改"},
        )

        assert response.status_code == 403

    def test_cannot_modify_global_business_tag(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        global_tags: list[Tag],
    ):
        """Should not allow modifying global business tags."""
        business_tag = next(t for t in global_tags if t.category == TagCategory.business)
        response = client.put(
            f"{settings.API_V1_STR}/tags/{business_tag.id}",
            headers=superuser_token_headers,
            json={"name": "尝试修改"},
        )

        assert response.status_code == 403


class TestDeleteTag:
    """Tests for delete tag endpoint."""

    def test_cannot_delete_global_system_tag(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        global_tags: list[Tag],
    ):
        """Should not allow deleting global system tags."""
        system_tag = next(t for t in global_tags if t.category == TagCategory.system)
        response = client.delete(
            f"{settings.API_V1_STR}/tags/{system_tag.id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 403

    def test_cannot_delete_global_business_tag(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        global_tags: list[Tag],
    ):
        """Should not allow deleting global business tags."""
        business_tag = next(t for t in global_tags if t.category == TagCategory.business)
        response = client.delete(
            f"{settings.API_V1_STR}/tags/{business_tag.id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 403

    def test_delete_user_tag(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        db: Session,
        superuser: User,
    ):
        """Should delete user-owned tags."""
        # Create a tag specifically for deletion
        tag = Tag(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            name=f"待删除标签_{uuid.uuid4().hex[:8]}",
            category=TagCategory.user,
        )
        db.add(tag)
        db.commit()
        db.refresh(tag)

        response = client.delete(
            f"{settings.API_V1_STR}/tags/{tag.id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
