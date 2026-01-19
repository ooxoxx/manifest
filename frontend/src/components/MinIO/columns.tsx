import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Plug } from "lucide-react"
import { type MinIOInstancePublic, MinioInstancesService } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export const columns: ColumnDef<MinIOInstancePublic>[] = [
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
    cell: ({ row }) => <ActionsMenu instance={row.original} />,
  },
]

function ActionsMenu({ instance }: { instance: MinIOInstancePublic }) {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleTest}>
          <Plug className="mr-2 h-4 w-4" />
          测试连接
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
