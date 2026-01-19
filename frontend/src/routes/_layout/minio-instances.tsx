import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { Suspense, useState } from "react"
import { MinioInstancesService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import AddMinIOInstance from "@/components/MinIO/AddInstance"
import { columns } from "@/components/MinIO/columns"
import { PendingComponent } from "@/components/Pending/PendingComponent"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/_layout/minio-instances")({
  component: MinIOInstances,
})

function MinIOInstancesTable() {
  const { data } = useSuspenseQuery({
    queryKey: ["minio-instances"],
    queryFn: () => MinioInstancesService.readMinioInstances(),
  })

  return <DataTable columns={columns} data={data?.data || []} />
}

function MinIOInstances() {
  const [isAddOpen, setIsAddOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MinIO 实例</h1>
          <p className="text-muted-foreground">管理您的 MinIO 存储连接</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          添加实例
        </Button>
      </div>
      <Suspense fallback={<PendingComponent />}>
        <MinIOInstancesTable />
      </Suspense>
      <AddMinIOInstance open={isAddOpen} onOpenChange={setIsAddOpen} />
    </div>
  )
}
