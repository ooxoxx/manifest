import { useQuery } from "@tanstack/react-query"
import {
  type AnnotationStatus,
  type FilterParams,
  MinioInstancesService,
} from "@/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Props {
  value: FilterParams
  onChange: (value: FilterParams) => void
}

export default function FilterPanel({ value, onChange }: Props) {
  const { data: minioInstances } = useQuery({
    queryKey: ["minio-instances"],
    queryFn: () => MinioInstancesService.readMinioInstances(),
  })

  const handleChange = (field: keyof FilterParams, newValue: string) => {
    onChange({
      ...value,
      [field]: newValue || undefined,
    })
  }

  const handleAnnotationStatusChange = (newValue: string) => {
    onChange({
      ...value,
      annotation_status:
        newValue && newValue !== "all"
          ? (newValue as AnnotationStatus)
          : undefined,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>筛选条件</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>MinIO 实例</Label>
            <Select
              value={value.minio_instance_id || ""}
              onValueChange={(v) => handleChange("minio_instance_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择 MinIO 实例" />
              </SelectTrigger>
              <SelectContent>
                {minioInstances?.data?.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Bucket</Label>
            <Input
              placeholder="输入 bucket 名称"
              value={value.bucket || ""}
              onChange={(e) => handleChange("bucket", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>对象前缀</Label>
          <Input
            placeholder="例如: images/train/"
            value={value.prefix || ""}
            onChange={(e) => handleChange("prefix", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>开始日期</Label>
            <Input
              type="date"
              value={value.date_from || ""}
              onChange={(e) => handleChange("date_from", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>结束日期</Label>
            <Input
              type="date"
              value={value.date_to || ""}
              onChange={(e) => handleChange("date_to", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>标注状态</Label>
          <Select
            value={value.annotation_status || ""}
            onValueChange={handleAnnotationStatusChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="none">无标注</SelectItem>
              <SelectItem value="linked">已关联</SelectItem>
              <SelectItem value="conflict">冲突</SelectItem>
              <SelectItem value="error">错误</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
