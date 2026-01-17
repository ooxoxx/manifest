import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"
import { Database } from "lucide-react"

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
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
          <Database className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
            Asset Repository
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Samples
        </h1>
        <p className="text-muted-foreground mt-2">
          Browse and manage your AI training sample assets
        </p>
      </div>
      <Suspense fallback={<PendingComponent />}>
        <div className="terminal-border bg-card/30 backdrop-blur-sm rounded-lg overflow-hidden">
          <SamplesTable />
        </div>
      </Suspense>
    </div>
  )
}
