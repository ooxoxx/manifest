"""MinIO bucket notification configuration service."""

import logging
import uuid

from minio.commonconfig import Filter
from minio.notificationconfig import (
    NotificationConfig,
    PrefixFilterRule,
    QueueConfig,
)

from app.models import MinIOInstance
from app.services.minio_service import MinIOService

logger = logging.getLogger(__name__)

# Default webhook ARN for MinIO - configured via MINIO_NOTIFY_WEBHOOK_ENABLE_MANIFEST
WEBHOOK_ARN = "arn:minio:sqs::MANIFEST:webhook"


class NotificationService:
    """Service for managing MinIO bucket notifications."""

    @staticmethod
    def generate_config_id(watched_path_id: uuid.UUID) -> str:
        """Generate a unique config ID for a watched path."""
        return f"manifest-{watched_path_id}"

    @staticmethod
    def configure_bucket_notification(
        instance: MinIOInstance,
        bucket: str,
        prefix: str,
        watched_path_id: uuid.UUID,
        events: list[str] | None = None,
    ) -> bool:
        """Configure bucket notification for a watched path.

        Args:
            instance: MinIO instance configuration
            bucket: Bucket name
            prefix: Object prefix to watch
            watched_path_id: UUID of the WatchedPath record
            events: List of events to subscribe to (default: create and remove)

        Returns:
            True if configuration was successful, False otherwise
        """
        if events is None:
            events = ["s3:ObjectCreated:*", "s3:ObjectRemoved:*"]

        config_id = NotificationService.generate_config_id(watched_path_id)

        try:
            client = MinIOService.get_client(instance)

            # Get existing notification config
            try:
                existing_config = client.get_bucket_notification(bucket)
                existing_queues = list(existing_config.queue_config_list or [])
            except Exception:
                existing_queues = []

            # Remove any existing config with the same ID
            existing_queues = [q for q in existing_queues if q.config_id != config_id]

            # Build filter rules for prefix
            filter_config = None
            if prefix:
                filter_config = Filter(
                    prefix_filter_rule=PrefixFilterRule(prefix),
                )

            # Create new queue config
            queue_config = QueueConfig(
                WEBHOOK_ARN,
                events,
                config_id=config_id,
                prefix_filter_rule=PrefixFilterRule(prefix) if prefix else None,
            )

            # Add to existing configs
            existing_queues.append(queue_config)

            # Set the new configuration
            new_config = NotificationConfig(queue_config_list=existing_queues)
            client.set_bucket_notification(bucket, new_config)

            logger.info(
                f"Configured bucket notification for {bucket}/{prefix} "
                f"with config_id={config_id}"
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to configure bucket notification for {bucket}/{prefix}: {e}"
            )
            return False

    @staticmethod
    def remove_bucket_notification(
        instance: MinIOInstance,
        bucket: str,
        watched_path_id: uuid.UUID,
    ) -> bool:
        """Remove bucket notification configuration for a watched path.

        Args:
            instance: MinIO instance configuration
            bucket: Bucket name
            watched_path_id: UUID of the WatchedPath record

        Returns:
            True if removal was successful, False otherwise
        """
        config_id = NotificationService.generate_config_id(watched_path_id)

        try:
            client = MinIOService.get_client(instance)

            # Get existing notification config
            try:
                existing_config = client.get_bucket_notification(bucket)
                existing_queues = list(existing_config.queue_config_list or [])
            except Exception:
                # No existing config, nothing to remove
                return True

            # Filter out the config with matching ID
            filtered_queues = [q for q in existing_queues if q.config_id != config_id]

            # If nothing changed, the config wasn't there
            if len(filtered_queues) == len(existing_queues):
                logger.info(f"No notification config found with id={config_id}")
                return True

            # Set the updated configuration
            new_config = NotificationConfig(queue_config_list=filtered_queues)
            client.set_bucket_notification(bucket, new_config)

            logger.info(
                f"Removed bucket notification config_id={config_id} from {bucket}"
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to remove bucket notification config_id={config_id}: {e}"
            )
            return False

    @staticmethod
    def get_bucket_notifications(
        instance: MinIOInstance,
        bucket: str,
    ) -> list[dict]:
        """Get all notification configurations for a bucket.

        Args:
            instance: MinIO instance configuration
            bucket: Bucket name

        Returns:
            List of notification config dictionaries
        """
        try:
            client = MinIOService.get_client(instance)
            config = client.get_bucket_notification(bucket)

            return [
                {
                    "config_id": q.config_id,
                    "events": q.events,
                    "prefix": (
                        q.prefix_filter_rule.value if q.prefix_filter_rule else ""
                    ),
                    "arn": q.queue,
                }
                for q in (config.queue_config_list or [])
            ]
        except Exception as e:
            logger.error(f"Failed to get bucket notifications for {bucket}: {e}")
            return []
