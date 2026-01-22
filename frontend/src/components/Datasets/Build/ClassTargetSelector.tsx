import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, Minus, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import { DatasetsService, type FilterParams } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface Props {
  filters: FilterParams
  value: Record<string, number>
  onChange: (value: Record<string, number>) => void
}

export default function ClassTargetSelector({
  filters,
  value,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false)

  const { data: classStats, isLoading } = useQuery({
    queryKey: ["filter-class-stats", filters],
    queryFn: () =>
      DatasetsService.filterClassStats({
        requestBody: filters,
      }),
  })

  const classes = classStats?.classes ?? []
  const selectedClasses = Object.keys(value)

  const handleSelectClass = (className: string) => {
    if (selectedClasses.includes(className)) {
      // Remove class
      const newValue = { ...value }
      delete newValue[className]
      onChange(newValue)
    } else {
      // Add class with default target = available count
      const classStat = classes.find((c) => c.name === className)
      onChange({
        ...value,
        [className]: classStat?.count ?? 0,
      })
    }
    setOpen(false)
  }

  const handleTargetChange = (className: string, target: number) => {
    const classStat = classes.find((c) => c.name === className)
    const maxCount = classStat?.count ?? 0
    const clampedTarget = Math.max(0, Math.min(target, maxCount))
    onChange({
      ...value,
      [className]: clampedTarget,
    })
  }

  const handleRemoveClass = (className: string) => {
    const newValue = { ...value }
    delete newValue[className]
    onChange(newValue)
  }

  const getAvailableCount = (className: string): number => {
    const classStat = classes.find((c) => c.name === className)
    return classStat?.count ?? 0
  }

  return (
    <div className="space-y-4">
      {/* Class Selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={isLoading}
          >
            {isLoading ? "加载类别中..." : "选择目标类别..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="搜索类别..." />
            <CommandList>
              <CommandEmpty>未找到类别</CommandEmpty>
              <CommandGroup>
                {classes.map((cls) => (
                  <CommandItem
                    key={cls.name}
                    value={cls.name}
                    onSelect={() => handleSelectClass(cls.name)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedClasses.includes(cls.name)
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <span className="flex-1">{cls.name}</span>
                    <span className="text-muted-foreground">
                      ({cls.count.toLocaleString()})
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected Classes Table */}
      {selectedClasses.length > 0 && (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>类别名称</TableHead>
                <TableHead className="text-right">可用数量</TableHead>
                <TableHead className="text-right">目标数量</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedClasses.map((className) => {
                const available = getAvailableCount(className)
                const target = value[className] ?? 0

                return (
                  <TableRow key={className}>
                    <TableCell className="font-medium">{className}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {available.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() =>
                            handleTargetChange(className, target - 100)
                          }
                          disabled={target <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          max={available}
                          value={target}
                          onChange={(e) =>
                            handleTargetChange(
                              className,
                              Number.parseInt(e.target.value, 10) || 0,
                            )
                          }
                          className="h-8 w-24 text-right"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() =>
                            handleTargetChange(className, target + 100)
                          }
                          disabled={target >= available}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveClass(className)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary */}
      {classStats && (
        <p className="text-xs text-muted-foreground">
          筛选范围内共 {classStats.total_samples.toLocaleString()} 个样本，
          {classStats.total_objects.toLocaleString()} 个目标对象
        </p>
      )}
    </div>
  )
}
