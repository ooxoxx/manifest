"""MinIO service for interacting with MinIO instances."""

import uuid
from datetime import timedelta

from minio import Minio
from minio.error import S3Error
from sqlmodel import Session

from app.core.encryption import decrypt_value, encrypt_value
from app.models import (
    MinIOInstance,
    MinIOInstanceCreate,
    MinIOInstanceUpdate,
    Sample,
    SampleCreate,
    SampleHistory,
    SampleHistoryAction,
    SampleSource,
    SampleStatus,
)


class MinIOService:
    """Service for MinIO operations."""

    @staticmethod
    def get_client(instance: MinIOInstance) -> Minio:
        """Create a MinIO client from instance configuration."""
        access_key = decrypt_value(instance.access_key_encrypted)
        secret_key = decrypt_value(instance.secret_key_encrypted)

        return Minio(
            instance.endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=instance.secure,
        )

    @staticmethod
    def test_connection(instance: MinIOInstance) -> tuple[bool, str]:
        """Test connection to MinIO instance."""
        try:
            client = MinIOService.get_client(instance)
            # Try to list buckets to verify connection
            client.list_buckets()
            return True, "Connection successful"
        except S3Error as e:
            return False, f"S3 Error: {e.message}"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"

    @staticmethod
    def list_buckets(instance: MinIOInstance) -> list[str]:
        """List all buckets in the MinIO instance."""
        client = MinIOService.get_client(instance)
        buckets = client.list_buckets()
        return [bucket.name for bucket in buckets]

    @staticmethod
    def list_objects(
        instance: MinIOInstance,
        bucket: str,
        prefix: str = "",
        recursive: bool = True,
    ) -> list[dict]:
        """List objects in a bucket with optional prefix."""
        client = MinIOService.get_client(instance)
        objects = []

        for obj in client.list_objects(bucket, prefix=prefix, recursive=recursive):
            if not obj.is_dir:
                objects.append({
                    "object_key": obj.object_name,
                    "size": obj.size,
                    "etag": obj.etag.strip('"') if obj.etag else None,
                    "content_type": obj.content_type,
                    "last_modified": obj.last_modified,
                })

        return objects

    @staticmethod
    def get_presigned_url(
        instance: MinIOInstance,
        bucket: str,
        object_key: str,
        expires: timedelta = timedelta(hours=1),
    ) -> str:
        """Generate a presigned URL for object access."""
        client = MinIOService.get_client(instance)
        return client.presigned_get_object(bucket, object_key, expires=expires)

    @staticmethod
    def get_object_stat(
        instance: MinIOInstance,
        bucket: str,
        object_key: str,
    ) -> dict | None:
        """Get object metadata."""
        try:
            client = MinIOService.get_client(instance)
            stat = client.stat_object(bucket, object_key)
            return {
                "size": stat.size,
                "etag": stat.etag.strip('"') if stat.etag else None,
                "content_type": stat.content_type,
                "last_modified": stat.last_modified,
                "metadata": dict(stat.metadata) if stat.metadata else None,
            }
        except S3Error:
            return None


def create_minio_instance(
    *,
    session: Session,
    instance_in: MinIOInstanceCreate,
    owner_id: uuid.UUID,
) -> MinIOInstance:
    """Create a new MinIO instance with encrypted credentials."""
    db_instance = MinIOInstance(
        name=instance_in.name,
        endpoint=instance_in.endpoint,
        secure=instance_in.secure,
        description=instance_in.description,
        is_active=instance_in.is_active,
        access_key_encrypted=encrypt_value(instance_in.access_key),
        secret_key_encrypted=encrypt_value(instance_in.secret_key),
        owner_id=owner_id,
    )
    session.add(db_instance)
    session.commit()
    session.refresh(db_instance)
    return db_instance


def update_minio_instance(
    *,
    session: Session,
    db_instance: MinIOInstance,
    instance_in: MinIOInstanceUpdate,
) -> MinIOInstance:
    """Update a MinIO instance."""
    update_data = instance_in.model_dump(exclude_unset=True)

    # Handle credential encryption
    if "access_key" in update_data and update_data["access_key"]:
        update_data["access_key_encrypted"] = encrypt_value(update_data.pop("access_key"))
    else:
        update_data.pop("access_key", None)

    if "secret_key" in update_data and update_data["secret_key"]:
        update_data["secret_key_encrypted"] = encrypt_value(update_data.pop("secret_key"))
    else:
        update_data.pop("secret_key", None)

    db_instance.sqlmodel_update(update_data)
    session.add(db_instance)
    session.commit()
    session.refresh(db_instance)
    return db_instance
