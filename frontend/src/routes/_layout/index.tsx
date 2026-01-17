import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { FolderOpen, Tags, Database, Server, TrendingUp, Activity } from "lucide-react"

import useAuth from "@/hooks/useAuth"
import { StatsCard } from "@/components/Dashboard/StatsCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: "Dashboard - Manifest",
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
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
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
            System Overview
          </span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Welcome back, <span className="text-primary">{currentUser?.full_name || currentUser?.email}</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Monitoring {overview?.total_samples?.toLocaleString() ?? 0} training samples across distributed storage
        </p>
      </div>

      {/* Stats grid with staggered animation */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <StatsCard
            title="Total Samples"
            value={overview?.total_samples?.toLocaleString() ?? 0}
            description={`+${overview?.samples_today ?? 0} ingested today`}
            icon={FolderOpen}
          />
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          <StatsCard
            title="Tags"
            value={overview?.total_tags ?? 0}
            description="Hierarchical labels"
            icon={Tags}
          />
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
          <StatsCard
            title="Datasets"
            value={overview?.total_datasets ?? 0}
            description="Sample collections"
            icon={Database}
          />
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-[400ms]">
          <StatsCard
            title="Storage"
            value={formatBytes(overview?.storage_bytes ?? 0)}
            description={`${overview?.total_minio_instances ?? 0} MinIO instances`}
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
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="space-y-3">
              <li className="flex items-start gap-2 group/item hover:text-foreground transition-colors">
                <span className="text-accent font-mono text-xs mt-0.5">&gt;</span>
                <span>Navigate to <span className="font-semibold text-primary">Samples</span> to browse your assets</span>
              </li>
              <li className="flex items-start gap-2 group/item hover:text-foreground transition-colors">
                <span className="text-accent font-mono text-xs mt-0.5">&gt;</span>
                <span>Use <span className="font-semibold text-primary">Tags</span> to organize samples hierarchically</span>
              </li>
              <li className="flex items-start gap-2 group/item hover:text-foreground transition-colors">
                <span className="text-accent font-mono text-xs mt-0.5">&gt;</span>
                <span>Create <span className="font-semibold text-primary">Datasets</span> for training collections</span>
              </li>
              <li className="flex items-start gap-2 group/item hover:text-foreground transition-colors">
                <span className="text-accent font-mono text-xs mt-0.5">&gt;</span>
                <span>Configure <span className="font-semibold text-primary">MinIO instances</span> for storage</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="terminal-border bg-card/50 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
          <CardHeader>
            <CardTitle className="text-lg">System Status</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-muted-foreground">MinIO Instances</span>
                <span className="font-mono font-semibold text-primary">{overview?.total_minio_instances ?? 0} <span className="text-xs text-muted-foreground">connected</span></span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-muted-foreground">Total Storage</span>
                <span className="font-mono font-semibold text-primary">{formatBytes(overview?.storage_bytes ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                  <span className="text-muted-foreground">Status</span>
                </div>
                <span className="font-mono font-semibold text-accent">OPERATIONAL</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
