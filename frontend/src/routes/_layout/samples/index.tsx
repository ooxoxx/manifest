// frontend/src/routes/_layout/samples/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router"
import { Database, Grid, List, Upload } from "lucide-react"
import { useCallback, useMemo, useState } from "react"

import type { AnnotationStatus } from "@/client"
import { NavigationSidebar } from "@/components/Samples/NavigationSidebar"
import {
  type FilterParams,
  SampleFilters,
} from "@/components/Samples/SampleFilters"
import { SampleGrid } from "@/components/Samples/SampleGrid"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface SampleSearch {
  tag_filter?: string
  date_from?: string
  date_to?: string
  annotation_status?: AnnotationStatus
  search?: string
  // New tree navigation params
  storage_path?: string
  business_tag_id?: string
}

export const Route = createFileRoute("/_layout/samples/")({
  component: SamplesPage,
  validateSearch: (search: Record<string, unknown>): SampleSearch => ({
    tag_filter: search.tag_filter as string | undefined,
    date_from: search.date_from as string | undefined,
    date_to: search.date_to as string | undefined,
    annotation_status: search.annotation_status as AnnotationStatus | undefined,
    search: search.search as string | undefined,
    storage_path: search.storage_path as string | undefined,
    business_tag_id: search.business_tag_id as string | undefined,
  }),
  head: () => ({
    meta: [{ title: "样本浏览 - Manifest" }],
  }),
})

type ViewMode = "grid" | "list"

function SamplesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  // Convert URL search params to FilterParams
  const filters: FilterParams = useMemo(() => {
    let tagFilter: string[][] = []
    if (search.tag_filter) {
      try {
        const parsed = JSON.parse(search.tag_filter)
        if (Array.isArray(parsed)) {
          tagFilter = parsed
        }
      } catch {
        // Invalid JSON, ignore
      }
    }

    return {
      tagFilter,
      dateFrom: search.date_from ?? null,
      dateTo: search.date_to ?? null,
      annotationStatus: search.annotation_status ?? null,
      search: search.search ?? "",
    }
  }, [search])

  // Update URL when filters change
  const handleFiltersChange = useCallback(
    (newFilters: FilterParams) => {
      // Serialize tag filter to JSON
      const tagFilterStr =
        newFilters.tagFilter.length > 0
          ? JSON.stringify(newFilters.tagFilter)
          : undefined

      navigate({
        search: (prev) => ({
          ...prev,
          tag_filter: tagFilterStr,
          date_from: newFilters.dateFrom ?? undefined,
          date_to: newFilters.dateTo ?? undefined,
          annotation_status: newFilters.annotationStatus ?? undefined,
          search: newFilters.search || undefined,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    navigate({
      search: {},
      replace: true,
    })
  }, [navigate])

  // Handle storage path selection from tree
  const handleStoragePathSelect = useCallback(
    (path: string | null) => {
      navigate({
        search: (prev) => ({
          ...prev,
          storage_path: path ?? undefined,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  // Handle business tag selection from tree
  const handleBusinessTagSelect = useCallback(
    (tagId: string | null) => {
      navigate({
        search: (prev) => ({
          ...prev,
          business_tag_id: tagId ?? undefined,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <NavigationSidebar
        selectedStoragePath={search.storage_path ?? null}
        selectedBusinessTagId={search.business_tag_id ?? null}
        onStoragePathSelect={handleStoragePathSelect}
        onBusinessTagSelect={handleBusinessTagSelect}
      />

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 p-6">
          {/* Header */}
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
              <Database className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
                浏览
              </span>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  样本浏览
                </h1>
                <p className="text-muted-foreground mt-2">
                  浏览和管理您的 AI 训练样本资源
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(v) => v && setViewMode(v as ViewMode)}
                >
                  <ToggleGroupItem value="grid" aria-label="网格模式">
                    <Grid className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label="列表模式">
                    <List className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
                <Link to="/import">
                  <Button>
                    <Upload className="w-4 h-4 mr-2" />
                    导入样本
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="terminal-border bg-card/30 backdrop-blur-sm rounded-lg p-4">
            <SampleFilters
              filters={filters}
              onChange={handleFiltersChange}
              onClear={handleClearFilters}
            />
          </div>

          {/* Content */}
          <div className="terminal-border bg-card/30 backdrop-blur-sm rounded-lg p-4">
            {viewMode === "grid" ? (
              <SampleGrid
                filters={filters}
                storagePath={search.storage_path}
                businessTagId={search.business_tag_id}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                列表视图即将推出
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
