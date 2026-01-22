import type { FilterParams } from "@/client"
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

import ClassTargetSelector from "./ClassTargetSelector"

export type SamplingMode = "all" | "random" | "class_targets"

export interface SamplingValues {
  mode: SamplingMode
  count?: number
  seed?: number
  class_targets?: Record<string, number>
}

interface Props {
  value: SamplingValues
  onChange: (value: SamplingValues) => void
  availableCount?: number
  filters: FilterParams
}

export default function SamplingConfig({
  value,
  onChange,
  availableCount,
  filters,
}: Props) {
  const handleModeChange = (mode: SamplingMode) => {
    onChange({
      ...value,
      mode,
      count: mode === "random" ? value.count || 100 : undefined,
      class_targets:
        mode === "class_targets" ? value.class_targets || {} : undefined,
    })
  }

  const handleCountChange = (count: number) => {
    onChange({ ...value, count })
  }

  const handleSeedChange = (seed: number | undefined) => {
    onChange({ ...value, seed })
  }

  const handleClassTargetsChange = (classTargets: Record<string, number>) => {
    onChange({ ...value, class_targets: classTargets })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>采样配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>采样模式</Label>
          <Select value={value.mode} onValueChange={handleModeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部 - 添加所有匹配样本</SelectItem>
              <SelectItem value="random">
                随机采样 - 随机选择指定数量
              </SelectItem>
              <SelectItem value="class_targets">
                类别目标 - 按类别数量采样
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {value.mode === "all" && availableCount !== undefined && (
          <div className="text-sm text-muted-foreground">
            将添加全部 {availableCount} 个匹配样本
          </div>
        )}

        {value.mode === "random" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>采样数量</Label>
              <Input
                type="number"
                min={1}
                max={availableCount}
                value={value.count || ""}
                onChange={(e) => handleCountChange(Number(e.target.value))}
                placeholder="输入数量"
              />
              {availableCount !== undefined && (
                <p className="text-xs text-muted-foreground">
                  可用: {availableCount} 个样本
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>随机种子 (可选)</Label>
              <Input
                type="number"
                value={value.seed ?? ""}
                onChange={(e) =>
                  handleSeedChange(
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="留空使用随机"
              />
              <p className="text-xs text-muted-foreground">
                相同种子产生相同结果
              </p>
            </div>
          </div>
        )}

        {value.mode === "class_targets" && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              类别目标采样: 系统将智能选择样本以满足每个类别的目标数量。
            </div>
            <ClassTargetSelector
              filters={filters}
              value={value.class_targets || {}}
              onChange={handleClassTargetsChange}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
