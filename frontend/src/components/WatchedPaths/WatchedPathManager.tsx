// frontend/src/components/WatchedPaths/WatchedPathManager.tsx
import { useSuspenseQuery } from "@tanstack/react-query"
import { Eye, Plus } from "lucide-react"
import { Suspense, useState } from "react"

import { WatchedPathsService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { PendingComponent } from "@/components/Pending/PendingComponent"
import { AddWatchedPath } from "@/components/WatchedPaths/AddWatchedPath"
import { columns } from "@/components/WatchedPaths/columns"
import { Button } from "@/components/ui/button"

function WatchedPathsTable() {
  const { data } = useSuspenseQuery({
    queryKey: ["watched-paths"],
    queryFn: () => WatchedPathsService.readWatchedPaths({}),
  })

  return <DataTable columns={columns} data={data?.data ?? []} />
}

export default function WatchedPathManager() {
  const [isAddOpen, setIsAddOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
          <Eye className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
            配置
          </span>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              监控路径
            </h1>
            <p className="text-muted-foreground mt-2">
              管理 MinIO bucket 目录监控，自动跟踪文件变化
            </p>
          </div>
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加监控路径
          </Button>
        </div>
      </div>

      <Suspense fallback={<PendingComponent />}>
        <div className="terminal-border bg-card/30 backdrop-blur-sm rounded-lg overflow-hidden">
          <WatchedPathsTable />
        </div>
      </Suspense>

      <AddWatchedPath open={isAddOpen} onOpenChange={setIsAddOpen} />
    </div>
  )
}
