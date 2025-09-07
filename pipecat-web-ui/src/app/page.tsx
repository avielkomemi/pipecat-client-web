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
    isRTL: false,
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
            title: "Connected",
            description: "Successfully connected to Pipecat server",
          })
        },
        onDisconnected: () => {
          setConnectionStatus('disconnected')
          setIsConnecting(false)
          toast({
            title: "Disconnected",
            description: "Disconnected from Pipecat server",
          })
        },
        onError: (message) => {
          setConnectionStatus('error')
          setIsConnecting(false)
          toast({
            title: "Connection Error",
            description: message.data?.message || "Failed to connect to server",
            variant: "destructive",
          })
        },
        onBotReady: () => {
          toast({
            title: "Bot Ready",
            description: "Voice AI bot is ready to chat",
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
    // Here you would typically send settings to the server
    toast({
      title: "Settings Updated",
      description: "Your preferences have been saved",
    })
  }, [toast])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Pipecat Web UI</h1>
          <p className="text-gray-600">Production-ready voice AI interface</p>
        </div>

        {/* Status and Controls */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Connection Status</CardTitle>
                <CardDescription>Manage your voice AI connection</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                {connectionStatus === 'connected' && (
                  <LatencyBadge latency={latency} />
                )}
                <StatusIndicator status={connectionStatus} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={handleConnect}
                disabled={isConnecting || connectionStatus === 'connected'}
                className="flex-1"
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </Button>
              
              <Button
                onClick={handleDisconnect}
                disabled={connectionStatus !== 'connected'}
                variant="outline"
                className="flex-1"
              >
                Disconnect
              </Button>
              
              <SettingsDrawer 
                settings={settings} 
                onSettingsChange={handleSettingsChange} 
              />
            </div>

            <MicrophoneSelect
              onMicrophoneChange={handleMicrophoneChange}
              onMicrophoneToggle={handleMicrophoneToggle}
              isMicEnabled={isMicEnabled}
              selectedMicId={selectedMicId}
            />
          </CardContent>
        </Card>

        {/* Transcript */}
        <Card>
          <CardHeader>
            <CardTitle>Live Transcript</CardTitle>
            <CardDescription>Real-time conversation transcript</CardDescription>
          </CardHeader>
          <CardContent>
            <TranscriptDisplay 
              entries={transcriptEntries} 
              isRTL={settings.isRTL}
            />
          </CardContent>
        </Card>

        {/* Settings Info */}
        <Card>
          <CardHeader>
            <CardTitle>Current Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Model</p>
                <Badge variant="secondary">{settings.model}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Transport</p>
                <Badge variant="secondary">{settings.transport}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Sample Rate</p>
                <Badge variant="secondary">{settings.sampleRate} Hz</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Text Direction</p>
                <Badge variant="secondary">{settings.isRTL ? 'RTL' : 'LTR'}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}