// Rule type configuration for consistent UI display
import type { TaggingRuleType } from "@/client"

export interface RuleTypeConfig {
  key: TaggingRuleType
  label: string
  description: string
  placeholder: string
  helpText: string
}

export const RULE_TYPES: RuleTypeConfig[] = [
  {
    key: "regex_filename",
    label: "文件名正则",
    description: "使用正则表达式匹配文件名",
    placeholder: "^IMG_\\d{8}.*\\.jpg$",
    helpText: "示例: ^IMG_\\d{8} 匹配以 IMG_ 开头后跟8位数字的文件名",
  },
  {
    key: "regex_path",
    label: "路径正则",
    description: "使用正则表达式匹配完整路径",
    placeholder: "^train/images/.*",
    helpText: "示例: ^train/.* 匹配 train/ 目录下所有文件",
  },
  {
    key: "file_extension",
    label: "扩展名",
    description: "匹配文件扩展名",
    placeholder: "png",
    helpText: "输入扩展名（不含点），如: png, jpg, jpeg",
  },
  {
    key: "bucket",
    label: "桶名",
    description: "匹配指定的存储桶",
    placeholder: "training-data",
    helpText: "输入完整的桶名称",
  },
  {
    key: "content_type",
    label: "MIME类型",
    description: "匹配文件的 MIME 类型",
    placeholder: "image/jpeg",
    helpText: "示例: image/jpeg, image/png, application/pdf",
  },
]

export function getRuleTypeConfig(type: TaggingRuleType): RuleTypeConfig {
  return RULE_TYPES.find((r) => r.key === type) ?? RULE_TYPES[0]
}

export function getRuleTypeLabel(type: TaggingRuleType): string {
  return getRuleTypeConfig(type).label
}
