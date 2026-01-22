import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

import TagGroupSelector from "./TagGroupSelector"

interface Props {
  value: string[][] // [[tagA, tagB], [tagC]] = (A AND B) OR C
  onChange: (value: string[][]) => void
}

export default function DNFTagFilter({ value, onChange }: Props) {
  const handleGroupChange = (groupIndex: number, tagIds: string[]) => {
    const newValue = [...value]
    newValue[groupIndex] = tagIds
    onChange(newValue)
  }

  const handleAddGroup = () => {
    onChange([...value, []])
  }

  const handleRemoveGroup = (groupIndex: number) => {
    onChange(value.filter((_, i) => i !== groupIndex))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>标签筛选</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddGroup}
        >
          <Plus className="mr-1 h-4 w-4" />
          添加标签组
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          未设置标签筛选条件，将包含所有样本
        </p>
      ) : (
        <div className="space-y-3">
          {value.map((group, index) => (
            <div key={index} className="relative">
              {index > 0 && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 bg-background text-xs text-muted-foreground">
                  或
                </div>
              )}
              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    标签组 {index + 1}
                    {group.length > 1 && (
                      <span className="ml-1">(需全部匹配)</span>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveGroup(index)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <TagGroupSelector
                  selectedTagIds={group}
                  onChange={(tagIds) => handleGroupChange(index, tagIds)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          组内标签为 AND 关系（全部匹配），组间为 OR 关系（任一匹配）
        </p>
      )}
    </div>
  )
}
