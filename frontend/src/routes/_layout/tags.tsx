import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { Suspense, useState } from "react"
import { DataTable } from "@/components/Common/DataTable"
import { PendingComponent } from "@/components/Pending/PendingComponent"
import AddTag from "@/components/Tags/AddTag"
import { columns } from "@/components/Tags/columns"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/_layout/tags")({
  component: Tags,
})

function TagsTable() {
  const { data } = useSuspenseQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const response = await fetch("/api/v1/tags/", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      })
      return response.json()
    },
  })

  return <DataTable columns={columns} data={data?.data || []} />
}

function Tags() {
  const [isAddOpen, setIsAddOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
          <p className="text-muted-foreground">
            Organize samples with hierarchical tags
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Tag
        </Button>
      </div>
      <Suspense fallback={<PendingComponent />}>
        <TagsTable />
      </Suspense>
      <AddTag open={isAddOpen} onOpenChange={setIsAddOpen} />
    </div>
  )
}
