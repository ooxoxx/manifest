import { Database, Folder, HardDrive } from "lucide-react"
import { useMemo } from "react"

import type { StorageTreeNode as StorageTreeNodeType } from "@/client"
import { useStorageTree } from "@/hooks/useNavigationTrees"

import { TreeNode, type TreeNodeData } from "./TreeNode"

interface StoragePathTreeProps {
  selectedPath?: string | null
  onSelect?: (path: string | null) => void
}

function convertToTreeNodeData(node: StorageTreeNodeType): TreeNodeData {
  const getIcon = () => {
    switch (node.type) {
      case "instance":
        return <HardDrive className="h-3.5 w-3.5 text-blue-500" />
      case "bucket":
        return <Database className="h-3.5 w-3.5 text-green-500" />
      case "folder":
        return <Folder className="h-3.5 w-3.5 text-yellow-500" />
      default:
        return null
    }
  }

  return {
    id: node.path,
    name: node.name,
    count: node.count,
    icon: getIcon(),
    children: node.children?.map(convertToTreeNodeData),
  }
}

export function StoragePathTree({
  selectedPath,
  onSelect,
}: StoragePathTreeProps) {
  const { data, isLoading, error } = useStorageTree()

  const treeData = useMemo(() => {
    if (!data) return []
    return data.map(convertToTreeNodeData)
  }, [data])

  const handleSelect = (node: TreeNodeData) => {
    if (selectedPath === node.id) {
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
    return <div className="p-4 text-sm text-muted-foreground">暂无存储数据</div>
  }

  return (
    <div className="py-1">
      {treeData.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          selectedId={selectedPath}
          onSelect={handleSelect}
          defaultExpanded
        />
      ))}
    </div>
  )
}
