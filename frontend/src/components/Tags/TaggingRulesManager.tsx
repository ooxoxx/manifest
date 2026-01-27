import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Filter,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  Zap,
} from "lucide-react"
import { Suspense, useState } from "react"

import {
  type TaggingRulePublic,
  TaggingRulesService,
  TagsService,
} from "@/client"
import { PendingComponent } from "@/components/Pending/PendingComponent"
import AddTaggingRule from "@/components/Tags/AddTaggingRule"
import RulePreviewDialog from "@/components/Tags/RulePreviewDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import useCustomToast from "@/hooks/useCustomToast"
import { getRuleTypeLabel } from "@/lib/ruleTypes"

function RuleCard({
  rule,
  onEdit,
  onPreview,
}: {
  rule: TaggingRulePublic
  onEdit: (rule: TaggingRulePublic) => void
  onPreview: (rule: TaggingRulePublic) => void
}) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  // Fetch tags to display names
  const { data: tagsData } = useSuspenseQuery({
    queryKey: ["tags"],
    queryFn: () => TagsService.readTags(),
  })

  const tags = tagsData?.data ?? []
  const ruleTags = rule.tag_ids
    .map((id) => tags.find((t) => t.id === id))
    .filter(Boolean)

  const toggleMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      TaggingRulesService.updateTaggingRule({
        id: rule.id,
        requestBody: { is_active: isActive },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tagging-rules"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => TaggingRulesService.deleteTaggingRule({ id: rule.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tagging-rules"] })
      showSuccessToast("规则已删除")
    },
    onError: () => {
      showErrorToast("删除失败")
    },
  })

  const executeMutation = useMutation({
    mutationFn: () =>
      TaggingRulesService.executeTaggingRule({ id: rule.id, dryRun: false }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["samples"] })
      showSuccessToast(
        `执行完成: 匹配 ${result.matched} 个样本，新打标 ${result.tagged} 个，跳过 ${result.skipped} 个`,
      )
    },
    onError: () => {
      showErrorToast("执行失败")
    },
  })

  return (
    <Card className={!rule.is_active ? "opacity-60" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-medium truncate">{rule.name}</h3>
              {rule.auto_execute && (
                <Badge variant="secondary" className="shrink-0">
                  <Zap className="h-3 w-3 mr-1" />
                  自动
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                {getRuleTypeLabel(rule.rule_type)}
              </span>
              <span className="mx-2">:</span>
              <code className="text-xs">{rule.pattern}</code>
            </div>
            {rule.description && (
              <p className="text-sm text-muted-foreground mb-2">
                {rule.description}
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              {ruleTags.map((tag) => (
                <Badge key={tag!.id} variant="outline" className="text-xs">
                  {tag!.name}
                </Badge>
              ))}
              {ruleTags.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  无关联标签
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={rule.is_active}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={toggleMutation.isPending}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onPreview(rule)}>
                  <Search className="h-4 w-4 mr-2" />
                  预览匹配
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => executeMutation.mutate()}
                  disabled={executeMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  执行规则
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onEdit(rule)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RulesContent({ onAddClick }: { onAddClick: () => void }) {
  const [editingRule, setEditingRule] = useState<TaggingRulePublic | null>(null)
  const [previewRule, setPreviewRule] = useState<TaggingRulePublic | null>(null)

  const { data } = useSuspenseQuery({
    queryKey: ["tagging-rules"],
    queryFn: () => TaggingRulesService.readTaggingRules({}),
  })

  const rules = data?.data ?? []

  return (
    <>
      {rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Filter className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无分类规则</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              创建规则来自动为样本打标签
            </p>
            <Button onClick={onAddClick}>
              <Plus className="h-4 w-4 mr-2" />
              新建规则
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={setEditingRule}
              onPreview={setPreviewRule}
            />
          ))}
        </div>
      )}

      <AddTaggingRule
        open={!!editingRule}
        onOpenChange={(open) => !open && setEditingRule(null)}
        editingRule={editingRule}
      />

      <RulePreviewDialog
        rule={previewRule}
        open={!!previewRule}
        onOpenChange={(open) => !open && setPreviewRule(null)}
      />
    </>
  )
}

export default function TaggingRulesManager() {
  const [isAddOpen, setIsAddOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
          <Filter className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
            配置
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              分类规则
            </h1>
            <p className="text-muted-foreground mt-2">
              定义规则自动为样本打标签，支持手动执行或新样本入库时自动执行
            </p>
          </div>
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建规则
          </Button>
        </div>
      </div>

      <Suspense fallback={<PendingComponent />}>
        <RulesContent onAddClick={() => setIsAddOpen(true)} />
      </Suspense>

      <AddTaggingRule open={isAddOpen} onOpenChange={setIsAddOpen} />
    </div>
  )
}
