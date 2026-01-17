# Manifest MVP 详细设计文档

> **版本**: 1.0.0
> **日期**: 2026-01-17
> **状态**: 已确认

---

## 1. 设计概述

### 1.1 MVP 范围定义

基于 PRD 讨论，Manifest MVP 将实现三个核心能力的基本可用状态：

**样本纳管**
- CSV 清单批量导入（支持 tags 列）
- MinIO Webhook 实时接收新增/删除事件
- 图像与 VOC XML 标注文件自动关联（同名匹配）

**标签与标注管理**
- 层级标签体系（已有基础）
- VOC XML 标注解析：提取类别、目标数量、bbox 坐标
- 标注内容存储用于筛选和可视化

**数据集构建**
- 多维度筛选：标签、时间、路径、标注类别、目标数量
- 随机采样与类别配比
- 列表模式 + 逐张审核模式

### 1.2 技术约束

- MinIO 大目录不可 ls 扫描，依赖 CSV 导入或事件推送
- 图像-标注关联基于文件名（不含扩展名）
- 标注格式 MVP 仅支持 VOC/Pascal XML

---

## 2. 数据模型

### 2.1 Sample 表扩展

```
Sample (扩展字段)
├── file_hash: String (MD5, 索引)    # 图像文件 MD5，用于去重
├── file_stem: String (索引)         # 文件名不含扩展名，用于关联匹配
├── annotation_key: String           # 标注文件路径（可空）
├── annotation_hash: String          # 标注文件 MD5
├── annotation_status: Enum          # none/linked/conflict/error
└── annotation_id: UUID (FK)         # 关联的 Annotation 记录
```

### 2.2 新增 Annotation 表

```
Annotation
├── id: UUID (PK)
├── sample_id: UUID (FK, unique)     # 关联的图像样本
├── format: Enum                     # voc/yolo/coco
├── image_width: Integer
├── image_height: Integer
├── object_count: Integer            # 目标总数
├── class_counts: JSONB              # {"person": 3, "car": 2}
├── objects: JSONB                   # 完整 bbox 列表
└── created_at, updated_at
```

**objects JSONB 结构**

```json
[
  {"class": "person", "xmin": 100, "ymin": 50, "xmax": 200, "ymax": 300},
  {"class": "car", "xmin": 300, "ymin": 100, "xmax": 500, "ymax": 250}
]
```

### 2.3 核心原则

**一个 Sample = 一张图像（可选关联标注）**

只有图像文件创建 Sample，标注文件作为附属信息存储。

---

## 3. 去重机制设计

### 3.1 场景 A：重复图像

- 计算新图像 MD5，查询是否已存在相同 `file_hash`
- 已存在 → 跳过，不创建新 Sample
- 记录到导入报告（重复跳过 N 张）

### 3.2 场景 B：新标注关联到已有图像

- 图像已存在，新标注文件到达
- 计算标注 MD5，对比 `annotation_hash`
  - 相同 → 跳过（完全重复）
  - 不同 → 标记 `annotation_status = conflict`，进入待审核队列

### 3.3 场景 C：标注冲突审核

- 前端展示冲突列表：图像 + 旧标注 + 新标注对比
- 用户选择：保留旧 / 使用新 / 稍后处理
- 操作记录到 SampleHistory

---

## 4. CSV 导入设计

### 4.1 CSV 格式规范

```csv
object_key,tags
images/2024/01/sample001.jpg,"输电/山火,已标注"
images/2024/01/sample002.jpg,"输电/通道监拍"
labels/2024/01/sample001.xml,
```

- `object_key`：必填，MinIO 对象路径
- `tags`：可选，逗号分隔的标签路径，支持层级（用 `/` 分隔）
- `bucket`：可在导入时统一指定，或作为 CSV 列

### 4.2 导入流程

```
1. 上传 CSV 文件
   ↓
2. 解析并校验格式（返回预览：总行数、字段识别）
   ↓
3. 用户确认 MinIO 实例、桶名、导入选项
   ↓
4. 后台异步任务处理：
   - 批量验证文件存在性（HEAD 请求，并发控制）
   - 创建 Sample 记录，提取 file_stem
   - 自动创建不存在的标签（按层级）
   - 关联标签到样本
   - 触发同名关联匹配（图像↔标注）
   - 解析标注文件内容（VOC XML）
   ↓
5. 返回导入报告：成功/失败/跳过数量
```

### 4.3 性能考虑

- 分批处理（每批 500 条）
- 并发 HEAD 请求（限制 20 并发）
- 事务批量提交

---

## 5. Webhook 事件处理

### 5.1 收到 `s3:ObjectCreated:*` 事件

