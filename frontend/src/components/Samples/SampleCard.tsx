import { format, isThisYear } from "date-fns"

import type { SampleThumbnail } from "@/client"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface SampleCardProps {
  sample: SampleThumbnail
  onClick: () => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isThisYear(date)) {
    return format(date, "MM-dd")
  }
  return format(date, "yy-MM-dd")
}

function formatClassCounts(counts: Record<string, number> | null | undefined): string {
  if (!counts || Object.keys(counts).length === 0) return "—"
  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
  const result = entries.map(([cls, count]) => `${cls}:${count}`).join(" ")
  if (Object.keys(counts).length > 2) {
    return `${result} +${Object.keys(counts).length - 2}`
  }
  return result
}

function truncateFileName(name: string, maxLength: number = 20): string {
  if (name.length <= maxLength) return name
  const ext = name.includes(".") ? name.substring(name.lastIndexOf(".")) : ""
  const base = name.substring(0, name.length - ext.length)
  const maxBase = maxLength - ext.length - 3
  if (maxBase <= 0) return `${name.substring(0, maxLength - 3)}...`
  return `${base.substring(0, maxBase)}...${ext}`
}

export function SampleCard({ sample, onClick }: SampleCardProps) {
  const hasAnnotation = sample.annotation_status === "linked"

  return (
    <Card
      className={cn(
        "cursor-pointer overflow-hidden transition-all duration-200",
        "hover:scale-[1.02] hover:shadow-lg hover:border-primary/50",
        "group",
      )}
      onClick={onClick}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={sample.presigned_url}
          alt={sample.file_name}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          loading="lazy"
        />
        {/* Annotation status indicator */}
        <div
          className={cn(
            "absolute top-2 right-2 h-3 w-3 rounded-full",
            hasAnnotation ? "bg-green-500" : "bg-muted-foreground/30",
          )}
          title={hasAnnotation ? "已标注" : "未标注"}
        />
      </div>
      <CardContent className="p-3 space-y-1">
        <p className="text-sm font-medium truncate" title={sample.file_name}>
          {truncateFileName(sample.file_name)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(sample.created_at)} · {formatFileSize(sample.file_size)}
        </p>
        <p className="text-xs text-muted-foreground/80 truncate">
          {formatClassCounts(sample.class_counts)}
        </p>
      </CardContent>
    </Card>
  )
}
