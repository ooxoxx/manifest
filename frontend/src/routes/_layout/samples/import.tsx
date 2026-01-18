import { createFileRoute } from "@tanstack/react-router"
import { FileSpreadsheet } from "lucide-react"

import { ImportHistory, ImportWizard } from "@/components/Import"

export const Route = createFileRoute("/_layout/samples/import")({
  component: ImportPage,
})

function ImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
          <FileSpreadsheet className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
            Batch Import
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Import Samples
        </h1>
        <p className="text-muted-foreground mt-2">
          Import samples from a CSV file with automatic tag creation and
          annotation linking
        </p>
      </div>

      <ImportWizard />

      <ImportHistory />
    </div>
  )
}
