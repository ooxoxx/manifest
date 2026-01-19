"""Tags API routes."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Message,
    Tag,
    TagCreate,
    TagPublic,
    TagsPublic,
    TagUpdate,
    TagWithChildren,
)

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("/", response_model=TagsPublic)
def read_tags(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Retrieve tags."""
    count_query = (
        select(func.count())
        .select_from(Tag)
        .where(Tag.owner_id == current_user.id)
    )
    count = session.exec(count_query).one()

    query = (
        select(Tag)
        .where(Tag.owner_id == current_user.id)
        .offset(skip)
        .limit(limit)
    )
    tags = session.exec(query).all()

    return TagsPublic(data=tags, count=count)


@router.get("/tree", response_model=list[TagWithChildren])
def get_tag_tree(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Get tags as tree structure."""
    tags = session.exec(
        select(Tag).where(Tag.owner_id == current_user.id)
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


@router.post("/", response_model=TagPublic)
def create_tag(
    session: SessionDep,
    current_user: CurrentUser,
    tag_in: TagCreate,
) -> Any:
    """Create a new tag."""
    if tag_in.parent_id:
        parent = session.get(Tag, tag_in.parent_id)
        if not parent or parent.owner_id != current_user.id:
            raise HTTPException(status_code=404, detail="Parent tag not found")

    tag = Tag(
        name=tag_in.name,
        color=tag_in.color,
        description=tag_in.description,
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
    """Update a tag."""
    tag = session.get(Tag, id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    if tag.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    if tag_in.parent_id:
        parent = session.get(Tag, tag_in.parent_id)
        if not parent or parent.owner_id != current_user.id:
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
    """Delete a tag."""
    tag = session.get(Tag, id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    if tag.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    session.delete(tag)
    session.commit()
    return Message(message="Tag deleted successfully")
