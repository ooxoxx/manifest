# Phase 4: 数据集构建功能设计

> **版本**: 1.0.0
> **日期**: 2026-01-18
> **状态**: 已确认

---

## 1. 概述

Phase 4 实现数据集智能构建功能，包括多维度筛选、配比采样算法、新建向导和追加样本页面。

### 1.1 交付物

| 类别 | 内容 |
|-----|------|
| 后端服务 | SamplingService (Query 构建器 + 配比算法) |
| API 端点 | 3 个新增端点 |
| 前端组件 | FilterPanel, SamplingConfig |
| 前端页面 | /datasets/new, /datasets/{id}/add |
| 测试 | 后端单元测试 + 前端 E2E 测试 |

---

## 2. 后端设计

### 2.1 SamplingService

**文件位置**: `backend/app/services/sampling_service.py`

采用 Query 构建器模式，服务层返回 `Select` 对象，session 操作留给 API 层。

```python
from sqlmodel import Select, select
from app.models import Sample, SampleTag, Annotation, SampleStatus, AnnotationStatus

def build_sample_filter_query(filters: FilterParams) -> Select:
    """构建筛选查询，不执行"""
    query = select(Sample).where(Sample.status == SampleStatus.active)

    if filters.tags_include:
        query = query.join(SampleTag).where(SampleTag.tag_id.in_(filters.tags_include))
    if filters.tags_exclude:
        subq = select(SampleTag.sample_id).where(SampleTag.tag_id.in_(filters.tags_exclude))
        query = query.where(Sample.id.notin_(subq))
    if filters.minio_instance_id:
        query = query.where(Sample.minio_instance_id == filters.minio_instance_id)
    if filters.bucket:
        query = query.where(Sample.bucket == filters.bucket)
    if filters.prefix:
        query = query.where(Sample.object_key.startswith(filters.prefix))
    if filters.date_from:
        query = query.where(Sample.created_at >= filters.date_from)
    if filters.date_to:
        query = query.where(Sample.created_at <= filters.date_to)
    if filters.annotation_status:
        query = query.where(Sample.annotation_status == filters.annotation_status)
    if filters.annotation_classes:
        query = query.join(Annotation).where(
            Annotation.class_counts.has_any(filters.annotation_classes)
        )
    if filters.object_count_min is not None:
        query = query.join(Annotation).where(Annotation.object_count >= filters.object_count_min)
    if filters.object_count_max is not None:
        query = query.join(Annotation).where(Annotation.object_count <= filters.object_count_max)

    return query


def sample_by_class_targets(
    candidates: list[Sample],
    class_targets: dict[str, int],
) -> SamplingResult:
    """按目标框数量配比选择最优样本组合（贪心 + 优先队列）"""
    import heapq

    remaining = class_targets.copy()
    selected = []
    candidate_set = list(candidates)

    def calculate_score(sample: Sample) -> float:
        if not sample.annotation or not sample.annotation.class_counts:
            return 0.0
        score = 0.0
        for cls, target in remaining.items():
            if target > 0:
                contribution = min(sample.annotation.class_counts.get(cls, 0), target)
                score += contribution / target
        return score

    while any(v > 0 for v in remaining.values()) and candidate_set:
        # 按分数排序，选最高分
        candidate_set.sort(key=calculate_score, reverse=True)
        best = candidate_set.pop(0)
        selected.append(best)

        # 更新剩余需求
        if best.annotation and best.annotation.class_counts:
            for cls, count in best.annotation.class_counts.items():
                if cls in remaining:
                    remaining[cls] = max(0, remaining[cls] - count)

    # 计算达成情况
    achievement = {}
    for cls, target in class_targets.items():
        actual = sum(
            s.annotation.class_counts.get(cls, 0)
            for s in selected
            if s.annotation and s.annotation.class_counts
        )
        achievement[cls] = ClassAchievement(
            target=target,
            actual=actual,
            status="achieved" if actual >= target else "partial"
        )

    return SamplingResult(
        selected_samples=selected,
        target_achievement=achievement,
        total_selected=len(selected)
    )


def random_sample(
    candidates: list[Sample],
    count: int,
    seed: int | None = None,
) -> list[Sample]:
    """随机抽取指定数量样本"""
    import random
    if seed is not None:
        random.seed(seed)
    return random.sample(candidates, min(count, len(candidates)))
```

