import type { ClassStatsResponse } from "@/client"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface ClassStatsPanelProps {
  stats: ClassStatsResponse | undefined
  selectedClass: string | null
  onClassSelect: (className: string | null) => void
  isLoading?: boolean
}

export function ClassStatsPanel({
  stats,
  selectedClass,
  onClassSelect,
  isLoading,
}: ClassStatsPanelProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (!stats || stats.classes.length === 0) {
    return <div className="text-sm text-muted-foreground">暂无类别统计数据</div>
  }

  const maxCount = Math.max(...stats.classes.map((c) => c.count))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">类别统计</span>
        <span className="text-muted-foreground">
          {stats.total_objects.toLocaleString()} 个物体
        </span>
      </div>

      {selectedClass && (
        <button
          type="button"
          onClick={() => onClassSelect(null)}
          className="text-xs text-primary hover:underline"
        >
          清除筛选
        </button>
      )}

      <ScrollArea className="h-[calc(100vh-16rem)]">
        <div className="space-y-1 pr-4">
          {stats.classes.map((cls) => {
            const isSelected = selectedClass === cls.name
            const percentage = (cls.count / maxCount) * 100

            return (
              <button
                key={cls.name}
                type="button"
                onClick={() => onClassSelect(isSelected ? null : cls.name)}
                className={cn(
                  "relative flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                  "hover:bg-accent",
                  isSelected && "bg-primary/10 text-primary font-medium",
                )}
              >
                {/* Background bar */}
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-md transition-all",
                    isSelected ? "bg-primary/20" : "bg-muted",
                  )}
                  style={{ width: `${percentage}%` }}
                />

                {/* Content */}
                <span className="relative z-10 truncate">{cls.name}</span>
                <Badge
                  variant={isSelected ? "default" : "secondary"}
                  className="relative z-10 ml-2"
                >
                  {cls.count.toLocaleString()}
                </Badge>
              </button>
            )
          })}
        </div>
      </ScrollArea>

      <div className="border-t pt-3 text-xs text-muted-foreground">
        共 {stats.classes.length} 个类别，{stats.total_samples.toLocaleString()}{" "}
        个样本
      </div>
    </div>
  )
}
