// frontend/src/components/Ops/OpsCenter.tsx
import { useQuery } from "@tanstack/react-query"
import { Activity, Database, Server, TrendingUp } from "lucide-react"
import { useState } from "react"

import { DashboardService } from "@/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type TimeRange = "today" | "week" | "month"

export default function OpsCenter() {
  const [timeRange, setTimeRange] = useState<TimeRange>("week")

  const { data: overview } = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: () => DashboardService.getDashboardOverview(),
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
            <Activity className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
              监测中心
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            运维中心
          </h1>
          <p className="text-muted-foreground mt-2">
            样本库健康状况与变化趋势监测
          </p>
        </div>

        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">今日</SelectItem>
            <SelectItem value="week">本周</SelectItem>
            <SelectItem value="month">本月</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">样本总量</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.total_samples?.toLocaleString() ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">已标注</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.annotated_samples?.toLocaleString() ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {overview?.total_samples
                ? `${((overview.annotated_samples ?? 0) / overview.total_samples * 100).toFixed(1)}%`
                : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">本周新增</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              +{overview?.samples_this_week?.toLocaleString() ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">存储实例</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.total_minio_instances ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">在线</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>样本增长趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              图表占位 - 将在后续任务中实现
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>标签分布 Top 10</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              图表占位 - 将在后续任务中实现
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>标注状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">已标注</span>
                <span className="text-sm font-medium">72%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">无标注</span>
                <span className="text-sm font-medium">25%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-yellow-500">冲突</span>
                <span className="text-sm font-medium">3%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>系统状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">导入任务</span>
                <span className="text-sm font-medium">0 进行中</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">标注冲突</span>
                <span className="text-sm font-medium">0 待处理</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-green-500">系统运行正常</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
