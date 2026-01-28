"""Import service for batch importing samples from CSV/Excel."""

import uuid
from dataclasses import dataclass, field
from typing import BinaryIO

import pandas as pd
from sqlmodel import Session, select

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
    SampleTag,
    Tag,
)
from app.services.annotation_service import parse_voc_xml
from app.services.matching_service import extract_file_stem
from app.services.minio_service import MinIOService

# Image file extensions
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".tif"}
# Annotation file extensions
ANNOTATION_EXTENSIONS = {".xml"}


@dataclass
class ImportResult:
    """Result of import operation."""

    created: int = 0
    skipped: int = 0
    errors: int = 0
    annotations_linked: int = 0
    tags_created: int = 0
    error_details: list[str] = field(default_factory=list)


@dataclass
class CSVPreview:
    """Preview of CSV file for import."""

    total_rows: int
    columns: list[str]
    sample_rows: list[dict]
    has_tags_column: bool
    image_count: int
    annotation_count: int


def preview_csv(file: BinaryIO) -> CSVPreview:
    """Preview CSV file content for import.

    Args:
        file: CSV file to preview

    Returns:
        CSVPreview with file statistics
    """
    df = pd.read_csv(file)
    file.seek(0)  # Reset file pointer for later use

    columns = list(df.columns)
    has_tags = "tags" in columns

    # Count images and annotations
    image_count = 0
    annotation_count = 0

    if "object_key" in columns:
        for key in df["object_key"]:
            ext = "." + str(key).split(".")[-1].lower() if "." in str(key) else ""
            if ext in IMAGE_EXTENSIONS:
                image_count += 1
            elif ext in ANNOTATION_EXTENSIONS:
                annotation_count += 1

    return CSVPreview(
        total_rows=len(df),
        columns=columns,
        sample_rows=df.head(5).to_dict(orient="records"),
        has_tags_column=has_tags,
        image_count=image_count,
        annotation_count=annotation_count,
    )


def get_or_create_tag_by_path(
    session: Session,
    owner_id: uuid.UUID,
    tag_path: str,
    tag_cache: dict[str, uuid.UUID],
) -> uuid.UUID:
    """Get or create a tag by its hierarchical path.

    Args:
        session: Database session
        owner_id: Owner user ID
        tag_path: Tag path (e.g., "输电/山火" or "已标注")
        tag_cache: Cache of already processed tag paths to IDs

    Returns:
        Tag UUID
    """
    tag_path = tag_path.strip()
    if tag_path in tag_cache:
        return tag_cache[tag_path]

    parts = tag_path.split("/")
    parent_id = None
    current_path = ""

    for part in parts:
        part = part.strip()
        if not part:
            continue

        current_path = f"{current_path}/{part}" if current_path else part

        if current_path in tag_cache:
            parent_id = tag_cache[current_path]
            continue

        # Find existing tag
        if parent_id:
            query = select(Tag).where(
                Tag.owner_id == owner_id,
                Tag.name == part,
                Tag.parent_id == parent_id,
            )
        else:
            query = select(Tag).where(
                Tag.owner_id == owner_id,
                Tag.name == part,
                Tag.parent_id.is_(None),  # type: ignore[union-attr]
            )
        existing_tag = session.exec(query).first()

        if existing_tag:
            tag_cache[current_path] = existing_tag.id
            parent_id = existing_tag.id
        else:
            # Create new tag
            new_tag = Tag(
                name=part,
                parent_id=parent_id,
                owner_id=owner_id,
            )
            session.add(new_tag)
            session.flush()  # Get the ID
            tag_cache[current_path] = new_tag.id
            parent_id = new_tag.id

    return parent_id  # type: ignore


def import_samples_from_csv(
    *,
    session: Session,
    file: BinaryIO,
    minio_instance_id: uuid.UUID,
    owner_id: uuid.UUID,
    validate_files: bool = True,
    batch_size: int = 500,
) -> ImportResult:
    """Import samples from CSV file.

    Args:
        session: Database session
        file: CSV file
        minio_instance_id: MinIO instance ID
        owner_id: Owner user ID
        validate_files: Whether to validate file existence via HEAD request
        batch_size: Batch size for processing

    Returns:
        ImportResult with statistics
    """
    df = pd.read_csv(file)
    return _import_samples_from_dataframe(
        session=session,
        df=df,
        minio_instance_id=minio_instance_id,
        owner_id=owner_id,
        validate_files=validate_files,
        batch_size=batch_size,
    )


