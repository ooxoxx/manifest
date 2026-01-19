# Frontend UX Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure frontend navigation around task flows (import, build, ops) and enhance browsing with dual-mode support.

**Architecture:** Refactor sidebar to use grouped navigation (Workbench + Config). Convert existing import/build pages to step-based wizards with left step-nav. Add dual-mode (list/single) for sample browsing.

**Tech Stack:** React 19, TanStack Router, TanStack Query, Tailwind CSS, shadcn/ui, Lucide icons

**Design Document:** `docs/plans/2026-01-19-frontend-ux-redesign.md`

---

## Phase 1: Navigation Restructure

### Task 1.1: Create Sidebar Group Component

**Files:**
- Create: `frontend/src/components/Sidebar/SidebarNavGroup.tsx`

**Step 1: Create the component**

```tsx
import { Link as RouterLink, useRouterState } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export type NavItem = {
  icon: LucideIcon
  title: string
  path: string
}

interface SidebarNavGroupProps {
  label: string
  items: NavItem[]
}

export function SidebarNavGroup({ label, items }: SidebarNavGroupProps) {
  const { isMobile, setOpenMobile } = useSidebar()
  const router = useRouterState()
  const currentPath = router.location.pathname

  const handleMenuClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive =
              currentPath === item.path ||
              (item.path !== "/" && currentPath.startsWith(item.path))

            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isActive}
                  asChild
                >
                  <RouterLink to={item.path} onClick={handleMenuClick}>
                    <item.icon />
                    <span>{item.title}</span>
                  </RouterLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
```

**Step 2: Verify the file was created**

Run: `ls -la frontend/src/components/Sidebar/SidebarNavGroup.tsx`

**Step 3: Commit**

```bash
git add frontend/src/components/Sidebar/SidebarNavGroup.tsx
git commit -m "feat(sidebar): add SidebarNavGroup component for grouped navigation"
```

---

### Task 1.2: Update AppSidebar with New Navigation Structure

**Files:**
- Modify: `frontend/src/components/Sidebar/AppSidebar.tsx`

**Step 1: Update AppSidebar to use grouped navigation**

```tsx
import {
  Activity,
  Database,
  FolderOpen,
  Hammer,
  Server,
  Settings,
  Tags,
  Upload,
  Users,
} from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { type NavItem, SidebarNavGroup } from "./SidebarNavGroup"
import { User } from "./User"

const workbenchItems: NavItem[] = [
  { icon: Upload, title: "样本入库", path: "/import" },
  { icon: Hammer, title: "数据集构建", path: "/build" },
  { icon: Activity, title: "运维中心", path: "/ops" },
]

const browseItems: NavItem[] = [
  { icon: FolderOpen, title: "样本浏览", path: "/samples" },
  { icon: Database, title: "数据集浏览", path: "/datasets" },
]

const configItems: NavItem[] = [
  { icon: Tags, title: "标签管理", path: "/settings/tags" },
  { icon: Server, title: "MinIO 实例", path: "/settings/minio" },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()

  const adminItems: NavItem[] = currentUser?.is_superuser
    ? [{ icon: Users, title: "用户管理", path: "/settings/users" }]
    : []

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarNavGroup label="工作台" items={workbenchItems} />
        <SidebarNavGroup label="浏览" items={browseItems} />
        <SidebarSeparator />
        <SidebarNavGroup label="配置" items={[...configItems, ...adminItems]} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
```

**Step 2: Delete the old Main.tsx component (no longer needed)**

Run: `rm frontend/src/components/Sidebar/Main.tsx`

**Step 3: Verify changes compile**

Run: `cd frontend && npm run lint`

**Step 4: Commit**

```bash
git add frontend/src/components/Sidebar/
git commit -m "feat(sidebar): restructure navigation into Workbench, Browse, Config groups"
```

---

### Task 1.3: Add New Route Files

**Files:**
- Create: `frontend/src/routes/_layout/import.tsx`
- Create: `frontend/src/routes/_layout/build.tsx`
- Create: `frontend/src/routes/_layout/ops.tsx`
- Create: `frontend/src/routes/_layout/settings/tags.tsx`
- Create: `frontend/src/routes/_layout/settings/minio.tsx`
- Create: `frontend/src/routes/_layout/settings/users.tsx`

