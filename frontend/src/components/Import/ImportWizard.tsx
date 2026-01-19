import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  FileSpreadsheet,
  Loader2,
  Settings,
  Upload,
} from "lucide-react"
import { useCallback, useState } from "react"
import type {
  CSVPreviewResponse,
  ImportTaskPublic,
  MinIOInstancePublic,
} from "@/client"
import { MinioInstancesService, SamplesService } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Step = 1 | 2 | 3 | 4

interface StepIndicatorProps {
  step: Step
  currentStep: Step
  label: string
  icon: React.ReactNode
}

function StepIndicator({ step, currentStep, label, icon }: StepIndicatorProps) {
  const isActive = currentStep === step
  const isCompleted = currentStep > step

  return (
    <div
      data-testid={`import-step-${step}`}
      data-active={isActive.toString()}
      data-completed={isCompleted.toString()}
      className={`flex items-center gap-2 ${
        isActive
          ? "text-primary"
          : isCompleted
            ? "text-green-500"
            : "text-muted-foreground"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
          isActive
            ? "border-primary bg-primary/10"
            : isCompleted
              ? "border-green-500 bg-green-500/10"
              : "border-muted-foreground"
        }`}
      >
        {isCompleted ? <CheckCircle className="w-4 h-4" /> : icon}
      </div>
      <span className="hidden sm:inline font-medium">{label}</span>
    </div>
  )
}