### 2.2 数据模型

**文件位置**: `backend/app/models.py` (扩展)

```python
class SamplingMode(str, Enum):
    all = "all"
    random = "random"
    class_targets = "class_targets"


class FilterParams(SQLModel):
    tags_include: list[uuid.UUID] | None = None
    tags_exclude: list[uuid.UUID] | None = None
    minio_instance_id: uuid.UUID | None = None
    bucket: str | None = None
    prefix: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    annotation_classes: list[str] | None = None
    object_count_min: int | None = None
    object_count_max: int | None = None
    annotation_status: AnnotationStatus | None = None


class SamplingConfig(SQLModel):
    mode: SamplingMode = SamplingMode.all
    count: int | None = None  # random 模式必填
    class_targets: dict[str, int] | None = None  # class_targets 模式必填
    seed: int | None = None  # 可选，用于复现随机结果


class ClassAchievement(SQLModel):
    target: int
    actual: int
    status: str  # "achieved" | "partial"


class SamplingResultResponse(SQLModel):
    added_count: int
    mode: SamplingMode
    target_achievement: dict[str, ClassAchievement] | None = None


class DatasetBuildRequest(SQLModel):
    name: str
    description: str | None = None
    filters: FilterParams
    sampling: SamplingConfig


class DatasetAddSamplesRequest(SQLModel):
    filters: FilterParams
    sampling: SamplingConfig
```

### 2.3 API 端点

**文件位置**: `backend/app/api/routes/datasets.py` (扩展)

```python
# 1. 筛选预览
@router.post("/filter-preview")
def filter_preview(
    session: SessionDep,
    current_user: CurrentUser,
    filters: FilterParams,
    skip: int = 0,
    limit: int = 20,
) -> dict:
    """预览符合条件的样本"""
    query = build_sample_filter_query(filters)
    total = session.exec(select(func.count()).select_from(query.subquery())).one()
    samples = session.exec(query.offset(skip).limit(limit)).all()
    return {"count": total, "samples": samples}


# 2. 智能构建
@router.post("/build")
def build_dataset(
    session: SessionDep,
    current_user: CurrentUser,
    request: DatasetBuildRequest,
) -> dict:
    """创建数据集并按配比添加样本"""
    # 创建数据集
    dataset = Dataset(
        name=request.name,
        description=request.description,
        owner_id=current_user.id,
    )
    session.add(dataset)
    session.flush()

    # 筛选样本
    query = build_sample_filter_query(request.filters)
    candidates = session.exec(query).all()

    # 采样
    result = _apply_sampling(candidates, request.sampling)

    # 添加到数据集
    for sample in result.selected_samples:
        ds = DatasetSample(dataset_id=dataset.id, sample_id=sample.id)
        session.add(ds)

    dataset.sample_count = len(result.selected_samples)
    session.commit()

    return {
        "dataset": dataset,
        "result": SamplingResultResponse(
            added_count=result.total_selected,
            mode=request.sampling.mode,
            target_achievement=result.target_achievement,
        )
    }


# 3. 追加样本
@router.post("/{dataset_id}/add-samples")
def add_samples(
    session: SessionDep,
    current_user: CurrentUser,
    dataset_id: uuid.UUID,
    request: DatasetAddSamplesRequest,
) -> dict:
    """往已有数据集添加样本"""
    dataset = session.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # 筛选样本
    query = build_sample_filter_query(request.filters)
    candidates = session.exec(query).all()

    # 排除已在数据集中的样本
    existing_ids = set(
        session.exec(
            select(DatasetSample.sample_id).where(DatasetSample.dataset_id == dataset_id)
        ).all()
    )
    candidates = [s for s in candidates if s.id not in existing_ids]

    # 采样
    result = _apply_sampling(candidates, request.sampling)

    # 添加到数据集
    for sample in result.selected_samples:
        ds = DatasetSample(dataset_id=dataset.id, sample_id=sample.id)
        session.add(ds)

    dataset.sample_count += len(result.selected_samples)
    session.commit()

    return {
        "dataset": dataset,
        "result": SamplingResultResponse(
            added_count=result.total_selected,
            mode=request.sampling.mode,
            target_achievement=result.target_achievement,
        )
    }


def _apply_sampling(candidates: list[Sample], config: SamplingConfig) -> SamplingResult:
    """应用采样策略"""
    if config.mode == SamplingMode.all:
        return SamplingResult(
            selected_samples=candidates,
            target_achievement=None,
            total_selected=len(candidates),
        )
    elif config.mode == SamplingMode.random:
        selected = random_sample(candidates, config.count, config.seed)
        return SamplingResult(
            selected_samples=selected,
            target_achievement=None,
            total_selected=len(selected),
        )
    else:  # class_targets
        return sample_by_class_targets(candidates, config.class_targets)
```

