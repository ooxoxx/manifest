import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, Loader2, Search } from "lucide-react"
import { useState } from "react"
import { DatasetsService, type FilterParams } from "@/client"
import FilterPanel from "@/components/Datasets/Build/FilterPanel"
import SamplingConfig, {
  type SamplingValues,
} from "@/components/Datasets/Build/SamplingConfig"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AddSamplesResponse {
  result: {
    added_count: number
  }
}

export const Route = createFileRoute("/_layout/datasets/$datasetId/add-samples")(
  {
    component: AddSamplesToDataset,
  }
)

function AddSamplesToDataset() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { datasetId } = Route.useParams()

  const [filters, setFilters] = useState<FilterParams>({})
  const [sampling, setSampling] = useState<SamplingValues>({ mode: "all" })

  // Fetch dataset info
  const { data: dataset } = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => DatasetsService.readDataset({ id: datasetId }),
  })

  // Preview query - response has { count: number, samples: unknown[] }
  const {
    data: preview,
    isLoading: isPreviewLoading,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: ["filter-preview", filters],
    queryFn: async () => {
      const result = await DatasetsService.filterPreview({ requestBody: filters })
      return result as { count: number; samples: unknown[] }
    },
    enabled: false,
  })

  // Add samples mutation
  const addMutation = useMutation({
    mutationFn: async () => {
      const result = await DatasetsService.addFilteredSamplesToDataset({
        datasetId,
        requestBody: { filters, sampling },
      })
      return result as unknown as AddSamplesResponse
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] })
      queryClient.invalidateQueries({ queryKey: ["dataset", datasetId] })
      alert(`成功添加 ${data.result.added_count} 个样本`)
      navigate({ to: "/datasets" })
    },
  })

  const handlePreview = () => {
    refetchPreview()
  }

  const handleAdd = () => {
    addMutation.mutate()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/datasets" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            添加样本到数据集
          </h1>
          <p className="text-muted-foreground">
            {dataset ? (
              <>
                数据集: <span className="font-medium">{dataset.name}</span>
                {" · "}当前样本数: {dataset.sample_count}
              </>
            ) : (
              "加载中..."
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
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
                    找到{" "}
                    <span className="text-primary">{preview.count}</span>{" "}
                    个匹配样本
                  </p>
                  <p className="text-xs text-muted-foreground">
                    已添加的样本将自动排除
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
                onClick={handleAdd}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {addMutation.isPending ? "添加中..." : "添加样本"}
              </Button>

              {addMutation.error && (
                <p className="text-sm text-destructive">
                  添加失败: {addMutation.error.message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
