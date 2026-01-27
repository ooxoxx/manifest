import uuid
from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import EmailStr
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    samples: list["Sample"] = Relationship(back_populates="owner", cascade_delete=True)
    minio_instances: list["MinIOInstance"] = Relationship(
        back_populates="owner", cascade_delete=True
    )
    datasets: list["Dataset"] = Relationship(back_populates="owner", cascade_delete=True)
    tags: list["Tag"] = Relationship(back_populates="owner", cascade_delete=True)


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# ============================================================================
# Enums
# ============================================================================


class SampleStatus(str, Enum):
    """Sample status enum."""

    active = "active"
    deleted = "deleted"
    archived = "archived"


class AnnotationStatus(str, Enum):
    """Annotation status enum."""

    none = "none"
    linked = "linked"
    conflict = "conflict"
    error = "error"


class AnnotationFormat(str, Enum):
    """Annotation format enum."""

    voc = "voc"
    yolo = "yolo"
    coco = "coco"


class TagCategory(str, Enum):
    """Tag category for semantic grouping."""

    system = "system"  # 系统标签（状态、来源）
    business = "business"  # 业务标签（领域、场景）
    user = "user"  # 用户自定义标签


class SystemTagType(str, Enum):
    """System tag type for automatic tagging."""

    file_type = "file_type"  # 文件类型 (image/jpeg, image/png)
    source = "source"  # 来源 (webhook, sync, import, manual)
    annotation_status = "annotation_status"  # 标注状态 (none, linked, conflict)
    storage_instance = "storage_instance"  # 存储实例名称


class TaggingRuleType(str, Enum):
    """Tagging rule type for batch tagging."""

    regex_filename = "regex_filename"  # 文件名正则匹配
    regex_path = "regex_path"  # 路径正则匹配
    file_extension = "file_extension"  # 扩展名匹配
    bucket = "bucket"  # 桶名匹配
    content_type = "content_type"  # MIME类型匹配


class SampleSource(str, Enum):
    """Sample source enum."""

    webhook = "webhook"
    sync = "sync"
    import_csv = "import"
    manual = "manual"


# ============================================================================
# MinIO Instance Models
# ============================================================================


class MinIOInstanceBase(SQLModel):
    """Base MinIO instance properties."""

    name: str = Field(min_length=1, max_length=255, index=True)
    endpoint: str = Field(max_length=512)
    secure: bool = True
    description: str | None = Field(default=None, max_length=1024)
    is_active: bool = True


class MinIOInstanceCreate(MinIOInstanceBase):
    """Properties to receive on MinIO instance creation."""

    access_key: str = Field(max_length=255)
    secret_key: str = Field(max_length=255)


class MinIOInstanceUpdate(SQLModel):
    """Properties to receive on MinIO instance update."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    endpoint: str | None = Field(default=None, max_length=512)
    secure: bool | None = None
    description: str | None = Field(default=None, max_length=1024)
    is_active: bool | None = None
    access_key: str | None = Field(default=None, max_length=255)
    secret_key: str | None = Field(default=None, max_length=255)


class MinIOInstance(MinIOInstanceBase, table=True):
    """MinIO instance database model."""

    __tablename__ = "minio_instance"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    access_key_encrypted: str = Field(max_length=512)
    secret_key_encrypted: str = Field(max_length=512)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    owner: Optional["User"] = Relationship(back_populates="minio_instances")
    watched_paths: list["WatchedPath"] = Relationship(
        back_populates="minio_instance", cascade_delete=True
    )
    samples: list["Sample"] = Relationship(
        back_populates="minio_instance", cascade_delete=True
    )


class MinIOInstancePublic(MinIOInstanceBase):
    """Properties to return via API."""

    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class MinIOInstancesPublic(SQLModel):
    """Paginated MinIO instances response."""

    data: list[MinIOInstancePublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


# ============================================================================
# Watched Path Models
# ============================================================================


class WatchedPathBase(SQLModel):
    """Base watched path properties."""

    bucket: str = Field(max_length=255)
    prefix: str = Field(default="", max_length=1024)
    description: str | None = Field(default=None, max_length=1024)
    is_active: bool = True


class WatchedPathCreate(WatchedPathBase):
    """Properties to receive on watched path creation."""

    minio_instance_id: uuid.UUID


class WatchedPathUpdate(SQLModel):
    """Properties to receive on watched path update."""

    bucket: str | None = Field(default=None, max_length=255)
    prefix: str | None = Field(default=None, max_length=1024)
    description: str | None = Field(default=None, max_length=1024)
    is_active: bool | None = None


class WatchedPath(WatchedPathBase, table=True):
    """Watched path database model."""

    __tablename__ = "watched_path"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    minio_instance_id: uuid.UUID = Field(
        foreign_key="minio_instance.id", nullable=False, ondelete="CASCADE"
    )
    last_sync_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    minio_instance: Optional["MinIOInstance"] = Relationship(back_populates="watched_paths")


class WatchedPathPublic(WatchedPathBase):
    """Properties to return via API."""

    id: uuid.UUID
    minio_instance_id: uuid.UUID
    last_sync_at: datetime | None
    created_at: datetime
    updated_at: datetime


class WatchedPathsPublic(SQLModel):
    """Paginated watched paths response."""

    data: list[WatchedPathPublic]
    count: int


# ============================================================================
# Tag Models
# ============================================================================


class TagBase(SQLModel):
    """Base tag properties."""

    name: str = Field(min_length=1, max_length=255, index=True)
    color: str | None = Field(default=None, max_length=7)
    description: str | None = Field(default=None, max_length=1024)
    category: TagCategory = Field(default=TagCategory.user)


class TagCreate(TagBase):
    """Properties to receive on tag creation."""

    parent_id: uuid.UUID | None = None


class TagUpdate(SQLModel):
    """Properties to receive on tag update."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    color: str | None = Field(default=None, max_length=7)
    description: str | None = Field(default=None, max_length=1024)
    category: TagCategory | None = None
    parent_id: uuid.UUID | None = None


