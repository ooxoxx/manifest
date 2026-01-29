// frontend/src/components/WatchedPaths/AddWatchedPath.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  type MinIOInstancePublic,
  MinioInstancesService,
  WatchedPathsService,
} from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BucketBrowser } from "@/components/WatchedPaths/BucketBrowser"
import { cn } from "@/lib/utils"

interface AddWatchedPathProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 1 | 2 | 3

const steps = [
  { number: 1, title: "选择实例" },
  { number: 2, title: "选择目录" },
  { number: 3, title: "确认配置" },
]

export function AddWatchedPath({ open, onOpenChange }: AddWatchedPathProps) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>(1)
  const [selectedInstance, setSelectedInstance] =
    useState<MinIOInstancePublic | null>(null)
  const [selectedBucket, setSelectedBucket] = useState("")
  const [selectedPrefix, setSelectedPrefix] = useState("")
  const [description, setDescription] = useState("")

  // Fetch MinIO instances
  const { data: instancesData, isLoading: instancesLoading } = useQuery({
    queryKey: ["minio-instances"],
    queryFn: () => MinioInstancesService.readMinioInstances(),
    enabled: open,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: () =>
      WatchedPathsService.createWatchedPath({
        requestBody: {
          minio_instance_id: selectedInstance!.id,
          bucket: selectedBucket,
          prefix: selectedPrefix,
          description: description || undefined,
          is_active: true,
        },
      }),
    onSuccess: () => {
      toast.success("监控路径创建成功")
      queryClient.invalidateQueries({ queryKey: ["watched-paths"] })
      handleClose()
    },
    onError: (error: Error) => {
      toast.error(`创建失败: ${error.message}`)
    },
  })

  const handleClose = () => {
    setStep(1)
    setSelectedInstance(null)
    setSelectedBucket("")
    setSelectedPrefix("")
    setDescription("")
    onOpenChange(false)
  }

  const handleInstanceSelect = (instanceId: string) => {
    const instance = instancesData?.data.find((i) => i.id === instanceId)
    if (instance) {
      setSelectedInstance(instance)
    }
  }

  const handlePathSelect = (bucket: string, prefix: string) => {
    setSelectedBucket(bucket)
    setSelectedPrefix(prefix)
    setStep(3)
  }

  const handleCreate = () => {
    createMutation.mutate()
  }

  const canProceedToStep2 = selectedInstance !== null
  const canProceedToStep3 = selectedBucket !== ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>添加监控路径</DialogTitle>
          <DialogDescription>
            选择要监控的 MinIO bucket 目录，系统将自动跟踪该目录下的文件变化
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          {steps.map((s, index) => (
            <div key={s.number} className="flex items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
                  step >= s.number
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {step > s.number ? <Check className="h-4 w-4" /> : s.number}
              </div>
              <span
                className={cn(
                  "ml-2 text-sm",
                  step >= s.number
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {s.title}
              </span>
              {index < steps.length - 1 && (
                <ChevronRight className="mx-4 h-4 w-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[300px]">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>选择 MinIO 实例</Label>
                {instancesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Select
                    value={selectedInstance?.id || ""}
                    onValueChange={handleInstanceSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择一个 MinIO 实例" />
                    </SelectTrigger>
                    <SelectContent>
                      {instancesData?.data.map((instance) => (
                        <SelectItem key={instance.id} value={instance.id}>
                          <div className="flex items-center gap-2">
                            <span>{instance.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({instance.endpoint})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedInstance && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">实例名称: </span>
                    <span className="font-medium">{selectedInstance.name}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">端点: </span>
                    <span className="font-mono text-xs">
                      {selectedInstance.endpoint}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && selectedInstance && (
            <div className="space-y-4">
              <Label>浏览并选择目录</Label>
              <BucketBrowser
                instanceId={selectedInstance.id}
                selectedBucket={selectedBucket}
                selectedPrefix={selectedPrefix}
                onSelect={handlePathSelect}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">MinIO 实例: </span>
                  <span className="font-medium">{selectedInstance?.name}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">监控路径: </span>
                  <span className="font-mono">
                    {selectedBucket}/{selectedPrefix}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">描述 (可选)</Label>
                <Input
                  id="description"
                  placeholder="为这个监控路径添加描述..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  创建后，系统将自动配置 MinIO bucket notification，
                  实时跟踪该目录下的文件变化。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              if (step === 1) {
                handleClose()
              } else {
                setStep((step - 1) as Step)
              }
            }}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            {step === 1 ? "取消" : "上一步"}
          </Button>

          {step < 3 ? (
            <Button
              onClick={() => setStep((step + 1) as Step)}
              disabled={step === 1 ? !canProceedToStep2 : !canProceedToStep3}
            >
              下一步
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                "创建监控路径"
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