def import_samples_from_excel(
    *,
    session: Session,
    file: BinaryIO,
    minio_instance_id: uuid.UUID,
    owner_id: uuid.UUID,
    validate_files: bool = True,
    batch_size: int = 500,
) -> ImportResult:
    """Import samples from Excel file.

    Args:
        session: Database session
        file: Excel file
        minio_instance_id: MinIO instance ID
        owner_id: Owner user ID
        validate_files: Whether to validate file existence via HEAD request
        batch_size: Batch size for processing

    Returns:
        ImportResult with statistics
    """
    df = pd.read_excel(file)
    return _import_samples_from_dataframe(
        session=session,
        df=df,
        minio_instance_id=minio_instance_id,
        owner_id=owner_id,
        validate_files=validate_files,
        batch_size=batch_size,
    )


def _import_samples_from_dataframe(
    *,
    session: Session,
    df: pd.DataFrame,
    minio_instance_id: uuid.UUID,
    owner_id: uuid.UUID,
    validate_files: bool = True,
    batch_size: int = 500,
) -> ImportResult:
    """Import samples from a pandas DataFrame.

    Supports:
    - file_stem extraction for annotation matching
    - file_hash from MinIO ETag for deduplication
    - tags column with hierarchical tag creation
    - Annotation linking and parsing

    Args:
        session: Database session
        df: DataFrame with object_key and bucket (required), tags (optional)
        minio_instance_id: MinIO instance ID
        owner_id: Owner user ID
        validate_files: Whether to validate file existence
        batch_size: Batch size for processing

    Returns:
        ImportResult with statistics
    """
    # Check required columns
    if "object_key" not in df.columns:
        raise ValueError("Missing required column: object_key")

    if "bucket" not in df.columns:
        raise ValueError("Missing required column: bucket")

    has_tags_column = "tags" in df.columns

    # Get MinIO instance
    minio_instance = session.get(MinIOInstance, minio_instance_id)
    if not minio_instance:
        raise ValueError(f"MinIO instance not found: {minio_instance_id}")

    result = ImportResult()
    tag_cache: dict[str, uuid.UUID] = {}

    # Separate images and annotations for two-pass processing
    image_rows = []
    annotation_rows = []

    for _, row in df.iterrows():
        object_key = str(row["object_key"])
        ext = "." + object_key.split(".")[-1].lower() if "." in object_key else ""
        if ext in IMAGE_EXTENSIONS:
            image_rows.append(row)
        elif ext in ANNOTATION_EXTENSIONS:
            annotation_rows.append(row)
        # Skip other file types silently

    # First pass: Process images
    for i in range(0, len(image_rows), batch_size):
        batch = image_rows[i : i + batch_size]

        for row in batch:
            try:
                object_key = str(row["object_key"])
                row_bucket = str(row["bucket"]) if pd.notna(row.get("bucket")) else None
                if not row_bucket:
                    result.errors += 1
                    result.error_details.append(f"No bucket for: {object_key}")
                    continue

                # Check if sample already exists by path
                existing = session.exec(
                    select(Sample).where(
                        Sample.minio_instance_id == minio_instance_id,
                        Sample.bucket == row_bucket,
                        Sample.object_key == object_key,
                    )
                ).first()

                if existing:
                    result.skipped += 1
                    continue

                # Extract file metadata
                file_name = object_key.split("/")[-1]
                file_stem = extract_file_stem(object_key)

                # Validate file and get metadata from MinIO
                file_size = 0
                file_hash = None
                content_type = None
                etag = None

                if validate_files:
                    stat = MinIOService.get_object_stat(
                        instance=minio_instance,
                        bucket=row_bucket,
                        object_key=object_key,
                    )
                    if not stat:
                        result.errors += 1
                        result.error_details.append(f"File not found: {row_bucket}/{object_key}")
                        continue
                    file_size = stat.get("size", 0)
                    etag = stat.get("etag")
                    file_hash = etag  # Use ETag as file hash (MD5 for non-multipart uploads)
                    content_type = stat.get("content_type")
                else:
                    # Use values from CSV if available
                    file_size = int(row.get("file_size", 0)) if pd.notna(row.get("file_size")) else 0
                    content_type = str(row.get("content_type")) if pd.notna(row.get("content_type")) else None

                # Check for duplicate by file_hash
                if file_hash:
                    existing_by_hash = session.exec(
                        select(Sample).where(
                            Sample.owner_id == owner_id,
                            Sample.file_hash == file_hash,
                        )
                    ).first()
                    if existing_by_hash:
                        result.skipped += 1
                        result.error_details.append(
                            f"Duplicate (hash): {object_key} matches {existing_by_hash.object_key}"
                        )
                        continue

                # Create sample
                sample = Sample(
                    minio_instance_id=minio_instance_id,
                    owner_id=owner_id,
                    bucket=row_bucket,
                    object_key=object_key,
                    file_name=file_name,
                    file_stem=file_stem,
                    file_size=file_size,
                    file_hash=file_hash,
                    etag=etag,
                    content_type=content_type,
                    source=SampleSource.import_csv,
                    status=SampleStatus.active,
                    annotation_status=AnnotationStatus.none,
                )
                session.add(sample)
                session.flush()  # Get sample ID

                # Process tags
                if has_tags_column and pd.notna(row.get("tags")):
                    tags_str = str(row["tags"])
                    tag_paths = [t.strip() for t in tags_str.split(",") if t.strip()]

                    for tag_path in tag_paths:
                        tag_id = get_or_create_tag_by_path(
                            session=session,
                            owner_id=owner_id,
                            tag_path=tag_path,
                            tag_cache=tag_cache,
                        )
                        # Create sample-tag association
                        sample_tag = SampleTag(sample_id=sample.id, tag_id=tag_id)
                        session.add(sample_tag)

                # Record history
                history = SampleHistory(
                    sample_id=sample.id,
                    action=SampleHistoryAction.created,
                    details={"source": "csv_import"},
                )
                session.add(history)

                result.created += 1

            except Exception as e:
                result.errors += 1
                result.error_details.append(f"Error processing {row.get('object_key', 'unknown')}: {str(e)}")

        session.commit()

    # Count newly created tags
    result.tags_created = len(tag_cache)

    # Second pass: Process annotations and link to images
    for i in range(0, len(annotation_rows), batch_size):
        batch = annotation_rows[i : i + batch_size]

        for row in batch:
            try:
                object_key = str(row["object_key"])
                row_bucket = str(row["bucket"]) if pd.notna(row.get("bucket")) else None
                if not row_bucket:
                    continue

                annotation_stem = extract_file_stem(object_key)

                # Find matching image sample by file_stem
                matching_sample = session.exec(
                    select(Sample).where(
                        Sample.owner_id == owner_id,
                        Sample.bucket == row_bucket,
                        Sample.file_stem == annotation_stem,
                        Sample.annotation_status == AnnotationStatus.none,
                    )
                ).first()

                if not matching_sample:
                    # No matching image found - skip silently
                    continue

                # Get annotation file content and parse
                try:
                    client = MinIOService.get_client(minio_instance)
                    response = client.get_object(row_bucket, object_key)
                    xml_content = response.read()
                    response.close()
                    response.release_conn()

                    parsed = parse_voc_xml(xml_content)
                    if not parsed:
                        matching_sample.annotation_status = AnnotationStatus.error
                        session.add(matching_sample)
                        continue

                    # Get annotation hash
                    ann_stat = MinIOService.get_object_stat(
                        instance=minio_instance,
                        bucket=row_bucket,
                        object_key=object_key,
                    )
                    annotation_hash = ann_stat.get("etag") if ann_stat else None

                    # Create Annotation record
                    annotation = Annotation(
                        sample_id=matching_sample.id,
                        format=AnnotationFormat.voc,
                        image_width=parsed.image_width,
                        image_height=parsed.image_height,
                        object_count=parsed.object_count,
                        class_counts=parsed.class_counts,
                        objects=parsed.objects,
                    )
                    session.add(annotation)
                    session.flush()

                    # Update sample with annotation info
                    matching_sample.annotation_id = annotation.id
                    matching_sample.annotation_key = object_key
                    matching_sample.annotation_hash = annotation_hash
                    matching_sample.annotation_status = AnnotationStatus.linked
                    session.add(matching_sample)

                    result.annotations_linked += 1

                except Exception as e:
                    matching_sample.annotation_status = AnnotationStatus.error
                    session.add(matching_sample)
                    result.error_details.append(f"Annotation parse error {object_key}: {str(e)}")

            except Exception as e:
                result.error_details.append(f"Error processing annotation {row.get('object_key', 'unknown')}: {str(e)}")

        session.commit()

    # Limit error details
    result.error_details = result.error_details[:100]

    return result
