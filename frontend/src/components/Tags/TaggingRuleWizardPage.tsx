import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  X,
} from "lucide-react"
import { Suspense, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  type PatternPreviewResult,
  type SamplePublic,
  TaggingRulesService,
} from "@/client"
import { SampleViewer } from "@/components/Samples/SampleViewer"
import TagSelector from "@/components/Tags/TagSelector"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
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
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"

// Form schema for the wizard
const wizardSchema = z.object({
  pattern: z.string().min(1, "请输入匹配模式"),
  tag_ids: z.array(z.string()).min(1, "请至少选择一个标签"),
  name: z.string().min(1, "请输入规则名称"),
  description: z.string().optional(),
  auto_execute: z.boolean(),
  execute_immediately: z.boolean(),
})

type WizardFormData = z.infer<typeof wizardSchema>

const STEPS = [
  { id: 1, title: "匹配模式", description: "定义规则和预览样本" },
  { id: 2, title: "选择标签", description: "选择要应用的标签" },
  { id: 3, title: "确认信息", description: "填写规则名称并确认" },
  { id: 4, title: "执行结果", description: "查看执行进度" },
]

// Step indicator component
function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number
  totalSteps: number
}) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.slice(0, totalSteps).map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
              currentStep > step.id
                ? "bg-primary text-primary-foreground"
                : currentStep === step.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
          </div>
          {index < totalSteps - 1 && (
            <div
              className={cn(
                "h-0.5 w-8 mx-1",
                currentStep > step.id ? "bg-primary" : "bg-muted",
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// Sample preview card for the grid
function SamplePreviewCard({
  sample,
  onClick,
}: {
  sample: SamplePublic
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="aspect-square rounded border overflow-hidden hover:ring-2 hover:ring-primary transition-all bg-muted"
    >
      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-1 text-center break-all">
        {sample.file_name}
      </div>
    </button>
  )
}

// Step 1: Pattern & Preview
function Step1PatternPreview({
  form,
  previewQuery,
  previewPage,
  setPreviewPage,
  totalPages,
  selectedSampleId,
  setSelectedSampleId,
}: {
  form: ReturnType<typeof useForm<WizardFormData>>
  previewQuery: ReturnType<typeof useQuery<PatternPreviewResult>>
  previewPage: number
  setPreviewPage: (page: number) => void
  totalPages: number
  selectedSampleId: string | null
  setSelectedSampleId: (id: string | null) => void
}) {
  return (
    <div className="flex-1 overflow-auto space-y-4">
      {/* Pattern input */}
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

      <p className="text-xs text-muted-foreground">
        示例: <code className="bg-muted px-1 rounded">.*\.jpg$</code> 匹配所有
        JPG 文件, <code className="bg-muted px-1 rounded">^test-bucket/.*</code>{" "}
        匹配 test-bucket 桶中所有文件
      </p>

      {/* Preview section */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">预览匹配样本</span>
          </div>
          {previewQuery.data && (
            <Badge variant="secondary">
              共 {previewQuery.data.total_matched} 个匹配
            </Badge>
          )}
        </div>

        {previewQuery.isLoading && (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded" />
            ))}
          </div>
        )}

        {previewQuery.isError && (
          <div className="text-center py-8 text-destructive">
            预览失败，请检查匹配模式是否正确
          </div>
        )}

        {previewQuery.data && previewQuery.data.samples.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            没有匹配的样本
          </div>
        )}

        {previewQuery.data && previewQuery.data.samples.length > 0 && (
          <>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {previewQuery.data.samples.map((sample) => (
                <SamplePreviewCard
                  key={sample.id}
                  sample={sample}
                  onClick={() => setSelectedSampleId(sample.id)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewPage(Math.max(0, previewPage - 1))}
                  disabled={previewPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {previewPage + 1} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPreviewPage(Math.min(totalPages - 1, previewPage + 1))
                  }
                  disabled={previewPage >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sample viewer dialog */}
      <Dialog
        open={!!selectedSampleId}
        onOpenChange={() => setSelectedSampleId(null)}
      >
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>样本详情</DialogTitle>
          </DialogHeader>
          {selectedSampleId && (
            <div className="flex-1 min-h-0">
              <SampleViewer sampleId={selectedSampleId} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Step 2: Tag Selection
function Step2TagSelection({
  form,
  matchedCount,
}: {
  form: ReturnType<typeof useForm<WizardFormData>>
  matchedCount: number
}) {
  return (
    <div className="flex-1 overflow-auto space-y-4">
      <div className="bg-muted/50 rounded-lg p-4 mb-4">
        <p className="text-sm">
          将为 <span className="font-bold">{matchedCount}</span>{" "}
          个匹配样本应用标签
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-10 w-full" />}>
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
      </Suspense>
    </div>
  )
}

// Step 3: Confirmation
function Step3Confirmation({
  form,
  matchedCount,
  tagCount,
}: {
  form: ReturnType<typeof useForm<WizardFormData>>
  matchedCount: number
  tagCount: number
}) {
  return (
    <div className="flex-1 overflow-auto space-y-4">
      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-sm">
          将为 <span className="font-bold">{matchedCount}</span> 个样本应用{" "}
          <span className="font-bold">{tagCount}</span> 个标签
        </p>
      </div>

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

      <FormField
        control={form.control}
        name="execute_immediately"
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <div className="space-y-1 leading-none">
              <FormLabel>立即执行一次</FormLabel>
              <FormDescription>
                创建规则后立即对现有匹配样本执行打标签
              </FormDescription>
            </div>
          </FormItem>
        )}
      />
    </div>
  )
}

// Step 4: Execution Result
function Step4ExecutionResult({
  result,
  onClose,
}: {
  result: { matched: number; tagged: number; skipped: number }
  onClose: () => void
}) {
  const total = result.tagged + result.skipped
  const progress = total > 0 ? 100 : 0

  return (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 py-8">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-center">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <h3 className="text-lg font-medium text-center">执行完成</h3>

        <Progress value={progress} className="w-full" />

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{result.matched}</div>
            <div className="text-xs text-muted-foreground">匹配样本</div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {result.tagged}
            </div>
            <div className="text-xs text-muted-foreground">新打标签</div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-muted-foreground">
              {result.skipped}
            </div>
            <div className="text-xs text-muted-foreground">已跳过</div>
          </div>
        </div>
      </div>

      <Button onClick={onClose}>完成</Button>
    </div>
  )
}

export default function TaggingRuleWizardPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [previewPage, setPreviewPage] = useState(0)
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null)
  const [executionResult, setExecutionResult] = useState<{
    matched: number
    tagged: number
    skipped: number
  } | null>(null)

  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      pattern: "",
      tag_ids: [],
      name: "",
      description: "",
      auto_execute: false,
      execute_immediately: true,
    },
  })

  const pattern = form.watch("pattern")
  const tagIds = form.watch("tag_ids")

  // Preview query
  const previewQuery = useQuery({
    queryKey: ["pattern-preview", pattern, previewPage],
    queryFn: () =>
      TaggingRulesService.previewPatternEndpoint({
        requestBody: { pattern },
        skip: previewPage * 12,
        limit: 12,
      }),
    enabled: pattern.length > 0 && currentStep === 1,
    staleTime: 30000,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: WizardFormData) =>
      TaggingRulesService.createTaggingRule({
        requestBody: {
          name: data.name,
          description: data.description || undefined,
          pattern: data.pattern,
          tag_ids: data.tag_ids,
          is_active: true,
          auto_execute: data.auto_execute,
        },
        executeImmediately: data.execute_immediately,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["tagging-rules"] })
      queryClient.invalidateQueries({ queryKey: ["samples"] })
      if (result.execution_result) {
        setExecutionResult(result.execution_result)
        setCurrentStep(4)
      } else {
        showSuccessToast("规则创建成功")
        navigate({ to: "/settings/tagging-rules" })
      }
    },
    onError: () => {
      showErrorToast("创建失败")
    },
  })

  const handleCancel = () => {
    navigate({ to: "/settings/tagging-rules" })
  }

  const handleNext = async () => {
    if (currentStep === 1) {
      const valid = await form.trigger(["pattern"])
      if (valid) setCurrentStep(2)
    } else if (currentStep === 2) {
      const valid = await form.trigger(["tag_ids"])
      if (valid) setCurrentStep(3)
    } else if (currentStep === 3) {
      const valid = await form.trigger(["name"])
      if (valid) {
        createMutation.mutate(form.getValues())
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 1 && currentStep < 4) {
      setCurrentStep(currentStep - 1)
    }
  }

  const totalPages = previewQuery.data
    ? Math.ceil(previewQuery.data.total_matched / 12)
    : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">新建分类规则</h1>
          <p className="text-muted-foreground mt-1">
            {STEPS[currentStep - 1]?.description}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <StepIndicator
        currentStep={currentStep}
        totalSteps={currentStep === 4 ? 4 : 3}
      />

      <Form {...form}>
        <form className="flex-1 overflow-hidden flex flex-col">
          {/* Step 1: Pattern & Preview */}
          {currentStep === 1 && (
            <Step1PatternPreview
              form={form}
              previewQuery={previewQuery}
              previewPage={previewPage}
              setPreviewPage={setPreviewPage}
              totalPages={totalPages}
              selectedSampleId={selectedSampleId}
              setSelectedSampleId={setSelectedSampleId}
            />
          )}

          {/* Step 2: Tag Selection */}
          {currentStep === 2 && (
            <Step2TagSelection
              form={form}
              matchedCount={previewQuery.data?.total_matched ?? 0}
            />
          )}

          {/* Step 3: Confirmation */}
          {currentStep === 3 && (
            <Step3Confirmation
              form={form}
              matchedCount={previewQuery.data?.total_matched ?? 0}
              tagCount={tagIds.length}
            />
          )}

          {/* Step 4: Execution Result */}
          {currentStep === 4 && executionResult && (
            <Step4ExecutionResult
              result={executionResult}
              onClose={handleCancel}
            />
          )}
        </form>
      </Form>

      {/* Navigation buttons */}
      {currentStep < 4 && (
        <div className="flex justify-between pt-4 border-t">
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              取消
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              上一步
            </Button>
          </div>
          <Button
            type="button"
            onClick={handleNext}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                创建中...
              </>
            ) : currentStep === 3 ? (
              "创建规则"
            ) : (
              <>
                下一步
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
