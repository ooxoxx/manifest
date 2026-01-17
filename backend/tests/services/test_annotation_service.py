"""Tests for AnnotationService VOC XML parsing."""


def test_parses_simple_voc_xml_with_single_object():
    """Parse VOC XML with one object and extract basic fields."""
    xml_content = b"""<?xml version="1.0"?>
<annotation>
  <filename>sample001.jpg</filename>
  <size>
    <width>1920</width>
    <height>1080</height>
    <depth>3</depth>
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
</annotation>
"""

    from app.services.annotation_service import parse_voc_xml

    result = parse_voc_xml(xml_content)

    assert result is not None
    assert result.filename == "sample001.jpg"
    assert result.image_width == 1920
    assert result.image_height == 1080
    assert result.object_count == 1
    assert result.class_counts == {"person": 1}
    assert len(result.objects) == 1
    assert result.objects[0] == {
        "class": "person",
        "xmin": 100,
        "ymin": 50,
        "xmax": 200,
        "ymax": 300,
    }


def test_parses_voc_xml_with_multiple_objects_and_classes():
    """Parse VOC XML with multiple objects and count classes correctly."""
    xml_content = b"""<?xml version="1.0"?>
<annotation>
  <filename>sample002.jpg</filename>
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
  <object>
    <name>car</name>
    <bndbox>
      <xmin>300</xmin>
      <ymin>100</ymin>
      <xmax>500</xmax>
      <ymax>250</ymax>
    </bndbox>
  </object>
  <object>
    <name>person</name>
    <bndbox>
      <xmin>600</xmin>
      <ymin>150</ymin>
      <xmax>700</xmax>
      <ymax>350</ymax>
    </bndbox>
  </object>
</annotation>
"""

    from app.services.annotation_service import parse_voc_xml

    result = parse_voc_xml(xml_content)

    assert result is not None
    assert result.object_count == 3
    assert result.class_counts == {"person": 2, "car": 1}
    assert len(result.objects) == 3


def test_returns_none_for_invalid_xml():
    """Return None when XML is malformed."""
    invalid_xml = b"<not-valid-xml"

    from app.services.annotation_service import parse_voc_xml

    result = parse_voc_xml(invalid_xml)

    assert result is None


def test_handles_missing_optional_fields_gracefully():
    """Parse XML even when some optional fields are missing."""
    xml_content = b"""<?xml version="1.0"?>
<annotation>
  <size>
    <width>800</width>
    <height>600</height>
  </size>
  <object>
    <name>dog</name>
    <bndbox>
      <xmin>10</xmin>
      <ymin>20</ymin>
      <xmax>30</xmax>
      <ymax>40</ymax>
    </bndbox>
  </object>
</annotation>
"""

    from app.services.annotation_service import parse_voc_xml

    result = parse_voc_xml(xml_content)

    assert result is not None
    assert result.filename == ""  # Missing filename defaults to empty
    assert result.image_width == 800
    assert result.image_height == 600
    assert result.object_count == 1
