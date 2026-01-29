import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Pencil, Plug, Trash } from "lucide-react"
import { type MinIOInstancePublic, MinioInstancesService } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type ColumnsOptions = {
  onEdit: (instance: MinIOInstancePublic) => void
}

export function createColumns(
  options: ColumnsOptions,
): ColumnDef<MinIOInstancePublic>[] {
  return [
    {
      accessorKey: "name",
      header: "名称",
    },
    {
      accessorKey: "endpoint",
      header: "端点",
    },
    {
      accessorKey: "secure",
      header: "安全",
      cell: ({ row }) => (
        <Badge variant={row.original.secure ? "default" : "secondary"}>
          {row.original.secure ? "HTTPS" : "HTTP"}
        </Badge>
      ),
    },
    {
      accessorKey: "is_active",
      header: "状态",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "default" : "destructive"}>
          {row.original.is_active ? "启用" : "禁用"}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <ActionsMenu instance={row.original} onEdit={options.onEdit} />
      ),
    },
  ]
}

// Keep for backwards compatibility
export const columns: ColumnDef<MinIOInstancePublic>[] = createColumns({
  onEdit: () => {},
})

function ActionsMenu({
  instance,
  onEdit,
}: {
  instance: MinIOInstancePublic
  onEdit: (instance: MinIOInstancePublic) => void
}) {
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: () =>
      MinioInstancesService.deleteMinioInstance({ id: instance.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["minio-instances"] })
    },
  })

  const handleTest = async () => {
    try {
      const result = await MinioInstancesService.testMinioConnection({
        id: instance.id,
      })
      alert(result.message)
    } catch {
      alert("连接测试失败")
    }
  }

  const handleDelete = () => {
    if (confirm(`确定要删除实例 "${instance.name}" 吗？`)) {
      deleteMutation.mutate()
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(instance)}>
          <Pencil className="mr-2 h-4 w-4" />
          编辑
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleTest}>
          <Plug className="mr-2 h-4 w-4" />
          测试连接
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash className="mr-2 h-4 w-4" />
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
