import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { useState } from "react"

import { type TagPublic, TagsService } from "@/client"
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
import { TAG_CATEGORIES, type TagCategoryKey } from "@/lib/tagCategories"
import { cn } from "@/lib/utils"

interface Props {
  selectedTagIds: string[]
  onChange: (tagIds: string[]) => void
}

export default function TagGroupSelector({ selectedTagIds, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const { data: tagsData } = useQuery({
    queryKey: ["tags"],
    queryFn: () => TagsService.readTags(),
  })

  const tags = tagsData?.data ?? []

  // Build full path for display
  const getFullPath = (tag: TagPublic): string => {
    const parts: string[] = [tag.name]
    let currentParentId = tag.parent_id
    while (currentParentId) {
      const parent = tags.find((t) => t.id === currentParentId)
      if (parent) {
        parts.unshift(parent.name)
        currentParentId = parent.parent_id
      } else {
        break
      }
    }
    return parts.join(" / ")
  }

  // Group tags by category
  const getTagsByCategory = (category: TagCategoryKey): TagPublic[] =>
    tags.filter((t) => t.category === category)

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id))

  const handleSelect = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedTagIds, tagId])
    }
  }

  const handleRemove = (tagId: string) => {
    onChange(selectedTagIds.filter((id) => id !== tagId))
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedTagIds.length > 0
              ? `已选择 ${selectedTagIds.length} 个标签`
              : "选择标签..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="搜索标签..." />
            <CommandList>
              <CommandEmpty>未找到标签</CommandEmpty>

              {TAG_CATEGORIES.map((category) => {
                const categoryTags = getTagsByCategory(category.key)
                if (categoryTags.length === 0) return null

                return (
                  <CommandGroup key={category.key} heading={category.label}>
                    {categoryTags.map((tag) => (
                      <CommandItem
                        key={tag.id}
                        value={`${category.key}:${getFullPath(tag)}`}
                        onSelect={() => handleSelect(tag.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedTagIds.includes(tag.id)
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        <span className="truncate">{getFullPath(tag)}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="gap-1">
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemove(tag.id)}
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
