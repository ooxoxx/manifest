# Phase 5 实现计划：审核与可视化

> **版本**: 1.0.0
> **日期**: 2026-01-18
> **状态**: 待实施
> **依赖**: Phase 1-3 已完成

---

## 1. 概述

Phase 5 实现 MVP 设计文档中的"审核与可视化"功能，包括：
- `ImageWithBbox` 组件（Canvas bbox 叠加渲染）
- `SampleReviewer` 逐张审核页面
- 完整快捷键支持

### 1.1 使用场景

1. **样本浏览模式**：用户从样本列表点击进入，浏览图像和标注信息，可左右切换
2. **数据集审核模式**：用户从数据集详情进入，逐张审核样本（保留/移除/跳过）

### 1.2 技术决策

| 决策项 | 选择 | 理由 |
|-------|------|------|
| 图片获取 | 后端 presigned URL | 安全，符合现有架构 |
| Bbox 渲染 | Canvas 绘制 | 性能好，交互灵活 |
| 审核持久化 | 即时保存 | 数据安全，防止意外丢失 |
| 快捷键 | 完整实现 6 个 | 完整审核体验 |

---

## 2. 组件架构设计

```
组件层次结构
├── ImageWithBbox (底层渲染组件)
│   ├── 输入：imageUrl, objects[], imageWidth, imageHeight
│   ├── 功能：Canvas 绘制图片 + bbox 叠加
│   └── 交互：缩放、拖拽、hover 高亮
│
├── SampleViewer (样本查看组件)
│   ├── 组合：ImageWithBbox + 元数据面板
│   ├── 功能：显示单个样本的完整信息
│   └── 包含：类别统计、标签列表、文件信息
│
└── SampleReviewer (审核容器组件)
    ├── 组合：SampleViewer + 导航控制 + 操作按钮
    ├── 模式：browse（浏览）/ review（审核）
    ├── 功能：样本列表导航、审核操作、快捷键
    └── 状态：当前索引、操作历史（支持撤销）
```

**复用策略**：
- 样本浏览模式：`SampleReviewer` 设置 `mode="browse"`，隐藏审核操作按钮
- 数据集审核模式：`SampleReviewer` 设置 `mode="review"`，显示完整操作

---

## 3. 后端 API 设计

### 3.1 样本预览 API（新增）

```
GET /api/v1/samples/{id}/preview

Response: {
  presigned_url: string,      // MinIO 图片 presigned URL (有效期 1 小时)
  annotation: {               // 标注信息（可空）
    objects: [{class, xmin, ymin, xmax, ymax}, ...],
    class_counts: {person: 3, car: 2},
    image_width: 1920,
    image_height: 1080
  },
  tags: [{id, name, color}, ...],
  sample: {...}               // 样本基础信息
}
```

### 3.2 依赖的已有 API

```
GET /api/v1/datasets/{id}/samples?page=1&limit=50
Response: { data: Sample[], count: number }

DELETE /api/v1/datasets/{id}/samples
Body: { sample_ids: [uuid] }
```

---

## 4. 前端路由设计

### 4.1 新增路由

```
/samples/{id}              # 样本浏览页（从列表点击进入）
/datasets/{id}/review      # 数据集审核页
```

### 4.2 路由参数传递

```typescript
// 样本列表页点击行时
navigate({
  to: '/samples/$sampleId',
  params: { sampleId: sample.id },
  search: {
    ids: currentPageSampleIds.join(','),  // 当前页样本 ID 列表
    index: clickedIndex                    // 当前点击的索引
  }
})

// 数据集审核入口
navigate({
  to: '/datasets/$datasetId/review',
  params: { datasetId: dataset.id }
})
```

### 4.3 文件结构

```
frontend/src/routes/_layout/
├── samples/
│   ├── index.tsx          # 样本列表（已有）
│   └── $sampleId.tsx      # 样本浏览页（新增）
└── datasets/
    └── $datasetId/
        └── review.tsx     # 数据集审核页（新增）
```

---

## 5. ImageWithBbox 组件设计

### 5.1 接口定义

