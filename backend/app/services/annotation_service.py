"""Annotation service for parsing VOC XML files."""

from dataclasses import dataclass
from xml.etree import ElementTree as ET


@dataclass
class ParsedAnnotation:
    """Parsed annotation data from VOC XML."""

    filename: str
    image_width: int
    image_height: int
    object_count: int
    class_counts: dict[str, int]
    objects: list[dict]


def parse_voc_xml(xml_content: bytes) -> ParsedAnnotation | None:
    """Parse VOC/Pascal XML annotation file.

    Args:
        xml_content: Raw XML content as bytes

    Returns:
        ParsedAnnotation object or None if parsing fails
    """
    try:
        root = ET.fromstring(xml_content)

        # Extract filename
        filename_elem = root.find("filename")
        filename = filename_elem.text if filename_elem is not None else ""

        # Extract image size
        size_elem = root.find("size")
        image_width = 0
        image_height = 0
        if size_elem is not None:
            width_elem = size_elem.find("width")
            height_elem = size_elem.find("height")
            image_width = int(width_elem.text) if width_elem is not None else 0
            image_height = int(height_elem.text) if height_elem is not None else 0

        # Extract objects
        objects = []
        class_counts: dict[str, int] = {}

        for obj in root.findall("object"):
            name_elem = obj.find("name")
            if name_elem is None:
                continue

            class_name = name_elem.text

            bndbox = obj.find("bndbox")
            if bndbox is None:
                continue

            xmin_elem = bndbox.find("xmin")
            ymin_elem = bndbox.find("ymin")
            xmax_elem = bndbox.find("xmax")
            ymax_elem = bndbox.find("ymax")

            if (
                xmin_elem is not None
                and ymin_elem is not None
                and xmax_elem is not None
                and ymax_elem is not None
            ):
                obj_dict = {
                    "class": class_name,
                    "xmin": int(xmin_elem.text),  # type: ignore
                    "ymin": int(ymin_elem.text),  # type: ignore
                    "xmax": int(xmax_elem.text),  # type: ignore
                    "ymax": int(ymax_elem.text),  # type: ignore
                }
                objects.append(obj_dict)

                # Update class counts
                class_counts[class_name] = class_counts.get(class_name, 0) + 1

        return ParsedAnnotation(
            filename=filename,
            image_width=image_width,
            image_height=image_height,
            object_count=len(objects),
            class_counts=class_counts,
            objects=objects,
        )

    except ET.ParseError:
        return None
