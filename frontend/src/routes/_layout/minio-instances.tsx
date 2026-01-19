// frontend/src/routes/_layout/minio-instances.tsx
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/minio-instances")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/minio" })
  },
  component: () => null,
})
