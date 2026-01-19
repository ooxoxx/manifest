// frontend/src/routes/_layout/tags.tsx
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/tags")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/tags" })
  },
  component: () => null,
})
