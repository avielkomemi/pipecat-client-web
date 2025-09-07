'use client'

import { useState } from 'react'
import { Settings, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

export interface SettingsConfig {
  model: string
  transport: string
  sampleRate: number
  isRTL: boolean
}

interface SettingsDrawerProps {
  settings: SettingsConfig
  onSettingsChange: (settings: SettingsConfig) => void
}

const MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
]

const TRANSPORTS = [
  { value: 'websocket', label: 'WebSocket' },
  { value: 'daily', label: 'Daily' },
  { value: 'agora', label: 'Agora' },
]

const SAMPLE_RATES = [
  { value: 16000, label: '16 kHz' },
  { value: 24000, label: '24 kHz' },
  { value: 48000, label: '48 kHz' },
]

export function SettingsDrawer({ settings, onSettingsChange }: SettingsDrawerProps) {
  const [open, setOpen] = useState(false)

  const updateSetting = <K extends keyof SettingsConfig>(
    key: K,
    value: SettingsConfig[K]
  ) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-14 text-lg font-semibold">
          <Settings className="h-5 w-5 ml-2" />
          הגדרות מתקדמות
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl">הגדרות מתקדמות</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model" className="text-base font-medium">מודל בינה מלאכותית</Label>
              <Select
                value={settings.model}
                onValueChange={(value) => updateSetting('model', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר מודל" />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transport" className="text-base font-medium">פרוטוקול תקשורת</Label>
              <Select
                value={settings.transport}
                onValueChange={(value) => updateSetting('transport', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר פרוטוקול" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSPORTS.map((transport) => (
                    <SelectItem key={transport.value} value={transport.value}>
                      {transport.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sampleRate" className="text-base font-medium">תדירות דגימה</Label>
              <Select
                value={settings.sampleRate.toString()}
                onValueChange={(value) => updateSetting('sampleRate', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר תדירות דגימה" />
                </SelectTrigger>
                <SelectContent>
                  {SAMPLE_RATES.map((rate) => (
                    <SelectItem key={rate.value} value={rate.value.toString()}>
                      {rate.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="rtl" className="text-base font-medium">תמיכה בעברית (ימין לשמאל)</Label>
              <Switch
                id="rtl"
                checked={settings.isRTL}
                onCheckedChange={(checked) => updateSetting('isRTL', checked)}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}