**Step 1: Create /import route (redirect from old location)**

```tsx
// frontend/src/routes/_layout/import.tsx
import { createFileRoute } from "@tanstack/react-router"
import { FileSpreadsheet } from "lucide-react"

import { ImportHistory, ImportWizard } from "@/components/Import"

export const Route = createFileRoute("/_layout/import")({
  component: ImportPage,
  head: () => ({
    meta: [{ title: "样本入库 - Manifest" }],
  }),
})

function ImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
          <FileSpreadsheet className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
            样本入库
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          导入样本
        </h1>
        <p className="text-muted-foreground mt-2">
          从 CSV 文件导入样本，支持自动创建标签和关联标注
        </p>
      </div>

      <ImportWizard />
      <ImportHistory />
    </div>
  )
}
```

**Step 2: Create /build route**

```tsx
// frontend/src/routes/_layout/build.tsx
import { createFileRoute } from "@tanstack/react-router"

import DatasetBuildWizard from "@/components/Datasets/Build/DatasetBuildWizard"

export const Route = createFileRoute("/_layout/build")({
  component: BuildPage,
  head: () => ({
    meta: [{ title: "数据集构建 - Manifest" }],
  }),
})

function BuildPage() {
  return <DatasetBuildWizard />
}
```

**Step 3: Create /ops route**

```tsx
// frontend/src/routes/_layout/ops.tsx
import { createFileRoute } from "@tanstack/react-router"

import OpsCenter from "@/components/Ops/OpsCenter"

export const Route = createFileRoute("/_layout/ops")({
  component: OpsPage,
  head: () => ({
    meta: [{ title: "运维中心 - Manifest" }],
  }),
})

function OpsPage() {
  return <OpsCenter />
}
```

**Step 4: Create /settings/tags route**

```tsx
// frontend/src/routes/_layout/settings/tags.tsx
import { createFileRoute } from "@tanstack/react-router"

import TagsManager from "@/components/Tags/TagsManager"

export const Route = createFileRoute("/_layout/settings/tags")({
  component: TagsSettingsPage,
  head: () => ({
    meta: [{ title: "标签管理 - Manifest" }],
  }),
})

function TagsSettingsPage() {
  return <TagsManager />
}
```

**Step 5: Create /settings/minio route**

```tsx
// frontend/src/routes/_layout/settings/minio.tsx
import { createFileRoute } from "@tanstack/react-router"

import MinioManager from "@/components/MinIO/MinioManager"

export const Route = createFileRoute("/_layout/settings/minio")({
  component: MinioSettingsPage,
  head: () => ({
    meta: [{ title: "MinIO 实例 - Manifest" }],
  }),
})

function MinioSettingsPage() {
  return <MinioManager />
}
```

**Step 6: Create /settings/users route**

```tsx
// frontend/src/routes/_layout/settings/users.tsx
import { createFileRoute, redirect } from "@tanstack/react-router"

import UsersManager from "@/components/Admin/UsersManager"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/settings/users")({
  component: UsersSettingsPage,
  beforeLoad: async () => {
    // Additional admin check could be added here
    if (!isLoggedIn()) {
      throw redirect({ to: "/login" })
    }
  },
  head: () => ({
    meta: [{ title: "用户管理 - Manifest" }],
  }),
})

function UsersSettingsPage() {
  return <UsersManager />
}
```

**Step 7: Commit**

```bash
git add frontend/src/routes/_layout/import.tsx \
        frontend/src/routes/_layout/build.tsx \
        frontend/src/routes/_layout/ops.tsx \
        frontend/src/routes/_layout/settings/
git commit -m "feat(routes): add new route structure for workbench and settings"
```

---

### Task 1.4: Update Index Route to Redirect to /ops

**Files:**
- Modify: `frontend/src/routes/_layout/index.tsx`

