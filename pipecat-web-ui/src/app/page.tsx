'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Square, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MicrophoneSelect } from '@/components/MicrophoneSelect'
import { TranscriptDisplay, TranscriptEntry } from '@/components/TranscriptDisplay'
import { SettingsDrawer, SettingsConfig } from '@/components/SettingsDrawer'
import { StatusIndicator, ConnectionStatus } from '@/components/StatusIndicator'
import { LatencyBadge } from '@/components/LatencyBadge'
import { useToast } from '@/hooks/use-toast'
import { PipecatClient } from '@pipecat-ai/client-js'
import { WebSocketTransport } from '@/lib/transport'

export default function Home() {
  const { toast } = useToast()
  
  // State management
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [client, setClient] = useState<PipecatClient | null>(null)
  const [transport, setTransport] = useState<WebSocketTransport | null>(null)
  const [latency, setLatency] = useState(0)
  const [isMicEnabled, setIsMicEnabled] = useState(true)
  const [selectedMicId, setSelectedMicId] = useState<string>('')
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([])
  const [settings, setSettings] = useState<SettingsConfig>({
    model: 'gpt-4o-mini',
    transport: 'websocket',
    sampleRate: 16000,
    isRTL: false,
  })

  // Initialize client and transport
  useEffect(() => {
    const wsTransport = new WebSocketTransport()
    setTransport(wsTransport)

    const pipecatClient = new PipecatClient({
      transport: wsTransport,
      enableMic: true,
      enableCam: false,
      callbacks: {
        onConnected: () => {
          setConnectionStatus('connected')
          setIsConnected(true)
          setIsConnecting(false)
          toast({
            title: "Connected",
            description: "Successfully connected to Pipecat server",
          })
        },
        onDisconnected: () => {
          setConnectionStatus('disconnected')
          setIsConnected(false)
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
            description: "AI assistant is ready to chat",
          })
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
            const filtered = prev.filter(e => e.id !== entry.id || e.isFinal)
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
        onTransportStateChanged: (state) => {
          console.log('Transport state changed:', state)
          if (state === 'connecting') {
            setConnectionStatus('connecting')
          }
        },
      },
    })

    setClient(pipecatClient)

    return () => {
      pipecatClient.disconnect()
    }
  }, [toast])

  // Update latency periodically
  useEffect(() => {
    if (!transport || !isConnected) return

    const interval = setInterval(() => {
      if (transport.latencyMs) {
        setLatency(transport.latencyMs)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [transport, isConnected])

  const handleStartStop = useCallback(async () => {
    if (!client) return

    if (isConnected) {
      setIsConnecting(true)
      await client.disconnect()
    } else {
      setIsConnecting(true)
      setConnectionStatus('connecting')
      
      try {
        const wsUrl = process.env.NEXT_PUBLIC_PIPECAT_WS_URL || 'ws://localhost:8765/ws'
        await client.connect({ wsUrl })
      } catch (error) {
        console.error('Failed to connect:', error)
        setConnectionStatus('error')
        setIsConnecting(false)
      }
    }
  }, [client, isConnected])

  const handleMicrophoneChange = useCallback((deviceId: string) => {
    setSelectedMicId(deviceId)
    if (client) {
      client.updateMic(deviceId)
    }
  }, [client])

  const handleMicrophoneToggle = useCallback((enabled: boolean) => {
    setIsMicEnabled(enabled)
    if (client) {
      client.enableMic(enabled)
    }
  }, [client])

  const handleSettingsChange = useCallback((newSettings: SettingsConfig) => {
    setSettings(newSettings)
    // Here you would typically send the new settings to the server
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

        {/* Main Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Voice Assistant</span>
              <div className="flex items-center gap-4">
                {isConnected && <LatencyBadge latency={latency} />}
                <StatusIndicator status={connectionStatus} />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Control Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleStartStop}
                  disabled={isConnecting}
                  size="lg"
                  className="flex items-center gap-2"
                >
                  {isConnecting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : isConnected ? (
                    <Square className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                  {isConnecting ? 'Connecting...' : isConnected ? 'Stop' : 'Start'}
                </Button>

                {isConnected && (
                  <MicrophoneSelect
                    onMicrophoneChange={handleMicrophoneChange}
                    onMicrophoneToggle={handleMicrophoneToggle}
                    isMicEnabled={isMicEnabled}
                    selectedMicId={selectedMicId}
                  />
                )}
              </div>

              <SettingsDrawer
                settings={settings}
                onSettingsChange={handleSettingsChange}
              />
            </div>

            {/* Transcript */}
            <TranscriptDisplay
              entries={transcriptEntries}
              isRTL={settings.isRTL}
            />
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>
            Built with{' '}
            <a
              href="https://pipecat.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Pipecat
            </a>
            {' '}• WebSocket: {process.env.NEXT_PUBLIC_PIPECAT_WS_URL || 'ws://localhost:8765/ws'}
          </p>
        </div>
      </div>
    </div>
  )
}