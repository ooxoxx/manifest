"""Import service for batch importing samples from CSV/Excel."""

import uuid
from datetime import datetime
from io import BytesIO
from typing import BinaryIO

import pandas as pd
from sqlmodel import Session, select

from app.models import (
    Sample,
    SampleHistory,
    SampleHistoryAction,
    SampleSource,
    SampleStatus,
    WatchedPath,
)
from app.services.minio_service import MinIOService


def import_samples_from_csv(
    *,
    session: Session,
    file: BinaryIO,
    minio_instance_id: uuid.UUID,
    owner_id: uuid.UUID,
    batch_size: int = 1000,
) -> dict:
    """Import samples from CSV file."""
    df = pd.read_csv(file)
    return _import_samples_from_dataframe(
        session=session,
        df=df,
        minio_instance_id=minio_instance_id,
        owner_id=owner_id,
        batch_size=batch_size,
    )


def import_samples_from_excel(
    *,
    session: Session,
    file: BinaryIO,
    minio_instance_id: uuid.UUID,
    owner_id: uuid.UUID,
    batch_size: int = 1000,
) -> dict:
    """Import samples from Excel file."""
    df = pd.read_excel(file)
    return _import_samples_from_dataframe(
        session=session,
        df=df,
        minio_instance_id=minio_instance_id,
        owner_id=owner_id,
        batch_size=batch_size,
    )


def _import_samples_from_dataframe(
    *,
    session: Session,
    df: pd.DataFrame,
    minio_instance_id: uuid.UUID,
    owner_id: uuid.UUID,
    batch_size: int = 1000,
) -> dict:
    """Import samples from a pandas DataFrame."""
    required_columns = ["bucket", "object_key"]
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")

    created_count = 0
    skipped_count = 0
    error_count = 0
    errors: list[str] = []

    for i in range(0, len(df), batch_size):
        batch = df.iloc[i : i + batch_size]

        for _, row in batch.iterrows():
            try:
                bucket = str(row["bucket"])
                object_key = str(row["object_key"])

                # Check if sample already exists
                existing = session.exec(
                    select(Sample).where(
                        Sample.minio_instance_id == minio_instance_id,
                        Sample.bucket == bucket,
                        Sample.object_key == object_key,
                    )
                ).first()

                if existing:
                    skipped_count += 1
                    continue

                # Extract file name from object key
                file_name = object_key.split("/")[-1]

                sample = Sample(
                    minio_instance_id=minio_instance_id,
                    owner_id=owner_id,
                    bucket=bucket,
                    object_key=object_key,
                    file_name=file_name,
                    file_size=int(row.get("file_size", 0)) if pd.notna(row.get("file_size")) else 0,
                    content_type=str(row.get("content_type")) if pd.notna(row.get("content_type")) else None,
                    source=SampleSource.import_csv,
                    status=SampleStatus.active,
                )
                session.add(sample)
                created_count += 1

            except Exception as e:
                error_count += 1
                errors.append(f"Row {i}: {str(e)}")

        session.commit()

    return {
        "created": created_count,
        "skipped": skipped_count,
        "errors": error_count,
        "error_details": errors[:100],  # Limit error details
    }
