import {
  Activity,
  Database,
  Eye,
  Filter,
  FolderOpen,
  Hammer,
  Server,
  Tags,
  Upload,
  Users,
} from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { type NavItem, SidebarNavGroup } from "./SidebarNavGroup"
import { User } from "./User"

const workbenchItems: NavItem[] = [
  { icon: Upload, title: "样本入库", path: "/import" },
  { icon: Hammer, title: "数据集构建", path: "/build" },
  { icon: Activity, title: "运维中心", path: "/ops" },
]

const browseItems: NavItem[] = [
  { icon: FolderOpen, title: "样本浏览", path: "/samples" },
  { icon: Database, title: "数据集浏览", path: "/datasets" },
]

const configItems: NavItem[] = [
  { icon: Tags, title: "标签管理", path: "/settings/tags" },
  { icon: Filter, title: "分类规则", path: "/settings/tagging-rules" },
  { icon: Server, title: "MinIO 实例", path: "/settings/minio" },
  { icon: Eye, title: "监控路径", path: "/settings/watched-paths" },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()

  const adminItems: NavItem[] = currentUser?.is_superuser
    ? [{ icon: Users, title: "用户管理", path: "/settings/users" }]
    : []

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarNavGroup label="工作台" items={workbenchItems} />
        <SidebarNavGroup label="浏览" items={browseItems} />
        <SidebarSeparator />
        <SidebarNavGroup label="配置" items={[...configItems, ...adminItems]} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
