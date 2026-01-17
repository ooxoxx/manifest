import { Skeleton } from "@/components/ui/skeleton"

export const PendingComponent = () => (
  <div className="space-y-3">
    {Array.from({ length: 5 }).map((_, index) => (
      <Skeleton key={index} className="h-12 w-full" />
    ))}
  </div>
)
