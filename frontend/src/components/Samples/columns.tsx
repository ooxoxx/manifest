import type { ColumnDef } from "@tanstack/react-table"
import type { SamplePublic } from "@/client"
import { Badge } from "@/components/ui/badge"

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

export const columns: ColumnDef<SamplePublic>[] = [
  {
    accessorKey: "file_name",
    header: "文件名",
  },
  {
    accessorKey: "bucket",
    header: "存储桶",
  },
  {
    accessorKey: "file_size",
    header: "大小",
    cell: ({ row }) => formatBytes(row.original.file_size ?? 0),
  },
  {
    accessorKey: "status",
    header: "状态",
    cell: ({ row }) => (
      <Badge
        variant={row.original.status === "active" ? "default" : "secondary"}
      >
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "source",
    header: "来源",
    cell: ({ row }) => <Badge variant="outline">{row.original.source}</Badge>,
  },
]
