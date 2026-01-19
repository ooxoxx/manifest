// frontend/src/routes/_layout/admin.tsx
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/admin")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/users" })
  },
  component: () => null,
})
