import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  SkipForward,
  Undo,
  X,
} from "lucide-react"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { DatasetsService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useReviewerKeyboard } from "@/hooks/useReviewerKeyboard"

import { SampleViewer } from "./SampleViewer"

type ReviewAction = "keep" | "remove" | "skip"

interface Operation {
  type: ReviewAction
  sampleId: string
  previousIndex: number
}

export interface SampleReviewerProps {
  sampleIds: string[]
  initialIndex?: number
  mode: "browse" | "review"
  datasetId?: string
  onComplete?: () => void
  onBack?: () => void
}

export function SampleReviewer({
  sampleIds,
  initialIndex = 0,
  mode,
  datasetId,
  onComplete,
  onBack,
}: SampleReviewerProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Current sample index
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(initialIndex, sampleIds.length - 1),
  )

  // Review status for each sample (only in review mode)
  const [reviewStatus, setReviewStatus] = useState<Map<string, ReviewAction>>(
    new Map(),
  )

  // Operation history for undo
  const [operationHistory, setOperationHistory] = useState<Operation[]>([])

  // Current sample ID
  const currentSampleId = sampleIds[currentIndex]
  const isFirstSample = currentIndex === 0
  const isLastSample = currentIndex === sampleIds.length - 1

  // Count reviewed samples
  const reviewedCount = reviewStatus.size
  const totalCount = sampleIds.length

  // Mutation for removing samples from dataset
  const removeSampleMutation = useMutation({
    mutationFn: async (sampleId: string) => {
      if (!datasetId) throw new Error("Dataset ID required for review mode")
      return DatasetsService.removeSamplesFromDataset({
        id: datasetId,
        requestBody: { sample_ids: [sampleId] },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets", datasetId] })
    },
  })

  // Mutation for adding samples back (for undo)
  const addSampleMutation = useMutation({
    mutationFn: async (sampleId: string) => {
      if (!datasetId) throw new Error("Dataset ID required for review mode")
      return DatasetsService.addSamplesToDataset({
        id: datasetId,
        requestBody: { sample_ids: [sampleId] },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets", datasetId] })
    },
  })

  // Navigation handlers
  const handlePrev = useCallback(() => {
    if (!isFirstSample) {
      setCurrentIndex((prev) => prev - 1)
    }
  }, [isFirstSample])

  const handleNext = useCallback(() => {
    if (!isLastSample) {
      setCurrentIndex((prev) => prev + 1)
    } else if (mode === "review" && onComplete) {
      onComplete()
    }
  }, [isLastSample, mode, onComplete])

  // Review action handlers
  const handleReviewAction = useCallback(
    async (action: ReviewAction) => {
      if (mode !== "review" || !currentSampleId) return

      // Record operation for undo
      setOperationHistory((prev) => [
        ...prev,
        {
          type: action,
          sampleId: currentSampleId,
          previousIndex: currentIndex,
        },
      ])

      // Update local review status
      setReviewStatus((prev) => new Map(prev).set(currentSampleId, action))

      // Perform action
      if (action === "remove" && datasetId) {
        try {
          await removeSampleMutation.mutateAsync(currentSampleId)
          toast.success("Sample removed from dataset")
        } catch {
          toast.error("Failed to remove sample")
          // Revert local state on error
          setReviewStatus((prev) => {
            const next = new Map(prev)
            next.delete(currentSampleId)
            return next
          })
          setOperationHistory((prev) => prev.slice(0, -1))
          return
        }
      } else if (action === "keep") {
        toast.success("Sample kept in dataset")
      } else if (action === "skip") {
        toast("Sample skipped")
      }

      // Move to next sample
      handleNext()
    },
    [
      mode,
      currentSampleId,
      currentIndex,
      datasetId,
      removeSampleMutation,
      handleNext,
    ],
  )

  const handleKeep = useCallback(
    () => handleReviewAction("keep"),
    [handleReviewAction],
  )
  const handleRemove = useCallback(
    () => handleReviewAction("remove"),
    [handleReviewAction],
  )
  const handleSkip = useCallback(
    () => handleReviewAction("skip"),
    [handleReviewAction],
  )

  // Undo handler
  const handleUndo = useCallback(async () => {
    if (operationHistory.length === 0) return

    const lastOp = operationHistory[operationHistory.length - 1]

    // Remove from history
    setOperationHistory((prev) => prev.slice(0, -1))

    // Revert review status
    setReviewStatus((prev) => {
      const next = new Map(prev)
      next.delete(lastOp.sampleId)
      return next
    })

    // If it was a remove, add back to dataset
    if (lastOp.type === "remove" && datasetId) {
      try {
        await addSampleMutation.mutateAsync(lastOp.sampleId)
        toast.success("Undo: Sample restored to dataset")
      } catch {
        toast.error("Failed to restore sample")
      }
    } else {
      toast("Undo: Reverted last action")
    }

    // Jump back to that sample
    setCurrentIndex(lastOp.previousIndex)
  }, [operationHistory, datasetId, addSampleMutation])

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (onBack) {
      onBack()
    } else {
      navigate({ to: ".." })
    }
  }, [onBack, navigate])

  // Keyboard shortcuts
  useReviewerKeyboard({
    onPrev: handlePrev,
    onNext: handleNext,
    onKeep: mode === "review" ? handleKeep : undefined,
    onRemove: mode === "review" ? handleRemove : undefined,
    onSkip: mode === "review" ? handleSkip : undefined,
    onUndo: mode === "review" ? handleUndo : undefined,
    enabled: true,
  })

  if (sampleIds.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No samples to display</p>
      </div>
    )
  }

  const currentSampleStatus = currentSampleId
    ? reviewStatus.get(currentSampleId)
    : undefined

  return (
    <div className="flex h-full flex-col">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between border-b bg-card px-4 py-2">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        <div className="text-sm">
          <span className="font-medium">
            {currentIndex + 1} / {totalCount}
          </span>
          {mode === "review" && (
            <span className="ml-2 text-muted-foreground">
              ({reviewedCount} reviewed)
            </span>
          )}
        </div>

        {/* Status indicator for current sample */}
        {mode === "review" && currentSampleStatus && (
          <div
            className={`rounded px-2 py-1 text-xs font-medium ${
              currentSampleStatus === "keep"
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : currentSampleStatus === "remove"
                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
            }`}
          >
            {currentSampleStatus === "keep"
              ? "Kept"
              : currentSampleStatus === "remove"
                ? "Removed"
                : "Skipped"}
          </div>
        )}

        {mode === "browse" && <div />}
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-0">
        <SampleViewer sampleId={currentSampleId} className="h-full" />
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-between border-t bg-card px-4 py-3">
        {/* Navigation buttons */}
        <TooltipProvider>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  disabled={isFirstSample}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>A or ← Arrow</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  disabled={isLastSample && mode === "browse"}
                >
                  Next
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>D or → Arrow</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        {/* Review actions (only in review mode) */}
        {mode === "review" && (
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUndo}
                    disabled={operationHistory.length === 0}
                  >
                    <Undo className="mr-1 h-4 w-4" />
                    Undo
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Ctrl+Z / Cmd+Z</p>
                </TooltipContent>
              </Tooltip>

              <div className="mx-2 h-6 w-px bg-border" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleKeep}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Keep (Y)
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Press Y to keep</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRemove}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Remove (N)
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Press N to remove</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" size="sm" onClick={handleSkip}>
                    <SkipForward className="mr-1 h-4 w-4" />
                    Skip (S)
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Press S to skip</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        )}
      </div>
    </div>
  )
}
