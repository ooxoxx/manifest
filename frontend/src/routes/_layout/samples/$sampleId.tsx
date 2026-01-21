// frontend/src/routes/_layout/samples/$sampleId.tsx
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { ArrowLeft, Database } from "lucide-react"

import { SampleViewer } from "@/components/Samples/SampleViewer"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/_layout/samples/$sampleId")({
  component: SampleDetailPage,
  head: () => ({
    meta: [{ title: "样本详情 - Manifest" }],
  }),
})

function SampleDetailPage() {
  const { sampleId } = Route.useParams()
  const router = useRouter()

  const handleBack = () => {
    // Navigate back preserving filter state in history
    router.history.back()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="relative mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
          <Database className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
            详情
          </span>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              样本详情
            </h1>
          </div>
          <Link to="/samples">
            <Button variant="outline" size="sm">
              浏览全部样本
            </Button>
          </Link>
        </div>
      </div>

      {/* Sample Viewer */}
      <div className="flex-1 terminal-border bg-card/30 backdrop-blur-sm rounded-lg overflow-hidden">
        <SampleViewer sampleId={sampleId} className="h-full" />
      </div>
    </div>
  )
}
