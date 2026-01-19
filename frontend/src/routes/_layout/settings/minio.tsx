// frontend/src/routes/_layout/settings/minio.tsx
import { createFileRoute } from "@tanstack/react-router"

import MinioManager from "@/components/MinIO/MinioManager"

export const Route = createFileRoute("/_layout/settings/minio")({
  component: MinioSettingsPage,
  head: () => ({
    meta: [{ title: "MinIO 实例 - Manifest" }],
  }),
})

function MinioSettingsPage() {
  return <MinioManager />
}
