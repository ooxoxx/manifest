// Tag category configuration for consistent UI display
import { Briefcase, Settings, User } from "lucide-react"

export const TAG_CATEGORIES = [
  {
    key: "system" as const,
    label: "系统标签",
    icon: Settings,
    description: "样本状态、来源系统等系统管理的标签",
    badgeStyle:
      "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  {
    key: "business" as const,
    label: "业务标签",
    icon: Briefcase,
    description: "业务领域、场景类型等分类标签",
    badgeStyle:
      "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  {
    key: "user" as const,
    label: "用户标签",
    icon: User,
    description: "自定义标签",
    badgeStyle:
      "border-gray-500 bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
] as const

export type TagCategoryKey = (typeof TAG_CATEGORIES)[number]["key"]

export function getCategoryConfig(category: TagCategoryKey | undefined) {
  return TAG_CATEGORIES.find((c) => c.key === category) ?? TAG_CATEGORIES[2] // default to user
}

export function getCategoryBadgeStyle(category: TagCategoryKey | undefined) {
  return getCategoryConfig(category).badgeStyle
}