---

## 3. 前端设计

### 3.1 FilterPanel 组件

**文件位置**: `frontend/src/components/Datasets/FilterPanel.tsx`

```
┌─────────────────────────────────────────────────────────┐
│ 筛选条件                                    [重置] [预览] │
├─────────────────────────────────────────────────────────┤
│ 标签（包含）    [多选下拉: 输电/山火, 已标注, ...]        │
│ 标签（排除）    [多选下拉: 待审核, ...]                   │
├─────────────────────────────────────────────────────────┤
│ MinIO 实例      [下拉选择]     桶名 [下拉/输入]           │
│ 路径前缀        [输入框: images/2024/]                   │
├─────────────────────────────────────────────────────────┤
│ 时间范围        [日期选择器] 至 [日期选择器]              │
├─────────────────────────────────────────────────────────┤
│ 标注筛选                                                 │
│ 类别包含        [多选输入: person, car, ...]             │
│ 目标数量        [最小] - [最大]                          │
│ 标注状态        [下拉: 全部/已标注/无标注/冲突]           │
├─────────────────────────────────────────────────────────┤
│ 匹配样本数: 1,234                                        │
└─────────────────────────────────────────────────────────┘
```

**Props 接口**:
```typescript
interface FilterParams {
  tags_include?: string[];
  tags_exclude?: string[];
  minio_instance_id?: string;
  bucket?: string;
  prefix?: string;
  date_from?: string;
  date_to?: string;
  annotation_classes?: string[];
  object_count_min?: number;
  object_count_max?: number;
  annotation_status?: "none" | "linked" | "conflict" | "error";
}

interface FilterPanelProps {
  value: FilterParams;
  onChange: (filters: FilterParams) => void;
  onPreview?: () => void;
  previewCount?: number;
  loading?: boolean;
}
```

### 3.2 SamplingConfig 组件

**文件位置**: `frontend/src/components/Datasets/SamplingConfig.tsx`

```
┌─────────────────────────────────────────────────────────┐
│ 采样模式                                                 │
│ ○ 全部添加 (1,234 个样本)                                │
│ ○ 随机抽取 [____] 个样本                                 │
│ ● 按类别配比                                             │
├─────────────────────────────────────────────────────────┤
│ 类别目标（当选择"按类别配比"时显示）                       │
│ ┌────────────┬──────────┬──────────┐                    │
│ │ 类别       │ 目标数量  │ 当前可用  │                    │
│ ├────────────┼──────────┼──────────┤                    │
│ │ person     │ [1000]   │ 2,345    │                    │
│ │ car        │ [500]    │ 1,123    │                    │
│ │ + 添加类别                        │                    │
│ └────────────┴──────────┴──────────┘                    │
└─────────────────────────────────────────────────────────┘
```

**Props 接口**:
```typescript
interface SamplingConfig {
  mode: "all" | "random" | "class_targets";
  count?: number;
  class_targets?: Record<string, number>;
  seed?: number;
}

interface SamplingConfigProps {
  value: SamplingConfig;
  onChange: (config: SamplingConfig) => void;
  totalCount: number;  // 当前筛选匹配的总数
  availableClasses?: Record<string, number>;  // 各类别可用数量
}
```