```typescript
interface BboxObject {
  class: string
  xmin: number
  ymin: number
  xmax: number
  ymax: number
}

interface ImageWithBboxProps {
  imageUrl: string
  objects?: BboxObject[]        // [{class, xmin, ymin, xmax, ymax}, ...]
  imageWidth?: number           // 原图宽度（用于坐标换算）
  imageHeight?: number
  showLabels?: boolean          // 是否显示类别标签
  highlightClass?: string       // 高亮特定类别
  onObjectClick?: (obj: BboxObject) => void
}
```

### 5.2 Canvas 绘制逻辑

1. **图片加载**：创建 Image 对象，加载 presigned URL
2. **自适应缩放**：计算 `scale = min(containerWidth/imageWidth, containerHeight/imageHeight)`
3. **居中绘制**：计算 offset 使图片居中
4. **bbox 绘制**：遍历 objects，按 scale 换算坐标，绘制矩形框
5. **类别标签**：在 bbox 左上角绘制类别名称背景 + 文字

### 5.3 交互功能

- **缩放**：鼠标滚轮控制 scale（限制 0.5x - 3x）
- **拖拽**：鼠标按住拖动调整 offset
- **hover 高亮**：鼠标移入 bbox 区域时高亮显示
- **双击复位**：双击恢复默认缩放和位置

### 5.4 颜色方案

为不同类别自动分配颜色（HSL 色轮均匀分布）：

```typescript
function getClassColor(className: string, allClasses: string[]): string {
  const index = allClasses.indexOf(className)
  const hue = (index * 360) / allClasses.length
  return `hsl(${hue}, 70%, 50%)`
}
```

---

## 6. SampleReviewer 组件设计

### 6.1 接口定义

```typescript
interface SampleReviewerProps {
  sampleIds: string[]           // 样本 ID 列表
  initialIndex?: number         // 初始索引
  mode: 'browse' | 'review'     // 浏览模式 / 审核模式
  datasetId?: string            // 审核模式需要
  onComplete?: () => void       // 审核完成回调
}
```

### 6.2 界面布局

```
┌─────────────────────────────────────────────────────┐
│  [← 返回]        第 23/156 张          [筛选信息]   │  <- 顶部导航栏
├─────────────────────────────────────────────────────┤
│                                                     │
│              ┌─────────────────────┐                │
│              │   ImageWithBbox     │                │  <- 主图区域
│              │   (可缩放拖拽)       │                │
│              └─────────────────────┘                │
│                                                     │
│  类别: person(3) car(2)    标签: [输电] [山火]      │  <- 元数据面板
├─────────────────────────────────────────────────────┤
│  [← A] 上一张   [保留 Y] [移除 N] [跳过 S]  [→ D]   │  <- 操作栏
└─────────────────────────────────────────────────────┘
```

### 6.3 状态管理

```typescript
const [currentIndex, setCurrentIndex] = useState(initialIndex)
const [operationHistory, setOperationHistory] = useState<Operation[]>([])
const [reviewStatus, setReviewStatus] = useState<Map<string, 'keep'|'remove'|'skip'>>()
```

### 6.4 模式差异

- `browse`：隐藏操作栏中的 Y/N/S 按钮，仅保留导航
- `review`：显示完整操作栏

---

## 7. 快捷键系统设计

### 7.1 快捷键映射

| 快捷键 | 功能 | 备注 |
|-------|------|------|
| `A` / `←` | 上一张 | 两种模式都可用 |
| `D` / `→` | 下一张 | 两种模式都可用 |
| `Y` | 保留到数据集 | 仅审核模式 |
| `N` | 从候选中移除 | 仅审核模式 |
| `S` | 跳过 | 仅审核模式 |
| `Ctrl/Cmd + Z` | 撤销上一步 | 仅审核模式 |

### 7.2 Hook 实现

