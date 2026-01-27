"""Auto-tagging service for system tags and tagging rules."""

import logging
import re
from uuid import UUID

from sqlmodel import Session, select

from app.models import (
    Sample,
    SampleTag,
    Tag,
    TagCategory,
    TaggingRule,
    TaggingRuleType,
    SystemTagType,
)

logger = logging.getLogger(__name__)


# System tag definitions - these are created once and shared globally
SYSTEM_TAG_DEFINITIONS = [
    # File type tags
    {"name": "图片/JPEG", "system_tag_type": SystemTagType.file_type, "pattern": "image/jpeg"},
    {"name": "图片/PNG", "system_tag_type": SystemTagType.file_type, "pattern": "image/png"},
    {"name": "图片/GIF", "system_tag_type": SystemTagType.file_type, "pattern": "image/gif"},
    {"name": "图片/WebP", "system_tag_type": SystemTagType.file_type, "pattern": "image/webp"},
    {"name": "图片/BMP", "system_tag_type": SystemTagType.file_type, "pattern": "image/bmp"},
    {"name": "图片/TIFF", "system_tag_type": SystemTagType.file_type, "pattern": "image/tiff"},
    # Source tags
    {"name": "来源/手动上传", "system_tag_type": SystemTagType.source, "pattern": "manual"},
    {"name": "来源/同步", "system_tag_type": SystemTagType.source, "pattern": "sync"},
    {"name": "来源/Webhook", "system_tag_type": SystemTagType.source, "pattern": "webhook"},
    {"name": "来源/导入", "system_tag_type": SystemTagType.source, "pattern": "import"},
    # Annotation status tags
    {"name": "标注/已标注", "system_tag_type": SystemTagType.annotation_status, "pattern": "linked"},
    {"name": "标注/未标注", "system_tag_type": SystemTagType.annotation_status, "pattern": "none"},
    {"name": "标注/冲突", "system_tag_type": SystemTagType.annotation_status, "pattern": "conflict"},
]


def initialize_system_tags(session: Session, force: bool = False) -> dict:
    """
    Initialize system tags from definitions.

    System tags are global (owner_id=NULL) and shared by all users.

    Args:
        session: Database session
        force: If True, delete existing system tags and recreate

    Returns:
        Statistics dict with created/skipped counts
    """
    from sqlmodel import delete

    existing = session.exec(
        select(Tag).where(Tag.category == TagCategory.system)
    ).first()

    if existing and not force:
        logger.info("System tags already exist, skipping initialization")
        return {"created": 0, "skipped": 0, "message": "already_exists"}

    if force and existing:
        session.exec(delete(Tag).where(Tag.category == TagCategory.system))
        session.commit()
        logger.info("Deleted existing system tags for re-initialization")

    stats = {"created": 0, "skipped": 0}

    for definition in SYSTEM_TAG_DEFINITIONS:
        tag = Tag(
            name=definition["name"],
            category=TagCategory.system,
            owner_id=None,
            is_system_managed=True,
            system_tag_type=definition["system_tag_type"],
            level=0,
            full_path=definition["name"],
        )
        session.add(tag)
        stats["created"] += 1

    session.commit()
    logger.info(f"Initialized {stats['created']} system tags")
    return stats


def _get_system_tag_by_pattern(
    session: Session,
    system_tag_type: SystemTagType,
    pattern: str,
) -> Tag | None:
    """Get a system tag by type and pattern match."""
    for definition in SYSTEM_TAG_DEFINITIONS:
        if (
            definition["system_tag_type"] == system_tag_type
            and definition["pattern"] == pattern
        ):
            return session.exec(
                select(Tag)
                .where(Tag.category == TagCategory.system)
                .where(Tag.name == definition["name"])
            ).first()
    return None


def _apply_tag_to_sample(
    session: Session,
    sample_id: UUID,
    tag_id: UUID,
) -> bool:
    """
    Apply a tag to a sample if not already applied.

    Returns True if tag was applied, False if already exists.
    """
    existing = session.exec(
        select(SampleTag)
        .where(SampleTag.sample_id == sample_id)
        .where(SampleTag.tag_id == tag_id)
    ).first()

    if existing:
        return False

    sample_tag = SampleTag(sample_id=sample_id, tag_id=tag_id)
    session.add(sample_tag)
    return True


