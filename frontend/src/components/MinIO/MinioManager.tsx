// frontend/src/components/MinIO/MinioManager.tsx
import { useSuspenseQuery } from "@tanstack/react-query"
import { Plus, Server } from "lucide-react"
import { Suspense, useState } from "react"

import { MinioInstancesService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import AddMinIOInstance from "@/components/MinIO/AddInstance"
import { columns } from "@/components/MinIO/columns"
import { PendingComponent } from "@/components/Pending/PendingComponent"
import { Button } from "@/components/ui/button"

function MinioTable() {
  const { data } = useSuspenseQuery({
    queryKey: ["minio-instances"],
    queryFn: () => MinioInstancesService.readMinioInstances(),
  })

  return <DataTable columns={columns} data={data?.data ?? []} />
}

export default function MinioManager() {
  const [isAddOpen, setIsAddOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
          <Server className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
            配置
          </span>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              MinIO 实例
            </h1>
            <p className="text-muted-foreground mt-2">
              管理对象存储连接配置
            </p>
          </div>
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加实例
          </Button>
        </div>
      </div>

      <Suspense fallback={<PendingComponent />}>
        <div className="terminal-border bg-card/30 backdrop-blur-sm rounded-lg overflow-hidden">
          <MinioTable />
        </div>
      </Suspense>

      <AddMinIOInstance open={isAddOpen} onOpenChange={setIsAddOpen} />
    </div>
  )
}
