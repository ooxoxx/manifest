// frontend/src/components/Datasets/Build/DatasetBuildWizard.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  Check,
  ClipboardList,
  Filter,
  Hammer,
  Loader2,
  Search,
  Settings,
} from "lucide-react"
import { useState } from "react"

import { DatasetsService, type FilterParams } from "@/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import FilterPanel from "./FilterPanel"
import SamplingConfig, { type SamplingValues } from "./SamplingConfig"

type Step = 1 | 2 | 3 | 4 | 5

const steps = [
  { step: 1 as Step, label: "基本信息", icon: ClipboardList },
  { step: 2 as Step, label: "筛选条件", icon: Filter },
  { step: 3 as Step, label: "采样配比", icon: Settings },
  { step: 4 as Step, label: "预览审核", icon: Search },
  { step: 5 as Step, label: "确认生成", icon: Check },
]

export default function DatasetBuildWizard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [filters, setFilters] = useState<FilterParams>({
    annotation_status: "linked",
  })
  const [sampling, setSampling] = useState<SamplingValues>({ mode: "all" })

  // Preview query
  const {
    data: preview,
    isLoading: isPreviewLoading,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: ["filter-preview", filters],
    queryFn: async () => {
      const result = await DatasetsService.filterPreview({
        requestBody: filters,
      })
      return result as { count: number; samples: unknown[] }
    },
    enabled: false,
  })

  // Build mutation
  const buildMutation = useMutation({
    mutationFn: () =>
      DatasetsService.buildNewDataset({
        requestBody: {
          name,
          description: description || undefined,
          filters,
          sampling,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] })
      navigate({ to: "/datasets" })
    },
  })

  const canProceed = (step: Step): boolean => {
    switch (step) {
      case 1:
        return name.trim().length > 0
      case 2:
        return true // Filters are optional
      case 3:
        return true // Sampling has default
      case 4:
        return preview !== undefined
      case 5:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (currentStep < 5 && canProceed(currentStep)) {
      if (currentStep === 3) {
        refetchPreview()
      }
      setCurrentStep((s) => (s + 1) as Step)
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => (s - 1) as Step)
    }
  }

  const handleBuild = () => {
    buildMutation.mutate()
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>数据集信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>名称 *</Label>
                <Input
                  placeholder="输入数据集名称"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>描述</Label>
                <Textarea
                  placeholder="可选描述"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )

      case 2:
        return <FilterPanel value={filters} onChange={setFilters} />

      case 3:
        return (
          <SamplingConfig
            value={sampling}
            onChange={setSampling}
            availableCount={preview?.count}
            filters={filters}
          />
        )

      case 4:
        return (
          <Card>
            <CardHeader>
              <CardTitle>预览结果</CardTitle>
            </CardHeader>
            <CardContent>
              {isPreviewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : preview ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-lg font-medium">
                      找到 <span className="text-primary">{preview.count}</span>{" "}
                      个匹配样本
                    </p>
                    {sampling.mode === "random" && sampling.count && (
                      <p className="text-sm text-muted-foreground mt-1">
                        将随机选择 {Math.min(sampling.count, preview.count)} 个
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    点击"下一步"确认创建数据集
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  正在加载预览...
                </p>
              )}
            </CardContent>
          </Card>
        )

      case 5:
        return (
          <Card>
            <CardHeader>
              <CardTitle>确认创建</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">数据集名称</p>
                <p className="font-medium">{name}</p>
              </div>
              {description && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">描述</p>
                  <p className="font-medium">{description}</p>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">样本数量</p>
                <p className="font-medium">{preview?.count ?? 0}</p>
              </div>
              <Button
                className="w-full"
                onClick={handleBuild}
                disabled={buildMutation.isPending}
              >
                {buildMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Hammer className="mr-2 h-4 w-4" />
                )}
                {buildMutation.isPending ? "构建中..." : "确认构建"}
              </Button>
              {buildMutation.error && (
                <p className="text-sm text-destructive">
                  构建失败: {buildMutation.error.message}
                </p>
              )}
            </CardContent>
          </Card>
        )
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
          <Hammer className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
            数据集构建
          </span>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              构建数据集
            </h1>
            <p className="text-muted-foreground mt-2">
              使用筛选条件和采样策略创建新数据集
            </p>
          </div>
          <span className="text-sm font-mono text-muted-foreground">
            步骤 {currentStep}/5
          </span>
        </div>
      </div>

      {/* Wizard Layout */}
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Left: Step Navigation */}
        <Card className="h-fit">
          <CardContent className="p-4">
            <div className="space-y-2">
              {steps.map(({ step, label, icon: Icon }) => {
                const isActive = currentStep === step
                const isCompleted = currentStep > step

                return (
                  <button
                    key={step}
                    type="button"
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                          ? "text-green-500"
                          : "text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => step < currentStep && setCurrentStep(step)}
                    disabled={step > currentStep}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                        isActive
                          ? "border-primary-foreground"
                          : isCompleted
                            ? "border-green-500 bg-green-500/10"
                            : "border-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Icon className="w-3 h-3" />
                      )}
                    </div>
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right: Step Content */}
        <div className="space-y-4">
          {renderStepContent()}

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentStep === 1}
            >
              上一步
            </Button>
            {currentStep < 5 && (
              <Button onClick={handleNext} disabled={!canProceed(currentStep)}>
                下一步
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
