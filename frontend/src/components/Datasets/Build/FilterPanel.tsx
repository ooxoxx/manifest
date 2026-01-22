import type { AnnotationStatus, FilterParams } from "@/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import DNFTagFilter from "./DNFTagFilter"

interface Props {
  value: FilterParams
  onChange: (value: FilterParams) => void
}

export default function FilterPanel({ value, onChange }: Props) {
  const handleDateChange = (
    field: "date_from" | "date_to",
    newValue: string,
  ) => {
    onChange({
      ...value,
      [field]: newValue || undefined,
    })
  }

  const handleAnnotationStatusChange = (newValue: string) => {
    onChange({
      ...value,
      annotation_status:
        newValue && newValue !== "all"
          ? (newValue as AnnotationStatus)
          : undefined,
    })
  }

  const handleTagFilterChange = (tagFilter: string[][]) => {
    onChange({
      ...value,
      tag_filter: tagFilter.length > 0 ? tagFilter : undefined,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>筛选条件</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tag Filter */}
        <DNFTagFilter
          value={value.tag_filter ?? []}
          onChange={handleTagFilterChange}
        />

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>获取时间起始</Label>
            <Input
              type="date"
              value={value.date_from ?? ""}
              onChange={(e) => handleDateChange("date_from", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>获取时间截止</Label>
            <Input
              type="date"
              value={value.date_to ?? ""}
              onChange={(e) => handleDateChange("date_to", e.target.value)}
            />
          </div>
        </div>

        {/* Annotation Status */}
        <div className="space-y-2">
          <Label>标注状态</Label>
          <Select
            value={value.annotation_status ?? ""}
            onValueChange={handleAnnotationStatusChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="none">无标注</SelectItem>
              <SelectItem value="linked">已标注</SelectItem>
              <SelectItem value="conflict">冲突</SelectItem>
              <SelectItem value="error">错误</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
