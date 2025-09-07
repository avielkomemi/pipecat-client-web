'use client'

import { useState, useEffect, useCallback } from 'react'
import { PipecatClient, RTVIEvent, TransportState } from '@pipecat-ai/client-js'
import { WebSocketTransport } from '@/lib/websocket-transport'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MicrophoneSelect } from '@/components/MicrophoneSelect'
import { TranscriptDisplay, TranscriptEntry } from '@/components/TranscriptDisplay'
import { SettingsDrawer, SettingsConfig } from '@/components/SettingsDrawer'
import { StatusIndicator, ConnectionStatus } from '@/components/StatusIndicator'
import { LatencyBadge } from '@/components/LatencyBadge'
import { useToast } from '@/hooks/use-toast'
import { Mic, MicOff, Play, Square, Settings, Zap } from 'lucide-react'

export default function Home() {
  const [client, setClient] = useState<PipecatClient | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [isConnecting, setIsConnecting] = useState(false)
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([])
  const [latency, setLatency] = useState(0)
  const [isMicEnabled, setIsMicEnabled] = useState(true)
  const [selectedMicId, setSelectedMicId] = useState<string>('')
  const [settings, setSettings] = useState<SettingsConfig>({
    model: 'gpt-4o',
    transport: 'websocket',
    sampleRate: 16000,
    isRTL: true, // Hebrew RTL support
  })
  
  const { toast } = useToast()

  useEffect(() => {
    const transport = new WebSocketTransport()
    
    const pipecatClient = new PipecatClient({
      transport,
      enableMic: true,
      enableCam: false,
      callbacks: {
        onConnected: () => {
          setConnectionStatus('connected')
          setIsConnecting(false)
          toast({
            title: "מחובר בהצלחה",
            description: "התחברת בהצלחה לשרת Pipecat",
          })
        },
        onDisconnected: () => {
          setConnectionStatus('disconnected')
          setIsConnecting(false)
          toast({
            title: "התנתק",
            description: "התנתקת משרת Pipecat",
          })
        },
        onError: (message) => {
          setConnectionStatus('error')
          setIsConnecting(false)
          toast({
            title: "שגיאת חיבור",
            description: message.data?.message || "נכשל בחיבור לשרת",
            variant: "destructive",
          })
        },
        onBotReady: () => {
          toast({
            title: "הבוט מוכן",
            description: "הסוכן הקולי מוכן לשיחה",
          })
        },
        onTransportStateChanged: (state: TransportState) => {
          if (state === 'connecting') {
            setConnectionStatus('connecting')
          } else if (state === 'connected' || state === 'ready') {
            setConnectionStatus('connected')
          } else if (state === 'disconnected') {
            setConnectionStatus('disconnected')
          } else if (state === 'error') {
            setConnectionStatus('error')
          }
        },
        onUserTranscript: (data) => {
          const entry: TranscriptEntry = {
            id: `user-${Date.now()}`,
            text: data.text,
            speaker: 'user',
            timestamp: new Date(),
            isFinal: data.final,
          }
          
          setTranscriptEntries(prev => {
            const filtered = prev.filter(e => !(e.speaker === 'user' && !e.isFinal))
            return [...filtered, entry]
          })
        },
        onBotLlmText: (data) => {
          const entry: TranscriptEntry = {
            id: `bot-${Date.now()}`,
            text: data.text,
            speaker: 'bot',
            timestamp: new Date(),
            isFinal: true,
          }
          
          setTranscriptEntries(prev => [...prev, entry])
        },
      },
    })

    setClient(pipecatClient)

    // Simulate latency updates
    const latencyInterval = setInterval(() => {
      if (connectionStatus === 'connected') {
        setLatency(Math.random() * 200 + 50) // 50-250ms
      }
    }, 2000)

    return () => {
      pipecatClient.disconnect()
      clearInterval(latencyInterval)
    }
  }, [connectionStatus, toast])

  const handleConnect = useCallback(async () => {
    if (!client) return

    setIsConnecting(true)
    
    try {
      await client.connect({
        wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'wss://localhost:8080/ws'
      })
    } catch (error) {
      console.error('Failed to connect:', error)
      setIsConnecting(false)
      setConnectionStatus('error')
    }
  }, [client])

  const handleDisconnect = useCallback(async () => {
    if (!client) return
    await client.disconnect()
    setTranscriptEntries([])
  }, [client])

  const handleMicrophoneChange = useCallback((deviceId: string) => {
    setSelectedMicId(deviceId)
    client?.updateMic(deviceId)
  }, [client])

  const handleMicrophoneToggle = useCallback((enabled: boolean) => {
    setIsMicEnabled(enabled)
    client?.enableMic(enabled)
  }, [client])

  const handleSettingsChange = useCallback((newSettings: SettingsConfig) => {
    setSettings(newSettings)
    toast({
      title: "הגדרות עודכנו",
      description: "ההעדפות שלך נשמרו בהצלחה",
    })
  }, [toast])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4 py-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Zap className="h-12 w-12 text-blue-600" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Pipecat Voice AI
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            פלטפורמה מתקדמת ליצירת סוכנים קוליים חכמים עם בינה מלאכותית
          </p>
          <div className="flex items-center justify-center gap-4 mt-6">
            <Badge variant="secondary" className="text-sm px-4 py-2">
              🎤 זיהוי דיבור בזמן אמת
            </Badge>
            <Badge variant="secondary" className="text-sm px-4 py-2">
              🤖 AI מתקדם
            </Badge>
            <Badge variant="secondary" className="text-sm px-4 py-2">
              🌐 תמיכה בעברית
            </Badge>
          </div>
        </div>

        {/* Main Control Panel */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Play className="h-6 w-6" />
                  לוח בקרה ראשי
                </CardTitle>
                <CardDescription className="text-blue-100 text-lg">
                  נהל את החיבור והגדרות הסוכן הקולי שלך
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                {connectionStatus === 'connected' && (
                  <LatencyBadge latency={latency} className="bg-white/20 text-white border-white/30" />
                )}
                <StatusIndicator status={connectionStatus} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            {/* Connection Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                onClick={handleConnect}
                disabled={isConnecting || connectionStatus === 'connected'}
                className="h-14 text-lg font-semibold bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                <Play className="h-5 w-5 ml-2" />
                {isConnecting ? 'מתחבר...' : 'התחבר לסוכן'}
              </Button>
              
              <Button
                onClick={handleDisconnect}
                disabled={connectionStatus !== 'connected'}
                variant="outline"
                className="h-14 text-lg font-semibold border-red-300 text-red-600 hover:bg-red-50"
                size="lg"
              >
                <Square className="h-5 w-5 ml-2" />
                נתק חיבור
              </Button>
              
              <SettingsDrawer 
                settings={settings} 
                onSettingsChange={handleSettingsChange}
              />
            </div>

            {/* Microphone Controls */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Mic className="h-5 w-5" />
                בקרת מיקרופון
              </h3>
              <MicrophoneSelect
                onMicrophoneChange={handleMicrophoneChange}
                onMicrophoneToggle={handleMicrophoneToggle}
                isMicEnabled={isMicEnabled}
                selectedMicId={selectedMicId}
              />
            </div>
          </CardContent>
        </Card>

        {/* Live Transcript */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-t-lg">
            <CardTitle className="text-xl flex items-center gap-2">
              💬 תמליל שיחה בזמן אמת
            </CardTitle>
            <CardDescription className="text-green-100">
              כל השיחה מתועדת ומתורגמת בזמן אמת
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <TranscriptDisplay 
              entries={transcriptEntries} 
              isRTL={settings.isRTL}
              className="min-h-[400px]"
            />
            {transcriptEntries.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Mic className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-xl">התחל לדבר כדי לראות את התמליל כאן...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settings Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                הגדרות נוכחיות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">מודל AI</p>
                  <Badge variant="secondary" className="text-sm">{settings.model}</Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">תדירות דגימה</p>
                  <Badge variant="secondary" className="text-sm">{settings.sampleRate} Hz</Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">כיוון טקסט</p>
                  <Badge variant="secondary" className="text-sm">{settings.isRTL ? 'עברית (ימין לשמאל)' : 'אנגלית (שמאל לימין)'}</Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">פרוטוקול</p>
                  <Badge variant="secondary" className="text-sm">{settings.transport}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>📊 סטטיסטיקות</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">סטטוס חיבור</span>
                  <StatusIndicator status={connectionStatus} />
                </div>
                {connectionStatus === 'connected' && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">זמן תגובה</span>
                    <LatencyBadge latency={latency} />
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">הודעות בתמליל</span>
                  <Badge variant="outline">{transcriptEntries.length}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">מיקרופון</span>
                  <Badge variant={isMicEnabled ? "default" : "secondary"}>
                    {isMicEnabled ? "פעיל" : "כבוי"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">
            נבנה עם ❤️ באמצעות Pipecat AI • תמיכה מלאה בעברית ובינה מלאכותית מתקדמת
          </p>
        </div>
      </div>
    </div>
  )
}