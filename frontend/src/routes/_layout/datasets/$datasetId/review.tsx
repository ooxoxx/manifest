import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Suspense } from "react"
import { toast } from "sonner"

import { DatasetsService } from "@/client"
import { PendingComponent } from "@/components/Pending/PendingComponent"
import { SampleReviewer } from "@/components/Samples/SampleReviewer"

export const Route = createFileRoute("/_layout/datasets/$datasetId/review")({
  component: DatasetReviewPage,
})

function DatasetReviewContent() {
  const { datasetId } = Route.useParams()
  const navigate = useNavigate()

  // Fetch dataset details
  const { data: dataset } = useSuspenseQuery({
    queryKey: ["datasets", datasetId],
    queryFn: () => DatasetsService.readDataset({ id: datasetId }),
  })

  // Fetch all samples in the dataset
  const { data: samplesData } = useSuspenseQuery({
    queryKey: ["datasets", datasetId, "samples"],
    queryFn: async () => {
      // Fetch dataset samples - need to use the API endpoint
      const response = await fetch(
        `/api/v1/datasets/${datasetId}/samples?limit=1000`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        },
      )
      if (!response.ok) {
        throw new Error("Failed to fetch dataset samples")
      }
      return response.json()
    },
  })

  const sampleIds = samplesData?.data?.map((s: { id: string }) => s.id) || []

  const handleComplete = () => {
    toast.success("Review completed!")
    navigate({ to: "/datasets" })
  }

  const handleBack = () => {
    navigate({ to: "/datasets" })
  }

  if (sampleIds.length === 0) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">
          No samples in dataset "{dataset?.name}"
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="text-primary underline"
        >
          Back to Datasets
        </button>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      <SampleReviewer
        sampleIds={sampleIds}
        initialIndex={0}
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