```
判断文件类型（按扩展名）
   │
   ├── 图像文件（jpg/png/jpeg）
   │   ├── 获取文件 MD5（从 MinIO ETag 或计算）
   │   ├── 查询是否存在相同 file_hash
   │   │   ├── 存在 → 跳过，记录日志
   │   │   └── 不存在 → 创建 Sample
   │   │       ├── 提取 file_stem
   │   │       ├── 查找同名 .xml 标注文件
   │   │       │   ├── 找到 → 填充 annotation_key，解析标注
   │   │       │   └── 未找到 → annotation_status = none
   │   │       └── 记录 SampleHistory (created)
   │
   └── 标注文件（xml）
       ├── 提取 file_stem
       ├── 查找同名图像的 Sample
       │   ├── 未找到 → 忽略（等待图像到达）
       │   └── 找到 → 检查标注状态
       │       ├── 无标注 → 关联并解析
       │       └── 已有标注 → 对比 MD5
       │           ├── 相同 → 跳过
       │           └── 不同 → 标记 conflict，存入待审核
       └── 记录 SampleHistory (annotation_linked/conflict)
```

### 5.2 收到 `s3:ObjectRemoved:*` 事件

- 图像删除 → Sample 软删除
- 标注删除 → 清空 annotation_key，保留 Sample

---

## 6. 数据集构建与筛选

### 6.1 筛选维度

| 维度 | 字段/来源 | 查询方式 |
|------|----------|---------|
| 标签 | SampleTag 关联 | JOIN + IN/NOT IN |
| 时间范围 | Sample.created_at | BETWEEN |
| MinIO 实例 | Sample.minio_instance_id | = |
| 桶名 | Sample.bucket | = |
| 路径前缀 | Sample.object_key | LIKE 'prefix%' |
| 标注类别 | Annotation.class_counts | JSONB ? 'class_name' |
| 目标数量 | Annotation.object_count | >, <, =, BETWEEN |
| 标注状态 | Sample.annotation_status | = |

### 6.2 筛选请求结构

```json
{
  "tags_include": ["uuid1", "uuid2"],
  "tags_exclude": ["uuid3"],
  "date_from": "2024-01-01",
  "date_to": "2024-06-30",
  "minio_instance_id": "uuid",
  "bucket": "training-data",
  "prefix": "images/2024/",
  "annotation_classes": ["person", "car"],
  "object_count_min": 1,
  "object_count_max": 10,
  "annotation_status": "linked"
}
```

### 6.3 目标框数量配比算法

**需求场景**

用户指定：需要 `person` 类别 1000 个框，`car` 类别 500 个框。系统自动选择最优图片组合。

**算法设计：贪心 + 优先队列**

```
输入：
  - candidates: 候选样本列表（经过基础筛选）
  - targets: {"person": 1000, "car": 500}  # 目标框数需求

算法步骤：
1. 预处理：计算每个样本的"贡献分数"
   score(sample) = Σ min(sample.class_counts[c], remaining[c]) / remaining[c]
   （对每个未满足类别，贡献越接近需求缺口越高分）

2. 贪心选择：
   remaining = copy(targets)
   selected = []

   WHILE any(remaining[c] > 0) AND candidates NOT empty:
       # 按贡献分数排序，优先选高分样本
       best = candidates.pop_max_score()
       selected.append(best)

       # 更新剩余需求
       FOR each class c in best.class_counts:
           remaining[c] -= best.class_counts[c]
           remaining[c] = max(0, remaining[c])

       # 重算候选分数（剩余需求变了）
       recalculate_scores(candidates, remaining)

3. 输出：selected 列表 + 实际达成统计
```

**配比结果响应**

```json
{
  "selected_count": 234,
  "target_achievement": {
    "person": {"target": 1000, "actual": 1023, "status": "achieved"},
    "car": {"target": 500, "actual": 487, "status": "partial"}
  },
  "samples": [...]
}
```

**性能优化**
- 候选集过大时，先随机采样 10x 目标数量再配比
- 分数计算使用 SQL 窗口函数预处理
- 配比计算在应用层完成，避免复杂 SQL

---

## 7. 样本预览与审核界面

### 7.1 列表模式

**表格列定义**

| 列 | 内容 | 宽度 |
|---|------|-----|
| 勾选框 | 批量操作 | 40px |
| 缩略图 | 64x64 预览图 | 80px |
| 文件名 | file_name + 路径提示 | 自适应 |
| 标注状态 | 图标：✓已标注 / ⚠冲突 / -无 | 80px |
| 目标数 | object_count | 60px |
| 类别 | 类别标签（最多显示3个） | 150px |
| 标签 | 用户标签 | 150px |
| 入库时间 | created_at | 120px |
| 操作 | 查看/移除 | 100px |

**批量操作**
- 全选当前页 / 全选所有筛选结果
- 批量添加到数据集
- 批量移除
- 批量打标签

### 7.2 逐张审核模式

**界面布局**

