// frontend/src/routes/_layout/settings/users.tsx
import { createFileRoute, redirect } from "@tanstack/react-router"

import UsersManager from "@/components/Admin/UsersManager"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/settings/users")({
  component: UsersSettingsPage,
  beforeLoad: async () => {
    // Additional admin check could be added here
    if (!isLoggedIn()) {
      throw redirect({ to: "/login" })
    }
  },
  head: () => ({
    meta: [{ title: "用户管理 - Manifest" }],
  }),
})

function UsersSettingsPage() {
  return <UsersManager />
}
