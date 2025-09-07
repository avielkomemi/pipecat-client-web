'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface TranscriptEntry {
  id: string
  text: string
  speaker: 'user' | 'bot'
  timestamp: Date
  isFinal: boolean
}

interface TranscriptDisplayProps {
  entries: TranscriptEntry[]
  className?: string
  isRTL?: boolean
}

export function TranscriptDisplay({ entries, className, isRTL = false }: TranscriptDisplayProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries])

  return (
    <div 
      ref={scrollRef}
      className={cn(
        "h-64 overflow-y-auto p-4 bg-muted/50 rounded-lg space-y-3",
        isRTL && "text-right",
        className
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {entries.length === 0 ? (
        <div className="text-muted-foreground text-center py-8">
          Transcript will appear here...
        </div>
      ) : (
        entries.map((entry) => (
          <div
            key={entry.id}
            className={cn(
              "flex flex-col gap-1",
              entry.speaker === 'user' ? 'items-end' : 'items-start'
            )}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn(
                "font-medium",
                entry.speaker === 'user' ? 'text-blue-600' : 'text-green-600'
              )}>
                {entry.speaker === 'user' ? 'You' : 'Bot'}
              </span>
              <span>{entry.timestamp.toLocaleTimeString()}</span>
            </div>
            <div
              className={cn(
                "max-w-[80%] p-3 rounded-lg text-sm",
                entry.speaker === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border',
                !entry.isFinal && 'opacity-70 italic'
              )}
            >
              {entry.text}
              {!entry.isFinal && (
                <span className="ml-1 animate-pulse">|</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}