export default function ImportWizard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Step state
  const [currentStep, setCurrentStep] = useState<Step>(1)

  // Step 1: File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  // Step 2: Preview data
  const [previewData, setPreviewData] = useState<CSVPreviewResponse | null>(
    null,
  )

  // Step 3: Configuration
  const [minioInstanceId, setMinioInstanceId] = useState<string>("")
  const [bucket, setBucket] = useState<string>("")
  const [validateFiles, setValidateFiles] = useState<boolean>(false)

  // Step 4: Import result
  const [importTask, setImportTask] = useState<ImportTaskPublic | null>(null)

  // Fetch MinIO instances
  const { data: minioInstances, isLoading: loadingInstances } = useQuery({
    queryKey: ["minio-instances"],
    queryFn: () => MinioInstancesService.readMinioInstances({}),
  })

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      return SamplesService.previewImportCsv({
        formData: { file },
      })
    },
    onSuccess: (data) => {
      setPreviewData(data)
      setCurrentStep(2)
    },
    onError: (error: Error) => {
      setFileError(error.message || "CSV 预览失败")
    },
  })

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !minioInstanceId || !bucket) {
        throw new Error("缺少必填字段")
      }
      return SamplesService.importSamples({
        formData: {
          file: selectedFile,
          minio_instance_id: minioInstanceId,
          bucket,
          validate_files: validateFiles,
        },
      })
    },
    onSuccess: (data) => {
      setImportTask(data)
      setCurrentStep(4)
      queryClient.invalidateQueries({ queryKey: ["samples"] })
      queryClient.invalidateQueries({ queryKey: ["import-tasks"] })
    },
    onError: (error: Error) => {
      setFileError(error.message || "导入启动失败")
    },
  })

  // File selection handler
  const handleFileSelect = useCallback((file: File | null) => {
    setFileError(null)

    if (!file) {
      setSelectedFile(null)
      return
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileError("请选择 CSV 文件")
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
  }, [])

  // File drop handler
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()

      const files = e.dataTransfer.files
      if (files.length > 0) {
        handleFileSelect(files[0])
      }
    },
    [handleFileSelect],
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // Navigation handlers
  const handleNext = () => {
    if (currentStep === 1 && selectedFile) {
      previewMutation.mutate(selectedFile)
    } else if (currentStep === 2) {
      setCurrentStep(3)
    } else if (currentStep === 3) {
      importMutation.mutate()
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step)
    }
  }

  const handleReset = () => {
    setCurrentStep(1)
    setSelectedFile(null)
    setFileError(null)
    setPreviewData(null)
    setMinioInstanceId("")
    setBucket("")
    setValidateFiles(false)
    setImportTask(null)
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedFile !== null && !fileError
      case 2:
        return previewData !== null
      case 3:
        return minioInstanceId !== "" && bucket !== ""
      default:
        return false
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6" />从 CSV 导入样本
          </CardTitle>
          <CardDescription>
            从包含对象键和可选标签的 CSV 文件导入样本
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Step indicators */}
          <div className="flex justify-between items-center mb-8 pb-4 border-b">
            <StepIndicator
              step={1}
              currentStep={currentStep}
              label="上传"
              icon={<Upload className="w-4 h-4" />}
            />
            <div className="flex-1 h-0.5 bg-muted mx-2" />
            <StepIndicator
              step={2}
              currentStep={currentStep}
              label="预览"
              icon={<FileSpreadsheet className="w-4 h-4" />}
            />
            <div className="flex-1 h-0.5 bg-muted mx-2" />
            <StepIndicator
              step={3}
              currentStep={currentStep}
              label="配置"
              icon={<Settings className="w-4 h-4" />}
            />
            <div className="flex-1 h-0.5 bg-muted mx-2" />
            <StepIndicator
              step={4}
              currentStep={currentStep}
              label="完成"
              icon={<CheckCircle className="w-4 h-4" />}
            />
          </div>

          {/* Step 1: File Upload */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div
                data-testid="file-upload-dropzone"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  selectedFile
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg mb-2">拖放 CSV 文件到此处</p>
                <p className="text-sm text-muted-foreground mb-4">
                  或点击浏览选择文件
                </p>
                <Input
                  data-testid="file-input"
                  type="file"
                  accept=".csv"
                  onChange={(e) =>
                    handleFileSelect(e.target.files?.[0] || null)
                  }
                  className="max-w-xs mx-auto"
                />
              </div>

              {selectedFile && (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{selectedFile.name}</span>
                  <Badge variant="secondary">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </Badge>
                </div>
              )}

              {fileError && (
                <div className="flex items-center justify-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{fileError}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Preview */}
          {currentStep === 2 && previewData && (
            <div className="space-y-6">
              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p
                      className="text-2xl font-bold"
                      data-testid="preview-total-rows"
                    >
                      {previewData.total_rows}
                    </p>
                    <p className="text-sm text-muted-foreground">总行数</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p
                      className="text-2xl font-bold"
                      data-testid="preview-image-count"
                    >
                      {previewData.image_count}
                    </p>
                    <p className="text-sm text-muted-foreground">图片</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p
                      className="text-2xl font-bold"
                      data-testid="preview-annotation-count"
                    >
                      {previewData.annotation_count}
                    </p>
                    <p className="text-sm text-muted-foreground">标注</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p
                      className="text-lg font-bold"
                      data-testid="preview-has-tags"
                    >
                      {previewData.has_tags_column ? "是" : "否"}
                    </p>
                    <p className="text-sm text-muted-foreground">包含标签</p>
                  </CardContent>
                </Card>
              </div>

              {/* Columns */}
              <div>
                <h4 className="font-medium mb-2">检测到的列</h4>
                <div className="flex flex-wrap gap-2">
                  {previewData.columns.map((col) => (
                    <Badge key={col} variant="outline">
                      {col}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Sample Rows */}
              <div>
                <h4 className="font-medium mb-2">示例数据（前 5 行）</h4>
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {previewData.columns.map((col) => (
                          <TableHead key={col}>{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.sample_rows.map((row, idx) => (
                        <TableRow key={idx}>
                          {previewData.columns.map((col) => (
                            <TableCell key={col} className="max-w-xs truncate">
                              {String(row[col] ?? "")}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Configure */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="minio-instance">MinIO 实例</Label>
                  <Select
                    value={minioInstanceId}
                    onValueChange={setMinioInstanceId}
                    disabled={loadingInstances || !minioInstances?.data?.length}
                  >
                    <SelectTrigger data-testid="minio-instance-select">
                      <SelectValue
                        placeholder={
                          loadingInstances
                            ? "加载中..."
                            : minioInstances?.data?.length
                              ? "选择 MinIO 实例"
                              : "未配置 MinIO 实例"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {minioInstances?.data?.map(
                        (instance: MinIOInstancePublic) => (
                          <SelectItem key={instance.id} value={instance.id}>
                            {instance.name} ({instance.endpoint})
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bucket">存储桶名称</Label>
                  <Input
                    id="bucket"
                    data-testid="bucket-input"
                    value={bucket}
                    onChange={(e) => setBucket(e.target.value)}
                    placeholder="my-bucket"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="validate-files"
                    data-testid="validate-files-checkbox"
                    checked={validateFiles}
                    onCheckedChange={setValidateFiles}
                  />
                  <Label htmlFor="validate-files">
                    验证文件是否存在于 MinIO（较慢但更安全）
                  </Label>
                </div>
              </div>

              {fileError && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{fileError}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Complete */}
          {currentStep === 4 && importTask && (
            <div className="space-y-6" data-testid="import-progress">
              <div className="text-center">
                {importTask.status === "completed" ? (
                  <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                ) : importTask.status === "failed" ? (
                  <AlertCircle className="w-16 h-16 mx-auto text-destructive mb-4" />
                ) : (
                  <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin mb-4" />
                )}
                <h3
                  className="text-xl font-semibold"
                  data-testid="import-status"
                >
                  {importTask.status === "completed"
                    ? "导入完成"
                    : importTask.status === "failed"
                      ? "导入失败"
                      : "导入进行中"}
                </h3>
              </div>

              {/* Results */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-green-500">
                      {importTask.created}
                    </p>
                    <p className="text-sm text-muted-foreground">已创建</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-500">
                      {importTask.skipped}
                    </p>
                    <p className="text-sm text-muted-foreground">已跳过</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-destructive">
                      {importTask.errors}
                    </p>
                    <p className="text-sm text-muted-foreground">错误</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-500">
                      {importTask.annotations_linked}
                    </p>
                    <p className="text-sm text-muted-foreground">标注</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-purple-500">
                      {importTask.tags_created}
                    </p>
                    <p className="text-sm text-muted-foreground">创建的标签</p>
                  </CardContent>
                </Card>
              </div>

              {/* Error details */}
              {importTask.error_details &&
                importTask.error_details.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">错误详情</h4>
                    <div className="bg-destructive/10 rounded-lg p-4 max-h-48 overflow-auto">
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {importTask.error_details
                          .slice(0, 10)
                          .map((error, idx) => (
                            <li key={idx} className="text-destructive">
                              {String(error)}
                            </li>
                          ))}
                        {importTask.error_details.length > 10 && (
                          <li className="text-muted-foreground">
                            ... 还有 {importTask.error_details.length - 10}{" "}
                            个错误
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}

              {/* Actions */}
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={handleReset}>
                  导入其他文件
                </Button>
                <Button onClick={() => navigate({ to: "/samples" })}>
                  查看样本
                </Button>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          {currentStep < 4 && (
            <div className="flex justify-between mt-8 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                上一步
              </Button>
              <Button
                onClick={handleNext}
                disabled={
                  !canProceed() ||
                  previewMutation.isPending ||
                  importMutation.isPending
                }
              >
                {previewMutation.isPending || importMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : currentStep === 3 ? (
                  <>
                    开始导入
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    下一步
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
