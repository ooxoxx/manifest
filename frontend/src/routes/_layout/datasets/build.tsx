// frontend/src/routes/_layout/datasets/build.tsx - update to simple import
import { createFileRoute } from "@tanstack/react-router"

import DatasetBuildWizard from "@/components/Datasets/Build/DatasetBuildWizard"

export const Route = createFileRoute("/_layout/datasets/build")({
  component: DatasetBuildWizard,
  head: () => ({
    meta: [{ title: "构建数据集 - Manifest" }],
  }),
})
