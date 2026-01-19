import { useEffect } from "react"

interface KeyboardHandlers {
  onPrev?: () => void
  onNext?: () => void
  onKeep?: () => void
  onRemove?: () => void
  onSkip?: () => void
  onUndo?: () => void
  enabled?: boolean
}

/**
 * Hook for handling keyboard shortcuts in the sample reviewer.
 *
 * Shortcuts:
 * - A / ArrowLeft: Previous sample
 * - D / ArrowRight: Next sample
 * - Y: Keep sample (review mode)
 * - N: Remove sample (review mode)
 * - S: Skip sample (review mode)
 * - Ctrl/Cmd + Z: Undo last action (review mode)
 */
export function useReviewerKeyboard({
  onPrev,
  onNext,
  onKeep,
  onRemove,
  onSkip,
  onUndo,
  enabled = true,
}: KeyboardHandlers) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      // Ignore if any modifier key is pressed (except for undo)
      const hasModifier = e.altKey || e.shiftKey
      if (hasModifier) return

      const key = e.key.toLowerCase()

      // Handle Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && key === "z") {
        e.preventDefault()
        onUndo?.()
        return
      }

      // Ignore if Ctrl/Cmd is pressed for other keys
      if (e.ctrlKey || e.metaKey) return

      switch (key) {
        case "a":
        case "arrowleft":
          e.preventDefault()
          onPrev?.()
          break
        case "d":
        case "arrowright":
          e.preventDefault()
          onNext?.()
          break
        case "y":
          e.preventDefault()
          onKeep?.()
          break
        case "n":
          e.preventDefault()
          onRemove?.()
          break
        case "s":
          e.preventDefault()
          onSkip?.()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [enabled, onPrev, onNext, onKeep, onRemove, onSkip, onUndo])
}
