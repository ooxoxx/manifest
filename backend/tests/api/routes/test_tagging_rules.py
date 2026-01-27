"""Tests for tagging rules API endpoints."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import Tag, TagCategory, TaggingRule, TaggingRuleType, User


@pytest.fixture(scope="module")
def superuser(db: Session) -> User:
    """Get the superuser from database."""
    user = db.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    assert user is not None, "Superuser not found in database"
    return user


@pytest.fixture(scope="function")
def test_tags(db: Session, superuser: User) -> list[Tag]:
    """Create test tags for tagging rules."""
    tags = [
        Tag(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            name=f"规则测试标签_{uuid.uuid4().hex[:8]}",
            category=TagCategory.user,
        ),
        Tag(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            name=f"规则测试标签_{uuid.uuid4().hex[:8]}",
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


@pytest.fixture(scope="function")
def test_rules(db: Session, superuser: User, test_tags: list[Tag]) -> list[TaggingRule]:
    """Create test tagging rules."""
    rules = [
        TaggingRule(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            name=f"测试规则_文件名_{uuid.uuid4().hex[:8]}",
            rule_type=TaggingRuleType.regex_filename,
            pattern=r".*\.jpg$",
            tag_ids=[str(test_tags[0].id)],
            is_active=True,
            auto_execute=False,
        ),
        TaggingRule(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            name=f"测试规则_路径_{uuid.uuid4().hex[:8]}",
            rule_type=TaggingRuleType.regex_path,
            pattern=r".*/train/.*",
            tag_ids=[str(test_tags[0].id), str(test_tags[1].id)],
            is_active=True,
            auto_execute=True,
        ),
        TaggingRule(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            name=f"测试规则_扩展名_{uuid.uuid4().hex[:8]}",
            rule_type=TaggingRuleType.file_extension,
            pattern="png",
            tag_ids=[str(test_tags[1].id)],
            is_active=False,
            auto_execute=False,
        ),
    ]
    for rule in rules:
        db.add(rule)
    db.commit()
    for rule in rules:
        db.refresh(rule)
    yield rules
    # Cleanup
    for rule in rules:
        try:
            db.delete(rule)
        except Exception:
            pass
    db.commit()


class TestReadTaggingRules:
    """Tests for read tagging rules endpoint."""

    def test_read_all_rules(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_rules: list[TaggingRule],
    ):
        """Should return all tagging rules for the user."""
        response = client.get(
            f"{settings.API_V1_STR}/tagging-rules/",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "count" in data
        assert data["count"] >= 3

    def test_read_rules_with_pagination(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_rules: list[TaggingRule],
    ):
        """Should support pagination."""
        response = client.get(
            f"{settings.API_V1_STR}/tagging-rules/?skip=0&limit=2",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) <= 2


class TestGetTaggingRule:
    """Tests for get single tagging rule endpoint."""

    def test_get_rule_by_id(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_rules: list[TaggingRule],
    ):
        """Should return a specific rule by ID."""
        rule = test_rules[0]
        response = client.get(
            f"{settings.API_V1_STR}/tagging-rules/{rule.id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(rule.id)
        assert data["name"] == rule.name

    def test_get_nonexistent_rule(
        self,
        client: TestClient,
        superuser_token_headers: dict,
    ):
        """Should return 404 for nonexistent rule."""
        fake_id = uuid.uuid4()
        response = client.get(
            f"{settings.API_V1_STR}/tagging-rules/{fake_id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 404


class TestCreateTaggingRule:
    """Tests for create tagging rule endpoint."""

    def test_create_regex_filename_rule(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should create a regex filename rule."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/",
            headers=superuser_token_headers,
            json={
                "name": "新建文件名规则",
                "rule_type": "regex_filename",
                "pattern": r".*test.*\.png$",
                "tag_ids": [str(test_tags[0].id)],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "新建文件名规则"
        assert data["rule_type"] == "regex_filename"
        assert data["is_active"] is True

    def test_create_file_extension_rule(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should create a file extension rule."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/",
            headers=superuser_token_headers,
            json={
                "name": "扩展名规则",
                "rule_type": "file_extension",
                "pattern": "jpeg",
                "tag_ids": [str(test_tags[0].id)],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["rule_type"] == "file_extension"

    def test_create_bucket_rule(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should create a bucket rule."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/",
            headers=superuser_token_headers,
            json={
                "name": "桶名规则",
                "rule_type": "bucket",
                "pattern": "training-data",
                "tag_ids": [str(test_tags[0].id)],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["rule_type"] == "bucket"

    def test_create_rule_with_auto_execute(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should create a rule with auto_execute enabled."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/",
            headers=superuser_token_headers,
            json={
                "name": "自动执行规则",
                "rule_type": "content_type",
                "pattern": "image/png",
                "tag_ids": [str(test_tags[0].id)],
                "auto_execute": True,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["auto_execute"] is True


class TestUpdateTaggingRule:
    """Tests for update tagging rule endpoint."""

    def test_update_rule_name(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_rules: list[TaggingRule],
    ):
        """Should update rule name."""
        rule = test_rules[0]
        response = client.put(
            f"{settings.API_V1_STR}/tagging-rules/{rule.id}",
            headers=superuser_token_headers,
            json={"name": "更新后的规则名称"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "更新后的规则名称"

    def test_update_rule_pattern(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_rules: list[TaggingRule],
    ):
        """Should update rule pattern."""
        rule = test_rules[1]
        response = client.put(
            f"{settings.API_V1_STR}/tagging-rules/{rule.id}",
            headers=superuser_token_headers,
            json={"pattern": r".*/validation/.*"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["pattern"] == r".*/validation/.*"

    def test_update_rule_toggle_active(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_rules: list[TaggingRule],
    ):
        """Should toggle rule active state."""
        rule = test_rules[2]  # This one is inactive
        response = client.put(
            f"{settings.API_V1_STR}/tagging-rules/{rule.id}",
            headers=superuser_token_headers,
            json={"is_active": True},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is True

    def test_update_nonexistent_rule(
        self,
        client: TestClient,
        superuser_token_headers: dict,
    ):
        """Should return 404 for nonexistent rule."""
        fake_id = uuid.uuid4()
        response = client.put(
            f"{settings.API_V1_STR}/tagging-rules/{fake_id}",
            headers=superuser_token_headers,
            json={"name": "不存在的规则"},
        )

        assert response.status_code == 404


class TestDeleteTaggingRule:
    """Tests for delete tagging rule endpoint."""

    def test_delete_rule(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        db: Session,
        superuser: User,
        test_tags: list[Tag],
    ):
        """Should delete a tagging rule."""
        # Create a rule specifically for deletion
        rule = TaggingRule(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            name=f"待删除规则_{uuid.uuid4().hex[:8]}",
            rule_type=TaggingRuleType.file_extension,
            pattern="tmp",
            tag_ids=[str(test_tags[0].id)],
        )
        db.add(rule)
        db.commit()
        db.refresh(rule)

        response = client.delete(
            f"{settings.API_V1_STR}/tagging-rules/{rule.id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200

    def test_delete_nonexistent_rule(
        self,
        client: TestClient,
        superuser_token_headers: dict,
    ):
        """Should return 404 for nonexistent rule."""
        fake_id = uuid.uuid4()
        response = client.delete(
            f"{settings.API_V1_STR}/tagging-rules/{fake_id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 404


class TestExecuteTaggingRule:
    """Tests for execute tagging rule endpoint."""

    def test_execute_rule_dry_run(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_rules: list[TaggingRule],
    ):
        """Should execute rule in dry run mode."""
        rule = test_rules[0]
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/{rule.id}/execute?dry_run=true",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "matched" in data
        assert "tagged" in data
        assert "skipped" in data

    def test_execute_rule_actual(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_rules: list[TaggingRule],
    ):
        """Should execute rule and apply tags."""
        rule = test_rules[0]
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/{rule.id}/execute?dry_run=false",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "matched" in data
        assert "tagged" in data
        assert "skipped" in data

    def test_execute_nonexistent_rule(
        self,
        client: TestClient,
        superuser_token_headers: dict,
    ):
        """Should return 404 for nonexistent rule."""
        fake_id = uuid.uuid4()
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/{fake_id}/execute",
            headers=superuser_token_headers,
        )

        assert response.status_code == 404


class TestPreviewTaggingRule:
    """Tests for preview tagging rule endpoint."""

    def test_preview_rule(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_rules: list[TaggingRule],
    ):
        """Should preview matching samples."""
        rule = test_rules[0]
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/{rule.id}/preview",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_matched" in data
        assert "samples" in data
        assert isinstance(data["samples"], list)

    def test_preview_rule_with_limit(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_rules: list[TaggingRule],
    ):
        """Should respect limit parameter."""
        rule = test_rules[0]
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/{rule.id}/preview?limit=5",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["samples"]) <= 5

    def test_preview_nonexistent_rule(
        self,
        client: TestClient,
        superuser_token_headers: dict,
    ):
        """Should return 404 for nonexistent rule."""
        fake_id = uuid.uuid4()
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/{fake_id}/preview",
            headers=superuser_token_headers,
        )

        assert response.status_code == 404
