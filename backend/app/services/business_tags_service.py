"""Business tags service for parsing and initializing business tags from CSV."""

import csv
import logging
from pathlib import Path

from sqlmodel import Session, select

from app.models import Tag, TagCategory

logger = logging.getLogger(__name__)

# Path to the business tags CSV file
BUSINESS_TAGS_CSV_PATH = Path(__file__).parent.parent.parent.parent / "docs" / "classes.csv"


def parse_business_tags_csv(csv_path: Path | None = None) -> list[dict]:
    """
    Parse the business tags CSV file and return structured tag data.

    CSV columns: 专业, 部件名称/场景分类, 部位名称/场景名称, 状态描述/场景描述, 标注标签

    Returns a list of dicts with:
    - level0: 专业 (e.g., 安监, 设备-输电)
    - level1: 部件名称/场景分类
    - level2: 部位名称/场景名称
    - level3: 状态描述/场景描述
    - business_code: 标注标签
    """
    if csv_path is None:
        csv_path = BUSINESS_TAGS_CSV_PATH

    if not csv_path.exists():
        logger.warning(f"Business tags CSV not found at {csv_path}")
        return []

    tags_data = []

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Handle different possible column names
            level0 = row.get("专业", "").strip()
            level1 = row.get("部件名称/场景分类", "").strip()
            level2 = row.get("部位名称/场景名称", "").strip()
            level3 = row.get("状态描述/场景描述", "").strip()
            business_code = row.get("标注标签", "").strip()

            if level0 and level1 and level2 and level3:
                tags_data.append({
                    "level0": level0,
                    "level1": level1,
                    "level2": level2,
                    "level3": level3,
                    "business_code": business_code,
                })

    logger.info(f"Parsed {len(tags_data)} business tag entries from CSV")
    return tags_data


def build_tag_hierarchy(tags_data: list[dict]) -> dict:
    """
    Build a hierarchical structure from flat tag data.

    Returns a nested dict structure:
    {
        "安监": {
            "_children": {
                "环境监测": {
                    "_children": {
                        "房屋建筑物": {
                            "_children": {
                                "盖板破损": {"business_code": "011_hjjc_fwjzw_gbps"}
                            }
                        }
                    }
                }
            }
        }
    }
    """
    hierarchy: dict = {}

    for entry in tags_data:
        level0 = entry["level0"]
        level1 = entry["level1"]
        level2 = entry["level2"]
        level3 = entry["level3"]
        business_code = entry["business_code"]

        # Level 0
        if level0 not in hierarchy:
            hierarchy[level0] = {"_children": {}}

        # Level 1
        if level1 not in hierarchy[level0]["_children"]:
            hierarchy[level0]["_children"][level1] = {"_children": {}}

        # Level 2
        if level2 not in hierarchy[level0]["_children"][level1]["_children"]:
            hierarchy[level0]["_children"][level1]["_children"][level2] = {"_children": {}}

        # Level 3 (leaf node with business_code)
        hierarchy[level0]["_children"][level1]["_children"][level2]["_children"][level3] = {
            "business_code": business_code
        }

    return hierarchy


def initialize_business_tags(session: Session, force: bool = False) -> dict:
    """
    Initialize business tags from CSV into the database.

    Business tags are global (owner_id=NULL) and shared by all users.

    Args:
        session: Database session
        force: If True, delete existing business tags and recreate

    Returns:
        Statistics dict with created/skipped counts
    """
    # Check if business tags already exist
    existing = session.exec(
        select(Tag).where(Tag.category == TagCategory.business)
    ).first()

    if existing and not force:
        logger.info("Business tags already exist, skipping initialization")
        return {"created": 0, "skipped": 0, "message": "already_exists"}

    if force and existing:
        # Delete existing business tags
        session.exec(
            select(Tag).where(Tag.category == TagCategory.business)
        )
        from sqlmodel import delete
        session.exec(delete(Tag).where(Tag.category == TagCategory.business))
        session.commit()
        logger.info("Deleted existing business tags for re-initialization")

    # Parse CSV and build hierarchy
    tags_data = parse_business_tags_csv()
    if not tags_data:
        return {"created": 0, "skipped": 0, "message": "no_csv_data"}

    hierarchy = build_tag_hierarchy(tags_data)

    # Create tags in database
    stats = {"created": 0, "skipped": 0}
    _create_tags_from_hierarchy(session, hierarchy, stats)

    session.commit()
    logger.info(f"Initialized {stats['created']} business tags")
    return stats


def _create_tags_from_hierarchy(
    session: Session,
    hierarchy: dict,
    stats: dict,
    parent_id: str | None = None,
    level: int = 0,
    path_parts: list[str] | None = None,
) -> None:
    """
    Recursively create tags from hierarchy structure.

    Args:
        session: Database session
        hierarchy: Nested dict structure from build_tag_hierarchy
        stats: Statistics dict to update
        parent_id: Parent tag ID (None for root level)
        level: Current hierarchy level (0-3)
        path_parts: List of ancestor names for building full_path
    """
    if path_parts is None:
        path_parts = []

    for name, data in hierarchy.items():
        # Skip internal keys
        if name.startswith("_"):
            continue

        current_path = path_parts + [name]
        full_path = "/".join(current_path)

        # Check if this is a leaf node (has business_code)
        business_code = data.get("business_code")
        children = data.get("_children", {})

        # Create the tag
        tag = Tag(
            name=name,
            category=TagCategory.business,
            parent_id=parent_id,
            owner_id=None,  # Global business tag
            is_system_managed=True,
            level=level,
            full_path=full_path,
            business_code=business_code,
        )
        session.add(tag)
        session.flush()  # Get the ID for children
        stats["created"] += 1

        # Recursively create children
        if children:
            _create_tags_from_hierarchy(
                session=session,
                hierarchy=children,
                stats=stats,
                parent_id=tag.id,
                level=level + 1,
                path_parts=current_path,
            )


