import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, Loader2, Search } from "lucide-react"
import { useState } from "react"
import FilterPanel, {
  type FilterValues,
} from "@/components/Datasets/Build/FilterPanel"
import SamplingConfig, {
  type SamplingValues,
} from "@/components/Datasets/Build/SamplingConfig"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export const Route = createFileRoute("/_layout/datasets/build")({
  component: DatasetBuildWizard,
})

function DatasetBuildWizard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [filters, setFilters] = useState<FilterValues>({})
  const [sampling, setSampling] = useState<SamplingValues>({ mode: "all" })

  // Preview query
  const {
    data: preview,
    isLoading: isPreviewLoading,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: ["filter-preview", filters],
    queryFn: async () => {
      const response = await fetch("/api/v1/datasets/filter-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify(filters),
      })
      if (!response.ok) throw new Error("Failed to preview")
      return response.json()
    },
    enabled: false,
  })

  // Build mutation
  const buildMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/v1/datasets/build", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          name,
          description: description || undefined,
          filters,
          sampling,
        }),
      })
      if (!response.ok) throw new Error("Failed to build dataset")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] })
      navigate({ to: "/datasets" })
    },
  })

  const handlePreview = () => {
    refetchPreview()
  }

  const handleBuild = () => {
    if (!name.trim()) {
      alert("请输入数据集名称")
      return
    }
    buildMutation.mutate()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/datasets" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">构建数据集</h1>
          <p className="text-muted-foreground">
            使用筛选条件和采样策略创建新数据集
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {/* Dataset Info */}
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

          {/* Filter Panel */}
          <FilterPanel value={filters} onChange={setFilters} />
        </div>

        <div className="space-y-6">
          {/* Sampling Config */}
          <SamplingConfig
            value={sampling}
            onChange={setSampling}
            availableCount={preview?.count}
          />

          {/* Preview & Actions */}
          <Card>
            <CardHeader>
              <CardTitle>预览与操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={handlePreview}
                disabled={isPreviewLoading}
              >
                {isPreviewLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                预览匹配样本
              </Button>

              {preview && (
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm font-medium">
                    找到 <span className="text-primary">{preview.count}</span> 个匹配样本
                  </p>
                  {sampling.mode === "random" && sampling.count && (
                    <p className="text-sm text-muted-foreground">
                      将随机选择 {Math.min(sampling.count, preview.count)} 个
                    </p>
                  )}
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleBuild}
                disabled={buildMutation.isPending || !name.trim()}
              >
                {buildMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {buildMutation.isPending ? "构建中..." : "构建数据集"}
              </Button>

              {buildMutation.error && (
                <p className="text-sm text-destructive">
                  构建失败: {buildMutation.error.message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
