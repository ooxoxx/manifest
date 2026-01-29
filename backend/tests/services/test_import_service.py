"""Tests for ImportService CSV import functionality."""

import uuid
from io import BytesIO
from unittest.mock import MagicMock

import pytest


# =============================================================================
# Tests for preview_csv function
# =============================================================================


def test_preview_csv_identifies_columns_and_row_count():
    """Preview should correctly identify columns and count rows."""
    csv_content = b"""object_key,tags
images/2024/01/sample001.jpg,"cat/persian,trained"
images/2024/01/sample002.jpg,"dog/husky"
images/2024/01/sample003.png,
"""

    from app.services.import_service import preview_csv

    result = preview_csv(BytesIO(csv_content))

    assert result.total_rows == 3
    assert "object_key" in result.columns
    assert "tags" in result.columns
    assert result.has_tags_column is True


def test_preview_csv_counts_images_and_annotations():
    """Preview should count image files and annotation files separately."""
    csv_content = b"""object_key,tags
images/sample001.jpg,
images/sample002.png,
images/sample003.jpeg,
labels/sample001.xml,
labels/sample002.xml,
other/file.txt,
"""

    from app.services.import_service import preview_csv

    result = preview_csv(BytesIO(csv_content))

    assert result.image_count == 3  # jpg, png, jpeg
    assert result.annotation_count == 2  # xml files
    assert result.total_rows == 6


def test_preview_csv_returns_sample_rows():
    """Preview should return first 5 rows as sample data."""
    csv_content = b"""object_key,tags
images/row1.jpg,tag1
images/row2.jpg,tag2
images/row3.jpg,tag3
images/row4.jpg,tag4
images/row5.jpg,tag5
images/row6.jpg,tag6
images/row7.jpg,tag7
"""

    from app.services.import_service import preview_csv

    result = preview_csv(BytesIO(csv_content))

    assert len(result.sample_rows) == 5
    assert result.sample_rows[0]["object_key"] == "images/row1.jpg"
    assert result.sample_rows[4]["object_key"] == "images/row5.jpg"


def test_preview_csv_handles_no_tags_column():
    """Preview should correctly identify when tags column is missing."""
    csv_content = b"""object_key,bucket
images/sample001.jpg,bucket1
images/sample002.jpg,bucket2
"""

    from app.services.import_service import preview_csv

    result = preview_csv(BytesIO(csv_content))

    assert result.has_tags_column is False
    assert result.total_rows == 2


def test_preview_csv_handles_empty_file():
    """Preview should handle empty CSV with only headers."""
    csv_content = b"""object_key,tags
"""

    from app.services.import_service import preview_csv

    result = preview_csv(BytesIO(csv_content))

    assert result.total_rows == 0
    assert result.image_count == 0
    assert result.annotation_count == 0


def test_preview_csv_resets_file_pointer():
    """Preview should reset file pointer for subsequent reads."""
    csv_content = b"""object_key,tags
images/sample001.jpg,tag1
"""
    file = BytesIO(csv_content)

    from app.services.import_service import preview_csv

    preview_csv(file)

    # File pointer should be reset to beginning
    assert file.read() == csv_content


def test_preview_csv_handles_various_image_extensions():
    """Preview should recognize all supported image extensions."""
    csv_content = b"""object_key
images/file.jpg
images/file.jpeg
images/file.png
images/file.gif
images/file.bmp
images/file.webp
images/file.tiff
images/file.tif
"""

    from app.services.import_service import preview_csv

    result = preview_csv(BytesIO(csv_content))

    assert result.image_count == 8


# =============================================================================
# Tests for ImportResult dataclass
# =============================================================================


def test_import_result_default_values():
    """ImportResult should have correct default values."""
    from app.services.import_service import ImportResult

    result = ImportResult()

    assert result.created == 0
    assert result.skipped == 0
    assert result.errors == 0
    assert result.annotations_linked == 0
    assert result.tags_created == 0
    assert result.error_details == []


def test_import_result_can_be_modified():
    """ImportResult fields should be mutable."""
    from app.services.import_service import ImportResult

    result = ImportResult()
    result.created = 10
    result.skipped = 5
    result.errors = 2
    result.annotations_linked = 8
    result.tags_created = 3
    result.error_details = ["error1", "error2"]

    assert result.created == 10
    assert result.skipped == 5
    assert result.errors == 2
    assert result.annotations_linked == 8
    assert result.tags_created == 3
    assert len(result.error_details) == 2


