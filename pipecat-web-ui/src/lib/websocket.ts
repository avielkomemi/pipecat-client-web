export interface WebSocketMessage {
  type: string
  data?: any
  timestamp?: number
}

export interface WebSocketConfig {
  url: string
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
}

export class WebSocketManager {
  private ws: WebSocket | null = null
  private config: Required<WebSocketConfig>
  private retryCount = 0
  private reconnectTimeout: NodeJS.Timeout | null = null
  private isManualClose = false
  private pingInterval: NodeJS.Timeout | null = null

  constructor(config: WebSocketConfig) {
    this.config = {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      onMessage: () => {},
      onConnect: () => {},
      onDisconnect: () => {},
      onError: () => {},
      ...config,
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.isManualClose = false
        this.ws = new WebSocket(this.config.url)

        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.retryCount = 0
          this.config.onConnect()
          this.startPing()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            this.config.onMessage(message)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason)
          this.stopPing()
          this.config.onDisconnect()
          
          if (!this.isManualClose && this.retryCount < this.config.maxRetries) {
            this.scheduleReconnect()
          }
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.config.onError(error)
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  disconnect(): void {
    this.isManualClose = true
    this.stopPing()
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect')
      this.ws = null
    }
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        ...message,
        timestamp: Date.now(),
      }))
    } else {
      console.warn('WebSocket not connected, message not sent:', message)
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      this.config.baseDelay * Math.pow(2, this.retryCount),
      this.config.maxDelay
    )
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.retryCount + 1}/${this.config.maxRetries})`)
    
    this.reconnectTimeout = setTimeout(() => {
      this.retryCount++
      this.connect().catch(() => {
        // Connection failed, will retry if under max retries
      })
    }, delay)
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' })
      }
    }, 30000) // Ping every 30 seconds
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }
}