class Tag(TagBase, table=True):
    """Tag database model with hierarchical support."""

    __tablename__ = "tag"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    parent_id: uuid.UUID | None = Field(
        default=None, foreign_key="tag.id", ondelete="CASCADE"
    )
    owner_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", nullable=True, ondelete="CASCADE"
    )
    is_system_managed: bool = Field(default=False)
    # New fields for tag category system
    business_code: str | None = Field(default=None, max_length=100, index=True)
    level: int = Field(default=0)
    full_path: str | None = Field(default=None, max_length=1024)
    system_tag_type: SystemTagType | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    owner: Optional["User"] = Relationship(back_populates="tags")
    parent: Optional["Tag"] = Relationship(
        back_populates="children",
        sa_relationship_kwargs={"remote_side": "Tag.id"},
    )
    children: list["Tag"] = Relationship(back_populates="parent")
    sample_tags: list["SampleTag"] = Relationship(
        back_populates="tag", cascade_delete=True
    )


class TagPublic(TagBase):
    """Properties to return via API."""

    id: uuid.UUID
    parent_id: uuid.UUID | None
    owner_id: uuid.UUID | None
    is_system_managed: bool
    business_code: str | None
    level: int
    full_path: str | None
    system_tag_type: SystemTagType | None
    created_at: datetime
    updated_at: datetime


class TagWithChildren(TagPublic):
    """Tag with children for tree structure."""

    children: list["TagWithChildren"] = []


class TagsPublic(SQLModel):
    """Paginated tags response."""

    data: list[TagPublic]
    count: int


class TagsByCategoryResponse(SQLModel):
    """Tags grouped by category."""

    system: list[TagPublic] = []
    business: list[TagPublic] = []
    user: list[TagPublic] = []


# ============================================================================
# Tagging Rule Models
# ============================================================================


class TaggingRuleBase(SQLModel):
    """Base tagging rule properties."""

    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1024)
    rule_type: TaggingRuleType
    pattern: str = Field(max_length=1024)
    is_active: bool = Field(default=True)
    auto_execute: bool = Field(default=False)


class TaggingRuleCreate(TaggingRuleBase):
    """Properties to receive on tagging rule creation."""

    tag_ids: list[uuid.UUID]


