import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  Activity,
  Database,
  FolderOpen,
  Server,
  Tags,
  TrendingUp,
} from "lucide-react"
import { StatsCard } from "@/components/Dashboard/StatsCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: "首页 - Manifest",
      },
    ],
  }),
})

interface DashboardOverview {
  total_samples: number
  total_tags: number
  total_datasets: number
  total_minio_instances: number
  samples_today: number
  storage_bytes: number
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

function Dashboard() {
  const { user: currentUser } = useAuth()

  const { data: overview } = useQuery<DashboardOverview>({
    queryKey: ["dashboard", "overview"],
    queryFn: async () => {
      const response = await fetch("/api/v1/dashboard/overview", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      })
      return response.json()
    },
  })

  return (
    <div className="flex flex-col gap-8 relative">
      {/* Header with enhanced styling */}
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
          <Activity className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
            系统概览
          </span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          欢迎回来，{" "}
          <span className="text-primary">
            {currentUser?.full_name || currentUser?.email}
          </span>
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          正在管理分布式存储中的{" "}
          {overview?.total_samples?.toLocaleString() ?? 0} 个训练样本
        </p>
      </div>

      {/* Stats grid with staggered animation */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <StatsCard
            title="样本总数"
            value={overview?.total_samples?.toLocaleString() ?? 0}
            description={`今日新增 ${overview?.samples_today ?? 0} 个`}
            icon={FolderOpen}
          />
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          <StatsCard
            title="标签"
            value={overview?.total_tags ?? 0}
            description="层级标签"
            icon={Tags}
          />
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
          <StatsCard
            title="数据集"
            value={overview?.total_datasets ?? 0}
            description="样本集合"
            icon={Database}
          />
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-[400ms]">
          <StatsCard
            title="存储空间"
            value={formatBytes(overview?.storage_bytes ?? 0)}
            description={`${overview?.total_minio_instances ?? 0} 个 MinIO 实例`}
            icon={Server}
          />
        </div>
      </div>

      {/* Enhanced info cards */}
      <div className="grid gap-5 md:grid-cols-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500">
        <Card className="terminal-border bg-card/50 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent opacity-60" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-accent" />
              快捷操作
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="space-y-3">
              <li className="flex items-start gap-2 group/item hover:text-foreground transition-colors">
                <span className="text-accent font-mono text-xs mt-0.5">
                  &gt;
                </span>
                <span>
                  前往 <span className="font-semibold text-primary">样本</span>{" "}
                  浏览您的资源
                </span>
              </li>
              <li className="flex items-start gap-2 group/item hover:text-foreground transition-colors">
                <span className="text-accent font-mono text-xs mt-0.5">
                  &gt;
                </span>
                <span>
                  使用 <span className="font-semibold text-primary">标签</span>{" "}
                  对样本进行层级分类
                </span>
              </li>
              <li className="flex items-start gap-2 group/item hover:text-foreground transition-colors">
                <span className="text-accent font-mono text-xs mt-0.5">
                  &gt;
                </span>
                <span>
                  创建{" "}
                  <span className="font-semibold text-primary">数据集</span>{" "}
                  用于训练集合
                </span>
              </li>
              <li className="flex items-start gap-2 group/item hover:text-foreground transition-colors">
                <span className="text-accent font-mono text-xs mt-0.5">
                  &gt;
                </span>
                <span>
                  配置{" "}
                  <span className="font-semibold text-primary">MinIO 实例</span>{" "}
                  以管理存储
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="terminal-border bg-card/50 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
          <CardHeader>
            <CardTitle className="text-lg">系统状态</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-muted-foreground">MinIO 实例</span>
                <span className="font-mono font-semibold text-primary">
                  {overview?.total_minio_instances ?? 0}{" "}
                  <span className="text-xs text-muted-foreground">已连接</span>
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-muted-foreground">存储总量</span>
                <span className="font-mono font-semibold text-primary">
                  {formatBytes(overview?.storage_bytes ?? 0)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                  <span className="text-muted-foreground">状态</span>
                </div>
                <span className="font-mono font-semibold text-accent">
                  运行正常
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
