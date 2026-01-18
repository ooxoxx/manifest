import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
}: StatsCardProps) {
  return (
    <Card className="relative overflow-hidden terminal-border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 group">
      {/* Accent line */}
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />

      {/* Corner decoration */}
      <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-primary/30" />
      <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-primary/30" />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
          {title}
        </CardTitle>
        <div className="p-2 rounded-md bg-primary/10 border border-primary/20">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="mono text-3xl font-bold tracking-tight text-primary text-glow">
          {value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-2 font-medium">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
