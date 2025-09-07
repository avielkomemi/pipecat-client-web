'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface StatusIndicatorProps {
  status: ConnectionStatus
  className?: string
}

const statusConfig = {
  disconnected: {
    label: 'Disconnected',
    color: 'bg-gray-500',
    variant: 'secondary' as const,
  },
  connecting: {
    label: 'Connecting...',
    color: 'bg-yellow-500',
    variant: 'secondary' as const,
  },
  connected: {
    label: 'Connected',
    color: 'bg-green-500',
    variant: 'default' as const,
  },
  error: {
    label: 'Error',
    color: 'bg-red-500',
    variant: 'destructive' as const,
  },
}

export function StatusIndicator({ status, className }: StatusIndicatorProps) {
  const config = statusConfig[status]

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("w-2 h-2 rounded-full", config.color)} />
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    </div>
  )
}