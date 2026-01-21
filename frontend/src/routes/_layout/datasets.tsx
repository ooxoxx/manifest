import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/datasets")({
  component: DatasetsLayout,
})

function DatasetsLayout() {
  return <Outlet />
}
