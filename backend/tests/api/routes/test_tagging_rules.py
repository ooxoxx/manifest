"""Tests for tagging rules API endpoints.

Tagging rules use full-path regex matching against: {bucket}/{object_key}
Example: test-bucket/train/images/IMG_001.jpg
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import Tag, TagCategory, TaggingRule, User


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
    """Create test tagging rules with full-path regex patterns."""
    rules = [
        TaggingRule(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            name=f"测试规则_JPG文件_{uuid.uuid4().hex[:8]}",
            pattern=r".*\.jpg$",
            tag_ids=[str(test_tags[0].id)],
            is_active=True,
            auto_execute=False,
        ),
        TaggingRule(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            name=f"测试规则_训练目录_{uuid.uuid4().hex[:8]}",
            pattern=r".*/train/.*",
            tag_ids=[str(test_tags[0].id), str(test_tags[1].id)],
            is_active=True,
            auto_execute=True,
        ),
        TaggingRule(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            name=f"测试规则_PNG扩展名_{uuid.uuid4().hex[:8]}",
            pattern=r".*\.png$",
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

    def test_create_full_path_regex_rule(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should create a full-path regex rule."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/",
            headers=superuser_token_headers,
            json={
                "name": "新建全路径规则",
                "pattern": r".*test.*\.png$",
                "tag_ids": [str(test_tags[0].id)],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["rule"]["name"] == "新建全路径规则"
        assert data["rule"]["is_active"] is True

    def test_create_bucket_prefix_rule(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should create a bucket prefix rule."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/",
            headers=superuser_token_headers,
            json={
                "name": "桶前缀规则",
                "pattern": r"^training-data/.*",
                "tag_ids": [str(test_tags[0].id)],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["rule"]["pattern"] == r"^training-data/.*"

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
                "pattern": r".*\.png$",
                "tag_ids": [str(test_tags[0].id)],
                "auto_execute": True,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["rule"]["auto_execute"] is True


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
            pattern=r".*\.tmp$",
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


class TestMappingRule:
    """Tests for mapping tagging rules (Type B)."""

    def test_create_mapping_rule(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should create a mapping rule with class_tag_mapping."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/mapping",
            headers=superuser_token_headers,
            json={
                "name": "映射规则测试",
                "pattern": r".*\.jpg$",
                "class_tag_mapping": {
                    "person": str(test_tags[0].id),
                    "car": str(test_tags[1].id),
                },
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["rule"]["name"] == "映射规则测试"
        assert data["rule"]["rule_type"] == "mapping"
        assert data["rule"]["class_tag_mapping"] is not None
        assert "person" in data["rule"]["class_tag_mapping"]

    def test_create_mapping_rule_invalid_pattern(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        test_tags: list[Tag],
    ):
        """Should reject invalid regex pattern."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/mapping",
            headers=superuser_token_headers,
            json={
                "name": "无效模式",
                "pattern": r"[invalid(regex",
                "class_tag_mapping": {"person": str(test_tags[0].id)},
            },
        )

        assert response.status_code == 400
        assert "Invalid regex pattern" in response.json()["detail"]

    def test_preview_mapping_returns_classes(
        self,
        client: TestClient,
        superuser_token_headers: dict,
    ):
        """Should return unique_classes and class_sample_counts in preview."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/preview-mapping",
            headers=superuser_token_headers,
            json={"pattern": ".*"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_matched" in data
        assert "samples" in data
        assert "unique_classes" in data
        assert "class_sample_counts" in data
        assert isinstance(data["unique_classes"], list)
        assert isinstance(data["class_sample_counts"], dict)

    def test_preview_mapping_invalid_pattern(
        self,
        client: TestClient,
        superuser_token_headers: dict,
    ):
        """Should reject invalid regex pattern in preview."""
        response = client.post(
            f"{settings.API_V1_STR}/tagging-rules/preview-mapping",
            headers=superuser_token_headers,
            json={"pattern": r"[invalid(regex"},
        )

        assert response.status_code == 400

    def test_execute_mapping_rule_returns_no_annotation(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        db: Session,
        superuser: User,
        test_tags: list[Tag],
    ):
        """Should return no_annotation count in execution result."""
        # Create a mapping rule
        from app.models import TaggingRule, TaggingRuleType

        rule = TaggingRule(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            name=f"执行测试映射规则_{uuid.uuid4().hex[:8]}",
            pattern=r".*",
            tag_ids=[],
            rule_type=TaggingRuleType.mapping,
            class_tag_mapping={"person": str(test_tags[0].id)},
        )
        db.add(rule)
        db.commit()
        db.refresh(rule)

        try:
            response = client.post(
                f"{settings.API_V1_STR}/tagging-rules/{rule.id}/execute?dry_run=true",
                headers=superuser_token_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert "matched" in data
            assert "tagged" in data
            assert "skipped" in data
            assert "no_annotation" in data
        finally:
            db.delete(rule)
            db.commit()

    def test_mapping_rule_get_includes_rule_type(
        self,
        client: TestClient,
        superuser_token_headers: dict,
        db: Session,
        superuser: User,
        test_tags: list[Tag],
    ):
        """Should include rule_type in GET response."""
        from app.models import TaggingRule, TaggingRuleType

        rule = TaggingRule(
            id=uuid.uuid4(),
            owner_id=superuser.id,
            name=f"获取测试_{uuid.uuid4().hex[:8]}",
            pattern=r".*\.png$",
            tag_ids=[],
            rule_type=TaggingRuleType.mapping,
            class_tag_mapping={"dog": str(test_tags[0].id)},
        )
        db.add(rule)
        db.commit()
        db.refresh(rule)

        try:
            response = client.get(
                f"{settings.API_V1_STR}/tagging-rules/{rule.id}",
                headers=superuser_token_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["rule_type"] == "mapping"
            assert data["class_tag_mapping"] is not None
        finally:
            db.delete(rule)
            db.commit()
