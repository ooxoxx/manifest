// frontend/src/routes/_layout/ops.tsx
import { createFileRoute } from "@tanstack/react-router"

import OpsCenter from "@/components/Ops/OpsCenter"

export const Route = createFileRoute("/_layout/ops")({
  component: OpsPage,
  head: () => ({
    meta: [{ title: "运维中心 - Manifest" }],
  }),
})

function OpsPage() {
  return <OpsCenter />
}
