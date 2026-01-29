"""Tests for NotificationService."""

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.models import MinIOInstance
from app.services.notification_service import NotificationService, WEBHOOK_ARN


@pytest.fixture
def mock_minio_instance():
    """Create a mock MinIO instance."""
    return MinIOInstance(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        name="Test MinIO",
        endpoint="127.0.0.1:9000",
        access_key_encrypted="encrypted_key",
        secret_key_encrypted="encrypted_secret",
        secure=False,
    )


class TestNotificationServiceConfigId:
    """Tests for config ID generation."""

    def test_generate_config_id_format(self):
        """Config ID should have manifest-{uuid} format."""
        watched_path_id = uuid.uuid4()
        config_id = NotificationService.generate_config_id(watched_path_id)

        assert config_id.startswith("manifest-")
        assert str(watched_path_id) in config_id

    def test_generate_config_id_unique(self):
        """Different watched path IDs should generate different config IDs."""
        id1 = uuid.uuid4()
        id2 = uuid.uuid4()

        config_id1 = NotificationService.generate_config_id(id1)
        config_id2 = NotificationService.generate_config_id(id2)

        assert config_id1 != config_id2


class TestNotificationServiceConfigure:
    """Tests for bucket notification configuration."""

    @patch("app.services.notification_service.MinIOService.get_client")
    def test_configure_bucket_notification_success(
        self, mock_get_client: MagicMock, mock_minio_instance: MinIOInstance
    ):
        """Configuring bucket notification should succeed."""
        mock_client = MagicMock()
        mock_client.get_bucket_notification.return_value = MagicMock(
            queue_config_list=[]
        )
        mock_get_client.return_value = mock_client

        watched_path_id = uuid.uuid4()
        result = NotificationService.configure_bucket_notification(
            instance=mock_minio_instance,
            bucket="test-bucket",
            prefix="images/",
            watched_path_id=watched_path_id,
        )

        assert result is True
        mock_client.set_bucket_notification.assert_called_once()

    @patch("app.services.notification_service.MinIOService.get_client")
    def test_configure_bucket_notification_with_custom_events(
        self, mock_get_client: MagicMock, mock_minio_instance: MinIOInstance
    ):
        """Configuring with custom events should use those events."""
        mock_client = MagicMock()
        mock_client.get_bucket_notification.return_value = MagicMock(
            queue_config_list=[]
        )
        mock_get_client.return_value = mock_client

        watched_path_id = uuid.uuid4()
        custom_events = ["s3:ObjectCreated:Put"]
        result = NotificationService.configure_bucket_notification(
            instance=mock_minio_instance,
            bucket="test-bucket",
            prefix="",
            watched_path_id=watched_path_id,
            events=custom_events,
        )

        assert result is True
        mock_client.set_bucket_notification.assert_called_once()

    @patch("app.services.notification_service.MinIOService.get_client")
    def test_configure_bucket_notification_failure(
        self, mock_get_client: MagicMock, mock_minio_instance: MinIOInstance
    ):
        """Configuration failure should return False."""
        mock_client = MagicMock()
        # Make set_bucket_notification fail, not get_bucket_notification
        mock_client.get_bucket_notification.return_value = MagicMock(
            queue_config_list=[]
        )
        mock_client.set_bucket_notification.side_effect = Exception("Connection failed")
        mock_get_client.return_value = mock_client

        watched_path_id = uuid.uuid4()
        result = NotificationService.configure_bucket_notification(
            instance=mock_minio_instance,
            bucket="test-bucket",
            prefix="images/",
            watched_path_id=watched_path_id,
        )

        assert result is False

    @patch("app.services.notification_service.MinIOService.get_client")
    def test_configure_bucket_notification_replaces_existing(
        self, mock_get_client: MagicMock, mock_minio_instance: MinIOInstance
    ):
        """Configuring should replace existing config with same ID."""
        watched_path_id = uuid.uuid4()
        config_id = NotificationService.generate_config_id(watched_path_id)

        # Mock existing config with same ID
        existing_queue = MagicMock()
        existing_queue.config_id = config_id

        mock_client = MagicMock()
        mock_client.get_bucket_notification.return_value = MagicMock(
            queue_config_list=[existing_queue]
        )
        mock_get_client.return_value = mock_client

        result = NotificationService.configure_bucket_notification(
            instance=mock_minio_instance,
            bucket="test-bucket",
            prefix="new-prefix/",
            watched_path_id=watched_path_id,
        )

        assert result is True
        mock_client.set_bucket_notification.assert_called_once()