class TaggingRuleUpdate(SQLModel):
    """Properties to receive on tagging rule update."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1024)
    rule_type: TaggingRuleType | None = None
    pattern: str | None = Field(default=None, max_length=1024)
    tag_ids: list[uuid.UUID] | None = None
    is_active: bool | None = None
    auto_execute: bool | None = None


class TaggingRule(TaggingRuleBase, table=True):
    """Tagging rule database model."""

    __tablename__ = "tagging_rule"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    tag_ids: list[uuid.UUID] = Field(default_factory=list, sa_column=Column(JSONB))
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TaggingRulePublic(TaggingRuleBase):
    """Properties to return via API."""

    id: uuid.UUID
    tag_ids: list[uuid.UUID]
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class TaggingRulesPublic(SQLModel):
    """Paginated tagging rules response."""

    data: list[TaggingRulePublic]
    count: int


class TaggingRuleExecuteResult(SQLModel):
    """Result of executing a tagging rule."""

    matched: int
    tagged: int
    skipped: int


class TaggingRulePreviewResult(SQLModel):
    """Result of previewing a tagging rule."""

    total_matched: int
    samples: list["SamplePublic"]


# ============================================================================
# Annotation Models
# ============================================================================


class AnnotationBase(SQLModel):
    """Base annotation properties."""

    format: AnnotationFormat = Field(default=AnnotationFormat.voc)
    image_width: int | None = None
    image_height: int | None = None
    object_count: int = Field(default=0, index=True)
    class_counts: dict | None = Field(default=None, sa_column=Column(JSONB))
    objects: list | None = Field(default=None, sa_column=Column(JSONB))


class AnnotationCreate(AnnotationBase):
    """Properties to receive on annotation creation."""

    sample_id: uuid.UUID


class AnnotationUpdate(SQLModel):
    """Properties to receive on annotation update."""

    format: AnnotationFormat | None = None
    image_width: int | None = None
    image_height: int | None = None
    object_count: int | None = None
    class_counts: dict | None = None
    objects: list | None = None


class Annotation(AnnotationBase, table=True):
    """Annotation database model."""

    __tablename__ = "annotation"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    sample_id: uuid.UUID = Field(
        foreign_key="sample.id", nullable=False, unique=True, ondelete="CASCADE"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    sample: Optional["Sample"] = Relationship(
        back_populates="annotation",
        sa_relationship_kwargs={
            "primaryjoin": "Annotation.sample_id == Sample.id",
            "foreign_keys": "[Annotation.sample_id]",
        },
    )


class AnnotationPublic(AnnotationBase):
    """Properties to return via API."""

    id: uuid.UUID
    sample_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# ============================================================================
# Sample Models
# ============================================================================


class SampleBase(SQLModel):
    """Base sample properties."""

    object_key: str = Field(max_length=1024, index=True)
    bucket: str = Field(max_length=255, index=True)
    file_name: str = Field(max_length=255)
    file_size: int = Field(default=0)
    content_type: str | None = Field(default=None, max_length=255)
    etag: str | None = Field(default=None, max_length=255)
    extra_data: dict | None = Field(default=None, sa_column=Column(JSONB))
    # MVP annotation fields
    file_hash: str | None = Field(default=None, max_length=255, index=True)  # MD5 hash
    file_stem: str | None = Field(default=None, max_length=255, index=True)  # filename without extension
    annotation_key: str | None = Field(default=None, max_length=1024)  # annotation file path
    annotation_hash: str | None = Field(default=None, max_length=255)  # annotation file MD5
    annotation_status: AnnotationStatus = Field(default=AnnotationStatus.none)


class SampleCreate(SampleBase):
    """Properties to receive on sample creation."""

    minio_instance_id: uuid.UUID
    source: SampleSource = SampleSource.manual


class SampleUpdate(SQLModel):
    """Properties to receive on sample update."""

    extra_data: dict | None = None
    status: SampleStatus | None = None


class Sample(SampleBase, table=True):
    """Sample database model."""

    __tablename__ = "sample"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    minio_instance_id: uuid.UUID = Field(
        foreign_key="minio_instance.id", nullable=False, ondelete="CASCADE"
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    annotation_id: uuid.UUID | None = Field(
        default=None,
        # Note: This is a denormalized field for quick access, not a FK
        # The authoritative relationship is via Annotation.sample_id
    )
    status: SampleStatus = Field(default=SampleStatus.active, index=True)
    source: SampleSource = Field(default=SampleSource.manual)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: datetime | None = None

    owner: Optional["User"] = Relationship(back_populates="samples")
    minio_instance: Optional["MinIOInstance"] = Relationship(back_populates="samples")
    annotation: Optional["Annotation"] = Relationship(
        back_populates="sample",
        sa_relationship_kwargs={
            "primaryjoin": "Sample.id == Annotation.sample_id",
            "foreign_keys": "[Annotation.sample_id]",
            "uselist": False,
        },
    )
    sample_tags: list["SampleTag"] = Relationship(
        back_populates="sample", cascade_delete=True
    )
    dataset_samples: list["DatasetSample"] = Relationship(
        back_populates="sample", cascade_delete=True
    )
    history: list["SampleHistory"] = Relationship(
        back_populates="sample", cascade_delete=True
    )


class SamplePublic(SampleBase):
    """Properties to return via API."""

    id: uuid.UUID
    minio_instance_id: uuid.UUID
    owner_id: uuid.UUID
    status: SampleStatus
    source: SampleSource
    created_at: datetime
    updated_at: datetime


class SampleWithTags(SamplePublic):
    """Sample with tags for detailed view."""

    tags: list[TagPublic] = []


class SamplePreviewAnnotation(SQLModel):
    """Annotation data for sample preview."""

    objects: list[dict] | None = None
    class_counts: dict[str, int] | None = None
    image_width: int | None = None
    image_height: int | None = None


class SamplePreviewResponse(SQLModel):
    """Response for sample preview API."""

    presigned_url: str
    expires_in: int  # seconds
    annotation: SamplePreviewAnnotation | None = None
    tags: list[TagPublic] = []
    sample: SamplePublic


class SamplesPublic(SQLModel):
    """Paginated samples response."""

    data: list[SamplePublic]
    count: int


# ============================================================================
# Sample-Tag Association
# ============================================================================


class SampleTag(SQLModel, table=True):
    """Sample-Tag association table."""

    __tablename__ = "sample_tag"

    sample_id: uuid.UUID = Field(
        foreign_key="sample.id", primary_key=True, ondelete="CASCADE"
    )
    tag_id: uuid.UUID = Field(
        foreign_key="tag.id", primary_key=True, ondelete="CASCADE"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)

    sample: Optional["Sample"] = Relationship(back_populates="sample_tags")
    tag: Optional["Tag"] = Relationship(back_populates="sample_tags")


# ============================================================================
# Dataset Models
# ============================================================================


class DatasetBase(SQLModel):
    """Base dataset properties."""

    name: str = Field(min_length=1, max_length=255, index=True)
    description: str | None = Field(default=None, max_length=2048)
    is_public: bool = False


class DatasetCreate(DatasetBase):
    """Properties to receive on dataset creation."""

    pass


class DatasetUpdate(SQLModel):
    """Properties to receive on dataset update."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2048)
    is_public: bool | None = None


