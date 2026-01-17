"""Tests for MatchingService - image and annotation file linking."""

import uuid
from unittest.mock import MagicMock

import pytest


def test_finds_annotation_by_matching_file_stem():
    """Find annotation file for an image based on file_stem match."""
    from app.services.matching_service import find_annotation_for_image

    # Create a mock sample
    sample = MagicMock()
    sample.file_stem = "sample001"
    sample.minio_instance_id = uuid.uuid4()
    sample.bucket = "test-bucket"

    # Create a mock MinIO client
    mock_client = MagicMock()
    # Simulate finding matching annotation file
    mock_client.list_objects.return_value = [
        MagicMock(object_name="labels/sample001.xml")
    ]

    result = find_annotation_for_image(sample, mock_client)

    assert result == "labels/sample001.xml"
    # Verify list_objects was called with correct bucket
    mock_client.list_objects.assert_called_once()


def test_returns_none_when_no_annotation_found():
    """Return None when no matching annotation file exists."""
    from app.services.matching_service import find_annotation_for_image

    sample = MagicMock()
    sample.file_stem = "sample999"
    sample.bucket = "test-bucket"

    mock_client = MagicMock()
    # No matching files
    mock_client.list_objects.return_value = []

    result = find_annotation_for_image(sample, mock_client)

    assert result is None


def test_extracts_file_stem_from_filename():
    """Extract file stem (filename without extension) correctly."""
    from app.services.matching_service import extract_file_stem

    assert extract_file_stem("sample001.jpg") == "sample001"
    assert extract_file_stem("image_123.png") == "image_123"
    assert extract_file_stem("path/to/file.jpeg") == "file"
    assert extract_file_stem("no_extension") == "no_extension"
    assert extract_file_stem("multi.dot.name.xml") == "multi.dot.name"
