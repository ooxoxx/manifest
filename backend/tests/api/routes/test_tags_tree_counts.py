"""Tests for Tags Tree with Counts API endpoint."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.core.encryption import encrypt_value
from app.models import (
    MinIOInstance,
    Sample,
    SampleStatus,
    SampleTag,
    Tag,
    TagCategory,
    User,
)


def create_test_minio_instance(session: Session, owner_id: uuid.UUID) -> MinIOInstance:
    """Create a test MinIO instance."""
    instance = MinIOInstance(
        name=f"test-instance-{uuid.uuid4().hex[:8]}",
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


def create_business_tag(
    session: Session,
    name: str,
    level: int,
    parent_id: uuid.UUID | None = None,
    full_path: str | None = None,
) -> Tag:
    """Create a business tag."""
    tag = Tag(
        name=name,
        category=TagCategory.business,
        level=level,
        parent_id=parent_id,
        full_path=full_path or name,
        owner_id=None,  # Business tags are global
        is_system_managed=True,
    )
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


def create_sample_with_tags(
    session: Session,
    owner_id: uuid.UUID,
    minio_instance_id: uuid.UUID,
    tag_ids: list[uuid.UUID],
) -> Sample:
    """Create a sample and associate it with tags."""
    sample = Sample(
        object_key=f"test/{uuid.uuid4().hex}.jpg",
        bucket="test-bucket",
        file_name=f"{uuid.uuid4().hex}.jpg",
        owner_id=owner_id,
        minio_instance_id=minio_instance_id,
        status=SampleStatus.active,
    )
    session.add(sample)
    session.commit()
    session.refresh(sample)

    for tag_id in tag_ids:
        sample_tag = SampleTag(sample_id=sample.id, tag_id=tag_id)
        session.add(sample_tag)
    session.commit()

    return sample


def test_business_tree_with_counts_requires_auth(client: TestClient) -> None:
    """Endpoint should require authentication."""
    r = client.get(f"{settings.API_V1_STR}/tags/business/tree-with-counts")
    assert r.status_code == 401


def test_business_tree_with_counts_returns_tree_structure(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    """Should return business tags as tree with count fields."""
    r = client.get(
        f"{settings.API_V1_STR}/tags/business/tree-with-counts",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_business_tree_with_counts_includes_sample_counts(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    """Each node should include sample count."""
    user = db.query(User).filter(User.email == settings.FIRST_SUPERUSER).first()
    assert user is not None

    instance = create_test_minio_instance(db, user.id)

    # Create hierarchy: Level0 > Level1 > Level2
    level0 = create_business_tag(db, "TestDomain", 0)
    level1 = create_business_tag(
        db, "TestScene", 1, level0.id, "TestDomain/TestScene"
    )
    level2 = create_business_tag(
        db, "TestPart", 2, level1.id, "TestDomain/TestScene/TestPart"
    )

    # Create samples with different tag levels
    sample1 = create_sample_with_tags(db, user.id, instance.id, [level2.id])
    sample2 = create_sample_with_tags(db, user.id, instance.id, [level1.id])
    sample3 = create_sample_with_tags(db, user.id, instance.id, [level0.id])

    try:
        r = client.get(
            f"{settings.API_V1_STR}/tags/business/tree-with-counts",
            headers=superuser_token_headers,
        )
        assert r.status_code == 200
        data = r.json()

        # Find our test domain
        test_domain = next((n for n in data if n["name"] == "TestDomain"), None)
        assert test_domain is not None
        assert "count" in test_domain
        assert "total_count" in test_domain
        # total_count should include all descendants
        assert test_domain["total_count"] >= 3

    finally:
        # Cleanup
        db.query(SampleTag).filter(
            SampleTag.sample_id.in_([sample1.id, sample2.id, sample3.id])
        ).delete(synchronize_session=False)
        db.delete(sample1)
        db.delete(sample2)
        db.delete(sample3)
        db.delete(level2)
        db.delete(level1)
        db.delete(level0)
        db.delete(instance)
        db.commit()
