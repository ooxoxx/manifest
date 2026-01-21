# 数据集构建向导改进设计

## 概述

改进 `/datasets/build` 页面的筛选条件和采样配比功能，使其更符合实际使用场景。

## 改动范围

### 1. FilterPanel（筛选条件）

**移除的字段：**
- MinIO 实例选择器
- Bucket 输入框
- 对象前缀输入框

**新增：标签组合筛选**
- 使用 DNF（析取范式）支持复杂的多标签组合
- UI 设计：多个标签组，组内 AND，组间 OR
- 支持 2~20 个标签的复杂组合

**修改：时间筛选**
- 标签从"开始日期/结束日期"改为"获取时间起始/获取时间截止"
- 后端按 Sample.created_at 字段筛选

**修改：标注状态**
- "已关联"文案改为"已标注"
- 默认值从空（全部）改为 `linked`（已标注）

### 2. SamplingConfig（采样配比）- 类别目标模式

**上部 - 类别选择器：**
- 可搜索的下拉列表，显示筛选范围内所有 object 类别
- 每个类别旁显示数量统计（如 `person (1,234)`）
- 点击类别将其添加到下方的目标列表

**下部 - 已选类别目标列表：**
- 表格形式：类别名称 | 可用数量 | 目标数量 | 操作
- 目标数量输入：数字输入框 + `-100`/`+100` 步进按钮
- 目标数量默认值：该类别可用数量的 100%

### 3. 后端 API

**新增端点：**
```
POST /api/v1/datasets/filter-class-stats
```

**请求体：**
```json
{
  "tag_filter": [
    ["uuid-tagA", "uuid-tagB"],
    ["uuid-tagC", "uuid-tagD"]
  ],
  "date_from": "2024-01-01",
  "date_to": "2024-12-31",
  "annotation_status": "linked"
}
```

**响应：**
```json
{
  "classes": [
    { "name": "person", "count": 1234 },
    { "name": "car", "count": 567 }
  ],
  "total_samples": 1500,
  "total_objects": 1801
}
```

### 4. FilterParams 数据格式

**tag_filter 字段（DNF 析取范式）：**
```json
{
  "tag_filter": [
    ["tagA", "tagB"],      // 组1: A AND B
    ["tagC", "tagD", "tagE"] // 组2: C AND D AND E
  ]
}
```

语义：`(tagA ∧ tagB) ∨ (tagC ∧ tagD ∧ tagE)`

- 外层数组：各组之间是 OR 关系
- 内层数组：组内标签是 AND 关系
- 空数组或不传：不按标签筛选

## 涉及文件

### 前端

| 文件 | 改动 |
|------|------|
| `FilterPanel.tsx` | 重写：移除 MinIO/Bucket/前缀，添加标签组筛选 UI |
| `SamplingConfig.tsx` | 扩展：添加类别目标模式完整 UI |
| `@/client` | 重新生成 API client |

### 后端

| 文件 | 改动 |
|------|------|
| `app/api/routes/datasets.py` | 新增 `/filter-class-stats` 端点 |
| `app/models.py` / `app/schemas/` | FilterParams 增加 tag_filter 字段 |
| `app/crud.py` / `app/services/` | 实现 DNF 标签筛选、类别统计逻辑 |

## 实现顺序

1. 后端：扩展 FilterParams 模型，支持 tag_filter
2. 后端：实现 DNF 标签筛选查询逻辑
3. 后端：新增 filter-class-stats API
4. 前端：重新生成 API client
5. 前端：改造 FilterPanel
6. 前端：改造 SamplingConfig
