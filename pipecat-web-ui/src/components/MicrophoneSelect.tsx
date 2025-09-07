'use client'

import { useState, useEffect } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface MicrophoneSelectProps {
  onMicrophoneChange: (deviceId: string) => void
  onMicrophoneToggle: (enabled: boolean) => void
  isMicEnabled: boolean
  selectedMicId?: string
}

export function MicrophoneSelect({
  onMicrophoneChange,
  onMicrophoneToggle,
  isMicEnabled,
  selectedMicId
}: MicrophoneSelectProps) {
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    const getMicrophones = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const mics = devices.filter(device => device.kind === 'audioinput')
        setMicrophones(mics)
      } catch (error) {
        console.error('Failed to get microphones:', error)
      }
    }

    getMicrophones()

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', getMicrophones)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getMicrophones)
    }
  }, [])

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isMicEnabled ? "default" : "secondary"}
        size="sm"
        onClick={() => onMicrophoneToggle(!isMicEnabled)}
        className="flex items-center gap-2"
      >
        {isMicEnabled ? (
          <Mic className="h-4 w-4" />
        ) : (
          <MicOff className="h-4 w-4" />
        )}
        {isMicEnabled ? 'Mute' : 'Unmute'}
      </Button>
      
      <Select value={selectedMicId} onValueChange={onMicrophoneChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select microphone" />
        </SelectTrigger>
        <SelectContent>
          {microphones.map((mic) => (
            <SelectItem key={mic.deviceId} value={mic.deviceId}>
              {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}