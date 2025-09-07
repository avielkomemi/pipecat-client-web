import { Transport, TransportConnectionParams, PipecatClientOptions, RTVIEventCallbacks, Tracks } from '@pipecat-ai/client-js'
import { RTVIMessage, TransportState } from '@pipecat-ai/client-js'

export interface WebSocketTransportParams extends TransportConnectionParams {
  wsUrl: string
}

export class WebSocketTransport extends Transport {
  private ws: WebSocket | null = null
  private _localStream: MediaStream | null = null
  private _availableMics: MediaDeviceInfo[] = []
  private _selectedMic: MediaDeviceInfo | Record<string, never> = {}

  initialize(options: PipecatClientOptions, messageHandler: (ev: RTVIMessage) => void): void {
    this._options = options
    this._onMessage = messageHandler
    this._callbacks = options.callbacks ?? {}
  }

  async initDevices(): Promise<void> {
    this.state = 'initializing'
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: this._options.enableCam 
      })
      
      this._localStream = stream
      this.state = 'initialized'
    } catch (error) {
      console.error('Failed to initialize devices:', error)
      this.state = 'error'
      throw error
    }
  }

  _validateConnectionParams(connectParams?: unknown): WebSocketTransportParams {
    if (!connectParams || typeof connectParams !== 'object') {
      throw new Error('WebSocket URL is required')
    }
    
    const params = connectParams as any
    if (!params.wsUrl || typeof params.wsUrl !== 'string') {
      throw new Error('WebSocket URL is required')
    }
    
    return params as WebSocketTransportParams
  }

  async _connect(connectParams?: WebSocketTransportParams): Promise<void> {
    if (!connectParams) {
      throw new Error('Connection parameters are required')
    }

    this.state = 'connecting'

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(connectParams.wsUrl)

      this.ws.onopen = () => {
        this.state = 'connected'
        this._callbacks.onConnected?.()
        resolve()
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const message: RTVIMessage = {
            id: data.id || Math.random().toString(36).substr(2, 9),
            label: 'rtvi-ai',
            type: data.type,
            data: data.data
          }
          this._onMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onclose = () => {
        this.state = 'disconnected'
        this._callbacks.onDisconnected?.()
      }

      this.ws.onerror = (error) => {
        this.state = 'error'
        this._callbacks.onError?.({
          id: 'ws-error',
          label: 'rtvi-ai',
          type: 'error',
          data: { message: 'WebSocket connection error', fatal: false }
        } as RTVIMessage)
        reject(error)
      }
    })
  }

  async _disconnect(): Promise<void> {
    this.state = 'disconnecting'
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    if (this._localStream) {
      this._localStream.getTracks().forEach(track => track.stop())
      this._localStream = null
    }
    
    this.state = 'disconnected'
    this._callbacks.onDisconnected?.()
  }

  sendReadyMessage(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'client-ready',
        data: { version: '1.0.0' }
      }))
      this.state = 'ready'
    }
  }

  sendMessage(message: RTVIMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: message.type,
        data: message.data
      }))
    }
  }

  get state(): TransportState {
    return this._state
  }

  set state(state: TransportState) {
    if (this._state === state) return
    this._state = state
    this._callbacks.onTransportStateChanged?.(state)
  }

  async getAllMics(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices()
    this._availableMics = devices.filter(device => device.kind === 'audioinput')
    return this._availableMics
  }

  async getAllCams(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter(device => device.kind === 'videoinput')
  }

  async getAllSpeakers(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter(device => device.kind === 'audiooutput')
  }

  get selectedMic(): MediaDeviceInfo | Record<string, never> {
    return this._selectedMic
  }

  get selectedCam(): MediaDeviceInfo | Record<string, never> {
    return {}
  }

  get selectedSpeaker(): MediaDeviceInfo | Record<string, never> {
    return {}
  }

  updateMic(micId: string): void {
    const mic = this._availableMics.find(m => m.deviceId === micId)
    if (mic) {
      this._selectedMic = mic
      this._callbacks.onMicUpdated?.(mic)
    }
  }

  updateCam(camId: string): void {
    // Implementation for camera update
  }

  updateSpeaker(speakerId: string): void {
    // Implementation for speaker update
  }

  enableMic(enable: boolean): void {
    if (this._localStream) {
      const audioTrack = this._localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = enable
      }
    }
  }

  enableCam(enable: boolean): void {
    if (this._localStream) {
      const videoTrack = this._localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = enable
      }
    }
  }

  enableScreenShare(enable: boolean): void {
    // Implementation for screen share
  }

  get isMicEnabled(): boolean {
    if (this._localStream) {
      const audioTrack = this._localStream.getAudioTracks()[0]
      return audioTrack?.enabled ?? false
    }
    return false
  }

  get isCamEnabled(): boolean {
    if (this._localStream) {
      const videoTrack = this._localStream.getVideoTracks()[0]
      return videoTrack?.enabled ?? false
    }
    return false
  }

  get isSharingScreen(): boolean {
    return false
  }

  tracks(): Tracks {
    const tracks: Tracks = {
      local: {}
    }

    if (this._localStream) {
      const audioTrack = this._localStream.getAudioTracks()[0]
      const videoTrack = this._localStream.getVideoTracks()[0]
      
      if (audioTrack) tracks.local.audio = audioTrack
      if (videoTrack) tracks.local.video = videoTrack
    }

    return tracks
  }
}