import { createFileRoute } from "@tanstack/react-router"

import TaggingRuleWizardPage from "@/components/Tags/TaggingRuleWizardPage"

export const Route = createFileRoute("/_layout/settings/tagging-rules/new")({
  component: TaggingRuleWizardPage,
  head: () => ({
    meta: [{ title: "新建分类规则 - Manifest" }],
  }),
})
