import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef } from "react"
import type { SampleThumbnail } from "@/client"
import { SamplesService } from "@/client"
import { Skeleton } from "@/components/ui/skeleton"

import { SampleCard } from "./SampleCard"
import type { FilterParams } from "./SampleFilters"

interface SampleGridProps {
  filters: FilterParams
  storagePath?: string
  businessTagId?: string
}

const PAGE_SIZE = 50

export function SampleGrid({
  filters,
  storagePath,
  businessTagId,
}: SampleGridProps) {
  const navigate = useNavigate()
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Serialize tag filter to JSON string for API
  const tagFilterJson = useMemo(() => {
    if (filters.tagFilter.length === 0) return undefined
    // Filter out empty groups
    const nonEmptyGroups = filters.tagFilter.filter((g) => g.length > 0)
    if (nonEmptyGroups.length === 0) return undefined
    return JSON.stringify(nonEmptyGroups)
  }, [filters.tagFilter])

  // Parse storage path to extract minio_instance_id, bucket, and prefix
  const storageParams = useMemo(() => {
    if (!storagePath) return {}
    const parts = storagePath.split(":")
    if (parts.length === 1) {
      return { minioInstanceId: parts[0] }
    }
    if (parts.length === 2) {
      return { minioInstanceId: parts[0], bucket: parts[1] }
    }
    if (parts.length >= 3) {
      return {
        minioInstanceId: parts[0],
        bucket: parts[1],
        prefix: parts.slice(2).join(":"),
      }
    }
    return {}
  }, [storagePath])

  // Infinite query for samples
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: [
      "samples-browser",
      tagFilterJson,
      filters.dateFrom,
      filters.dateTo,
      filters.annotationStatus,
      filters.search,
      storagePath,
      businessTagId,
    ],
    queryFn: async ({ pageParam = 0 }) => {
      return SamplesService.readSamples({
        skip: pageParam,
        limit: PAGE_SIZE,
        tagFilter: tagFilterJson,
        dateFrom: filters.dateFrom ?? undefined,
        dateTo: filters.dateTo ?? undefined,
        annotationStatus: filters.annotationStatus ?? undefined,
        search: filters.search || undefined,
        sort: "-created_at",
        minioInstanceId: storageParams.minioInstanceId,
        bucket: storageParams.bucket,
        prefix: storageParams.prefix,
        businessTagId: businessTagId,
      })
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.has_more) return undefined
      return allPages.reduce((sum, page) => sum + page.items.length, 0)
    },
  })

  // Get all sample IDs for batch thumbnail fetch
  const allSamples = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? []
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
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Create thumbnail map for O(1) lookup
  const thumbnailMap = useMemo(() => {
    const map = new Map<string, SampleThumbnail>()
    for (const thumb of thumbnails ?? []) {
      map.set(thumb.id, thumb)
    }
    return map
  }, [thumbnails])

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

  const handleSampleClick = useCallback(
    (sampleId: string) => {
      navigate({
        to: "/samples/$sampleId",
        params: { sampleId },
      })
    },
    [navigate],
  )

  const total = data?.pages[0]?.total ?? 0

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">加载中...</div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
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
        没有找到符合条件的样本
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        共 {total.toLocaleString()} 个样本
        {allSamples.length < total && (
          <span className="ml-2">
            | 已加载 {allSamples.length.toLocaleString()} 个
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {allSamples.map((sample) => {
          const thumbnail = thumbnailMap.get(sample.id)
          // If we don't have thumbnail yet, show skeleton
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
            <SampleCard
              key={sample.id}
              sample={thumbnail}
              onClick={() => handleSampleClick(sample.id)}
            />
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
    </div>
  )
}