class Dataset(DatasetBase, table=True):
    """Dataset database model."""

    __tablename__ = "dataset"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    sample_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    owner: Optional["User"] = Relationship(back_populates="datasets")
    dataset_samples: list["DatasetSample"] = Relationship(
        back_populates="dataset", cascade_delete=True
    )


class DatasetPublic(DatasetBase):
    """Properties to return via API."""

    id: uuid.UUID
    owner_id: uuid.UUID
    sample_count: int
    created_at: datetime
    updated_at: datetime


class DatasetsPublic(SQLModel):
    """Paginated datasets response."""

    data: list[DatasetPublic]
    count: int


# ============================================================================
# Dataset-Sample Association
# ============================================================================


class DatasetSample(SQLModel, table=True):
    """Dataset-Sample association table."""

    __tablename__ = "dataset_sample"

    dataset_id: uuid.UUID = Field(
        foreign_key="dataset.id", primary_key=True, ondelete="CASCADE"
    )
    sample_id: uuid.UUID = Field(
        foreign_key="sample.id", primary_key=True, ondelete="CASCADE"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)

    dataset: Optional["Dataset"] = Relationship(back_populates="dataset_samples")
    sample: Optional["Sample"] = Relationship(back_populates="dataset_samples")


# ============================================================================
# Sample History
# ============================================================================


class SampleHistoryAction(str, Enum):
    """Sample history action enum."""

    created = "created"
    updated = "updated"
    deleted = "deleted"
    tagged = "tagged"
    untagged = "untagged"
    added_to_dataset = "added_to_dataset"
    removed_from_dataset = "removed_from_dataset"
    annotation_linked = "annotation_linked"
    annotation_conflict = "annotation_conflict"
    annotation_removed = "annotation_removed"


# ============================================================================
# Phase 4: Dataset Building Models
# ============================================================================


class SamplingMode(str, Enum):
    """Sampling mode for dataset building."""

    all = "all"
    random = "random"
    class_targets = "class_targets"


class FilterParams(SQLModel):
    """Parameters for filtering samples."""

    # DNF tag filter: [[tagA, tagB], [tagC]] = (A AND B) OR C
    tag_filter: list[list[uuid.UUID]] | None = None
    # Legacy fields - kept for backwards compatibility but deprecated
    tags_include: list[uuid.UUID] | None = None
    tags_exclude: list[uuid.UUID] | None = None
    date_from: date | None = None
    date_to: date | None = None
    annotation_classes: list[str] | None = None
    object_count_min: int | None = None
    object_count_max: int | None = None
    annotation_status: AnnotationStatus | None = None


class ClassStat(SQLModel):
    """Statistics for a single class."""

    name: str
    count: int


class ClassStatsResponse(SQLModel):
    """Response for filter class stats."""

    classes: list[ClassStat]
    total_samples: int
    total_objects: int


