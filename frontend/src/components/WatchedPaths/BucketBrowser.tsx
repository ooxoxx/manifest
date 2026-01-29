// frontend/src/components/WatchedPaths/BucketBrowser.tsx
import { useQuery } from "@tanstack/react-query"
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Loader2,
} from "lucide-react"
import { useState } from "react"

import { MinioInstancesService } from "@/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface BucketBrowserProps {
  instanceId: string
  selectedBucket?: string
  selectedPrefix?: string
  onSelect: (bucket: string, prefix: string) => void
}

interface FolderNodeProps {
  instanceId: string
  bucket: string
  prefix: string
  name: string
  level: number
  selectedPrefix: string
  onSelect: (prefix: string) => void
}

function FolderNode({
  instanceId,
  bucket,
  prefix,
  name,
  level,
  selectedPrefix,
  onSelect,
}: FolderNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const isSelected = selectedPrefix === prefix

  const { data, isLoading } = useQuery({
    queryKey: ["bucket-objects", instanceId, bucket, prefix],
    queryFn: () =>
      MinioInstancesService.listBucketObjects({
        id: instanceId,
        bucket,
        prefix,
      }),
    enabled: expanded,
  })

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(!expanded)
  }

  const handleSelect = () => {
    onSelect(prefix)
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer",
          "hover:bg-accent/50 transition-colors",
          isSelected && "bg-accent text-accent-foreground",
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleSelect}
      >
        <button
          type="button"
          className="p-0.5 rounded hover:bg-accent"
          onClick={handleToggle}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {expanded ? (
          <FolderOpen className="h-4 w-4 text-amber-500" />
        ) : (
          <Folder className="h-4 w-4 text-amber-500" />
        )}

        <span className="flex-1 truncate text-sm">{name}</span>
      </div>

      {expanded && data && (
        <div>
          {data.folders.map((folderPath) => {
            const folderName = folderPath.slice(prefix.length).replace(/\/$/, "")
            return (
              <FolderNode
                key={folderPath}
                instanceId={instanceId}
                bucket={bucket}
                prefix={folderPath}
                name={folderName}
                level={level + 1}
                selectedPrefix={selectedPrefix}
                onSelect={onSelect}
              />
            )
          })}
          {data.objects.slice(0, 5).map((obj) => (
            <div
              key={obj.key}
              className="flex items-center gap-1 py-1 px-2 text-muted-foreground"
              style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
            >
              <div className="w-5" />
              <File className="h-4 w-4" />
              <span className="flex-1 truncate text-sm">{obj.name}</span>
              {obj.size && (
                <span className="text-xs">
                  {(obj.size / 1024).toFixed(1)} KB
                </span>
              )}
            </div>
          ))}
          {data.objects.length > 5 && (
            <div
              className="py-1 px-2 text-xs text-muted-foreground"
              style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
            >
              ... 还有 {data.objects.length - 5} 个文件
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function BucketBrowser({
  instanceId,
  selectedBucket,
  selectedPrefix = "",
  onSelect,
}: BucketBrowserProps) {
  const [currentBucket, setCurrentBucket] = useState(selectedBucket || "")
  const [currentPrefix, setCurrentPrefix] = useState(selectedPrefix)

  // Fetch buckets
  const { data: bucketsData, isLoading: bucketsLoading } = useQuery({
    queryKey: ["minio-buckets", instanceId],
    queryFn: () => MinioInstancesService.listMinioBuckets({ id: instanceId }),
    enabled: !!instanceId,
  })

  // Fetch root objects when bucket is selected
  const { data: rootData, isLoading: rootLoading } = useQuery({
    queryKey: ["bucket-objects", instanceId, currentBucket, ""],
    queryFn: () =>
      MinioInstancesService.listBucketObjects({
        id: instanceId,
        bucket: currentBucket,
        prefix: "",
      }),
    enabled: !!currentBucket,
  })

  const handleBucketSelect = (bucket: string) => {
    setCurrentBucket(bucket)
    setCurrentPrefix("")
  }

  const handlePrefixSelect = (prefix: string) => {
    setCurrentPrefix(prefix)
  }

  const handleConfirm = () => {
    onSelect(currentBucket, currentPrefix)
  }

  if (!instanceId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        请先选择 MinIO 实例
      </div>
    )
  }

  return (
    <div className="border rounded-lg">
      {/* Breadcrumb */}
      <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">路径:</span>
        {currentBucket ? (
          <>
            <button
              type="button"
              className="hover:underline text-primary"
              onClick={() => {
                setCurrentBucket("")
                setCurrentPrefix("")
              }}
            >
              /
            </button>
            <span>/</span>
            <span className="font-medium">{currentBucket}</span>
            {currentPrefix && (
              <>
                <span>/</span>
                <span className="text-muted-foreground">{currentPrefix}</span>
              </>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">/</span>
        )}
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-auto">
        {bucketsLoading || rootLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !currentBucket ? (
          // Show bucket list
          <div className="py-2">
            {bucketsData?.buckets?.map((bucket) => (
              <div
                key={bucket}
                className={cn(
                  "flex items-center gap-2 py-2 px-3 cursor-pointer",
                  "hover:bg-accent/50 transition-colors",
                )}
                onClick={() => handleBucketSelect(bucket)}
              >
                <Folder className="h-4 w-4 text-amber-500" />
                <span className="text-sm">{bucket}</span>
              </div>
            ))}
            {(!bucketsData?.buckets || bucketsData.buckets.length === 0) && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                没有可用的 bucket
              </div>
            )}
          </div>
        ) : (
          // Show folder tree
          <div className="py-2">
            {/* Root selection option */}
            <div
              className={cn(
                "flex items-center gap-2 py-1.5 px-3 cursor-pointer",
                "hover:bg-accent/50 transition-colors",
                currentPrefix === "" && "bg-accent text-accent-foreground",
              )}
              onClick={() => handlePrefixSelect("")}
            >
              <FolderOpen className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">{currentBucket}/</span>
              <span className="text-xs text-muted-foreground">(根目录)</span>
            </div>

            {rootData?.folders.map((folderPath) => {
              const folderName = folderPath.replace(/\/$/, "")
              return (
                <FolderNode
                  key={folderPath}
                  instanceId={instanceId}
                  bucket={currentBucket}
                  prefix={folderPath}
                  name={folderName}
                  level={0}
                  selectedPrefix={currentPrefix}
                  onSelect={handlePrefixSelect}
                />
              )
            })}

            {rootData?.objects.slice(0, 3).map((obj) => (
              <div
                key={obj.key}
                className="flex items-center gap-2 py-1 px-3 text-muted-foreground"
              >
                <div className="w-5" />
                <File className="h-4 w-4" />
                <span className="flex-1 truncate text-sm">{obj.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t bg-muted/30 flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {currentBucket
            ? `${currentBucket}/${currentPrefix}`
            : "请选择 bucket"}
        </span>
        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={!currentBucket}
        >
          确认选择
        </Button>
      </div>
    </div>
  )
}
