// frontend/src/routes/_layout/settings/tags.tsx
import { createFileRoute } from "@tanstack/react-router"

import TagsManager from "@/components/Tags/TagsManager"

export const Route = createFileRoute("/_layout/settings/tags")({
  component: TagsSettingsPage,
  head: () => ({
    meta: [{ title: "标签管理 - Manifest" }],
  }),
})

function TagsSettingsPage() {
  return <TagsManager />
}
