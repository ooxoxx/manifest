import { useQuery } from "@tanstack/react-query"
import { FileIcon, ImageIcon, TagIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

import { type BboxObject, ImageWithBbox } from "./ImageWithBbox"

// Response types matching backend SamplePreviewResponse
interface SamplePreviewAnnotation {
  objects: BboxObject[] | null
  class_counts: Record<string, number> | null
  image_width: number | null
  image_height: number | null
}

interface TagPublic {
  id: string
  name: string
  color: string | null
  parent_id: string | null
}

interface SamplePublic {
  id: string
  object_key: string
  bucket: string
  file_name: string
  file_size: number
  content_type: string | null
  status: string
  source: string
  created_at: string
  annotation_status: string
}

interface SamplePreviewResponse {
  presigned_url: string
  expires_in: number
  annotation: SamplePreviewAnnotation | null
  tags: TagPublic[]
  sample: SamplePublic
}

interface SampleViewerProps {
  sampleId: string
  className?: string
}

// Helper function to fetch sample preview
async function fetchSamplePreview(
  sampleId: string,
): Promise<SamplePreviewResponse> {
  const response = await fetch(`/api/v1/samples/${sampleId}/preview`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("access_token")}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch sample preview: ${response.statusText}`)
  }

  return response.json()
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString()
}

// Generate consistent color for a class based on its index
function getClassBadgeColor(className: string, allClasses: string[]): string {
  const index = allClasses.indexOf(className)
  const hue = allClasses.length > 0 ? (index * 360) / allClasses.length : 0
  return `hsl(${hue}, 70%, 50%)`
}

export function SampleViewer({ sampleId, className = "" }: SampleViewerProps) {
  const {
    data: preview,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["sample-preview", sampleId],
    queryFn: () => fetchSamplePreview(sampleId),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  })

  if (isLoading) {
    return (
      <div className={`flex h-full flex-col ${className}`}>
        <div className="flex-1">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="border-t p-4">
          <Skeleton className="mb-2 h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
    )
  }

  if (error || !preview) {
    return (
      <div className={`flex h-full items-center justify-center ${className}`}>
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">
              {error instanceof Error ? error.message : "Failed to load sample"}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { presigned_url, annotation, tags, sample } = preview
  const allClasses = annotation?.class_counts
    ? Object.keys(annotation.class_counts)
    : []

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* Image with bboxes */}
      <div className="flex-1 min-h-0">
        <ImageWithBbox
          imageUrl={presigned_url}
          objects={annotation?.objects || []}
          imageWidth={annotation?.image_width || undefined}
          imageHeight={annotation?.image_height || undefined}
          showLabels={true}
        />
      </div>

      {/* Metadata panel */}
      <div className="border-t bg-card p-4 space-y-3">
        {/* File info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <FileIcon className="h-4 w-4" />
            <span>{sample.file_name}</span>
          </div>
          <span>{formatBytes(sample.file_size)}</span>
          <span>{sample.content_type || "unknown"}</span>
        </div>

        {/* Class counts */}
        {annotation?.class_counts &&
          Object.keys(annotation.class_counts).length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              {Object.entries(annotation.class_counts).map(
                ([className, count]) => (
                  <Badge
                    key={className}
                    variant="secondary"
                    style={{
                      backgroundColor: getClassBadgeColor(
                        className,
                        allClasses,
                      ),
                      color: "#fff",
                    }}
                  >
                    {className} ({count})
                  </Badge>
                ),
              )}
            </div>
          )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <TagIcon className="h-4 w-4 text-muted-foreground" />
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                style={
                  tag.color
                    ? { borderColor: tag.color, color: tag.color }
                    : undefined
                }
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Additional info */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Bucket: {sample.bucket}</span>
          <span>Created: {formatDate(sample.created_at)}</span>
          <Badge
            variant={
              sample.annotation_status === "linked" ? "default" : "secondary"
            }
          >
            {sample.annotation_status === "linked"
              ? "Has Annotation"
              : "No Annotation"}
          </Badge>
        </div>
      </div>
    </div>
  )
}
