import { useSuspenseQuery } from "@tanstack/react-query"
import { Check, X } from "lucide-react"
import { useState } from "react"

import { TagsService } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { TAG_CATEGORIES } from "@/lib/tagCategories"

interface Props {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export default function TagSelector({ selectedIds, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const { data } = useSuspenseQuery({
    queryKey: ["tags"],
    queryFn: () => TagsService.readTags(),
  })

  const tags = data?.data ?? []

  // Group tags by category (exclude system tags from selection)
  const selectableTags = tags.filter((t) => t.category !== "system")

  const selectedTags = selectedIds
    .map((id) => tags.find((t) => t.id === id))
    .filter(Boolean)

  const toggleTag = (tagId: string) => {
    if (selectedIds.includes(tagId)) {
      onChange(selectedIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedIds, tagId])
    }
  }

  const removeTag = (tagId: string) => {
    onChange(selectedIds.filter((id) => id !== tagId))
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
          >
            {selectedIds.length > 0
              ? `已选择 ${selectedIds.length} 个标签`
              : "选择标签..."}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="搜索标签..." />
            <CommandList>
              <CommandEmpty>未找到标签</CommandEmpty>
              {TAG_CATEGORIES.filter((c) => c.key !== "system").map(
                (category) => {
                  const categoryTags = selectableTags.filter(
                    (t) => t.category === category.key,
                  )
                  if (categoryTags.length === 0) return null

                  return (
                    <CommandGroup key={category.key} heading={category.label}>
                      {categoryTags.map((tag) => (
                        <CommandItem
                          key={tag.id}
                          value={tag.name}
                          onSelect={() => toggleTag(tag.id)}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <Check
                              className={`h-4 w-4 ${
                                selectedIds.includes(tag.id)
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                            <span className="truncate">{tag.name}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )
                },
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <Badge key={tag!.id} variant="secondary" className="gap-1">
              {tag!.name}
              <button
                type="button"
                onClick={() => removeTag(tag!.id)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