```
┌─────────────────────────────────────────────────────┐
│  [← 返回列表]        第 23/156 张        [筛选条件] │
├─────────────────────────────────────────────────────┤
│                                                     │
│              ┌─────────────────────┐                │
│              │                     │                │
│              │   图像 + bbox 叠加   │                │
│              │   (可缩放拖拽)       │                │
│              │                     │                │
│              └─────────────────────┘                │
│                                                     │
│  类别统计: person(3) car(2) bicycle(1)              │
│  标签: [输电] [山火] [+添加]                         │
├─────────────────────────────────────────────────────┤
│  [← A] 上一张    [保留 Y]  [移除 N]  [跳过 S]  [→ D] │
└─────────────────────────────────────────────────────┘
```

**快捷键**
- `A` / `←`：上一张
- `D` / `→`：下一张
- `Y`：保留到数据集
- `N`：从候选中移除
- `S`：跳过（稍后决定）
- `Z`：撤销上一步操作

---

## 8. API 接口设计

### 8.1 CSV 导入

```
POST /api/v1/samples/import
  - Content-Type: multipart/form-data
  - Body: file (CSV), minio_instance_id, bucket
  - Response: { task_id, total_rows }

GET /api/v1/samples/import/{task_id}/status
  - Response: { status, progress, success, failed, skipped, errors[] }
```

### 8.2 标注冲突处理

```
GET /api/v1/samples/conflicts
  - Query: page, limit
  - Response: 冲突列表（含新旧标注对比）

POST /api/v1/samples/{id}/resolve-conflict
  - Body: { action: "keep_old" | "use_new" | "skip" }
```

### 8.3 数据集智能构建

```
POST /api/v1/datasets/{id}/build
  - Body: {
      filters: { tags_include, date_from, annotation_classes, ... },
      sampling: { ratio, class_targets: {"person": 1000} }
    }
  - Response: { preview_count, target_achievement, sample_ids[] }

POST /api/v1/datasets/{id}/build/confirm
  - Body: { sample_ids[] }
  - 确认将预览结果加入数据集
```

### 8.4 样本预览增强

```
GET /api/v1/samples/{id}/preview
  - Response: {
      presigned_url,
      annotation: { objects[], class_counts },
      tags[]
    }
```

---

## 9. 前端页面结构

### 9.1 路由设计

```
/samples                    # 样本列表（已有，需增强）
/samples/import             # CSV 导入向导
/samples/conflicts          # 标注冲突处理

/datasets                   # 数据集列表（已有）
/datasets/new               # 新建向导：筛选 → 配比 → 预览 → 命名创建
/datasets/{id}              # 数据集详情 + 样本列表
/datasets/{id}/add          # 往已有数据集追加样本
/datasets/{id}/review       # 逐张审核模式

/tags                       # 标签管理（已有）
```

### 9.2 核心组件

| 组件 | 用途 |
|-----|------|
| `ImportWizard` | CSV 导入三步向导（上传→预览→执行） |
| `ImportProgress` | 导入进度展示 + 错误详情 |
| `ConflictResolver` | 标注冲突对比与处理 |
| `DatasetBuilder` | 筛选条件表单 + 配比设置 |
| `BuildPreview` | 配比结果预览 + 达成统计 |
| `SampleReviewer` | 逐张审核主界面 |
| `ImageWithBbox` | 图像 + bbox 叠加渲染 |
| `ClassBadges` | 类别标签展示组件 |
| `FilterPanel` | 可复用的筛选条件面板 |

### 9.3 组件复用策略

- `FilterPanel` 在样本列表、数据集构建中复用
- `ImageWithBbox` 在列表缩略图、审核大图中复用
- `DataTable` 继续使用现有表格组件

---

## 10. 后端服务架构

### 10.1 服务模块划分

```
app/services/
├── minio_service.py       # 已有，MinIO 操作
├── import_service.py      # 增强，CSV 导入逻辑
├── annotation_service.py  # 新增，VOC XML 解析
├── matching_service.py    # 新增，图像-标注关联匹配
├── sampling_service.py    # 新增，配比算法实现
└── conflict_service.py    # 新增，冲突检测与处理
```

### 10.2 各服务职责

**AnnotationService**
- `parse_voc_xml(content: bytes) -> Annotation`
- 提取：image_size, objects[], class_counts
- 错误处理：格式异常返回 None + 日志

**MatchingService**
- `find_annotation_for_image(sample: Sample) -> Optional[str]`
- `find_image_for_annotation(annotation_key: str) -> Optional[Sample]`
- `link_and_parse(sample: Sample, annotation_key: str)`

**SamplingService**
- `filter_samples(filters: FilterParams) -> Query`
- `apply_sampling(query, ratio, class_targets) -> SamplingResult`
- 实现贪心配比算法

