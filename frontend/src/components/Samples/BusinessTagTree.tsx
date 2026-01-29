import { Tag } from "lucide-react"
import { useMemo } from "react"

import { useBusinessTagsTree } from "@/hooks/useNavigationTrees"

import { TreeNode, type TreeNodeData } from "./TreeNode"

interface BusinessTagTreeProps {
  selectedTagId?: string | null
  onSelect?: (tagId: string | null) => void
}

interface BusinessTagNode {
  id: string
  name: string
  level: number
  full_path: string | null
  count: number
  total_count: number
  children: BusinessTagNode[]
}

function convertToTreeNodeData(node: BusinessTagNode): TreeNodeData {
  return {
    id: node.id,
    name: node.name,
    count: node.total_count,
    icon: <Tag className="h-3.5 w-3.5 text-purple-500" />,
    children: node.children?.map(convertToTreeNodeData),
  }
}

export function BusinessTagTree({
  selectedTagId,
  onSelect,
}: BusinessTagTreeProps) {
  const { data, isLoading, error } = useBusinessTagsTree()

  const treeData = useMemo(() => {
    if (!data) return []
    return (data as BusinessTagNode[]).map(convertToTreeNodeData)
  }, [data])

  const handleSelect = (node: TreeNodeData) => {
    if (selectedTagId === node.id) {
      onSelect?.(null)
    } else {
      onSelect?.(node.id)
    }
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">加载中...</div>
  }

  if (error) {
    return <div className="p-4 text-sm text-destructive">加载失败</div>
  }

  if (treeData.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">暂无业务标签</div>
  }

  return (
    <div className="py-1">
      {treeData.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          selectedId={selectedTagId}
          onSelect={handleSelect}
        />
      ))}
    </div>
  )
}
