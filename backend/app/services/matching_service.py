"""Matching service for linking images and annotation files."""

import os
from typing import Any

from app.models import Sample


def extract_file_stem(filename: str) -> str:
    """Extract file stem (filename without extension).

    Args:
        filename: Full filename or path

    Returns:
        Filename without extension
    """
    # Get basename if it's a path
    basename = os.path.basename(filename)
    # Remove extension
    stem = os.path.splitext(basename)[0]
    return stem


def find_annotation_for_image(sample: Sample, minio_client: Any) -> str | None:
    """Find annotation file for an image sample based on file_stem match.

    Args:
        sample: Image sample to find annotation for
        minio_client: MinIO client instance

    Returns:
        Annotation file object key if found, None otherwise
    """
    if not sample.file_stem:
        return None

    # List objects in the bucket looking for matching annotation files
    objects = minio_client.list_objects(
        bucket_name=sample.bucket,
        recursive=True,
    )

    # Look for .xml files with matching stem
    for obj in objects:
        obj_stem = extract_file_stem(obj.object_name)
        if obj_stem == sample.file_stem and obj.object_name.endswith(".xml"):
            return obj.object_name

    return None