# =============================================================================
# Tests for file extension detection
# =============================================================================


def test_image_extensions_constant():
    """IMAGE_EXTENSIONS should contain all supported image formats."""
    from app.services.import_service import IMAGE_EXTENSIONS

    expected = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".tif"}
    assert IMAGE_EXTENSIONS == expected


def test_annotation_extensions_constant():
    """ANNOTATION_EXTENSIONS should contain .xml for VOC format."""
    from app.services.import_service import ANNOTATION_EXTENSIONS

    assert ".xml" in ANNOTATION_EXTENSIONS


# =============================================================================
# Tests for CSVPreview dataclass
# =============================================================================


def test_csv_preview_dataclass_fields():
    """CSVPreview should have all required fields."""
    from app.services.import_service import CSVPreview

    preview = CSVPreview(
        total_rows=100,
        columns=["object_key", "tags"],
        sample_rows=[{"object_key": "test.jpg", "tags": "cat"}],
        has_tags_column=True,
        image_count=80,
        annotation_count=20,
    )

    assert preview.total_rows == 100
    assert preview.columns == ["object_key", "tags"]
    assert len(preview.sample_rows) == 1
    assert preview.has_tags_column is True
    assert preview.image_count == 80
    assert preview.annotation_count == 20


# =============================================================================
# Tests for get_or_create_tag_by_path function (requires database mock)
# =============================================================================


def test_get_or_create_tag_by_path_creates_simple_tag():
    """Should create a simple tag without hierarchy."""
    from app.services.import_service import get_or_create_tag_by_path

    # Mock session
    mock_session = MagicMock()
    mock_session.exec.return_value.first.return_value = None  # Tag doesn't exist

    # Mock tag creation
    mock_tag = MagicMock()
    mock_tag.id = uuid.uuid4()

    owner_id = uuid.uuid4()
    tag_cache: dict[str, uuid.UUID] = {}

    # Patch Tag class to return our mock
    with pytest.MonkeyPatch().context() as m:
        from app import models

        def mock_tag_init(**kwargs):
            tag = MagicMock()
            tag.id = uuid.uuid4()
            tag.name = kwargs.get("name")
            tag.parent_id = kwargs.get("parent_id")
            return tag

        m.setattr(models, "Tag", mock_tag_init)

        result = get_or_create_tag_by_path(
            session=mock_session,
            owner_id=owner_id,
            tag_path="simple_tag",
            tag_cache=tag_cache,
        )

    assert result is not None
    assert "simple_tag" in tag_cache
    mock_session.add.assert_called()
    mock_session.flush.assert_called()


def test_get_or_create_tag_by_path_uses_cache():
    """Should return cached tag ID if already processed."""
    from app.services.import_service import get_or_create_tag_by_path

    mock_session = MagicMock()
    owner_id = uuid.uuid4()
    cached_tag_id = uuid.uuid4()
    tag_cache = {"existing_tag": cached_tag_id}

    result = get_or_create_tag_by_path(
        session=mock_session,
        owner_id=owner_id,
        tag_path="existing_tag",
        tag_cache=tag_cache,
    )

    assert result == cached_tag_id
    # Session should not be queried since tag is in cache
    mock_session.exec.assert_not_called()


def test_get_or_create_tag_by_path_strips_whitespace():
    """Should strip whitespace from tag path."""
    from app.services.import_service import get_or_create_tag_by_path

    mock_session = MagicMock()
    owner_id = uuid.uuid4()
    cached_tag_id = uuid.uuid4()
    tag_cache = {"trimmed": cached_tag_id}

    result = get_or_create_tag_by_path(
        session=mock_session,
        owner_id=owner_id,
        tag_path="  trimmed  ",
        tag_cache=tag_cache,
    )

    assert result == cached_tag_id


# =============================================================================
# Tests for import validation
# =============================================================================


def test_import_requires_object_key_column():
    """Import should raise error if object_key column is missing."""
    from app.services.import_service import import_samples_from_csv

    csv_content = b"""bucket,tags
bucket1,tag1
"""
    mock_session = MagicMock()

    with pytest.raises(ValueError, match="Missing required column: object_key"):
        import_samples_from_csv(
            session=mock_session,
            file=BytesIO(csv_content),
            minio_instance_id=uuid.uuid4(),
            owner_id=uuid.uuid4(),
        )
