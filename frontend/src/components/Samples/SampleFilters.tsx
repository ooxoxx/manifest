import { CalendarDays, Search, Tag, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import type { AnnotationStatus } from "@/client"
import DNFTagFilter from "@/components/Datasets/Build/DNFTagFilter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface FilterParams {
  tagFilter: string[][] // [[tagA, tagB], [tagC]] = (A AND B) OR C
  dateFrom: string | null
  dateTo: string | null
  annotationStatus: AnnotationStatus | null
  search: string
}

interface SampleFiltersProps {
  filters: FilterParams
  onChange: (filters: FilterParams) => void
  onClear: () => void
}

export const defaultFilters: FilterParams = {
  tagFilter: [],
  dateFrom: null,
  dateTo: null,
  annotationStatus: null,
  search: "",
}

export function hasActiveFilters(filters: FilterParams): boolean {
  return (
    filters.tagFilter.length > 0 ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.annotationStatus !== null ||
    filters.search.trim() !== ""
  )
}

export function SampleFilters({
  filters,
  onChange,
  onClear,
}: SampleFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search)
  const [tagOpen, setTagOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onChange({ ...filters, search: searchInput })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, filters, onChange])

  const handleTagFilterChange = useCallback(
    (tagFilter: string[][]) => {
      onChange({ ...filters, tagFilter })
    },
    [filters, onChange],
  )

  const handleDateFromChange = useCallback(
    (value: string) => {
      onChange({ ...filters, dateFrom: value || null })
    },
    [filters, onChange],
  )

  const handleDateToChange = useCallback(
    (value: string) => {
      onChange({ ...filters, dateTo: value || null })
    },
    [filters, onChange],
  )

  const handleAnnotationStatusChange = useCallback(
    (value: string) => {
      onChange({
        ...filters,
        annotationStatus: value === "all" ? null : (value as AnnotationStatus),
      })
    },
    [filters, onChange],
  )

  const tagFilterSummary =
    filters.tagFilter.length > 0 ? `${filters.tagFilter.length} 组` : "标签筛选"

  const dateFilterSummary =
    filters.dateFrom || filters.dateTo
      ? `${filters.dateFrom || "..."} ~ ${filters.dateTo || "..."}`
      : "日期范围"

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Tag Filter */}
      <Popover open={tagOpen} onOpenChange={setTagOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={filters.tagFilter.length > 0 ? "secondary" : "outline"}
            size="sm"
            className="gap-2"
          >
            <Tag className="h-4 w-4" />
            {tagFilterSummary}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px]" align="start">
          <DNFTagFilter
            value={filters.tagFilter}
            onChange={handleTagFilterChange}
          />
        </PopoverContent>
      </Popover>

      {/* Date Range Filter */}
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={
              filters.dateFrom || filters.dateTo ? "secondary" : "outline"
            }
            size="sm"
            className="gap-2"
          >
            <CalendarDays className="h-4 w-4" />
            {dateFilterSummary}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px]" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">开始日期</label>
              <Input
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) => handleDateFromChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">结束日期</label>
              <Input
                type="date"
                value={filters.dateTo || ""}
                onChange={(e) => handleDateToChange(e.target.value)}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Annotation Status Filter */}
      <Select
        value={filters.annotationStatus || "all"}
        onValueChange={handleAnnotationStatusChange}
      >
        <SelectTrigger size="sm" className="w-[120px]">
          <SelectValue placeholder="标注状态" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部</SelectItem>
          <SelectItem value="linked">已标注</SelectItem>
          <SelectItem value="none">未标注</SelectItem>
          <SelectItem value="conflict">冲突</SelectItem>
          <SelectItem value="error">错误</SelectItem>
        </SelectContent>
      </Select>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="搜索文件名..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9 h-8 w-[180px]"
        />
      </div>

      {/* Clear Filters */}
      {hasActiveFilters(filters) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="gap-1 text-muted-foreground"
        >
          <X className="h-4 w-4" />
          清除筛选
        </Button>
      )}
    </div>
  )
}