**Step 1: Update index to redirect**

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/")({
  beforeLoad: () => {
    throw redirect({ to: "/ops" })
  },
  component: () => null,
})
```

**Step 2: Commit**

```bash
git add frontend/src/routes/_layout/index.tsx
git commit -m "feat(routes): redirect root to /ops (ops center)"
```

---

## Phase 2: Component Scaffolding

### Task 2.1: Create OpsCenter Component Skeleton

**Files:**
- Create: `frontend/src/components/Ops/OpsCenter.tsx`
- Create: `frontend/src/components/Ops/index.ts`

**Step 1: Create OpsCenter component**

```tsx
// frontend/src/components/Ops/OpsCenter.tsx
import { useQuery } from "@tanstack/react-query"
import { Activity, AlertCircle, Database, Server, TrendingUp } from "lucide-react"

import { DashboardService } from "@/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useState } from "react"

type TimeRange = "today" | "week" | "month"

export default function OpsCenter() {
  const [timeRange, setTimeRange] = useState<TimeRange>("week")

  const { data: overview } = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: () => DashboardService.getDashboardOverview(),
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
            <Activity className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
              监测中心
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            运维中心
          </h1>
          <p className="text-muted-foreground mt-2">
            样本库健康状况与变化趋势监测
          </p>
        </div>

        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">今日</SelectItem>
            <SelectItem value="week">本周</SelectItem>
            <SelectItem value="month">本月</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">样本总量</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.total_samples?.toLocaleString() ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">已标注</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.annotated_samples?.toLocaleString() ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {overview?.total_samples
                ? `${((overview.annotated_samples ?? 0) / overview.total_samples * 100).toFixed(1)}%`
                : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">本周新增</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              +{overview?.samples_this_week?.toLocaleString() ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">存储实例</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.total_minio_instances ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">在线</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>样本增长趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              图表占位 - 将在后续任务中实现
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>标签分布 Top 10</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              图表占位 - 将在后续任务中实现
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>标注状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">已标注</span>
                <span className="text-sm font-medium">72%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">无标注</span>
                <span className="text-sm font-medium">25%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-yellow-500">冲突</span>
                <span className="text-sm font-medium">3%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>系统状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">导入任务</span>
                <span className="text-sm font-medium">0 进行中</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">标注冲突</span>
                <span className="text-sm font-medium">0 待处理</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-green-500">系统运行正常</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Step 2: Create index.ts**

```tsx
// frontend/src/components/Ops/index.ts
export { default as OpsCenter } from "./OpsCenter"
```

**Step 3: Commit**

```bash
git add frontend/src/components/Ops/
git commit -m "feat(ops): add OpsCenter component with stats and status cards"
```

---

### Task 2.2: Create TagsManager Component

**Files:**
- Create: `frontend/src/components/Tags/TagsManager.tsx`

**Step 1: Create TagsManager component (tree + detail layout)**

```tsx
// frontend/src/components/Tags/TagsManager.tsx
import { useSuspenseQuery } from "@tanstack/react-query"
import { ChevronRight, Plus, Tags as TagsIcon } from "lucide-react"
import { Suspense, useState } from "react"

import { TagsService, type TagPublic } from "@/client"
import { PendingComponent } from "@/components/Pending/PendingComponent"
import { AddTag } from "@/components/Tags/AddTag"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function TagTree({
  tags,
  selectedId,
  onSelect,
}: {
  tags: TagPublic[]
  selectedId: string | null
  onSelect: (tag: TagPublic) => void
}) {
  // Build tree structure
  const rootTags = tags.filter((t) => !t.parent_id)

  const getChildren = (parentId: string) =>
    tags.filter((t) => t.parent_id === parentId)

  const renderTag = (tag: TagPublic, level: number = 0) => {
    const children = getChildren(tag.id)
    const isSelected = selectedId === tag.id

    return (
      <div key={tag.id}>
        <button
          type="button"
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
            isSelected
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          }`}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={() => onSelect(tag)}
        >
          {children.length > 0 && (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">{tag.name}</span>
        </button>
        {children.map((child) => renderTag(child, level + 1))}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {rootTags.map((tag) => renderTag(tag))}
      {rootTags.length === 0 && (
        <p className="text-sm text-muted-foreground p-4 text-center">
          暂无标签
        </p>
      )}
    </div>
  )
}

function TagsContent() {
  const [selectedTag, setSelectedTag] = useState<TagPublic | null>(null)

  const { data } = useSuspenseQuery({
    queryKey: ["tags"],
    queryFn: () => TagsService.readTags(),
  })

  const tags = data?.data ?? []

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Left: Tag Tree */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>标签树</CardTitle>
          <AddTag />
        </CardHeader>
        <CardContent>
          <TagTree
            tags={tags}
            selectedId={selectedTag?.id ?? null}
            onSelect={setSelectedTag}
          />
        </CardContent>
      </Card>

      {/* Right: Tag Detail */}
      <Card>
        <CardHeader>
          <CardTitle>标签详情</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedTag ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">完整路径</p>
                <p className="font-medium">{selectedTag.full_path}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">关联样本</p>
                <p className="font-medium">
                  {selectedTag.sample_count?.toLocaleString() ?? 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">层级</p>
                <p className="font-medium">{selectedTag.level}</p>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="sm">
                  编辑
                </Button>
                <Button variant="destructive" size="sm">
                  删除
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              选择一个标签查看详情
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function TagsManager() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
          <TagsIcon className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
            配置
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          标签管理
        </h1>
        <p className="text-muted-foreground mt-2">
          管理层级标签体系，用于样本分类
        </p>
      </div>

      <Suspense fallback={<PendingComponent />}>
        <TagsContent />
      </Suspense>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/Tags/TagsManager.tsx
git commit -m "feat(tags): add TagsManager with tree view and detail panel"
```

---

### Task 2.3: Create MinioManager Component

**Files:**
- Create: `frontend/src/components/MinIO/MinioManager.tsx`

**Step 1: Create MinioManager component**

```tsx
// frontend/src/components/MinIO/MinioManager.tsx
import { useSuspenseQuery } from "@tanstack/react-query"
import { Server } from "lucide-react"
import { Suspense } from "react"

import { MinioInstancesService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { AddInstance } from "@/components/MinIO/AddInstance"
import { columns } from "@/components/MinIO/columns"
import { PendingComponent } from "@/components/Pending/PendingComponent"

function MinioTable() {
  const { data } = useSuspenseQuery({
    queryKey: ["minio-instances"],
    queryFn: () => MinioInstancesService.readMinioInstances(),
  })

  return <DataTable columns={columns} data={data?.data ?? []} />
}

export default function MinioManager() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
          <Server className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
            配置
          </span>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              MinIO 实例
            </h1>
            <p className="text-muted-foreground mt-2">
              管理对象存储连接配置
            </p>
          </div>
          <AddInstance />
        </div>
      </div>

      <Suspense fallback={<PendingComponent />}>
        <div className="terminal-border bg-card/30 backdrop-blur-sm rounded-lg overflow-hidden">
          <MinioTable />
        </div>
      </Suspense>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/MinIO/MinioManager.tsx
git commit -m "feat(minio): add MinioManager page component"
```

---

### Task 2.4: Create UsersManager Component

**Files:**
- Create: `frontend/src/components/Admin/UsersManager.tsx`

**Step 1: Create UsersManager component**

```tsx
// frontend/src/components/Admin/UsersManager.tsx
import { useSuspenseQuery } from "@tanstack/react-query"
import { Users } from "lucide-react"
import { Suspense } from "react"

import { UsersService } from "@/client"
import { AddUser } from "@/components/Admin/AddUser"
import { columns } from "@/components/Admin/columns"
import { DataTable } from "@/components/Common/DataTable"
import { PendingComponent } from "@/components/Pending/PendingComponent"

function UsersTable() {
  const { data } = useSuspenseQuery({
    queryKey: ["users"],
    queryFn: () => UsersService.readUsers(),
  })

  return <DataTable columns={columns} data={data?.data ?? []} />
}

export default function UsersManager() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
          <Users className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
            配置
          </span>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              用户管理
            </h1>
            <p className="text-muted-foreground mt-2">
              管理系统用户和权限
            </p>
          </div>
          <AddUser />
        </div>
      </div>

      <Suspense fallback={<PendingComponent />}>
        <div className="terminal-border bg-card/30 backdrop-blur-sm rounded-lg overflow-hidden">
          <UsersTable />
        </div>
      </Suspense>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/Admin/UsersManager.tsx
git commit -m "feat(admin): add UsersManager page component"
```

---

### Task 2.5: Move DatasetBuildWizard to Components

**Files:**
- Create: `frontend/src/components/Datasets/Build/DatasetBuildWizard.tsx`
- Modify: `frontend/src/routes/_layout/datasets/build.tsx` (update import)

**Step 1: Move build logic to component**

Copy the existing build.tsx content to a new component file, updating the structure to match the design (left step nav + right content).

```tsx
// frontend/src/components/Datasets/Build/DatasetBuildWizard.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  Check,
  ClipboardList,
  Filter,
  Hammer,
  Loader2,
  Search,
  Settings,
} from "lucide-react"
import { useState } from "react"

import { DatasetsService, type FilterParams } from "@/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import FilterPanel from "./FilterPanel"
import SamplingConfig, { type SamplingValues } from "./SamplingConfig"

type Step = 1 | 2 | 3 | 4 | 5

const steps = [
  { step: 1 as Step, label: "基本信息", icon: ClipboardList },
  { step: 2 as Step, label: "筛选条件", icon: Filter },
  { step: 3 as Step, label: "采样配比", icon: Settings },
  { step: 4 as Step, label: "预览审核", icon: Search },
  { step: 5 as Step, label: "确认生成", icon: Check },
]

export default function DatasetBuildWizard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [filters, setFilters] = useState<FilterParams>({})
  const [sampling, setSampling] = useState<SamplingValues>({ mode: "all" })

  // Preview query
  const {
    data: preview,
    isLoading: isPreviewLoading,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: ["filter-preview", filters],
    queryFn: async () => {
      const result = await DatasetsService.filterPreview({ requestBody: filters })
      return result as { count: number; samples: unknown[] }
    },
    enabled: false,
  })

  // Build mutation
  const buildMutation = useMutation({
    mutationFn: () =>
      DatasetsService.buildNewDataset({
        requestBody: {
          name,
          description: description || undefined,
          filters,
          sampling,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] })
      navigate({ to: "/datasets" })
    },
  })

  const canProceed = (step: Step): boolean => {
    switch (step) {
      case 1:
        return name.trim().length > 0
      case 2:
        return true // Filters are optional
      case 3:
        return true // Sampling has default
      case 4:
        return preview !== undefined
      case 5:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (currentStep < 5 && canProceed(currentStep)) {
      if (currentStep === 3) {
        refetchPreview()
      }
      setCurrentStep((s) => (s + 1) as Step)
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => (s - 1) as Step)
    }
  }

  const handleBuild = () => {
    buildMutation.mutate()
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>数据集信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>名称 *</Label>
                <Input
                  placeholder="输入数据集名称"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>描述</Label>
                <Textarea
                  placeholder="可选描述"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )

      case 2:
        return <FilterPanel value={filters} onChange={setFilters} />

      case 3:
        return (
          <SamplingConfig
            value={sampling}
            onChange={setSampling}
            availableCount={preview?.count}
          />
        )

      case 4:
        return (
          <Card>
            <CardHeader>
              <CardTitle>预览结果</CardTitle>
            </CardHeader>
            <CardContent>
              {isPreviewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : preview ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-lg font-medium">
                      找到 <span className="text-primary">{preview.count}</span> 个匹配样本
                    </p>
                    {sampling.mode === "random" && sampling.count && (
                      <p className="text-sm text-muted-foreground mt-1">
                        将随机选择 {Math.min(sampling.count, preview.count)} 个
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    点击"下一步"确认创建数据集
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  正在加载预览...
                </p>
              )}
            </CardContent>
          </Card>
        )

      case 5:
        return (
          <Card>
            <CardHeader>
              <CardTitle>确认创建</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">数据集名称</p>
                <p className="font-medium">{name}</p>
              </div>
              {description && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">描述</p>
                  <p className="font-medium">{description}</p>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">样本数量</p>
                <p className="font-medium">{preview?.count ?? 0}</p>
              </div>
              <Button
                className="w-full"
                onClick={handleBuild}
                disabled={buildMutation.isPending}
              >
                {buildMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Hammer className="mr-2 h-4 w-4" />
                )}
                {buildMutation.isPending ? "构建中..." : "确认构建"}
              </Button>
              {buildMutation.error && (
                <p className="text-sm text-destructive">
                  构建失败: {buildMutation.error.message}
                </p>
              )}
            </CardContent>
          </Card>
        )
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
          <Hammer className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
            数据集构建
          </span>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              构建数据集
            </h1>
            <p className="text-muted-foreground mt-2">
              使用筛选条件和采样策略创建新数据集
            </p>
          </div>
          <span className="text-sm font-mono text-muted-foreground">
            步骤 {currentStep}/5
          </span>
        </div>
      </div>

      {/* Wizard Layout */}
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Left: Step Navigation */}
        <Card className="h-fit">
          <CardContent className="p-4">
            <div className="space-y-2">
              {steps.map(({ step, label, icon: Icon }) => {
                const isActive = currentStep === step
                const isCompleted = currentStep > step

                return (
                  <button
                    key={step}
                    type="button"
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                          ? "text-green-500"
                          : "text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => step < currentStep && setCurrentStep(step)}
                    disabled={step > currentStep}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                        isActive
                          ? "border-primary-foreground"
                          : isCompleted
                            ? "border-green-500 bg-green-500/10"
                            : "border-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Icon className="w-3 h-3" />
                      )}
                    </div>
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right: Step Content */}
        <div className="space-y-4">
          {renderStepContent()}

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentStep === 1}
            >
              上一步
            </Button>
            {currentStep < 5 && (
              <Button
                onClick={handleNext}
                disabled={!canProceed(currentStep)}
              >
                下一步
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Update the route file to use the new component**

```tsx
// frontend/src/routes/_layout/datasets/build.tsx - update to simple import
import { createFileRoute } from "@tanstack/react-router"

import DatasetBuildWizard from "@/components/Datasets/Build/DatasetBuildWizard"

export const Route = createFileRoute("/_layout/datasets/build")({
  component: DatasetBuildWizard,
  head: () => ({
    meta: [{ title: "构建数据集 - Manifest" }],
  }),
})
```

**Step 3: Commit**

```bash
git add frontend/src/components/Datasets/Build/DatasetBuildWizard.tsx \
        frontend/src/routes/_layout/datasets/build.tsx
git commit -m "refactor(datasets): extract DatasetBuildWizard to component with step navigation"
```

---

## Phase 3: Sample Browsing Dual-Mode

### Task 3.1: Add View Mode Toggle to Samples Page

**Files:**
- Modify: `frontend/src/routes/_layout/samples/index.tsx`

**Step 1: Update samples page with dual mode support**

```tsx
// frontend/src/routes/_layout/samples/index.tsx
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Database, Grid, List, Upload } from "lucide-react"
import { Suspense, useState } from "react"

import { SamplesService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { PendingComponent } from "@/components/Pending/PendingComponent"
import { columns } from "@/components/Samples/columns"
import { SampleReviewer } from "@/components/Samples/SampleReviewer"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export const Route = createFileRoute("/_layout/samples/")({
  component: Samples,
  head: () => ({
    meta: [{ title: "样本浏览 - Manifest" }],
  }),
})

type ViewMode = "list" | "single"

function SamplesContent({
  viewMode,
  onViewModeChange,
  onSampleSelect
}: {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onSampleSelect: (index: number) => void
}) {
  const { data } = useSuspenseQuery({
    queryKey: ["samples"],
    queryFn: () => SamplesService.readSamples(),
  })

  const samples = data?.data ?? []
  const sampleIds = samples.map((s) => s.id)

  if (viewMode === "single" && samples.length > 0) {
    return (
      <SampleReviewer
        sampleIds={sampleIds}
        mode="browse"
        onBack={() => onViewModeChange("list")}
      />
    )
  }

  return (
    <div className="terminal-border bg-card/30 backdrop-blur-sm rounded-lg overflow-hidden">
      <DataTable
        columns={columns}
        data={samples}
        onRowClick={(row, index) => {
          onSampleSelect(index)
          onViewModeChange("single")
        }}
      />
    </div>
  )
}

function Samples() {
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [selectedIndex, setSelectedIndex] = useState(0)

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
          <Database className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
            浏览
          </span>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              样本浏览
            </h1>
            <p className="text-muted-foreground mt-2">
              浏览和管理您的 AI 训练样本资源
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as ViewMode)}
            >
              <ToggleGroupItem value="list" aria-label="列表模式">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="single" aria-label="逐张模式">
                <Grid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Link to="/import">
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                导入样本
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Suspense fallback={<PendingComponent />}>
        <SamplesContent
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSampleSelect={setSelectedIndex}
        />
      </Suspense>
    </div>
  )
}
```

**Step 2: Add ToggleGroup component if not exists**

Run: `cd frontend && npx shadcn@latest add toggle-group`

**Step 3: Commit**

```bash
git add frontend/src/routes/_layout/samples/index.tsx \
        frontend/src/components/ui/toggle-group.tsx
git commit -m "feat(samples): add dual-mode view toggle (list/single)"
```

---

## Phase 4: Cleanup Old Routes

### Task 4.1: Remove or Redirect Old Route Files

**Files:**
- Delete: `frontend/src/routes/_layout/samples/import.tsx` (moved to /import)
- Modify: `frontend/src/routes/_layout/tags.tsx` (redirect to /settings/tags)
- Modify: `frontend/src/routes/_layout/minio-instances.tsx` (redirect to /settings/minio)
- Modify: `frontend/src/routes/_layout/admin.tsx` (redirect to /settings/users)

**Step 1: Delete old import route**

Run: `rm frontend/src/routes/_layout/samples/import.tsx`

**Step 2: Update tags.tsx to redirect**

```tsx
// frontend/src/routes/_layout/tags.tsx
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/tags")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/tags" })
  },
  component: () => null,
})
```

**Step 3: Update minio-instances.tsx to redirect**

```tsx
// frontend/src/routes/_layout/minio-instances.tsx
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/minio-instances")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/minio" })
  },
  component: () => null,
})
```

**Step 4: Update admin.tsx to redirect**

```tsx
// frontend/src/routes/_layout/admin.tsx
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/admin")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/users" })
  },
  component: () => null,
})
```

**Step 5: Regenerate route tree**

Run: `cd frontend && npm run dev` (this auto-generates routeTree.gen.ts)

**Step 6: Commit**

```bash
git add -A frontend/src/routes/
git commit -m "refactor(routes): redirect old routes to new locations"
```

---

## Phase 5: Testing & Polish

### Task 5.1: Update E2E Tests for New Routes

**Files:**
- Modify: `frontend/tests/*.spec.ts` (update paths)

**Step 1: Update test files to use new routes**

Replace occurrences of:
- `/samples/import` → `/import`
- `/tags` → `/settings/tags`
- `/minio-instances` → `/settings/minio`
- `/admin` → `/settings/users`
- `/` (dashboard) → `/ops`

**Step 2: Run tests to verify**

Run: `cd frontend && npx playwright test`

**Step 3: Commit**

```bash
git add frontend/tests/
git commit -m "test: update E2E tests for new route structure"
```

---

### Task 5.2: Final Verification

**Step 1: Run lint**

Run: `cd frontend && npm run lint`

**Step 2: Run type check**

Run: `cd frontend && npm run build`

**Step 3: Manual testing checklist**

- [ ] Navigate to /ops - should show OpsCenter
- [ ] Navigate to /import - should show ImportWizard
- [ ] Navigate to /build - should show DatasetBuildWizard with step nav
- [ ] Navigate to /samples - should show dual-mode toggle
- [ ] Navigate to /datasets - should show dataset list
- [ ] Navigate to /settings/tags - should show TagsManager
- [ ] Navigate to /settings/minio - should show MinioManager
- [ ] Navigate to /settings/users - should show UsersManager (admin only)
- [ ] Sidebar should show grouped navigation

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found in final verification"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1.1-1.4 | Navigation restructure (sidebar groups, new routes) |
| 2 | 2.1-2.5 | Component scaffolding (OpsCenter, TagsManager, etc.) |
| 3 | 3.1 | Sample browsing dual-mode |
| 4 | 4.1 | Cleanup old routes |
| 5 | 5.1-5.2 | Testing and verification |

Total: ~15 tasks, estimated 2-3 hours of focused implementation.
