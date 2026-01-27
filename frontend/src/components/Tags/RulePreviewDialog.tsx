import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Play } from "lucide-react"

import { type TaggingRulePublic, TaggingRulesService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import useCustomToast from "@/hooks/useCustomToast"
import { getRuleTypeLabel } from "@/lib/ruleTypes"

interface Props {
  rule: TaggingRulePublic | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function RulePreviewDialog({ rule, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const { data, isLoading } = useQuery({
    queryKey: ["tagging-rule-preview", rule?.id],
    queryFn: () =>
      TaggingRulesService.previewTaggingRule({ id: rule!.id, limit: 20 }),
    enabled: !!rule && open,
  })

  const executeMutation = useMutation({
    mutationFn: () =>
      TaggingRulesService.executeTaggingRule({ id: rule!.id, dryRun: false }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["samples"] })
      showSuccessToast(
        `执行完成: 匹配 ${result.matched} 个，新打标 ${result.tagged} 个，跳过 ${result.skipped} 个`,
      )
      onOpenChange(false)
    },
    onError: () => {
      showErrorToast("执行失败")
    },
  })

  if (!rule) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>预览匹配结果</DialogTitle>
          <DialogDescription>
            规则: {rule.name} ({getRuleTypeLabel(rule.rule_type)}:{" "}
            {rule.pattern})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              加载中...
            </div>
          ) : data ? (
            <>
              <div className="text-sm">
                匹配样本数: <strong>{data.total_matched}</strong>
              </div>

              {data.samples.length > 0 ? (
                <div className="border rounded-md max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>文件名</TableHead>
                        <TableHead>路径</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.samples.map((sample) => (
                        <TableRow key={sample.id}>
                          <TableCell className="font-mono text-xs">
                            {sample.file_name}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[300px]">
                            {sample.object_key}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground border rounded-md">
                  没有匹配的样本
                </div>
              )}

              {data.total_matched > 0 && (
                <Button
                  onClick={() => executeMutation.mutate()}
                  disabled={executeMutation.isPending}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {executeMutation.isPending
                    ? "执行中..."
                    : `执行规则 (${data.total_matched} 个样本)`}
                </Button>
              )}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
