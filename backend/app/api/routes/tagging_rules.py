"""Tagging rules API routes."""

import re
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Message,
    MappingPreviewRequest,
    MappingPreviewResult,
    PatternPreviewRequest,
    PatternPreviewResult,
    TaggingRule,
    TaggingRuleCreate,
    TaggingRuleCreateMapping,
    TaggingRuleCreateResult,
    TaggingRulePublic,
    TaggingRulesPublic,
    TaggingRuleType,
    TaggingRuleUpdate,
    TaggingRuleExecuteResult,
    TaggingRulePreviewResult,
    SamplePublic,
)
from app.services.auto_tagging_service import (
    execute_rule,
    preview_rule,
    preview_pattern,
    preview_mapping_pattern,
)

router = APIRouter(prefix="/tagging-rules", tags=["tagging-rules"])


@router.get("/", response_model=TaggingRulesPublic)
def read_tagging_rules(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Retrieve tagging rules."""
    count_query = (
        select(func.count())
        .select_from(TaggingRule)
        .where(TaggingRule.owner_id == current_user.id)
    )
    query = (
        select(TaggingRule)
        .where(TaggingRule.owner_id == current_user.id)
        .offset(skip)
        .limit(limit)
    )

    count = session.exec(count_query).one()
    rules = session.exec(query).all()

    return TaggingRulesPublic(data=rules, count=count)


@router.post("/preview-pattern", response_model=PatternPreviewResult)
def preview_pattern_endpoint(
    session: SessionDep,
    current_user: CurrentUser,
    request: PatternPreviewRequest,
    skip: int = 0,
    limit: int = 20,
) -> Any:
    """Preview samples matching a pattern without creating a rule.

    Pattern is a regex matched against full path: {bucket}/{object_key}
    Supports pagination with skip and limit parameters.
    """
    # Always validate regex pattern
    try:
        re.compile(request.pattern)
    except re.error as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid regex pattern: {str(e)}",
        )

    result = preview_pattern(
        session,
        owner_id=current_user.id,
        pattern=request.pattern,
        skip=skip,
        limit=limit,
    )
    return PatternPreviewResult(
        total_matched=result["total_matched"],
        samples=[SamplePublic.model_validate(s) for s in result["samples"]],
    )


@router.post("/preview-mapping", response_model=MappingPreviewResult)
def preview_mapping_endpoint(
    session: SessionDep,
    current_user: CurrentUser,
    request: MappingPreviewRequest,
    skip: int = 0,
    limit: int = 20,
) -> Any:
    """Preview samples matching a mapping rule pattern.

    Pattern is a regex matched against full path: {bucket}/{object_key}
    Only samples with annotations are included.
    Returns unique class names found in matching samples.
    """
    # Validate regex pattern
    try:
        re.compile(request.pattern)
    except re.error as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid regex pattern: {str(e)}",
        )

    result = preview_mapping_pattern(
        session,
        owner_id=current_user.id,
        pattern=request.pattern,
        skip=skip,
        limit=limit,
    )
    return MappingPreviewResult(
        total_matched=result["total_matched"],
        samples=[SamplePublic.model_validate(s) for s in result["samples"]],
        unique_classes=result["unique_classes"],
        class_sample_counts=result["class_sample_counts"],
    )


@router.get("/{id}", response_model=TaggingRulePublic)
def read_tagging_rule(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Any:
    """Get a tagging rule by ID."""
    rule = session.get(TaggingRule, id)
    if not rule:
        raise HTTPException(status_code=404, detail="Tagging rule not found")
    if rule.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return rule


@router.post("/", response_model=TaggingRuleCreateResult)
def create_tagging_rule(
    session: SessionDep,
    current_user: CurrentUser,
    rule_in: TaggingRuleCreate,
    execute_immediately: bool = False,
) -> Any:
    """Create a new tagging rule.

    Pattern is a regex matched against full path: {bucket}/{object_key}

    Args:
        execute_immediately: If True, execute the rule immediately after creation.
    """
    # Validate regex pattern
    try:
        re.compile(rule_in.pattern)
    except re.error as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid regex pattern: {str(e)}",
        )

    rule = TaggingRule(
        name=rule_in.name,
        description=rule_in.description,
        pattern=rule_in.pattern,
        tag_ids=[str(tid) for tid in rule_in.tag_ids],
        is_active=rule_in.is_active,
        auto_execute=rule_in.auto_execute,
        owner_id=current_user.id,
    )
    session.add(rule)
    session.commit()
    session.refresh(rule)

    execution_result = None
    if execute_immediately:
        result = execute_rule(session, rule, dry_run=False)
        execution_result = TaggingRuleExecuteResult(
            matched=result["matched"],
            tagged=result["tagged"],
            skipped=result["skipped"],
            no_annotation=result.get("no_annotation", 0),
        )

    return TaggingRuleCreateResult(
        rule=TaggingRulePublic.model_validate(rule),
        execution_result=execution_result,
    )


@router.post("/mapping", response_model=TaggingRuleCreateResult)
def create_mapping_rule(
    session: SessionDep,
    current_user: CurrentUser,
    rule_in: TaggingRuleCreateMapping,
    execute_immediately: bool = False,
) -> Any:
    """Create a new mapping tagging rule (Type B).

    Maps annotation class names to tags based on class_tag_mapping.
    Pattern is a regex matched against full path: {bucket}/{object_key}

    Args:
        execute_immediately: If True, execute the rule immediately after creation.
    """
    # Validate regex pattern
    try:
        re.compile(rule_in.pattern)
    except re.error as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid regex pattern: {str(e)}",
        )

    rule = TaggingRule(
        name=rule_in.name,
        description=rule_in.description,
        pattern=rule_in.pattern,
        tag_ids=[],  # Mapping rules don't use tag_ids
        class_tag_mapping=rule_in.class_tag_mapping,
        rule_type=TaggingRuleType.mapping,
        is_active=rule_in.is_active,
        auto_execute=rule_in.auto_execute,
        owner_id=current_user.id,
    )
    session.add(rule)
    session.commit()
    session.refresh(rule)

    execution_result = None
    if execute_immediately:
        result = execute_rule(session, rule, dry_run=False)
        execution_result = TaggingRuleExecuteResult(
            matched=result["matched"],
            tagged=result["tagged"],
            skipped=result["skipped"],
            no_annotation=result.get("no_annotation", 0),
        )

    return TaggingRuleCreateResult(
        rule=TaggingRulePublic.model_validate(rule),
        execution_result=execution_result,
    )


@router.put("/{id}", response_model=TaggingRulePublic)
def update_tagging_rule(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    rule_in: TaggingRuleUpdate,
) -> Any:
    """Update a tagging rule."""
    rule = session.get(TaggingRule, id)
    if not rule:
        raise HTTPException(status_code=404, detail="Tagging rule not found")
    if rule.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    update_data = rule_in.model_dump(exclude_unset=True)
    # Convert tag_ids UUIDs to strings for JSONB storage
    if "tag_ids" in update_data and update_data["tag_ids"] is not None:
        update_data["tag_ids"] = [str(tid) for tid in update_data["tag_ids"]]
    rule.sqlmodel_update(update_data)
    rule.updated_at = datetime.utcnow()
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return rule


@router.delete("/{id}")
def delete_tagging_rule(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Message:
    """Delete a tagging rule."""
    rule = session.get(TaggingRule, id)
    if not rule:
        raise HTTPException(status_code=404, detail="Tagging rule not found")
    if rule.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    session.delete(rule)
    session.commit()
    return Message(message="Tagging rule deleted successfully")


@router.post("/{id}/execute", response_model=TaggingRuleExecuteResult)
def execute_tagging_rule(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    dry_run: bool = False,
) -> Any:
    """Execute a tagging rule on all matching samples.

    Args:
        dry_run: If True, only return statistics without applying tags.
    """
    rule = session.get(TaggingRule, id)
    if not rule:
        raise HTTPException(status_code=404, detail="Tagging rule not found")
    if rule.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    result = execute_rule(session, rule, dry_run=dry_run)
    return TaggingRuleExecuteResult(
        matched=result["matched"],
        tagged=result["tagged"],
        skipped=result["skipped"],
        no_annotation=result.get("no_annotation", 0),
    )


@router.post("/{id}/preview", response_model=TaggingRulePreviewResult)
def preview_tagging_rule(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    limit: int = 10,
) -> Any:
    """Preview which samples would match a tagging rule."""
    rule = session.get(TaggingRule, id)
    if not rule:
        raise HTTPException(status_code=404, detail="Tagging rule not found")
    if rule.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    result = preview_rule(session, rule, limit=limit)
    return TaggingRulePreviewResult(
        total_matched=result["total_matched"],
        samples=[SamplePublic.model_validate(s) for s in result["samples"]],
    )
