import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Plus, Wand2 } from "lucide-react"
import { Suspense, useState } from "react"
import type { DatasetPublic } from "@/client"
import { DatasetsService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import AddDataset from "@/components/Datasets/AddDataset"
import { columns } from "@/components/Datasets/columns"
import { PendingComponent } from "@/components/Pending/PendingComponent"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/_layout/datasets/")({
  component: Datasets,
})

function DatasetsTable() {
  const navigate = useNavigate()
  const { data } = useSuspenseQuery({
    queryKey: ["datasets"],
    queryFn: () => DatasetsService.readDatasets(),
  })

  const handleRowClick = (dataset: DatasetPublic) => {
    navigate({
      to: "/datasets/$datasetId",
      params: { datasetId: dataset.id },
    })
  }

  return (
    <DataTable
      columns={columns}
      data={data?.data || []}
      onRowClick={handleRowClick}
    />
  )
}

function Datasets() {
  const [isAddOpen, setIsAddOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">数据集</h1>
          <p className="text-muted-foreground">创建和管理训练样本集合</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/datasets/build">
              <Wand2 className="mr-2 h-4 w-4" />
              构建数据集
            </Link>
          </Button>
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            创建空数据集
          </Button>
        </div>
      </div>
      <Suspense fallback={<PendingComponent />}>
        <DatasetsTable />
      </Suspense>
      <AddDataset open={isAddOpen} onOpenChange={setIsAddOpen} />
    </div>
  )
}
