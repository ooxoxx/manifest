// frontend/src/components/Admin/UsersManager.tsx
import { useSuspenseQuery } from "@tanstack/react-query"
import { Users } from "lucide-react"
import { Suspense } from "react"

import { type UserPublic, UsersService } from "@/client"
import AddUser from "@/components/Admin/AddUser"
import { columns, type UserTableData } from "@/components/Admin/columns"
import { DataTable } from "@/components/Common/DataTable"
import { PendingComponent } from "@/components/Pending/PendingComponent"
import useAuth from "@/hooks/useAuth"

function UsersTableContent() {
  const { user: currentUser } = useAuth()
  const { data } = useSuspenseQuery({
    queryKey: ["users"],
    queryFn: () => UsersService.readUsers(),
  })

  const tableData: UserTableData[] = (data?.data ?? []).map((user: UserPublic) => ({
    ...user,
    isCurrentUser: currentUser?.id === user.id,
  }))

  return <DataTable columns={columns} data={tableData} />
}

export default function UsersManager() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
          <Users className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
            配置
          </span>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              用户管理
            </h1>
            <p className="text-muted-foreground mt-2">
              管理系统用户和权限
            </p>
          </div>
          <AddUser />
        </div>
      </div>

      <Suspense fallback={<PendingComponent />}>
        <div className="terminal-border bg-card/30 backdrop-blur-sm rounded-lg overflow-hidden">
          <UsersTableContent />
        </div>
      </Suspense>
    </div>
  )
}