def get_business_tags_tree(session: Session) -> list[dict]:
    """
    Get business tags as a tree structure for frontend display.

    Returns a list of root-level tags with nested children.
    """
    # Get all business tags
    tags = session.exec(
        select(Tag)
        .where(Tag.category == TagCategory.business)
        .order_by(Tag.level, Tag.name)
    ).all()

    # Build lookup by ID
    tag_dict = {str(tag.id): tag for tag in tags}

    # Build tree structure
    root_tags = []
    children_map: dict[str, list] = {}

    for tag in tags:
        tag_data = {
            "id": str(tag.id),
            "name": tag.name,
            "level": tag.level,
            "full_path": tag.full_path,
            "business_code": tag.business_code,
            "children": [],
        }

        if tag.parent_id is None:
            root_tags.append(tag_data)
        else:
            parent_key = str(tag.parent_id)
            if parent_key not in children_map:
                children_map[parent_key] = []
            children_map[parent_key].append(tag_data)

    # Attach children recursively
    def attach_children(node: dict) -> None:
        node_id = node["id"]
        if node_id in children_map:
            node["children"] = children_map[node_id]
            for child in node["children"]:
                attach_children(child)

    for root in root_tags:
        attach_children(root)

    return root_tags


def search_business_tags(
    session: Session,
    query: str,
    limit: int = 20,
) -> list[Tag]:
    """
    Search business tags by name, full_path, or business_code.

    Args:
        session: Database session
        query: Search query string
        limit: Maximum number of results

    Returns:
        List of matching Tag objects
    """
    if not query or len(query) < 1:
        return []

    search_pattern = f"%{query}%"

    tags = session.exec(
        select(Tag)
        .where(Tag.category == TagCategory.business)
        .where(
            (Tag.name.ilike(search_pattern))
            | (Tag.full_path.ilike(search_pattern))
            | (Tag.business_code.ilike(search_pattern))
        )
        .order_by(Tag.level, Tag.name)
        .limit(limit)
    ).all()

    return list(tags)


def get_business_tag_by_code(
    session: Session,
    business_code: str,
) -> Tag | None:
    """
    Get a business tag by its business_code.

    Args:
        session: Database session
        business_code: The business code (e.g., "011_hjjc_fwjzw_gbps")

    Returns:
        Tag object or None if not found
    """
    return session.exec(
        select(Tag)
        .where(Tag.category == TagCategory.business)
        .where(Tag.business_code == business_code)
    ).first()


def get_business_tags_tree_with_counts(
    session: Session,
    owner_id,
) -> list[dict]:
    """
    Get business tags as a tree structure with sample counts.

    Each node includes:
    - count: Direct sample count (samples tagged with this specific tag)
    - total_count: Total including all descendants

    Args:
        session: Database session
        owner_id: Owner user ID for counting samples

    Returns:
        List of root-level tags with nested children and counts
    """
    import uuid
    from collections import defaultdict

    from sqlalchemy import func as sa_func

    from app.models import Sample, SampleStatus, SampleTag

    # Get all business tags
    tags = session.exec(
        select(Tag)
        .where(Tag.category == TagCategory.business)
        .order_by(Tag.level, Tag.name)
    ).all()

    if not tags:
        return []

    # Get sample counts per tag for this user
    tag_ids = [tag.id for tag in tags]
    count_query = (
        select(SampleTag.tag_id, sa_func.count(SampleTag.sample_id))
        .join(Sample, Sample.id == SampleTag.sample_id)
        .where(Sample.owner_id == owner_id)
        .where(Sample.status == SampleStatus.active)
        .where(SampleTag.tag_id.in_(tag_ids))
        .group_by(SampleTag.tag_id)
    )
    count_results = session.exec(count_query).all()
    count_map = {str(tag_id): count for tag_id, count in count_results}

    # Build tree structure with counts
    root_tags = []
    children_map: dict[str, list] = defaultdict(list)
    node_map: dict[str, dict] = {}

    for tag in tags:
        tag_data = {
            "id": str(tag.id),
            "name": tag.name,
            "level": tag.level,
            "full_path": tag.full_path,
            "count": count_map.get(str(tag.id), 0),
            "total_count": 0,  # Will be calculated after tree is built
            "children": [],
        }
        node_map[str(tag.id)] = tag_data

        if tag.parent_id is None:
            root_tags.append(tag_data)
        else:
            children_map[str(tag.parent_id)].append(tag_data)

    # Attach children
    for node_id, node in node_map.items():
        node["children"] = children_map.get(node_id, [])

    # Calculate total_count (including descendants) bottom-up
    def calculate_total_count(node: dict) -> int:
        total = node["count"]
        for child in node["children"]:
            total += calculate_total_count(child)
        node["total_count"] = total
        return total

    for root in root_tags:
        calculate_total_count(root)

    return root_tags

