import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Plug } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

export type MinIOInstance = {
  id: string
  name: string
  endpoint: string
  secure: boolean
  is_active: boolean
  created_at: string
}

export const columns: ColumnDef<MinIOInstance>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "endpoint",
    header: "Endpoint",
  },
  {
    accessorKey: "secure",
    header: "Secure",
    cell: ({ row }) => (
      <Badge variant={row.original.secure ? "default" : "secondary"}>
        {row.original.secure ? "HTTPS" : "HTTP"}
      </Badge>
    ),
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? "default" : "destructive"}>
        {row.original.is_active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsMenu instance={row.original} />,
  },
]

function ActionsMenu({ instance }: { instance: MinIOInstance }) {
  const handleTest = async () => {
    const response = await fetch(`/api/v1/minio-instances/${instance.id}/test`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
    })
    const result = await response.json()
    alert(result.message)
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
          Test Connection
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
