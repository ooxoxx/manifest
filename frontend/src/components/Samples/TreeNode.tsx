import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

import { cn } from "@/lib/utils"

export interface TreeNodeData {
  id: string
  name: string
  count: number
  children?: TreeNodeData[]
  icon?: React.ReactNode
}

interface TreeNodeProps {
  node: TreeNodeData
  level?: number
  selectedId?: string | null
  onSelect?: (node: TreeNodeData) => void
  defaultExpanded?: boolean
}

export function TreeNode({
  node,
  level = 0,
  selectedId,
  onSelect,
  defaultExpanded = false,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const hasChildren = node.children && node.children.length > 0
  const isSelected = selectedId === node.id

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasChildren) {
      setExpanded(!expanded)
    }
  }

  const handleSelect = () => {
    onSelect?.(node)
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer",
          "hover:bg-accent/50 transition-colors",
          isSelected && "bg-accent text-accent-foreground",
        )}
        style={{ paddingLeft: `${level * 12 + 4}px` }}
        onClick={handleSelect}
      >
        <button
          type="button"
          className={cn(
            "p-0.5 rounded hover:bg-accent",
            !hasChildren && "invisible",
          )}
          onClick={handleToggle}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {node.icon && <span className="mr-1">{node.icon}</span>}

        <span className="flex-1 truncate text-sm">{node.name}</span>

        <span className="text-xs text-muted-foreground tabular-nums">
          {node.count}
        </span>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children?.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
