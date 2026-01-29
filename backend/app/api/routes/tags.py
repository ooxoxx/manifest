"""Tags API routes."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, or_, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Message,
    Tag,
    TagCategory,
    TagCreate,
    TagPublic,
    TagsPublic,
    TagsByCategoryResponse,
    TagUpdate,
    TagWithChildren,
)
from app.services.business_tags_service import (
    get_business_tags_tree,
    get_business_tags_tree_with_counts,
    search_business_tags,
)

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("/", response_model=TagsPublic)
def read_tags(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    category: TagCategory | None = None,
) -> Any:
    """Retrieve tags with optional category filtering.

    Includes both user-owned tags and global tags (system/business).
    """
    # Include user's tags and global tags (owner_id=NULL)
    ownership_filter = or_(
        Tag.owner_id == current_user.id,
        Tag.owner_id.is_(None),
    )

    count_query = (
        select(func.count())
        .select_from(Tag)
        .where(ownership_filter)
    )
    query = select(Tag).where(ownership_filter)

    # Apply category filter if provided
    if category:
        count_query = count_query.where(Tag.category == category)
        query = query.where(Tag.category == category)

    count = session.exec(count_query).one()
    tags = session.exec(query.offset(skip).limit(limit)).all()

    return TagsPublic(data=tags, count=count)


@router.get("/tree", response_model=list[TagWithChildren])
def get_tag_tree(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Get tags as tree structure.

    Includes both user-owned tags and global tags.
    """
    tags = session.exec(
        select(Tag).where(
            or_(
                Tag.owner_id == current_user.id,
                Tag.owner_id.is_(None),
            )
        )
    ).all()

    # Build tree
    tag_map = {tag.id: TagWithChildren(**tag.model_dump(), children=[]) for tag in tags}
    roots = []

    for tag in tags:
        if tag.parent_id and tag.parent_id in tag_map:
            tag_map[tag.parent_id].children.append(tag_map[tag.id])
        else:
            roots.append(tag_map[tag.id])

    return roots


@router.get("/by-category", response_model=TagsByCategoryResponse)
def get_tags_by_category(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Get tags grouped by category.

    Includes both user-owned tags and global tags.
    """
    tags = session.exec(
        select(Tag).where(
            or_(
                Tag.owner_id == current_user.id,
                Tag.owner_id.is_(None),
            )
        )
    ).all()

    # Group tags by category
    categorized: dict[TagCategory, list[TagPublic]] = {
        TagCategory.system: [],
        TagCategory.business: [],
        TagCategory.user: [],
    }

    for tag in tags:
        categorized[tag.category].append(TagPublic.model_validate(tag))

    return TagsByCategoryResponse(
        system=categorized[TagCategory.system],
        business=categorized[TagCategory.business],
        user=categorized[TagCategory.user],
    )


@router.post("/", response_model=TagPublic)
def create_tag(
    session: SessionDep,
    current_user: CurrentUser,
    tag_in: TagCreate,
) -> Any:
    """Create a new user tag.

    Users can only create tags with category='user'.
    System and business tags are managed by the system.
    """
    # Force category to user - users cannot create system/business tags
    if tag_in.category != TagCategory.user:
        raise HTTPException(
            status_code=403,
            detail="Users can only create tags with category 'user'"
        )

    if tag_in.parent_id:
        parent = session.get(Tag, tag_in.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent tag not found")
        # Allow parenting under global tags or own tags
        if parent.owner_id is not None and parent.owner_id != current_user.id:
            raise HTTPException(status_code=404, detail="Parent tag not found")

    tag = Tag(
        name=tag_in.name,
        color=tag_in.color,
        description=tag_in.description,
        category=TagCategory.user,  # Always user category
        parent_id=tag_in.parent_id,
        owner_id=current_user.id,
    )
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


@router.put("/{id}", response_model=TagPublic)
def update_tag(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    tag_in: TagUpdate,
) -> Any:
    """Update a user tag.

    System and business tags cannot be modified.
    """
    tag = session.get(Tag, id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Global tags (system/business) cannot be modified
    if tag.owner_id is None:
        raise HTTPException(
            status_code=403,
            detail="System and business tags cannot be modified"
        )

    if tag.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Protect system-managed tags
    if tag.is_system_managed:
        raise HTTPException(
            status_code=403,
            detail="Cannot modify system-managed tags"
        )

    # Users cannot change category to system/business
    if tag_in.category and tag_in.category != TagCategory.user:
        raise HTTPException(
            status_code=403,
            detail="Cannot change tag category to system or business"
        )

    if tag_in.parent_id:
        parent = session.get(Tag, tag_in.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent tag not found")
        if parent.owner_id is not None and parent.owner_id != current_user.id:
            raise HTTPException(status_code=404, detail="Parent tag not found")

    update_data = tag_in.model_dump(exclude_unset=True)
    tag.sqlmodel_update(update_data)
    tag.updated_at = datetime.utcnow()
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


@router.delete("/{id}")
def delete_tag(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Message:
    """Delete a user tag.

    System and business tags cannot be deleted.
    """
    tag = session.get(Tag, id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Global tags (system/business) cannot be deleted
    if tag.owner_id is None:
        raise HTTPException(
            status_code=403,
            detail="System and business tags cannot be deleted"
        )

    if tag.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Protect system-managed tags from deletion
    if tag.is_system_managed:
        raise HTTPException(
            status_code=403,
            detail="Cannot delete system-managed tags"
        )

    session.delete(tag)
    session.commit()
    return Message(message="Tag deleted successfully")


@router.get("/business/tree")
def get_business_tag_tree(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Get business tags as a tree structure."""
    return get_business_tags_tree(session)


@router.get("/business/tree-with-counts")
def get_business_tag_tree_with_counts(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Get business tags as a tree structure with sample counts.

    Each node includes:
    - count: Direct sample count (samples tagged with this specific tag)
    - total_count: Total including all descendants
    """
    return get_business_tags_tree_with_counts(session, current_user.id)


@router.get("/business/search", response_model=list[TagPublic])
def search_business_tag(
    session: SessionDep,
    current_user: CurrentUser,
    q: str,
    limit: int = 20,
) -> Any:
    """Search business tags by name, path, or code."""
    return search_business_tags(session, q, limit)
