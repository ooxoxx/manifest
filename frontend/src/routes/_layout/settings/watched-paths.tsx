// frontend/src/routes/_layout/settings/watched-paths.tsx
import { createFileRoute } from "@tanstack/react-router"

import WatchedPathManager from "@/components/WatchedPaths/WatchedPathManager"

export const Route = createFileRoute("/_layout/settings/watched-paths")({
  component: WatchedPathsSettingsPage,
  head: () => ({
    meta: [{ title: "监控路径 - Manifest" }],
  }),
})

function WatchedPathsSettingsPage() {
  return <WatchedPathManager />
}
