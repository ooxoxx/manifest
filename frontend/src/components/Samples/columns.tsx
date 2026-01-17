import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"

export type Sample = {
  id: string
  file_name: string
  bucket: string
  file_size: number
  status: string
  source: string
  created_at: string
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export const columns: ColumnDef<Sample>[] = [
  {
    accessorKey: "file_name",
    header: "File Name",
  },
  {
    accessorKey: "bucket",
    header: "Bucket",
  },
  {
    accessorKey: "file_size",
    header: "Size",
    cell: ({ row }) => formatBytes(row.original.file_size),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.status === "active" ? "default" : "secondary"}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.source}</Badge>
    ),
  },
]
