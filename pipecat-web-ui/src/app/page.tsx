'use client'

import { useState, useEffect, useCallback } from 'react'
import { PipecatClient } from '@pipecat-ai/client-js'
import { WebSocketTransport } from '@/lib/websocket-transport'

export default function Home() {
  const [client, setClient] = useState<PipecatClient | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    const transport = new WebSocketTransport()
    
    const pipecatClient = new PipecatClient({
      transport,
      enableMic: true,
      enableCam: false,
      callbacks: {
        onConnected: () => {
          setIsConnected(true)
          setIsConnecting(false)
          console.log('Connected to Pipecat')
        },
        onDisconnected: () => {
          setIsConnected(false)
          setIsConnecting(false)
          console.log('Disconnected from Pipecat')
        },
        onError: (message) => {
          setIsConnecting(false)
          console.error('Pipecat error:', message)
        },
        onBotReady: () => {
          console.log('Bot is ready')
        },
      },
    })

    setClient(pipecatClient)

    return () => {
      pipecatClient.disconnect()
    }
  }, [])

  const handleConnect = useCallback(async () => {
    if (!client) return

    setIsConnecting(true)
    
    try {
      await client.connect({
        wsUrl: process.env.NEXT_PUBLIC_PIPECAT_WS_URL || 'ws://localhost:8765/ws'
      })
    } catch (error) {
      console.error('Failed to connect:', error)
      setIsConnecting(false)
    }
  }, [client])

  const handleDisconnect = useCallback(async () => {
    if (!client) return
    await client.disconnect()
  }, [client])

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6">Pipecat Web UI</h1>
        
        <div className="space-y-4">
          <div className="text-center">
            <div className={`inline-block w-3 h-3 rounded-full mr-2 ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleConnect}
              disabled={isConnecting || isConnected}
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded"
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
            
            <button
              onClick={handleDisconnect}
              disabled={!isConnected}
              className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-4 py-2 rounded"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}