```typescript
// hooks/useReviewerKeyboard.ts
function useReviewerKeyboard({
  onPrev,
  onNext,
  onKeep,
  onRemove,
  onSkip,
  onUndo,
  enabled = true
}: KeyboardHandlers) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框内的按键
      if (e.target instanceof HTMLInputElement) return

      switch (e.key.toLowerCase()) {
        case 'a':
        case 'arrowleft':
          onPrev?.()
          break
        case 'd':
        case 'arrowright':
          onNext?.()
          break
        case 'y':
          onKeep?.()
          break
        case 'n':
          onRemove?.()
          break
        case 's':
          onSkip?.()
          break
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            onUndo?.()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onPrev, onNext, onKeep, onRemove, onSkip, onUndo])
}
```

### 7.3 撤销功能

操作历史栈记录每次操作：

```typescript
type Operation = {
  type: 'keep' | 'remove' | 'skip'
  sampleId: string
  previousIndex: number
}
```

撤销时：
1. 从历史栈弹出最后一个操作
2. 恢复本地状态
3. 调用 API 恢复（如已移除则重新添加到数据集）
4. 跳转回该样本位置

---

## 8. 实现步骤

### Step 1：后端 Preview API

**文件**：`backend/app/api/routes/samples.py`

**任务**：
- [ ] 新增 `GET /api/v1/samples/{id}/preview` 端点
- [ ] 实现 MinIO presigned URL 生成（有效期 1 小时）
- [ ] 返回样本信息 + 标注 + 标签
- [ ] 添加响应模型 `SamplePreviewResponse`

### Step 2：ImageWithBbox 组件

**文件**：`frontend/src/components/Samples/ImageWithBbox.tsx`

**任务**：
- [ ] 实现 Canvas 渲染逻辑（图片 + bbox）
- [ ] 实现缩放交互（滚轮，限制 0.5x - 3x）
- [ ] 实现拖拽交互（鼠标拖动）
- [ ] 实现 hover 高亮和双击复位
- [ ] 实现类别颜色自动分配
- [ ] 添加 loading 和 error 状态处理

### Step 3：SampleViewer 组件

**文件**：`frontend/src/components/Samples/SampleViewer.tsx`

**任务**：
- [ ] 组合 ImageWithBbox + 元数据面板
- [ ] 调用 preview API 获取数据（使用 TanStack Query）
- [ ] 显示类别统计（ClassBadges）
- [ ] 显示标签列表
- [ ] 显示文件基础信息

### Step 4：SampleReviewer 组件 + 快捷键

**文件**：
- `frontend/src/components/Samples/SampleReviewer.tsx`
- `frontend/src/hooks/useReviewerKeyboard.ts`

**任务**：
- [ ] 实现导航逻辑（上一张/下一张，边界处理）
- [ ] 实现审核操作（保留/移除/跳过）
- [ ] 实现 useReviewerKeyboard hook
- [ ] 实现操作历史栈和撤销功能
- [ ] 实现 browse/review 模式切换
- [ ] 添加操作成功 toast 提示

### Step 5：路由集成

**文件**：
- `frontend/src/routes/_layout/samples/$sampleId.tsx`
- `frontend/src/routes/_layout/datasets/$datasetId/review.tsx`
- `frontend/src/components/Samples/columns.tsx`（修改）

**任务**：
- [ ] 创建样本浏览页路由
- [ ] 创建数据集审核页路由
- [ ] 样本列表添加行点击跳转逻辑
- [ ] 处理路由参数（ids, index）

---

## 9. 测试要点

### 9.1 后端测试

- Preview API 返回正确的 presigned URL
- 无标注样本返回 annotation: null
- 权限验证（只能预览自己的样本）

### 9.2 前端测试

- Canvas 正确渲染图片和 bbox
- 缩放/拖拽交互正常
- 快捷键在不同浏览器工作
- 审核操作即时保存
- 撤销功能正确恢复状态

### 9.3 E2E 测试

- 从样本列表进入浏览模式，左右切换正常
- 从数据集进入审核模式，完成完整审核流程
- 快捷键操作验证

---

## 10. 注意事项

1. **Canvas 跨域**：MinIO presigned URL 需要配置 CORS，否则 Canvas 无法读取图片像素
2. **大图性能**：对于超大图片（>4000px），考虑后端生成缩略图
3. **移动端**：快捷键不可用，需要确保按钮操作完整
4. **无障碍**：按钮需要有正确的 aria-label
