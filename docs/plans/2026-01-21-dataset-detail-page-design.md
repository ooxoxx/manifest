# 数据集详情页功能设计

## 概述与目标

### 功能目标

创建数据集详情页，让用户能够：
- 查看数据集中各类别的物体数量统计
- 以缩略图网格浏览所有样本
- 点击类别筛选显示相关样本
- 查看单个样本的详细标注信息
- 移除不需要的样本（单个/批量）
- 添加新样本到数据集

### 技术目标

- 创建可复用的 `SampleGrid`、`ClassStatsPanel` 组件
- 重构 review 页面为通用样本查看器
- 新增后端 API 支持类别统计查询
- 使用无限滚动实现大数据集的流畅浏览

### 路由规划

```
/datasets                    → 数据集列表（整行可点击）
/datasets/{id}               → 数据集详情页（新建）
/datasets/{id}/add-samples   → 添加样本（现有）
/datasets/{id}/review        → 样本查看器（增强）
```

## 后端 API 变更

### 新增 API 端点

```
GET /api/v1/datasets/{id}/class-stats
```

返回数据集内所有样本的类别统计信息：

```json
{
  "classes": [
    { "name": "person", "count": 1250 },
    { "name": "car", "count": 890 }
  ],
  "total_samples": 500,
  "total_objects": 2140
}
```

### 修改现有端点

```
GET /api/v1/datasets/{id}/samples
```

新增查询参数：
- `class_filter`: 可选，按类别筛选样本（如 `?class_filter=person`）
- `limit` / `offset`: 已有，用于无限滚动分页

### 实现位置

- `backend/app/api/routes/datasets.py` - 新增 `get_dataset_class_stats` 路由
- `backend/app/services/sampling_service.py` - 新增统计查询逻辑（复用现有的 Annotation 关联查询）

## 前端组件设计

### 新建可复用组件

```
src/components/
├── Samples/
│   ├── SampleGrid.tsx          # 缩略图网格，支持无限滚动、多选、单个删除
│   ├── SampleThumbnail.tsx     # 单个缩略图卡片，显示图片+删除按钮+选中状态
│   └── SampleViewer.tsx        # 样本详情查看器（重构自 review 页面）
├── Datasets/
│   ├── Detail/
│   │   ├── DatasetDetailPage.tsx   # 详情页主容器（侧边栏+主区域布局）
│   │   ├── ClassStatsPanel.tsx     # 左侧类别统计面板，支持点击筛选
│   │   └── DatasetHeader.tsx       # 顶部标题栏（名称+添加样本按钮）
│   └── List/
│       └── columns.tsx             # 修改：整行可点击
```

### 组件职责划分

- `SampleGrid`: 接收样本列表，处理无限滚动、选中状态、删除回调
- `ClassStatsPanel`: 接收类别统计，渲染列表，触发筛选回调
- `SampleViewer`: 显示大图 + 标注框绘制 + 标注信息列表

## 数据流与状态管理

### 详情页状态

```typescript
// DatasetDetailPage 状态
const [selectedClass, setSelectedClass] = useState<string | null>(null)  // 当前筛选的类别
const [selectedSamples, setSelectedSamples] = useState<Set<string>>()    // 多选的样本ID
```

### TanStack Query 数据获取

```typescript
// 数据集基本信息
useQuery({ queryKey: ['dataset', datasetId], queryFn: () => readDataset(datasetId) })

// 类别统计（左侧面板）
useQuery({ queryKey: ['dataset', datasetId, 'class-stats'], queryFn: () => getDatasetClassStats(datasetId) })

// 样本列表（无限滚动）
useInfiniteQuery({
  queryKey: ['dataset', datasetId, 'samples', { classFilter: selectedClass }],
  queryFn: ({ pageParam }) => getDatasetSamples(datasetId, { offset: pageParam, class_filter: selectedClass }),
  getNextPageParam: (lastPage, pages) => /* 计算下一页 offset */
})
```

### 删除操作

单个/批量删除后调用 `queryClient.invalidateQueries(['dataset', datasetId])` 刷新统计和列表

## 样本查看器设计

### 增强现有 review.tsx 页面

当前 review 页面功能简单，需要增强为通用的 `SampleViewer` 组件。

### 显示内容

- 大图展示（可缩放）
- 标注框可视化叠加（根据 Annotation 中的 objects 绘制边界框）
- 标注信息面板：类别列表、每个物体的坐标/尺寸
- 样本元信息：文件名、尺寸、MIME 类型、创建时间

### 交互功能

- 上一个/下一个样本导航（在数据集上下文中）
- 从数据集移除当前样本按钮
- 返回数据集详情页

### 路由参数

```
/datasets/{datasetId}/review?sampleId={sampleId}&classFilter={class}
```

- `sampleId`: 当前查看的样本
- `classFilter`: 可选，保持从详情页带过来的筛选状态，用于上下导航

### 组件拆分

- `SampleViewer.tsx`: 纯展示组件，接收样本数据
- `AnnotationOverlay.tsx`: Canvas 绘制标注框
- `SampleInfoPanel.tsx`: 显示元信息和标注详情

## 实现步骤

按优先级排序的实现顺序：

### 阶段 1：基础框架

1. 后端新增 `/datasets/{id}/class-stats` API
2. 后端修改 `/datasets/{id}/samples` 支持 `class_filter` 参数
3. 前端新建 `datasets/$datasetId/index.tsx` 路由
4. 修改数据集列表，整行可点击跳转详情页

### 阶段 2：详情页核心

5. 实现 `ClassStatsPanel` 组件（左侧类别统计）
6. 实现 `SampleThumbnail` 组件（单个缩略图卡片）
7. 实现 `SampleGrid` 组件（网格 + 无限滚动）
8. 组装 `DatasetDetailPage`（侧边栏布局 + 筛选联动）

### 阶段 3：样本操作

9. 实现单个样本删除功能
10. 实现多选批量删除功能
11. 添加顶部"添加样本"按钮跳转

### 阶段 4：样本查看器

12. 创建 `AnnotationOverlay` 标注框绘制组件
13. 增强 review 页面为 `SampleViewer`
14. 实现样本上下导航功能

## 测试策略

### 后端测试（pytest）

- 测试 `GET /datasets/{id}/class-stats` 返回正确统计
- 测试 `GET /datasets/{id}/samples?class_filter=xxx` 筛选逻辑
- 测试空数据集、单类别、多类别场景

### 前端 E2E 测试（Playwright）

- 数据集列表点击跳转详情页
- 类别统计面板显示正确数据
- 点击类别筛选样本网格
- 无限滚动加载更多样本
- 单个样本删除确认流程
- 批量选择和删除流程
- 点击样本跳转查看器
- 查看器上下导航功能
