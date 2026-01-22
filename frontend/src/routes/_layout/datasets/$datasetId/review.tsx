import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Suspense, useMemo } from "react"
import { toast } from "sonner"

import { DatasetsService } from "@/client"
import { PendingComponent } from "@/components/Pending/PendingComponent"
import { SampleReviewer } from "@/components/Samples/SampleReviewer"

interface ReviewSearchParams {
  sampleId?: string
  classFilter?: string
}

export const Route = createFileRoute("/_layout/datasets/$datasetId/review")({
  component: DatasetReviewPage,
  validateSearch: (search: Record<string, unknown>): ReviewSearchParams => ({
    sampleId: typeof search.sampleId === "string" ? search.sampleId : undefined,
    classFilter:
      typeof search.classFilter === "string" ? search.classFilter : undefined,
  }),
})

function DatasetReviewContent() {
  const { datasetId } = Route.useParams()
  const { sampleId, classFilter } = Route.useSearch()
  const navigate = useNavigate()

  // Fetch dataset details
  const { data: dataset } = useSuspenseQuery({
    queryKey: ["datasets", datasetId],
    queryFn: () => DatasetsService.readDataset({ id: datasetId }),
  })

  // Fetch samples in the dataset (with optional class filter)
  const { data: samplesData } = useSuspenseQuery({
    queryKey: ["datasets", datasetId, "samples-review", classFilter],
    queryFn: () =>
      DatasetsService.getDatasetSamples({
        id: datasetId,
        limit: 1000,
        classFilter: classFilter ?? undefined,
      }),
  })

  const sampleIds = useMemo(
    () => samplesData?.data?.map((s) => s.id) || [],
    [samplesData],
  )

  // Calculate initial index based on sampleId param
  const initialIndex = useMemo(() => {
    if (!sampleId || sampleIds.length === 0) return 0
    const index = sampleIds.indexOf(sampleId)
    return index >= 0 ? index : 0
  }, [sampleId, sampleIds])

  const handleComplete = () => {
    toast.success("浏览完成！")
    navigate({
      to: "/datasets/$datasetId",
      params: { datasetId },
    })
  }

  const handleBack = () => {
    navigate({
      to: "/datasets/$datasetId",
      params: { datasetId },
    })
  }

  if (sampleIds.length === 0) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">
          {classFilter
            ? `数据集 "${dataset?.name}" 中没有包含 "${classFilter}" 类别的样本`
            : `数据集 "${dataset?.name}" 中暂无样本`}
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="text-primary underline"
        >
          返回数据集
        </button>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      <SampleReviewer
        sampleIds={sampleIds}
        initialIndex={initialIndex}
        mode="review"
        datasetId={datasetId}
        onComplete={handleComplete}
        onBack={handleBack}
      />
    </div>
  )
}

function DatasetReviewPage() {
  return (
    <Suspense fallback={<PendingComponent />}>
      <DatasetReviewContent />
    </Suspense>
  )
}
