// frontend/src/routes/_layout/samples/index.tsx
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Database, Grid, List, Upload } from "lucide-react"
import { Suspense, useState } from "react"

import { SamplesService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { PendingComponent } from "@/components/Pending/PendingComponent"
import { columns } from "@/components/Samples/columns"
import { SampleReviewer } from "@/components/Samples/SampleReviewer"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export const Route = createFileRoute("/_layout/samples/")({
  component: Samples,
  head: () => ({
    meta: [{ title: "样本浏览 - Manifest" }],
  }),
})

type ViewMode = "list" | "single"

function SamplesContent({
  viewMode,
  onViewModeChange,
  onSampleSelect,
}: {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onSampleSelect: (index: number) => void
}) {
  const { data } = useSuspenseQuery({
    queryKey: ["samples"],
    queryFn: () => SamplesService.readSamples(),
  })

  const samples = data?.data ?? []
  const sampleIds = samples.map((s) => s.id)

  if (viewMode === "single" && samples.length > 0) {
    return (
      <SampleReviewer
        sampleIds={sampleIds}
        mode="browse"
        onBack={() => onViewModeChange("list")}
      />
    )
  }

  return (
    <div className="terminal-border bg-card/30 backdrop-blur-sm rounded-lg overflow-hidden">
      <DataTable
        columns={columns}
        data={samples}
        onRowClick={(_row, index) => {
          onSampleSelect(index)
          onViewModeChange("single")
        }}
      />
    </div>
  )
}

function Samples() {
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [_selectedIndex, setSelectedIndex] = useState(0)

  return (
    <div className="flex flex-col gap-6">
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
              <ToggleGroupItem value="list" aria-label="列表模式">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="single" aria-label="逐张模式">
                <Grid className="h-4 w-4" />
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

      <Suspense fallback={<PendingComponent />}>
        <SamplesContent
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSampleSelect={setSelectedIndex}
        />
      </Suspense>
    </div>
  )
}