class SamplingConfig(SQLModel):
    """Configuration for sampling strategy."""

    mode: SamplingMode = SamplingMode.all
    count: int | None = None
    class_targets: dict[str, int] | None = None
    seed: int | None = None


class ClassAchievement(SQLModel):
    """Achievement status for a single class."""

    target: int
    actual: int
    status: str  # "achieved" | "partial"


class SamplingResultResponse(SQLModel):
    """Response for sampling operations."""

    added_count: int
    mode: SamplingMode
    target_achievement: dict[str, ClassAchievement] | None = None


class DatasetBuildRequest(SQLModel):
    """Request for building a new dataset."""

    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    filters: FilterParams
    sampling: SamplingConfig


class DatasetAddSamplesRequest(SQLModel):
    """Request for adding samples to existing dataset."""

    filters: FilterParams
    sampling: SamplingConfig


class FilterPreviewResponse(SQLModel):
    """Response for filter preview."""

    count: int
    samples: list["SamplePublic"]


class SampleHistory(SQLModel, table=True):
    """Sample operation history."""

    __tablename__ = "sample_history"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    sample_id: uuid.UUID = Field(
        foreign_key="sample.id", nullable=False, ondelete="CASCADE"
    )
    action: SampleHistoryAction
    details: dict | None = Field(default=None, sa_column=Column(JSONB))
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    sample: Optional["Sample"] = Relationship(back_populates="history")


class SampleHistoryPublic(SQLModel):
    """Properties to return via API."""

    id: uuid.UUID
    sample_id: uuid.UUID
    action: SampleHistoryAction
    details: dict | None
    created_at: datetime


# ============================================================================
# Request/Response Models for Batch Operations
# ============================================================================


class BatchTagRequest(SQLModel):
    """Request for batch tagging samples."""

    sample_ids: list[uuid.UUID]
    tag_ids: list[uuid.UUID]


class DatasetSamplesRequest(SQLModel):
    """Request for adding/removing samples from dataset."""

    sample_ids: list[uuid.UUID]


# ============================================================================
# Dashboard Models
# ============================================================================


class DashboardOverview(SQLModel):
    """Dashboard overview statistics."""

    total_samples: int
    total_datasets: int
    total_tags: int
    total_minio_instances: int
    samples_today: int
    samples_this_week: int


class DailyStats(SQLModel):
    """Daily statistics."""

    date: str
    count: int


class TagDistribution(SQLModel):
    """Tag distribution statistics."""

    tag_id: uuid.UUID
    tag_name: str
    count: int


# ============================================================================
# Import Models
# ============================================================================


class ImportTaskStatus(str, Enum):
    """Import task status enum."""

    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class ImportTask(SQLModel, table=True):
    """Import task for tracking async CSV import."""

    __tablename__ = "import_task"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    minio_instance_id: uuid.UUID = Field(
        foreign_key="minio_instance.id", nullable=False, ondelete="CASCADE"
    )
    bucket: str | None = Field(default=None, max_length=255)
    status: ImportTaskStatus = Field(default=ImportTaskStatus.pending)
    total_rows: int = Field(default=0)
    progress: int = Field(default=0)
    created: int = Field(default=0)
    skipped: int = Field(default=0)
    errors: int = Field(default=0)
    annotations_linked: int = Field(default=0)
    tags_created: int = Field(default=0)
    error_details: list | None = Field(default=None, sa_column=Column(JSONB))
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None


class ImportTaskPublic(SQLModel):
    """Import task response for API."""

    id: uuid.UUID
    status: ImportTaskStatus
    total_rows: int
    progress: int
    created: int
    skipped: int
    errors: int
    annotations_linked: int
    tags_created: int
    error_details: list | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None


class CSVPreviewResponse(SQLModel):
    """CSV preview response for API."""

    total_rows: int
    columns: list[str]
    sample_rows: list[dict]
    has_tags_column: bool
    image_count: int
    annotation_count: int


class ImportStartRequest(SQLModel):
    """Request to start import."""

    minio_instance_id: uuid.UUID
    bucket: str | None = None
    validate_files: bool = True


# ============================================================================
# Sample Browser Models
# ============================================================================


class SampleListResponse(SQLModel):
    """Response for paginated sample list with infinite scroll support."""

    items: list["SamplePublic"]
    total: int
    has_more: bool


class SampleThumbnail(SQLModel):
    """Thumbnail data for a single sample."""

    id: uuid.UUID
    presigned_url: str
    file_name: str
    file_size: int
    created_at: datetime
    annotation_status: AnnotationStatus
    class_counts: dict[str, int] | None = None


class SampleThumbnailsRequest(SQLModel):
    """Request for batch sample thumbnails."""

    sample_ids: list[uuid.UUID]
