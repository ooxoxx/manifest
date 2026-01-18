"""Tests for MinIO webhook event handling with Phase 3 enhancements."""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.main import app
from app.models import (
    Annotation,
    AnnotationFormat,
    AnnotationStatus,
    MinIOInstance,
    Sample,
    SampleHistory,
    SampleHistoryAction,
    SampleSource,
    SampleStatus,
    User,
)


@pytest.fixture
def test_user(db: Session):
    """Create a test user for webhooks."""
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email=f"webhook_test_{user_id}@example.com",
        hashed_password="fakehash",
        full_name="Webhook Test User",
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
        name="Test MinIO Webhook",
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


# =============================================================================
# Phase 3: Image Webhook Event Tests
# =============================================================================


class TestWebhookImageCreated:
    """Tests for image file webhook events with Phase 3 enhancements."""

    def test_image_created_extracts_file_stem(
        self, client: TestClient, db: Session, test_minio_instance: MinIOInstance
    ):
        """When an image is created via webhook, file_stem should be extracted."""
        payload = {
            "Records": [
                {
                    "eventName": "s3:ObjectCreated:Put",
                    "s3": {
                        "bucket": {"name": "test-bucket"},
                        "object": {
                            "key": "images/2024/01/sample001.jpg",
                            "size": 12345,
                            "eTag": '"d41d8cd98f00b204e9800998ecf8427e"',
                            "contentType": "image/jpeg",
                        },
                    },
                }
            ]
        }

        response = client.post(
            f"/api/v1/webhooks/minio/{test_minio_instance.id}",
            json=payload,
        )

        assert response.status_code == 200

        # Verify file_stem was extracted
        sample = db.exec(
            select(Sample).where(
                Sample.minio_instance_id == test_minio_instance.id,
                Sample.object_key == "images/2024/01/sample001.jpg",
            )
        ).first()

        assert sample is not None
        assert sample.file_stem == "sample001"

        # Cleanup
        if sample:
            db.delete(sample)
            db.commit()

    def test_image_created_uses_etag_as_file_hash(
        self, client: TestClient, db: Session, test_minio_instance: MinIOInstance
    ):
        """When an image is created, ETag should be used as file_hash for deduplication."""
        etag = "d41d8cd98f00b204e9800998ecf8427e"
        payload = {
            "Records": [
                {
                    "eventName": "s3:ObjectCreated:Put",
                    "s3": {
                        "bucket": {"name": "test-bucket"},
                        "object": {
                            "key": "images/sample_hash.jpg",
                            "size": 12345,
                            "eTag": f'"{etag}"',
                            "contentType": "image/jpeg",
                        },
                    },
                }
            ]
        }

        response = client.post(
            f"/api/v1/webhooks/minio/{test_minio_instance.id}",
            json=payload,
        )

        assert response.status_code == 200

        sample = db.exec(
            select(Sample).where(
                Sample.minio_instance_id == test_minio_instance.id,
                Sample.object_key == "images/sample_hash.jpg",
            )
        ).first()

        assert sample is not None
        assert sample.file_hash == etag

        # Cleanup
        if sample:
            db.delete(sample)
            db.commit()

    def test_image_created_skips_duplicate_by_file_hash(
        self, client: TestClient, db: Session, test_minio_instance: MinIOInstance
    ):
        """When an image with same file_hash already exists, skip creation."""
        etag = "duplicate_hash_12345"

        # Create existing sample with same file_hash
        existing_sample = Sample(
            id=uuid.uuid4(),
            minio_instance_id=test_minio_instance.id,
            owner_id=test_minio_instance.owner_id,
            bucket="test-bucket",
            object_key="images/old_sample.jpg",
            file_name="old_sample.jpg",
            file_size=12345,
            file_hash=etag,
            file_stem="old_sample",
            source=SampleSource.webhook,
            status=SampleStatus.active,
        )
        db.add(existing_sample)
        db.commit()

        # Try to create new sample with same hash
        payload = {
            "Records": [
                {
                    "eventName": "s3:ObjectCreated:Put",
                    "s3": {
                        "bucket": {"name": "test-bucket"},
                        "object": {
                            "key": "images/new_sample.jpg",
                            "size": 12345,
                            "eTag": f'"{etag}"',
                            "contentType": "image/jpeg",
                        },
                    },
                }
            ]
        }

        response = client.post(
            f"/api/v1/webhooks/minio/{test_minio_instance.id}",
            json=payload,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["processed"] == 0  # Should be skipped

        # Verify no new sample was created
        samples = db.exec(
            select(Sample).where(
                Sample.minio_instance_id == test_minio_instance.id,
                Sample.bucket == "test-bucket",
            )
        ).all()
        assert len(samples) == 1
        assert samples[0].object_key == "images/old_sample.jpg"

        # Cleanup
        db.delete(existing_sample)
        db.commit()

    @patch("app.api.routes.webhooks.find_and_link_annotation")
    def test_image_created_triggers_annotation_matching(
        self,
        mock_find_annotation: MagicMock,
        client: TestClient,
        db: Session,
        test_minio_instance: MinIOInstance,
    ):
        """When an image is created, should trigger annotation file matching."""
        payload = {
            "Records": [
                {
                    "eventName": "s3:ObjectCreated:Put",
                    "s3": {
                        "bucket": {"name": "test-bucket"},
                        "object": {
                            "key": "images/sample_match.jpg",
                            "size": 12345,
                            "eTag": '"unique_abc123"',
                            "contentType": "image/jpeg",
                        },
                    },
                }
            ]
        }

        response = client.post(
            f"/api/v1/webhooks/minio/{test_minio_instance.id}",
            json=payload,
        )

        assert response.status_code == 200
        mock_find_annotation.assert_called_once()

        # Cleanup
        sample = db.exec(
            select(Sample).where(
                Sample.minio_instance_id == test_minio_instance.id,
                Sample.object_key == "images/sample_match.jpg",
            )
        ).first()
        if sample:
            db.delete(sample)
            db.commit()


# =============================================================================
# Phase 3: Annotation Webhook Event Tests
# =============================================================================


class TestWebhookAnnotationCreated:
    """Tests for annotation file (.xml) webhook events."""

    def test_annotation_created_links_to_existing_sample(
        self, client: TestClient, db: Session, test_minio_instance: MinIOInstance
    ):
        """When an annotation file is created, it should link to existing sample with same stem."""
        # Create existing image sample
        image_sample = Sample(
            id=uuid.uuid4(),
            minio_instance_id=test_minio_instance.id,
            owner_id=test_minio_instance.owner_id,
            bucket="test-bucket",
            object_key="images/sample_link.jpg",
            file_name="sample_link.jpg",
            file_size=12345,
            file_stem="sample_link",
            file_hash="abc123_link",
            annotation_status=AnnotationStatus.none,
            source=SampleSource.manual,
            status=SampleStatus.active,
        )
        db.add(image_sample)
        db.commit()

        # Webhook for annotation file
        payload = {
            "Records": [
                {
                    "eventName": "s3:ObjectCreated:Put",
                    "s3": {
                        "bucket": {"name": "test-bucket"},
                        "object": {
                            "key": "labels/sample_link.xml",
                            "size": 500,
                            "eTag": '"def456_link"',
                            "contentType": "application/xml",
                        },
                    },
                }
            ]
        }

        with patch("app.api.routes.webhooks.get_minio_client") as mock_get_client:
            # Mock MinIO client to return XML content
            mock_client = MagicMock()
            mock_client.get_object.return_value.read.return_value = b"""<?xml version="1.0"?>
<annotation>
    <filename>sample_link.jpg</filename>
    <size>
        <width>1920</width>
        <height>1080</height>
    </size>
    <object>
        <name>person</name>
        <bndbox>
            <xmin>100</xmin>
            <ymin>50</ymin>
            <xmax>200</xmax>
            <ymax>300</ymax>
        </bndbox>
    </object>
</annotation>"""
            mock_get_client.return_value = mock_client

            response = client.post(
                f"/api/v1/webhooks/minio/{test_minio_instance.id}",
                json=payload,
            )

        assert response.status_code == 200

        # Verify sample was updated with annotation info
        db.refresh(image_sample)
        assert image_sample.annotation_key == "labels/sample_link.xml"
        assert image_sample.annotation_status == AnnotationStatus.linked

        # Verify Annotation record was created
        annotation = db.exec(
            select(Annotation).where(Annotation.sample_id == image_sample.id)
        ).first()
        assert annotation is not None
        assert annotation.format == AnnotationFormat.voc
        assert annotation.image_width == 1920
        assert annotation.image_height == 1080
        assert annotation.object_count == 1
        assert annotation.class_counts == {"person": 1}

        # Cleanup
        if annotation:
            db.delete(annotation)
        db.delete(image_sample)
        db.commit()

    def test_annotation_created_ignored_when_no_matching_sample(
        self, client: TestClient, db: Session, test_minio_instance: MinIOInstance
    ):
        """When an annotation file arrives but no matching image exists, it should be ignored."""
        payload = {
            "Records": [
                {
                    "eventName": "s3:ObjectCreated:Put",
                    "s3": {
                        "bucket": {"name": "test-bucket"},
                        "object": {
                            "key": "labels/orphan_annotation.xml",
                            "size": 500,
                            "eTag": '"def456_orphan"',
                            "contentType": "application/xml",
                        },
                    },
                }
            ]
        }

        response = client.post(
            f"/api/v1/webhooks/minio/{test_minio_instance.id}",
            json=payload,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["processed"] == 0  # No sample to link to

    def test_annotation_created_detects_conflict(
        self, client: TestClient, db: Session, test_minio_instance: MinIOInstance
    ):
        """When annotation arrives for sample that already has different annotation, mark as conflict."""
        # Create existing image sample with an annotation
        image_sample = Sample(
            id=uuid.uuid4(),
            minio_instance_id=test_minio_instance.id,
            owner_id=test_minio_instance.owner_id,
            bucket="test-bucket",
            object_key="images/sample_conflict.jpg",
            file_name="sample_conflict.jpg",
            file_size=12345,
            file_stem="sample_conflict",
            file_hash="abc123_conflict",
            annotation_key="labels/old_annotation.xml",
            annotation_hash="old_hash_123",
            annotation_status=AnnotationStatus.linked,
            source=SampleSource.manual,
            status=SampleStatus.active,
        )
        db.add(image_sample)
        db.commit()

        # Webhook for new annotation file with different hash
        payload = {
            "Records": [
                {
                    "eventName": "s3:ObjectCreated:Put",
                    "s3": {
                        "bucket": {"name": "test-bucket"},
                        "object": {
                            "key": "labels/sample_conflict.xml",
                            "size": 600,
                            "eTag": '"new_hash_456"',
                            "contentType": "application/xml",
                        },
                    },
                }
            ]
        }

        response = client.post(
            f"/api/v1/webhooks/minio/{test_minio_instance.id}",
            json=payload,
        )

        assert response.status_code == 200

        # Verify sample was marked as conflict
        db.refresh(image_sample)
        assert image_sample.annotation_status == AnnotationStatus.conflict

        # Verify history record was created
        history = db.exec(
            select(SampleHistory).where(
                SampleHistory.sample_id == image_sample.id,
                SampleHistory.action == SampleHistoryAction.annotation_conflict,
            )
        ).first()
        assert history is not None
        assert "old_annotation.xml" in str(history.details)
        assert "sample_conflict.xml" in str(history.details)

        # Cleanup
        if history:
            db.delete(history)
        db.delete(image_sample)
        db.commit()

    def test_annotation_created_skips_duplicate_by_hash(
        self, client: TestClient, db: Session, test_minio_instance: MinIOInstance
    ):
        """When annotation with same hash already linked, skip processing."""
        annotation_hash = "same_hash_skip"

        image_sample = Sample(
            id=uuid.uuid4(),
            minio_instance_id=test_minio_instance.id,
            owner_id=test_minio_instance.owner_id,
            bucket="test-bucket",
            object_key="images/sample_skip.jpg",
            file_name="sample_skip.jpg",
            file_size=12345,
            file_stem="sample_skip",
            file_hash="abc123_skip",
            annotation_key="labels/sample_skip.xml",
            annotation_hash=annotation_hash,
            annotation_status=AnnotationStatus.linked,
            source=SampleSource.manual,
            status=SampleStatus.active,
        )
        db.add(image_sample)
        db.commit()

        # Webhook for same annotation file (same hash)
        payload = {
            "Records": [
                {
                    "eventName": "s3:ObjectCreated:Put",
                    "s3": {
                        "bucket": {"name": "test-bucket"},
                        "object": {
                            "key": "labels/sample_skip.xml",
                            "size": 500,
                            "eTag": f'"{annotation_hash}"',
                            "contentType": "application/xml",
                        },
                    },
                }
            ]
        }

        response = client.post(
            f"/api/v1/webhooks/minio/{test_minio_instance.id}",
            json=payload,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["processed"] == 0  # Should be skipped (same hash)

        # Cleanup
        db.delete(image_sample)
        db.commit()


# =============================================================================
# Phase 3: Object Removal Tests
# =============================================================================


class TestWebhookObjectRemoved:
    """Tests for object removal webhook events."""

    def test_image_removed_soft_deletes_sample(
        self, client: TestClient, db: Session, test_minio_instance: MinIOInstance
    ):
        """When image file is deleted, sample should be soft-deleted."""
        sample = Sample(
            id=uuid.uuid4(),
            minio_instance_id=test_minio_instance.id,
            owner_id=test_minio_instance.owner_id,
            bucket="test-bucket",
            object_key="images/sample_delete.jpg",
            file_name="sample_delete.jpg",
            file_size=12345,
            file_stem="sample_delete",
            source=SampleSource.webhook,
            status=SampleStatus.active,
        )
        db.add(sample)
        db.commit()

        payload = {
            "Records": [
                {
                    "eventName": "s3:ObjectRemoved:Delete",
                    "s3": {
                        "bucket": {"name": "test-bucket"},
                        "object": {"key": "images/sample_delete.jpg"},
                    },
                }
            ]
        }

        response = client.post(
            f"/api/v1/webhooks/minio/{test_minio_instance.id}",
            json=payload,
        )

        assert response.status_code == 200

        db.refresh(sample)
        assert sample.status == SampleStatus.deleted
        assert sample.deleted_at is not None

        # Cleanup
        db.delete(sample)
        db.commit()

    def test_annotation_removed_clears_annotation_link(
        self, client: TestClient, db: Session, test_minio_instance: MinIOInstance
    ):
        """When annotation file is deleted, clear annotation_key but keep sample."""
        sample = Sample(
            id=uuid.uuid4(),
            minio_instance_id=test_minio_instance.id,
            owner_id=test_minio_instance.owner_id,
            bucket="test-bucket",
            object_key="images/sample_ann_remove.jpg",
            file_name="sample_ann_remove.jpg",
            file_size=12345,
            file_stem="sample_ann_remove",
            annotation_key="labels/sample_ann_remove.xml",
            annotation_hash="hash123_remove",
            annotation_status=AnnotationStatus.linked,
            source=SampleSource.webhook,
            status=SampleStatus.active,
        )
        db.add(sample)
        db.commit()

        # Also create the Annotation record
        annotation = Annotation(
            id=uuid.uuid4(),
            sample_id=sample.id,
            format=AnnotationFormat.voc,
            image_width=1920,
            image_height=1080,
            object_count=2,
        )
        db.add(annotation)
        db.commit()

        payload = {
            "Records": [
                {
                    "eventName": "s3:ObjectRemoved:Delete",
                    "s3": {
                        "bucket": {"name": "test-bucket"},
                        "object": {"key": "labels/sample_ann_remove.xml"},
                    },
                }
            ]
        }

        response = client.post(
            f"/api/v1/webhooks/minio/{test_minio_instance.id}",
            json=payload,
        )

        assert response.status_code == 200

        db.refresh(sample)
        # Sample should still be active
        assert sample.status == SampleStatus.active
        # But annotation link should be cleared
        assert sample.annotation_key is None
        assert sample.annotation_hash is None
        assert sample.annotation_status == AnnotationStatus.none

        # Annotation record should be deleted
        remaining_annotation = db.exec(
            select(Annotation).where(Annotation.sample_id == sample.id)
        ).first()
        assert remaining_annotation is None

        # Cleanup
        db.delete(sample)
        db.commit()