**ConflictService**
- `check_conflict(sample: Sample, new_hash: str) -> bool`
- `create_conflict_record(sample, old_key, new_key)`
- `resolve_conflict(sample_id, action)`

### 10.3 异步任务

使用现有 Redis 作为任务队列：

| 任务 | 触发方式 | 处理内容 |
|-----|---------|---------|
| `import_csv` | API 调用 | CSV 批量导入 |
| `parse_annotation` | 导入/Webhook | 解析单个标注文件 |
| `batch_match` | 导入完成后 | 批量关联匹配 |

---

## 11. 数据库索引与性能

### 11.1 Sample 表新增索引

```sql
-- 去重查询
CREATE INDEX idx_sample_file_hash ON sample(file_hash);

-- 同名匹配
CREATE INDEX idx_sample_file_stem ON sample(file_stem);

-- 筛选组合索引
CREATE INDEX idx_sample_filter ON sample(
  minio_instance_id, bucket, status, created_at
);
```

### 11.2 Annotation 表索引

```sql
-- 类别筛选（GIN 索引支持 JSONB 查询）
CREATE INDEX idx_annotation_classes ON annotation
  USING GIN(class_counts);

-- 目标数量范围查询
CREATE INDEX idx_annotation_count ON annotation(object_count);
```

### 11.3 查询性能预估

| 操作 | 数据量 | 预期耗时 |
|-----|-------|---------|
| 按标签筛选 | 1000万样本 | < 500ms |
| 按类别筛选 | 100万标注 | < 1s |
| 配比算法 | 1万候选 | < 2s |
| MD5 去重检查 | 单条 | < 10ms |

---

## 12. VOC XML 解析规范

### 12.1 VOC/Pascal XML 格式参考

```xml
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
  <object>
    <name>car</name>
    <bndbox>
      <xmin>300</xmin>
      <ymin>100</ymin>
      <xmax>500</xmax>
      <ymax>250</ymax>
    </bndbox>
  </object>
</annotation>
```

### 12.2 解析输出结构

```python
@dataclass
class ParsedAnnotation:
    filename: str
    image_width: int
    image_height: int
    object_count: int
    class_counts: dict[str, int]  # {"person": 1, "car": 1}
    objects: list[dict]  # [{"class": "person", "xmin": 100, ...}]
```

### 12.3 异常处理

| 情况 | 处理方式 |
|-----|---------|
| XML 格式错误 | 记录错误，annotation_status = error |
| 缺少必填字段 | 尽量解析，缺失字段置空 |
| 坐标超出图像边界 | 警告日志，不阻断 |
| 文件编码问题 | 尝试 UTF-8 / GBK 自动检测 |

---

## 13. MVP 实施阶段

### 阶段 1：数据模型与基础服务
- Sample 表扩展（file_hash, file_stem, annotation_key 等）
- Annotation 表创建 + 迁移脚本
- AnnotationService（VOC XML 解析）
- MatchingService（同名关联逻辑）

### 阶段 2：CSV 导入功能
- 导入 API + 异步任务
- 文件校验 + MD5 去重
- 标签自动创建与关联
- 前端 ImportWizard 组件

### 阶段 3：Webhook 增强
- 图像事件 → 创建 Sample + 查找标注
- 标注事件 → 关联 + 冲突检测
- ConflictService + 冲突处理页面

### 阶段 4：数据集构建
- FilterPanel 筛选组件
- SamplingService 配比算法
- /datasets/new 新建向导
- /datasets/{id}/add 追加样本

### 阶段 5：审核与可视化
- ImageWithBbox 组件（bbox 叠加渲染）
- SampleReviewer 逐张审核页面
- 快捷键支持

### 阶段 6：集成测试与优化
- 端到端流程验证
- 性能调优
- 边界情况处理

---

## 14. 设计总结

### 14.1 MVP 核心交付物

| 类别 | 交付内容 |
|-----|---------|
| 数据模型 | Sample 扩展 + Annotation 表 |
| 后端服务 | 5 个新增服务模块 |
| API 端点 | 8 个新增/修改端点 |
| 前端页面 | 4 个新增页面 |
| 前端组件 | 9 个核心组件 |

### 14.2 关键技术决策

1. **一图一样本**：Sample 代表图像，标注作为附属
2. **MD5 去重**：图像去重跳过，标注冲突人工审核
3. **同名关联**：基于 file_stem 索引实时匹配
4. **贪心配比**：优先队列算法实现目标框数量配比
5. **VOC 优先**：MVP 仅支持 Pascal VOC XML 格式

### 14.3 未纳入 MVP 的功能

- YOLO / COCO 格式支持（后续扩展）
- MinIO 目录扫描（性能问题，暂不实现）
- 模型推理记录与误报筛选（二期）
- 批量正则打标签（二期）
- 操作回滚（二期）
