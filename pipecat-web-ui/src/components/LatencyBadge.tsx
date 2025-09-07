'use client'

import { Badge } from '@/components/ui/badge'
import { formatLatency, getLatencyColor } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface LatencyBadgeProps {
  latency: number
  className?: string
}

export function LatencyBadge({ latency, className }: LatencyBadgeProps) {
  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "text-white font-mono text-xs",
        getLatencyColor(latency),
        className
      )}
    >
      {formatLatency(latency)}
    </Badge>
  )
}