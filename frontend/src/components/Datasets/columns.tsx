import { ColumnDef } from "@tanstack/react-table"
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
    header: "Name",
  },
  {
    accessorKey: "description",
    header: "Description",
  },
  {
    accessorKey: "sample_count",
    header: "Samples",
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original.sample_count}</Badge>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
  },
]
