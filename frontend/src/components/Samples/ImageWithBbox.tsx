import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"

export interface BboxObject {
  class: string
  xmin: number
  ymin: number
  xmax: number
  ymax: number
}

export interface ImageWithBboxProps {
  imageUrl: string
  objects?: BboxObject[]
  imageWidth?: number
  imageHeight?: number
  showLabels?: boolean
  highlightClass?: string
  onObjectClick?: (obj: BboxObject) => void
}

// Generate consistent color for a class based on its index in the class list
function getClassColor(className: string, allClasses: string[]): string {
  const index = allClasses.indexOf(className)
  const hue = allClasses.length > 0 ? (index * 360) / allClasses.length : 0
  return `hsl(${hue}, 70%, 50%)`
}

export function ImageWithBbox({
  imageUrl,
  objects = [],
  imageWidth: annotationWidth,
  imageHeight: annotationHeight,
  showLabels = true,
  highlightClass,
  onObjectClick,
}: ImageWithBboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Transform state
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredObject, setHoveredObject] = useState<BboxObject | null>(null)

  // Extract unique classes for color assignment (memoized to avoid recreation)
  const allClasses = useMemo(
    () => [...new Set(objects.map((obj) => obj.class))],
    [objects],
  )

  // Load image
  useEffect(() => {
    if (!imageUrl) return

    setLoading(true)
    setError(null)

    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      setImage(img)
      setLoading(false)
      // Reset transform on new image
      setScale(1)
      setOffset({ x: 0, y: 0 })
    }

    img.onerror = () => {
      setError("Failed to load image")
      setLoading(false)
    }

    img.src = imageUrl

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [imageUrl])

  // Calculate fit scale and center offset
  const calculateFitTransform = useCallback(() => {
    if (!image || !containerRef.current)
      return { fitScale: 1, centerX: 0, centerY: 0 }

    const container = containerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const imgWidth = image.naturalWidth
    const imgHeight = image.naturalHeight

    const fitScale = Math.min(
      containerWidth / imgWidth,
      containerHeight / imgHeight,
      1, // Don't scale up beyond original size
    )

    const scaledWidth = imgWidth * fitScale
    const scaledHeight = imgHeight * fitScale
    const centerX = (containerWidth - scaledWidth) / 2
    const centerY = (containerHeight - scaledHeight) / 2

    return { fitScale, centerX, centerY }
  }, [image])

  // Draw canvas
  useEffect(() => {
    if (!canvasRef.current || !image || !containerRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const container = containerRef.current
    const dpr = window.devicePixelRatio || 1

    // Set canvas size
    canvas.width = container.clientWidth * dpr
    canvas.height = container.clientHeight * dpr
    canvas.style.width = `${container.clientWidth}px`
    canvas.style.height = `${container.clientHeight}px`
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.fillStyle = "#1a1a1a"
    ctx.fillRect(0, 0, container.clientWidth, container.clientHeight)

    // Calculate base transform
    const { fitScale, centerX, centerY } = calculateFitTransform()
    const totalScale = fitScale * scale
    const drawX = centerX + offset.x
    const drawY = centerY + offset.y
    const drawWidth = image.naturalWidth * totalScale
    const drawHeight = image.naturalHeight * totalScale

    // Draw image
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)

    // Draw bounding boxes
    if (objects.length > 0) {
      // Calculate scale factor from annotation coordinates to actual image
      const annotW = annotationWidth || image.naturalWidth
      const annotH = annotationHeight || image.naturalHeight
      const scaleX = (image.naturalWidth / annotW) * totalScale
      const scaleY = (image.naturalHeight / annotH) * totalScale

      for (const obj of objects) {
        const x = obj.xmin * scaleX + drawX
        const y = obj.ymin * scaleY + drawY
        const w = (obj.xmax - obj.xmin) * scaleX
        const h = (obj.ymax - obj.ymin) * scaleY

        const color = getClassColor(obj.class, allClasses)
        const isHighlighted =
          (highlightClass && obj.class === highlightClass) ||
          (hoveredObject &&
            hoveredObject.xmin === obj.xmin &&
            hoveredObject.ymin === obj.ymin &&
            hoveredObject.xmax === obj.xmax &&
            hoveredObject.ymax === obj.ymax)

        // Draw bbox
        ctx.strokeStyle = color
        ctx.lineWidth = isHighlighted ? 3 : 2
        ctx.strokeRect(x, y, w, h)

        // Draw fill for highlighted
        if (isHighlighted) {
          ctx.fillStyle = color.replace("50%)", "50%, 0.2)")
          ctx.fillRect(x, y, w, h)
        }

        // Draw label
        if (showLabels) {
          const label = obj.class
          ctx.font = "bold 12px sans-serif"
          const textMetrics = ctx.measureText(label)
          const textHeight = 16
          const padding = 4

          // Label background
          ctx.fillStyle = color
          ctx.fillRect(
            x,
            y - textHeight - padding,
            textMetrics.width + padding * 2,
            textHeight + padding,
          )

          // Label text
          ctx.fillStyle = "#fff"
          ctx.fillText(label, x + padding, y - padding - 2)
        }
      }
    }
  }, [
    image,
    scale,
    offset,
    objects,
    annotationWidth,
    annotationHeight,
    showLabels,
    highlightClass,
    hoveredObject,
    allClasses,
    calculateFitTransform,
  ])

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      // Trigger redraw by updating a dependency
      setOffset((prev) => ({ ...prev }))
    })

    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  // Mouse wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()

      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newScale = Math.max(0.5, Math.min(3, scale * delta))

      // Zoom towards mouse position
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        const scaleFactor = newScale / scale
        const newOffsetX = mouseX - (mouseX - offset.x) * scaleFactor
        const newOffsetY = mouseY - (mouseY - offset.y) * scaleFactor

        setOffset({ x: newOffsetX, y: newOffsetY })
      }

      setScale(newScale)
    },
    [scale, offset],
  )

  // Mouse drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return // Only left click
      setIsDragging(true)
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    },
    [offset],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setOffset({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        })
        return
      }

      // Check hover on bboxes
      if (!image || !containerRef.current || objects.length === 0) {
        setHoveredObject(null)
        return
      }

      const rect = containerRef.current.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const { fitScale, centerX, centerY } = calculateFitTransform()
      const totalScale = fitScale * scale
      const drawX = centerX + offset.x
      const drawY = centerY + offset.y

      const annotW = annotationWidth || image.naturalWidth
      const annotH = annotationHeight || image.naturalHeight
      const scaleX = (image.naturalWidth / annotW) * totalScale
      const scaleY = (image.naturalHeight / annotH) * totalScale

      let foundObject: BboxObject | null = null
      for (const obj of objects) {
        const x = obj.xmin * scaleX + drawX
        const y = obj.ymin * scaleY + drawY
        const w = (obj.xmax - obj.xmin) * scaleX
        const h = (obj.ymax - obj.ymin) * scaleY

        if (mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h) {
          foundObject = obj
          break
        }
      }

      setHoveredObject(foundObject)
    },
    [
      isDragging,
      dragStart,
      image,
      objects,
      scale,
      offset,
      annotationWidth,
      annotationHeight,
      calculateFitTransform,
    ],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false)
    setHoveredObject(null)
  }, [])

  // Double click to reset
  const handleDoubleClick = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  // Click on object
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (onObjectClick && hoveredObject) {
        e.stopPropagation()
        onObjectClick(hoveredObject)
      }
    },
    [onObjectClick, hoveredObject],
  )

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <Skeleton className="h-full w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
        <div className="text-center">
          <p>{error}</p>
          <p className="mt-2 text-sm">URL: {imageUrl}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-neutral-900"
      style={{
        cursor: isDragging ? "grabbing" : hoveredObject ? "pointer" : "grab",
      }}
    >
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        onClick={handleClick}
      />
      {/* Zoom indicator */}
      <div className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-1 text-xs text-white">
        {Math.round(scale * 100)}%
      </div>
    </div>
  )
}
