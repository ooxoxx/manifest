import { createFileRoute } from "@tanstack/react-router"

import TaggingRulesManager from "@/components/Tags/TaggingRulesManager"

export const Route = createFileRoute("/_layout/settings/tagging-rules/")({
  component: TaggingRulesPage,
  head: () => ({
    meta: [{ title: "分类规则 - Manifest" }],
  }),
})

function TaggingRulesPage() {
  return <TaggingRulesManager />
}
