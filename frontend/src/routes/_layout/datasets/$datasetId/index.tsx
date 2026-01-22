import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, Eye, Plus } from "lucide-react"
import { Suspense, useState } from "react"

import { DatasetsService } from "@/client"
import { ClassStatsPanel } from "@/components/Datasets/Detail/ClassStatsPanel"
import { DatasetSampleGrid } from "@/components/Datasets/Detail/DatasetSampleGrid"
import { PendingComponent } from "@/components/Pending/PendingComponent"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/_layout/datasets/$datasetId/")({
  component: DatasetDetailPage,
})

function DatasetDetailContent() {
  const { datasetId } = Route.useParams()
  const navigate = useNavigate()
  const [selectedClass, setSelectedClass] = useState<string | null>(null)

  // Fetch dataset details
  const { data: dataset } = useSuspenseQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => DatasetsService.readDataset({ id: datasetId }),
  })

  // Fetch class stats
  const { data: classStats, isLoading: isStatsLoading } = useSuspenseQuery({
    queryKey: ["dataset", datasetId, "class-stats"],
    queryFn: () => DatasetsService.getDatasetClassStats({ id: datasetId }),
  })

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/datasets" })}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-xl font-bold">{dataset.name}</h1>
            {dataset.description && (
              <p className="text-sm text-muted-foreground">
                {dataset.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/datasets/$datasetId/review" params={{ datasetId }}>
              <Eye className="mr-2 h-4 w-4" />
              浏览样本
            </Link>
          </Button>
          <Button asChild>
            <Link to="/datasets/$datasetId/add-samples" params={{ datasetId }}>
              <Plus className="mr-2 h-4 w-4" />
              添加样本
            </Link>
          </Button>
        </div>
      </div>

      {/* Main content with sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar - Class stats */}
        <div className="w-64 flex-shrink-0 border-r p-4 overflow-hidden">
          <ClassStatsPanel
            stats={classStats}
            selectedClass={selectedClass}
            onClassSelect={setSelectedClass}
            isLoading={isStatsLoading}
          />
        </div>

        {/* Main area - Sample grid */}
        <div className="flex-1 overflow-auto p-6">
          <DatasetSampleGrid
            datasetId={datasetId}
            classFilter={selectedClass}
          />
        </div>
      </div>
    </div>
  )
}

function DatasetDetailPage() {
  return (
    <Suspense fallback={<PendingComponent />}>
      <DatasetDetailContent />
    </Suspense>
  )
}
