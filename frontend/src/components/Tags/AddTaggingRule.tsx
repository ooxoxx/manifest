import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Suspense } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { type TaggingRulePublic, TaggingRulesService } from "@/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import TagSelector from "./TagSelector"

const formSchema = z.object({
  name: z.string().min(1, "请输入规则名称"),
  description: z.string().optional(),
  pattern: z.string().min(1, "请输入匹配模式"),
  tag_ids: z.array(z.string()).min(1, "请至少选择一个标签"),
  is_active: z.boolean(),
  auto_execute: z.boolean(),
})

type FormData = z.infer<typeof formSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingRule?: TaggingRulePublic | null
}

function AddTaggingRuleForm({
  onOpenChange,
  editingRule,
}: Omit<Props, "open">) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: editingRule
      ? {
          name: editingRule.name,
          description: editingRule.description ?? "",
          pattern: editingRule.pattern,
          tag_ids: editingRule.tag_ids,
          is_active: editingRule.is_active,
          auto_execute: editingRule.auto_execute,
        }
      : {
          name: "",
          description: "",
          pattern: "",
          tag_ids: [],
          is_active: true,
          auto_execute: false,
        },
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      TaggingRulesService.createTaggingRule({
        requestBody: {
          name: data.name,
          description: data.description || undefined,
          pattern: data.pattern,
          tag_ids: data.tag_ids,
          is_active: data.is_active,
          auto_execute: data.auto_execute,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tagging-rules"] })
      showSuccessToast("规则创建成功")
      onOpenChange(false)
      form.reset()
    },
    onError: () => {
      showErrorToast("创建失败")
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      TaggingRulesService.updateTaggingRule({
        id: editingRule!.id,
        requestBody: {
          name: data.name,
          description: data.description || undefined,
          pattern: data.pattern,
          tag_ids: data.tag_ids,
          is_active: data.is_active,
          auto_execute: data.auto_execute,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tagging-rules"] })
      showSuccessToast("规则更新成功")
      onOpenChange(false)
    },
    onError: () => {
      showErrorToast("更新失败")
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const onSubmit = (data: FormData) => {
    if (editingRule) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>规则名称</FormLabel>
              <FormControl>
                <Input placeholder="如: 训练集图片标签" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>描述</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="可选，描述规则用途"
                  className="resize-none"
                  rows={2}
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="pattern"
          render={({ field }) => (
            <FormItem>
              <FormLabel>匹配模式</FormLabel>
              <FormControl>
                <Input placeholder="test-bucket/train/.*\.jpg$" {...field} />
              </FormControl>
              <FormDescription>
                正则表达式匹配全路径: bucket/path/filename.ext
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tag_ids"
          render={({ field }) => (
            <FormItem>
              <FormLabel>应用标签</FormLabel>
              <FormControl>
                <TagSelector
                  selectedIds={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormDescription>选择匹配后要应用的标签</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="auto_execute"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>自动执行</FormLabel>
                <FormDescription>新样本入库时自动应用此规则</FormDescription>
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending
            ? editingRule
              ? "更新中..."
              : "创建中..."
            : editingRule
              ? "更新规则"
              : "创建规则"}
        </Button>
      </form>
    </Form>
  )
}

export default function AddTaggingRule({
  open,
  onOpenChange,
  editingRule,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingRule ? "编辑规则" : "新建分类规则"}</DialogTitle>
          <DialogDescription>
            {editingRule ? "修改规则配置" : "定义匹配条件和要应用的标签"}
          </DialogDescription>
        </DialogHeader>
        <Suspense fallback={<div className="py-8 text-center">加载中...</div>}>
          <AddTaggingRuleForm
            onOpenChange={onOpenChange}
            editingRule={editingRule}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  )
}
