import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { FolderOpen, Tags, Database, Server, TrendingUp } from "lucide-react"

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {currentUser?.full_name || currentUser?.email}
        </h1>
        <p className="text-muted-foreground">
          Here's an overview of your asset management system
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Samples"
          value={overview?.total_samples ?? 0}
          description={`+${overview?.samples_today ?? 0} today`}
          icon={FolderOpen}
        />
        <StatsCard
          title="Tags"
          value={overview?.total_tags ?? 0}
          description="Hierarchical labels"
          icon={Tags}
        />
        <StatsCard
          title="Datasets"
          value={overview?.total_datasets ?? 0}
          description="Sample collections"
          icon={Database}
        />
        <StatsCard
          title="Storage"
          value={formatBytes(overview?.storage_bytes ?? 0)}
          description={`${overview?.total_minio_instances ?? 0} MinIO instances`}
          icon={Server}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="space-y-2">
              <li>• Navigate to Samples to browse your assets</li>
              <li>• Use Tags to organize samples hierarchically</li>
              <li>• Create Datasets for training collections</li>
              <li>• Configure MinIO instances for storage</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>MinIO Instances</span>
                <span className="font-medium">{overview?.total_minio_instances ?? 0} connected</span>
              </div>
              <div className="flex justify-between">
                <span>Total Storage</span>
                <span className="font-medium">{formatBytes(overview?.storage_bytes ?? 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
