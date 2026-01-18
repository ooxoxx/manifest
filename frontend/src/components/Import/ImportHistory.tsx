import { useQuery } from "@tanstack/react-query"
import { AlertCircle, CheckCircle, Clock, Loader2 } from "lucide-react"
import type { ImportTaskPublic, ImportTaskStatus } from "@/client"
import { SamplesService } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return "刚刚"
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`
  return `${Math.floor(seconds / 86400)} 天前`
}

function StatusBadge({ status }: { status: ImportTaskStatus }) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="w-3 h-3 mr-1" />
          已完成
        </Badge>
      )
    case "failed":
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          失败
        </Badge>
      )
    case "running":
      return (
        <Badge variant="default" className="bg-blue-500">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          运行中
        </Badge>
      )
    case "pending":
      return (
        <Badge variant="secondary">
          <Clock className="w-3 h-3 mr-1" />
          等待中
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default function ImportHistory() {
  const {
    data: tasks,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["import-tasks"],
    queryFn: () => SamplesService.listImportTasks({}),
    refetchInterval: 5000, // Refresh every 5 seconds for running tasks
  })

  if (isLoading) {
    return (
      <Card data-testid="import-history">
        <CardHeader>
          <CardTitle>导入历史</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card data-testid="import-history">
        <CardHeader>
          <CardTitle>导入历史</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-destructive">
            <AlertCircle className="w-5 h-5 mr-2" />
            加载导入历史失败
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-testid="import-history">
      <CardHeader>
        <CardTitle>导入历史</CardTitle>
      </CardHeader>
      <CardContent>
        {!tasks || tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无导入任务
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>状态</TableHead>
                <TableHead>行数</TableHead>
                <TableHead>已创建</TableHead>
                <TableHead>已跳过</TableHead>
                <TableHead>错误</TableHead>
                <TableHead>开始时间</TableHead>
                <TableHead>完成时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task: ImportTaskPublic) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <StatusBadge status={task.status} />
                  </TableCell>
                  <TableCell>{task.total_rows}</TableCell>
                  <TableCell className="text-green-500">
                    {task.created}
                  </TableCell>
                  <TableCell className="text-yellow-500">
                    {task.skipped}
                  </TableCell>
                  <TableCell className="text-destructive">
                    {task.errors}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTimeAgo(task.created_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {task.completed_at ? formatTimeAgo(task.completed_at) : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
