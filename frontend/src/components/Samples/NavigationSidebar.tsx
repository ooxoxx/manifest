import { ChevronLeft, ChevronRight, FolderTree, Tags } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

import { BusinessTagTree } from "./BusinessTagTree"
import { StoragePathTree } from "./StoragePathTree"

interface NavigationSidebarProps {
  selectedStoragePath?: string | null
  selectedBusinessTagId?: string | null
  onStoragePathSelect?: (path: string | null) => void
  onBusinessTagSelect?: (tagId: string | null) => void
}

export function NavigationSidebar({
  selectedStoragePath,
  selectedBusinessTagId,
  onStoragePathSelect,
  onBusinessTagSelect,
}: NavigationSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [businessTagsOpen, setBusinessTagsOpen] = useState(true)
  const [storagePathOpen, setStoragePathOpen] = useState(true)

  return (
    <div
      data-testid="navigation-sidebar"
      className={cn(
        "h-full border-r bg-card/30 backdrop-blur-sm transition-all duration-300",
        isOpen ? "w-64" : "w-10",
      )}
    >
      {/* Toggle button */}
      <div className="flex justify-end p-1 border-b">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="sidebar-toggle"
        >
          {isOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {isOpen && (
        <div className="overflow-y-auto h-[calc(100%-41px)]">
          {/* Business Tags Tree */}
          <Collapsible
            open={businessTagsOpen}
            onOpenChange={setBusinessTagsOpen}
          >
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50 border-b">
                <Tags className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium flex-1">业务标签</span>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform",
                    businessTagsOpen && "rotate-90",
                  )}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <BusinessTagTree
                selectedTagId={selectedBusinessTagId}
                onSelect={onBusinessTagSelect}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Storage Path Tree */}
          <Collapsible open={storagePathOpen} onOpenChange={setStoragePathOpen}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50 border-b">
                <FolderTree className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium flex-1">存储路径</span>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform",
                    storagePathOpen && "rotate-90",
                  )}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <StoragePathTree
                selectedPath={selectedStoragePath}
                onSelect={onStoragePathSelect}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  )
}
