import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router"
import { Suspense } from "react"

import { PendingComponent } from "@/components/Pending/PendingComponent"
import { SampleReviewer } from "@/components/Samples/SampleReviewer"

// Define search params schema
interface SampleSearchParams {
  ids?: string
  index?: number
}

export const Route = createFileRoute("/_layout/samples/$sampleId")({
  component: SampleViewerPage,
  validateSearch: (search: Record<string, unknown>): SampleSearchParams => ({
    ids: typeof search.ids === "string" ? search.ids : undefined,
    index: typeof search.index === "number" ? search.index : undefined,
  }),
})

function SampleViewerContent() {
  const { sampleId } = Route.useParams()
  const search = useSearch({ from: "/_layout/samples/$sampleId" })
  const navigate = useNavigate()

  // Parse sample IDs from search params or use single sample
  const sampleIds = search.ids ? search.ids.split(",") : [sampleId]
  const initialIndex = search.index ?? sampleIds.indexOf(sampleId)

  // Fetch all samples in the list to verify they exist
  const { data: samplesData } = useSuspenseQuery({
    queryKey: ["samples", "list", sampleIds],
    queryFn: async () => {
      // Just verify the samples exist - the SampleViewer will fetch details
      const response = await fetch("/api/v1/samples/", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      })
      return response.json()
    },
  })

  // Filter to only existing sample IDs
  const validSampleIds = sampleIds.filter((id) =>
    samplesData?.data?.some((s: { id: string }) => s.id === id),
  )

  const handleBack = () => {
    navigate({ to: "/samples" })
  }

  if (validSampleIds.length === 0) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <p className="text-muted-foreground">Sample not found</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      <SampleReviewer
        sampleIds={validSampleIds}
        initialIndex={Math.max(0, initialIndex)}
        mode="browse"
        onBack={handleBack}
      />
    </div>
  )
}

function SampleViewerPage() {
  return (
    <Suspense fallback={<PendingComponent />}>
      <SampleViewerContent />
    </Suspense>
  )
}
