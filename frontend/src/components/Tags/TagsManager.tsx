// frontend/src/components/Tags/TagsManager.tsx
import { useSuspenseQuery } from "@tanstack/react-query"
import { ChevronRight, Plus, Tags as TagsIcon } from "lucide-react"
import { Suspense, useState } from "react"

import { type TagPublic, TagsService } from "@/client"
import { PendingComponent } from "@/components/Pending/PendingComponent"
import AddTag from "@/components/Tags/AddTag"
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
            isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          }`}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={() => onSelect(tag)}
        >
          {children.length > 0 && <ChevronRight className="h-4 w-4 shrink-0" />}
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

function TagsContent({ onAddClick }: { onAddClick: () => void }) {
  const [selectedTag, setSelectedTag] = useState<TagPublic | null>(null)

  const { data } = useSuspenseQuery({
    queryKey: ["tags"],
    queryFn: () => TagsService.readTags(),
  })

  const tags = data?.data ?? []

  // Calculate level from parent chain
  const getTagLevel = (tag: TagPublic): number => {
    let level = 0
    let currentParentId = tag.parent_id
    while (currentParentId) {
      level++
      const parent = tags.find((t) => t.id === currentParentId)
      currentParentId = parent?.parent_id ?? null
    }
    return level
  }

  // Build full path from parent chain
  const getFullPath = (tag: TagPublic): string => {
    const parts: string[] = [tag.name]
    let currentParentId = tag.parent_id
    while (currentParentId) {
      const parent = tags.find((t) => t.id === currentParentId)
      if (parent) {
        parts.unshift(parent.name)
        currentParentId = parent.parent_id
      } else {
        break
      }
    }
    return parts.join(" / ")
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Left: Tag Tree */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>标签树</CardTitle>
          <Button size="sm" onClick={onAddClick}>
            <Plus className="mr-2 h-4 w-4" />
            添加标签
          </Button>
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
                <p className="text-sm text-muted-foreground">名称</p>
                <p className="font-medium">{selectedTag.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">完整路径</p>
                <p className="font-medium">{getFullPath(selectedTag)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">层级</p>
                <p className="font-medium">{getTagLevel(selectedTag)}</p>
              </div>
              {selectedTag.description && (
                <div>
                  <p className="text-sm text-muted-foreground">描述</p>
                  <p className="font-medium">{selectedTag.description}</p>
                </div>
              )}
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
  const [isAddOpen, setIsAddOpen] = useState(false)

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
        <TagsContent onAddClick={() => setIsAddOpen(true)} />
      </Suspense>

      <AddTag open={isAddOpen} onOpenChange={setIsAddOpen} />
    </div>
  )
}
