import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Loader2, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import type { SampleThumbnail } from "@/client"
import { DatasetsService, SamplesService } from "@/client"
import { SampleCard } from "@/components/Samples/SampleCard"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface DatasetSampleGridProps {
  datasetId: string
  classFilter: string | null
}

const PAGE_SIZE = 50

export function DatasetSampleGrid({
  datasetId,
  classFilter,
}: DatasetSampleGridProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sampleToDelete, setSampleToDelete] = useState<string | null>(null)

  // Infinite query for dataset samples
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ["dataset-samples", datasetId, classFilter],
    queryFn: async ({ pageParam = 0 }) => {
      return DatasetsService.getDatasetSamples({
        id: datasetId,
        skip: pageParam,
        limit: PAGE_SIZE,
        classFilter: classFilter ?? undefined,
      })
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce(
        (sum, page) => sum + page.data.length,
        0,
      )
      if (totalLoaded >= lastPage.count) return undefined
      return totalLoaded
    },
  })

  // Get all samples
  const allSamples = useMemo(() => {
    return data?.pages.flatMap((page) => page.data) ?? []
  }, [data])

  const sampleIds = useMemo(() => {
    return allSamples.map((s) => s.id)
  }, [allSamples])

  // Batch fetch thumbnails
  const { data: thumbnails } = useQuery({
    queryKey: ["sample-thumbnails", sampleIds],
    queryFn: async () => {
      if (sampleIds.length === 0) return []
      return SamplesService.getSampleThumbnails({
        requestBody: { sample_ids: sampleIds },
      })
    },
    enabled: sampleIds.length > 0,
    staleTime: 1000 * 60 * 5,
  })

  // Create thumbnail map
  const thumbnailMap = useMemo(() => {
    const map = new Map<string, SampleThumbnail>()
    for (const thumb of thumbnails ?? []) {
      map.set(thumb.id, thumb)
    }
    return map
  }, [thumbnails])

  // Remove samples mutation
  const removeMutation = useMutation({
    mutationFn: async (sampleIdsToRemove: string[]) => {
      return DatasetsService.removeSamplesFromDataset({
        id: datasetId,
        requestBody: { sample_ids: sampleIdsToRemove },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["dataset-samples", datasetId],
      })
      queryClient.invalidateQueries({ queryKey: ["dataset", datasetId] })
      queryClient.invalidateQueries({
        queryKey: ["dataset", datasetId, "class-stats"],
      })
      queryClient.invalidateQueries({ queryKey: ["datasets"] })
    },
  })

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )

    const target = loadMoreRef.current
    if (target) {
      observer.observe(target)
    }

    return () => {
      if (target) {
        observer.unobserve(target)
      }
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set())
    setIsSelectionMode(false)
  }, [])

  const handleSampleClick = useCallback(
    (sampleId: string) => {
      if (isSelectionMode) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(sampleId)) {
            next.delete(sampleId)
          } else {
            next.add(sampleId)
          }
          return next
        })
      } else {
        navigate({
          to: "/datasets/$datasetId/review",
          params: { datasetId },
          search: { sampleId },
        })
      }
    },
    [isSelectionMode, navigate, datasetId],
  )

  const handleDeleteSingle = useCallback((sampleId: string) => {
    setSampleToDelete(sampleId)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return
    setSampleToDelete(null)
    setDeleteDialogOpen(true)
  }, [selectedIds])

  const handleConfirmDelete = useCallback(async () => {
    const idsToRemove = sampleToDelete
      ? [sampleToDelete]
      : Array.from(selectedIds)
    try {
      await removeMutation.mutateAsync(idsToRemove)
      toast.success(`已从数据集移除 ${idsToRemove.length} 个样本`)
      setSelectedIds(new Set())
      setIsSelectionMode(false)
    } catch {
      toast.error("移除样本失败")
    }
    setDeleteDialogOpen(false)
    setSampleToDelete(null)
  }, [sampleToDelete, selectedIds, removeMutation])

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === allSamples.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allSamples.map((s) => s.id)))
    }
  }, [selectedIds, allSamples])

  const total = data?.pages[0]?.count ?? 0

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">加载中...</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        加载失败: {(error as Error)?.message || "未知错误"}
      </div>
    )
  }

  if (allSamples.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {classFilter
          ? `没有包含 "${classFilter}" 类别的样本`
          : "数据集中暂无样本"}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          共 {total.toLocaleString()} 个样本
          {classFilter && <span className="ml-2">| 筛选: {classFilter}</span>}
          {allSamples.length < total && (
            <span className="ml-2">
              | 已加载 {allSamples.length.toLocaleString()} 个
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isSelectionMode ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                {selectedIds.size === allSamples.length ? "取消全选" : "全选"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={selectedIds.size === 0}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                移除 ({selectedIds.size})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsSelectionMode(false)
                  setSelectedIds(new Set())
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSelectionMode(true)}
            >
              批量选择
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {allSamples.map((sample) => {
          const thumbnail = thumbnailMap.get(sample.id)
          const isSelected = selectedIds.has(sample.id)

          if (!thumbnail) {
            return (
              <div key={sample.id} className="space-y-2">
                <Skeleton className="aspect-square rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            )
          }

          return (
            <div key={sample.id} className="relative group">
              {/* Selection checkbox */}
              {isSelectionMode && (
                <div className="absolute top-2 left-2 z-10">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleSampleClick(sample.id)}
                    className="h-5 w-5 border-2 bg-background/80 backdrop-blur"
                  />
                </div>
              )}

              {/* Delete button (hover) */}
              {!isSelectionMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteSingle(sample.id)
                  }}
                  className={cn(
                    "absolute top-2 right-2 z-10 rounded-full p-1.5",
                    "bg-destructive/80 text-destructive-foreground backdrop-blur",
                    "opacity-0 transition-opacity group-hover:opacity-100",
                    "hover:bg-destructive",
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}

              <div
                className={cn(isSelected && "ring-2 ring-primary rounded-lg")}
              >
                <SampleCard
                  sample={thumbnail}
                  onClick={() => handleSampleClick(sample.id)}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Infinite scroll trigger */}
      <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>加载更多...</span>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认移除</AlertDialogTitle>
            <AlertDialogDescription>
              {sampleToDelete
                ? "确定要从数据集中移除这个样本吗？"
                : `确定要从数据集中移除选中的 ${selectedIds.size} 个样本吗？`}
              <br />
              <span className="text-muted-foreground">
                （样本文件不会被删除，只是从数据集中移除关联）
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
