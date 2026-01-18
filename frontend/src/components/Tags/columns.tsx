import type { ColumnDef } from "@tanstack/react-table"

export type Tag = {
  id: string
  name: string
  color: string | null
  description: string | null
  parent_id: string | null
  created_at: string
}

export const columns: ColumnDef<Tag>[] = [
  {
    accessorKey: "name",
    header: "名称",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        {row.original.color && (
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: row.original.color }}
          />
        )}
        <span>{row.original.name}</span>
      </div>
    ),
  },
  {
    accessorKey: "description",
    header: "描述",
  },
]
