// frontend/src/components/WatchedPaths/columns.tsx
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { MoreHorizontal, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { type WatchedPathPublic, WatchedPathsService } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function ActionsCell({ path }: { path: WatchedPathPublic }) {
  const queryClient = useQueryClient()

  const syncMutation = useMutation({
    mutationFn: () => WatchedPathsService.syncWatchedPath({ id: path.id }),
    onSuccess: (data) => {
      toast.success(
        `同步完成: 新增 ${data.created} 个样本，跳过 ${data.skipped} 个`,
      )
      queryClient.invalidateQueries({ queryKey: ["watched-paths"] })
    },
    onError: (error: Error) => {
      toast.error(`同步失败: ${error.message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => WatchedPathsService.deleteWatchedPath({ id: path.id }),
    onSuccess: () => {
      toast.success("监控路径已删除")
      queryClient.invalidateQueries({ queryKey: ["watched-paths"] })
    },
    onError: (error: Error) => {
      toast.error(`删除失败: ${error.message}`)
    },
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {syncMutation.isPending ? "同步中..." : "手动同步"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {deleteMutation.isPending ? "删除中..." : "删除"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const columns: ColumnDef<WatchedPathPublic>[] = [
  {
    accessorKey: "bucket",
    header: "Bucket",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.bucket}</span>
    ),
  },
  {
    accessorKey: "prefix",
    header: "路径前缀",
    cell: ({ row }) => (
      <span className="font-mono text-sm text-muted-foreground">
        {row.original.prefix || "/"}
      </span>
    ),
  },
  {
    accessorKey: "description",
    header: "描述",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.description || "-"}</span>
    ),
  },
  {
    accessorKey: "is_active",
    header: "状态",
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? "default" : "secondary"}>
        {row.original.is_active ? "活跃" : "停用"}
      </Badge>
    ),
  },
  {
    accessorKey: "last_sync_at",
    header: "最后同步",
    cell: ({ row }) => {
      const lastSync = row.original.last_sync_at
      if (!lastSync) {
        return <span className="text-muted-foreground text-sm">从未同步</span>
      }
      return (
        <span className="text-sm">
          {formatDistanceToNow(new Date(lastSync), {
            addSuffix: true,
            locale: zhCN,
          })}
        </span>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell path={row.original} />,
  },
]
