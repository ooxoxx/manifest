import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"

import { DataTable } from "@/components/Common/DataTable"
import { PendingComponent } from "@/components/Pending/PendingComponent"
import { columns } from "@/components/Samples/columns"

export const Route = createFileRoute("/_layout/samples")({
  component: Samples,
})

function SamplesTable() {
  const { data } = useSuspenseQuery({
    queryKey: ["samples"],
    queryFn: async () => {
      const response = await fetch("/api/v1/samples/", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      })
      return response.json()
    },
  })

  return <DataTable columns={columns} data={data?.data || []} />
}

function Samples() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Samples</h1>
        <p className="text-muted-foreground">
          Browse and manage your sample assets
        </p>
      </div>
      <Suspense fallback={<PendingComponent />}>
        <SamplesTable />
      </Suspense>
    </div>
  )
}
