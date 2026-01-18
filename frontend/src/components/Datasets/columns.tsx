import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"

export type Dataset = {
  id: string
  name: string
  description: string | null
  sample_count: number
  created_at: string
}

export const columns: ColumnDef<Dataset>[] = [
  {
    accessorKey: "name",
    header: "名称",
  },
  {
    accessorKey: "description",
    header: "描述",
  },
  {
    accessorKey: "sample_count",
    header: "样本数",
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original.sample_count}</Badge>
    ),
  },
  {
    accessorKey: "created_at",
    header: "创建时间",
    cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
  },
]
