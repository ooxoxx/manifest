import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { Suspense, useState } from "react"

import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/Common/DataTable"
import { PendingComponent } from "@/components/Pending/PendingComponent"
import { columns } from "@/components/Datasets/columns"
import AddDataset from "@/components/Datasets/AddDataset"

export const Route = createFileRoute("/_layout/datasets")({
  component: Datasets,
})

function DatasetsTable() {
  const { data } = useSuspenseQuery({
    queryKey: ["datasets"],
    queryFn: async () => {
      const response = await fetch("/api/v1/datasets/", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      })
      return response.json()
    },
  })

  return <DataTable columns={columns} data={data?.data || []} />
}

function Datasets() {
  const [isAddOpen, setIsAddOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Datasets</h1>
          <p className="text-muted-foreground">
            Create and manage sample collections for training
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Dataset
        </Button>
      </div>
      <Suspense fallback={<PendingComponent />}>
        <DatasetsTable />
      </Suspense>
      <AddDataset open={isAddOpen} onOpenChange={setIsAddOpen} />
    </div>
  )
}