def apply_system_tags_to_sample(
    session: Session,
    sample: Sample,
) -> dict:
    """
    Apply system tags to a sample based on its attributes.

    Args:
        session: Database session
        sample: Sample to tag

    Returns:
        Statistics dict with applied tag count
    """
    stats = {"applied": 0, "skipped": 0}

    # Apply file type tag
    if sample.content_type:
        tag = _get_system_tag_by_pattern(
            session, SystemTagType.file_type, sample.content_type
        )
        if tag:
            if _apply_tag_to_sample(session, sample.id, tag.id):
                stats["applied"] += 1
            else:
                stats["skipped"] += 1

    # Apply source tag
    if sample.source:
        tag = _get_system_tag_by_pattern(
            session, SystemTagType.source, sample.source.value
        )
        if tag:
            if _apply_tag_to_sample(session, sample.id, tag.id):
                stats["applied"] += 1
            else:
                stats["skipped"] += 1

    # Apply annotation status tag
    if sample.annotation_status:
        tag = _get_system_tag_by_pattern(
            session, SystemTagType.annotation_status, sample.annotation_status.value
        )
        if tag:
            if _apply_tag_to_sample(session, sample.id, tag.id):
                stats["applied"] += 1
            else:
                stats["skipped"] += 1

    return stats


def matches_rule(sample: Sample, rule: TaggingRule) -> bool:
    """
    Check if a sample matches a tagging rule.

    Args:
        sample: Sample to check
        rule: Tagging rule to match against

    Returns:
        True if sample matches the rule
    """
    if rule.rule_type == TaggingRuleType.regex_filename:
        return bool(re.search(rule.pattern, sample.file_name or ""))
    elif rule.rule_type == TaggingRuleType.regex_path:
        return bool(re.search(rule.pattern, sample.object_key or ""))
    elif rule.rule_type == TaggingRuleType.file_extension:
        file_name = sample.file_name or ""
        return file_name.lower().endswith(f".{rule.pattern.lower()}")
    elif rule.rule_type == TaggingRuleType.bucket:
        return sample.bucket == rule.pattern
    elif rule.rule_type == TaggingRuleType.content_type:
        return sample.content_type == rule.pattern
    return False


def execute_rule(
    session: Session,
    rule: TaggingRule,
    dry_run: bool = False,
) -> dict:
    """
    Execute a tagging rule on all matching samples.

    Args:
        session: Database session
        rule: Tagging rule to execute
        dry_run: If True, don't actually apply tags

    Returns:
        Statistics dict with matched/tagged/skipped counts
    """
    samples = session.exec(
        select(Sample).where(Sample.owner_id == rule.owner_id)
    ).all()

    matched = 0
    tagged = 0
    skipped = 0

    for sample in samples:
        if matches_rule(sample, rule):
            matched += 1
            if not dry_run:
                for tag_id in rule.tag_ids:
                    if _apply_tag_to_sample(session, sample.id, tag_id):
                        tagged += 1
                    else:
                        skipped += 1

    if not dry_run:
        session.commit()

    return {"matched": matched, "tagged": tagged, "skipped": skipped}


def preview_rule(
    session: Session,
    rule: TaggingRule,
    limit: int = 10,
) -> dict:
    """
    Preview which samples would match a tagging rule.

    Args:
        session: Database session
        rule: Tagging rule to preview
        limit: Maximum number of sample previews to return

    Returns:
        Dict with total_matched count and sample previews
    """
    samples = session.exec(
        select(Sample).where(Sample.owner_id == rule.owner_id)
    ).all()

    matching = [s for s in samples if matches_rule(s, rule)]

    return {
        "total_matched": len(matching),
        "samples": matching[:limit],
    }


def apply_auto_rules_to_sample(
    session: Session,
    sample: Sample,
) -> dict:
    """
    Apply all auto-execute tagging rules to a sample.

    Called when a new sample is created.

    Args:
        session: Database session
        sample: Newly created sample

    Returns:
        Statistics dict with applied tag count
    """
    rules = session.exec(
        select(TaggingRule)
        .where(TaggingRule.owner_id == sample.owner_id)
        .where(TaggingRule.is_active == True)  # noqa: E712
        .where(TaggingRule.auto_execute == True)  # noqa: E712
    ).all()

    stats = {"rules_matched": 0, "tags_applied": 0}

    for rule in rules:
        if matches_rule(sample, rule):
            stats["rules_matched"] += 1
            for tag_id in rule.tag_ids:
                if _apply_tag_to_sample(session, sample.id, tag_id):
                    stats["tags_applied"] += 1

    return stats
