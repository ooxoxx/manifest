// frontend/src/routes/_layout/build.tsx
import { createFileRoute } from "@tanstack/react-router"

import DatasetBuildWizard from "@/components/Datasets/Build/DatasetBuildWizard"

export const Route = createFileRoute("/_layout/build")({
  component: BuildPage,
  head: () => ({
    meta: [{ title: "数据集构建 - Manifest" }],
  }),
})

function BuildPage() {
  return <DatasetBuildWizard />
}
