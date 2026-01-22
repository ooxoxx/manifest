import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { ApiError, UsersService } from "@/client"
import { Footer } from "@/components/Common/Footer"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    // Check if token exists first
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }

    // Validate token with backend
    try {
      await UsersService.readUserMe()
    } catch (error) {
      // Token is invalid, clear it and redirect to login
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        localStorage.removeItem("access_token")
        throw redirect({
          to: "/login",
        })
      }
      // Re-throw other errors (e.g., network errors) to let error boundary handle them
      throw error
    }
  },
})

function Layout() {
  return (
    <SidebarProvider>
      {/* Scan line effect */}
      <div className="scan-line hidden dark:block" />

      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-border/50 backdrop-blur-sm bg-background/80 px-4">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-primary transition-colors" />

          {/* Header accent line */}
          <div className="flex-1 flex items-center justify-end gap-3">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              <span className="hidden md:inline tracking-wider uppercase">
                System Active
              </span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 md:p-8 relative">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