class TestNotificationServiceRemove:
    """Tests for bucket notification removal."""

    @patch("app.services.notification_service.MinIOService.get_client")
    def test_remove_bucket_notification_success(
        self, mock_get_client: MagicMock, mock_minio_instance: MinIOInstance
    ):
        """Removing bucket notification should succeed."""
        watched_path_id = uuid.uuid4()
        config_id = NotificationService.generate_config_id(watched_path_id)

        # Mock existing config
        existing_queue = MagicMock()
        existing_queue.config_id = config_id

        mock_client = MagicMock()
        mock_client.get_bucket_notification.return_value = MagicMock(
            queue_config_list=[existing_queue]
        )
        mock_get_client.return_value = mock_client

        result = NotificationService.remove_bucket_notification(
            instance=mock_minio_instance,
            bucket="test-bucket",
            watched_path_id=watched_path_id,
        )

        assert result is True
        mock_client.set_bucket_notification.assert_called_once()

    @patch("app.services.notification_service.MinIOService.get_client")
    def test_remove_bucket_notification_not_found(
        self, mock_get_client: MagicMock, mock_minio_instance: MinIOInstance
    ):
        """Removing non-existent notification should return True."""
        mock_client = MagicMock()
        mock_client.get_bucket_notification.return_value = MagicMock(
            queue_config_list=[]
        )
        mock_get_client.return_value = mock_client

        watched_path_id = uuid.uuid4()
        result = NotificationService.remove_bucket_notification(
            instance=mock_minio_instance,
            bucket="test-bucket",
            watched_path_id=watched_path_id,
        )

        assert result is True
        # Should not call set_bucket_notification if nothing to remove
        mock_client.set_bucket_notification.assert_not_called()

    @patch("app.services.notification_service.MinIOService.get_client")
    def test_remove_bucket_notification_failure(
        self, mock_get_client: MagicMock, mock_minio_instance: MinIOInstance
    ):
        """Removal failure should return False."""
        mock_client = MagicMock()
        mock_client.get_bucket_notification.side_effect = Exception("Connection failed")
        mock_get_client.return_value = mock_client

        watched_path_id = uuid.uuid4()
        result = NotificationService.remove_bucket_notification(
            instance=mock_minio_instance,
            bucket="test-bucket",
            watched_path_id=watched_path_id,
        )

        # Should return True if get_bucket_notification fails (nothing to remove)
        assert result is True


class TestNotificationServiceGet:
    """Tests for getting bucket notifications."""

    @patch("app.services.notification_service.MinIOService.get_client")
    def test_get_bucket_notifications_success(
        self, mock_get_client: MagicMock, mock_minio_instance: MinIOInstance
    ):
        """Getting bucket notifications should return list of configs."""
        # Mock queue config
        mock_queue = MagicMock()
        mock_queue.config_id = "manifest-test"
        mock_queue.events = ["s3:ObjectCreated:*"]
        mock_queue.prefix_filter_rule = MagicMock(value="images/")
        mock_queue.queue = WEBHOOK_ARN

        mock_client = MagicMock()
        mock_client.get_bucket_notification.return_value = MagicMock(
            queue_config_list=[mock_queue]
        )
        mock_get_client.return_value = mock_client

        result = NotificationService.get_bucket_notifications(
            instance=mock_minio_instance,
            bucket="test-bucket",
        )

        assert len(result) == 1
        assert result[0]["config_id"] == "manifest-test"
        assert result[0]["events"] == ["s3:ObjectCreated:*"]
        assert result[0]["prefix"] == "images/"

    @patch("app.services.notification_service.MinIOService.get_client")
    def test_get_bucket_notifications_empty(
        self, mock_get_client: MagicMock, mock_minio_instance: MinIOInstance
    ):
        """Getting notifications from bucket with none should return empty list."""
        mock_client = MagicMock()
        mock_client.get_bucket_notification.return_value = MagicMock(
            queue_config_list=[]
        )
        mock_get_client.return_value = mock_client

        result = NotificationService.get_bucket_notifications(
            instance=mock_minio_instance,
            bucket="test-bucket",
        )

        assert result == []

    @patch("app.services.notification_service.MinIOService.get_client")
    def test_get_bucket_notifications_failure(
        self, mock_get_client: MagicMock, mock_minio_instance: MinIOInstance
    ):
        """Getting notifications failure should return empty list."""
        mock_client = MagicMock()
        mock_client.get_bucket_notification.side_effect = Exception("Connection failed")
        mock_get_client.return_value = mock_client

        result = NotificationService.get_bucket_notifications(
            instance=mock_minio_instance,
            bucket="test-bucket",
        )

        assert result == []