### 3.3 页面路由

```
frontend/src/routes/_layout/
├── datasets.tsx                    # 列表页（已有）
└── datasets/
    ├── new.tsx                     # 新建向导（3步）
    └── $id.add.tsx                 # 追加样本（单页）
```

### 3.4 新建向导 (/datasets/new)

**三步流程**:

```
步骤 1/3: 基本信息          步骤 2/3: 筛选样本          步骤 3/3: 确认创建
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ 数据集名称 [___] │  →   │ [FilterPanel]    │  →   │ 数据集: 训练集v1 │
│ 描述 [________]  │      │                  │      │ 筛选条件: ...    │
│                  │      │ 匹配: 1,234 样本 │      │ ──────────────── │
│                  │      │                  │      │ [SamplingConfig] │
│        [下一步]  │      │ [上一步] [下一步]│      │                  │
└──────────────────┘      └──────────────────┘      │ [上一步] [创建]  │
                                                    └──────────────────┘
```

### 3.5 追加样本 (/datasets/{id}/add)

**单页设计**:

```
为数据集 "训练集v1" 添加样本
┌─────────────────────────────────────────────────────────┐
│ [FilterPanel]                                           │
│ 匹配样本数: 1,234                                        │
├─────────────────────────────────────────────────────────┤
│ [SamplingConfig]                                        │
├─────────────────────────────────────────────────────────┤
│ 当前数据集: 500 样本  →  添加后预计: 1,734 样本          │
│                                          [取消] [添加]  │
└─────────────────────────────────────────────────────────┘
```

---

## 4. 测试策略

### 4.1 后端测试

**文件**: `backend/tests/services/test_sampling_service.py`

```python
# Query 构建器测试
- test_build_filter_query_with_tags_include
- test_build_filter_query_with_tags_exclude
- test_build_filter_query_with_date_range
- test_build_filter_query_with_annotation_classes
- test_build_filter_query_with_object_count_range
- test_build_filter_query_combined_filters

# 配比算法测试
- test_sample_by_class_targets_achieves_all_targets
- test_sample_by_class_targets_partial_achievement
- test_sample_by_class_targets_empty_candidates
- test_sample_by_class_targets_greedy_selection

# 随机采样测试
- test_random_sample_returns_correct_count
- test_random_sample_with_seed_reproducible
- test_random_sample_count_exceeds_candidates
```

**文件**: `backend/tests/api/routes/test_datasets_build.py`

```python
# API 端点测试
- test_filter_preview_returns_count_and_samples
- test_filter_preview_with_pagination
- test_build_dataset_with_all_mode
- test_build_dataset_with_random_mode
- test_build_dataset_with_class_targets_mode
- test_add_samples_to_existing_dataset
- test_add_samples_excludes_duplicates
- test_add_samples_dataset_not_found
```

### 4.2 前端测试

**文件**: `frontend/tests/datasets-build.spec.ts`

```typescript
// E2E 测试
- test('create dataset wizard completes all steps')
- test('filter panel updates preview count')
- test('sampling config shows class targets input')
- test('add samples to existing dataset')
- test('class targets shows achievement status after build')
```

---

## 5. 实施步骤

### 步骤 1: 后端服务与模型
- [ ] 创建 `sampling_service.py`
- [ ] 扩展 `models.py` 添加新模型
- [ ] 编写服务层单元测试

### 步骤 2: 后端 API
- [ ] 实现 `/filter-preview` 端点
- [ ] 实现 `/build` 端点
- [ ] 实现 `/{id}/add-samples` 端点
- [ ] 编写 API 测试

### 步骤 3: 前端组件
- [ ] 创建 `FilterPanel.tsx`
- [ ] 创建 `SamplingConfig.tsx`

### 步骤 4: 前端页面
- [ ] 创建 `/datasets/new` 向导页面
- [ ] 创建 `/datasets/{id}/add` 追加页面
- [ ] 更新 `/datasets` 列表页链接

### 步骤 5: E2E 测试
- [ ] 编写 Playwright 测试
- [ ] 端到端流程验证
