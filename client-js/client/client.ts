/**
 * Copyright (c) 2024, Daily.
 *
 * SPDX-License-Identifier: BSD-2-Clause
 */

import EventEmitter from "events";
import TypedEmitter from "typed-emitter";

import packageJson from "../package.json";
import {
  AppendToContextResultData,
  BotLLMSearchResponseData,
  BotLLMTextData,
  BotReadyData,
  BotTTSTextData,
  ErrorData,
  LLMContextMessage,
  LLMFunctionCallData,
  LLMFunctionCallResult,
  Participant,
  PipecatMetricsData,
  RTVIEvent,
  RTVIEvents,
  RTVIMessage,
  RTVIMessageType,
  TranscriptData,
  TransportState,
} from "../rtvi";
import * as RTVIErrors from "../rtvi/errors";
import { transportReady } from "./decorators";
import { MessageDispatcher } from "./dispatcher";
import { logger, LogLevel } from "./logger";
import { ConnectionEndpoint, isConnectionEndpoint } from "./rest_helpers";
import {
  getTransportConnectionParams,
  Tracks,
  Transport,
  TransportConnectionParams,
  TransportWrapper,
} from "./transport";

export type FunctionCallParams = {
  functionName: string;
  arguments: Record<string, unknown>;
};

export type FunctionCallCallback = (
  fn: FunctionCallParams
) => Promise<LLMFunctionCallResult | void>;

export type RTVIEventCallbacks = Partial<{
  onConnected: () => void;
  onDisconnected: () => void;
  onError: (message: RTVIMessage) => void;
  onTransportStateChanged: (state: TransportState) => void;

  onBotConnected: (participant: Participant) => void;
  onBotReady: (botReadyData: BotReadyData) => void;
  onBotDisconnected: (participant: Participant) => void;
  onMetrics: (data: PipecatMetricsData) => void;

  onServerMessage: (data: unknown) => void;
  onMessageError: (message: RTVIMessage) => void;

  onParticipantJoined: (participant: Participant) => void;
  onParticipantLeft: (participant: Participant) => void;

  onAvailableCamsUpdated: (cams: MediaDeviceInfo[]) => void;
  onAvailableMicsUpdated: (mics: MediaDeviceInfo[]) => void;
  onAvailableSpeakersUpdated: (speakers: MediaDeviceInfo[]) => void;
  onCamUpdated: (cam: MediaDeviceInfo) => void;
  onMicUpdated: (mic: MediaDeviceInfo) => void;
  onSpeakerUpdated: (speaker: MediaDeviceInfo) => void;
  onTrackStarted: (track: MediaStreamTrack, participant?: Participant) => void;
  onTrackStopped: (track: MediaStreamTrack, participant?: Participant) => void;
  onScreenTrackStarted: (
    track: MediaStreamTrack,
    participant?: Participant
  ) => void;
  onScreenTrackStopped: (
    track: MediaStreamTrack,
    participant?: Participant
  ) => void;
  onScreenShareError: (errorMessage: string) => void;
  onLocalAudioLevel: (level: number) => void;
  onRemoteAudioLevel: (level: number, participant: Participant) => void;

  onBotStartedSpeaking: () => void;
  onBotStoppedSpeaking: () => void;
  onUserStartedSpeaking: () => void;
  onUserStoppedSpeaking: () => void;
  onUserTranscript: (data: TranscriptData) => void;
  onBotTranscript: (data: BotLLMTextData) => void;

  onBotLlmText: (data: BotLLMTextData) => void;
  onBotLlmStarted: () => void;
  onBotLlmStopped: () => void;
  onBotTtsText: (data: BotTTSTextData) => void;
  onBotTtsStarted: () => void;
  onBotTtsStopped: () => void;

  onBotLlmSearchResponse: (data: BotLLMSearchResponseData) => void;
}>;

export interface PipecatClientOptions {
  /**
   * Transport class for media streaming
   */
  transport: Transport;

  /**
   * Optional callback methods for PCI events
   */
  callbacks?: RTVIEventCallbacks;

  /**
   * Enable user mic input
   *
   * Default to true
   */
  enableMic?: boolean;

  /**
   * Enable user cam input
   *
   * Default to false
   */
  enableCam?: boolean;
}

abstract class RTVIEventEmitter extends (EventEmitter as unknown as new () => TypedEmitter<RTVIEvents>) {}

export class PipecatClient extends RTVIEventEmitter {
  protected _options: PipecatClientOptions;
  private _connectionTimeout: ReturnType<typeof setTimeout> | undefined;
  private _startResolve: ((value: unknown) => void) | undefined;
  protected _transport: Transport;
  protected _transportWrapper: TransportWrapper;
  protected declare _messageDispatcher: MessageDispatcher;
  protected _functionCallCallbacks: Record<string, FunctionCallCallback> = {};
  protected _abortController: AbortController | undefined;

  constructor(options: PipecatClientOptions) {
    super();

    this._transport = options.transport;
    this._transportWrapper = new TransportWrapper(this._transport);

    // Wrap transport callbacks with event triggers
    // This allows for either functional callbacks or .on / .off event listeners
    const wrappedCallbacks: RTVIEventCallbacks = {
      ...options.callbacks,
      onMessageError: (message: RTVIMessage) => {
        options?.callbacks?.onMessageError?.(message);
        this.emit(RTVIEvent.MessageError, message);
      },
      onError: (message: RTVIMessage) => {
        options?.callbacks?.onError?.(message);
        try {
          this.emit(RTVIEvent.Error, message);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          logger.debug("Could not emit error", message);
        }
        const data = message.data as ErrorData;
        if (data?.fatal) {
          logger.error("Fatal error reported. Disconnecting...");
          this.disconnect();
        }
      },
      onConnected: () => {
        options?.callbacks?.onConnected?.();
        this.emit(RTVIEvent.Connected);
      },
      onDisconnected: () => {
        options?.callbacks?.onDisconnected?.();
        this.emit(RTVIEvent.Disconnected);
      },
      onTransportStateChanged: (state: TransportState) => {
        options?.callbacks?.onTransportStateChanged?.(state);
        this.emit(RTVIEvent.TransportStateChanged, state);
      },
      onParticipantJoined: (p) => {
        options?.callbacks?.onParticipantJoined?.(p);
        this.emit(RTVIEvent.ParticipantConnected, p);
      },
      onParticipantLeft: (p) => {
        options?.callbacks?.onParticipantLeft?.(p);
        this.emit(RTVIEvent.ParticipantLeft, p);
      },
      onTrackStarted: (track, p) => {
        options?.callbacks?.onTrackStarted?.(track, p);
        this.emit(RTVIEvent.TrackStarted, track, p);
      },
      onTrackStopped: (track, p) => {
        options?.callbacks?.onTrackStopped?.(track, p);
        this.emit(RTVIEvent.TrackStopped, track, p);
      },
      onScreenTrackStarted: (track, p) => {
        options?.callbacks?.onScreenTrackStarted?.(track, p);
        this.emit(RTVIEvent.ScreenTrackStarted, track, p);
      },
      onScreenTrackStopped: (track, p) => {
        options?.callbacks?.onScreenTrackStopped?.(track, p);
        this.emit(RTVIEvent.ScreenTrackStopped, track, p);
      },
      onScreenShareError: (errorMessage) => {
        options?.callbacks?.onScreenShareError?.(errorMessage);
        this.emit(RTVIEvent.ScreenShareError, errorMessage);
      },
      onAvailableCamsUpdated: (cams) => {
        options?.callbacks?.onAvailableCamsUpdated?.(cams);
        this.emit(RTVIEvent.AvailableCamsUpdated, cams);
      },
      onAvailableMicsUpdated: (mics) => {
        options?.callbacks?.onAvailableMicsUpdated?.(mics);
        this.emit(RTVIEvent.AvailableMicsUpdated, mics);
      },
      onAvailableSpeakersUpdated: (speakers) => {
        options?.callbacks?.onAvailableSpeakersUpdated?.(speakers);
        this.emit(RTVIEvent.AvailableSpeakersUpdated, speakers);
      },
      onCamUpdated: (cam) => {
        options?.callbacks?.onCamUpdated?.(cam);
        this.emit(RTVIEvent.CamUpdated, cam);
      },
      onMicUpdated: (mic) => {
        options?.callbacks?.onMicUpdated?.(mic);
        this.emit(RTVIEvent.MicUpdated, mic);
      },
      onSpeakerUpdated: (speaker) => {
        options?.callbacks?.onSpeakerUpdated?.(speaker);
        this.emit(RTVIEvent.SpeakerUpdated, speaker);
      },
      onBotConnected: (p) => {
        options?.callbacks?.onBotConnected?.(p);
        this.emit(RTVIEvent.BotConnected, p);
      },
      onBotReady: (botReadyData: BotReadyData) => {
        options?.callbacks?.onBotReady?.(botReadyData);
        this.emit(RTVIEvent.BotReady, botReadyData);
      },
      onBotDisconnected: (p) => {
        options?.callbacks?.onBotDisconnected?.(p);
        this.emit(RTVIEvent.BotDisconnected, p);
      },
      onBotStartedSpeaking: () => {
        options?.callbacks?.onBotStartedSpeaking?.();
        this.emit(RTVIEvent.BotStartedSpeaking);
      },
      onBotStoppedSpeaking: () => {
        options?.callbacks?.onBotStoppedSpeaking?.();
        this.emit(RTVIEvent.BotStoppedSpeaking);
      },
      onRemoteAudioLevel: (level, p) => {
        options?.callbacks?.onRemoteAudioLevel?.(level, p);
        this.emit(RTVIEvent.RemoteAudioLevel, level, p);
      },
      onUserStartedSpeaking: () => {
        options?.callbacks?.onUserStartedSpeaking?.();
        this.emit(RTVIEvent.UserStartedSpeaking);
      },
      onUserStoppedSpeaking: () => {
        options?.callbacks?.onUserStoppedSpeaking?.();
        this.emit(RTVIEvent.UserStoppedSpeaking);
      },
      onLocalAudioLevel: (level) => {
        options?.callbacks?.onLocalAudioLevel?.(level);
        this.emit(RTVIEvent.LocalAudioLevel, level);
      },
      onUserTranscript: (data) => {
        options?.callbacks?.onUserTranscript?.(data);
        this.emit(RTVIEvent.UserTranscript, data);
      },
      onBotTranscript: (text) => {
        options?.callbacks?.onBotTranscript?.(text);
        this.emit(RTVIEvent.BotTranscript, text);
      },
      onBotLlmText: (text) => {
        options?.callbacks?.onBotLlmText?.(text);
        this.emit(RTVIEvent.BotLlmText, text);
      },
      onBotLlmStarted: () => {
        options?.callbacks?.onBotLlmStarted?.();
        this.emit(RTVIEvent.BotLlmStarted);
      },
      onBotLlmStopped: () => {
        options?.callbacks?.onBotLlmStopped?.();
        this.emit(RTVIEvent.BotLlmStopped);
      },
      onBotTtsText: (text) => {
        options?.callbacks?.onBotTtsText?.(text);
        this.emit(RTVIEvent.BotTtsText, text);
      },
      onBotTtsStarted: () => {
        options?.callbacks?.onBotTtsStarted?.();
        this.emit(RTVIEvent.BotTtsStarted);
      },
      onBotTtsStopped: () => {
        options?.callbacks?.onBotTtsStopped?.();
        this.emit(RTVIEvent.BotTtsStopped);
      },
    };

    // Update options to reference wrapped callbacks and config defaults
    this._options = {
      ...options,
      callbacks: wrappedCallbacks,
      enableMic: options.enableMic ?? true,
      enableCam: options.enableCam ?? false,
    };

    // Instantiate the transport class and bind message handler
    this._initialize();

    // Get package version number
    logger.debug("[Pipecat Client] Initialized", this.version);
  }

  public setLogLevel(level: LogLevel) {
    logger.setLevel(level);
  }

  // ------ Transport methods

  /**
   * Initialize local media devices
   */
  public async initDevices() {
    logger.debug("[Pipecat Client] Initializing devices...");
    await this._transport.initDevices();
  }

  /**
   * Connect the voice client session with chosen transport
   * Call async (await) to handle errors
   */
  public async connect(
    connectParams?: TransportConnectionParams | ConnectionEndpoint
  ): Promise<unknown> {
    if (
      ["authenticating", "connecting", "connected", "ready"].includes(
        this._transport.state
      )
    ) {
      throw new RTVIErrors.RTVIError(
        "Voice client has already been started. Please call disconnect() before starting again."
      );
    }

    // Establish transport session and await bot ready signal
    return new Promise((resolve, reject) => {
      (async () => {
        this._startResolve = resolve;

        if (this._transport.state === "disconnected") {
          await this._transport.initDevices();
        }

        try {
          let cxnParams: TransportConnectionParams;
          if (connectParams) {
            if (isConnectionEndpoint(connectParams)) {
              this._abortController = new AbortController();
              cxnParams = await getTransportConnectionParams(
                connectParams as ConnectionEndpoint,
                this._abortController
              );
              if (this._abortController?.signal.aborted) return;
            } else {
              cxnParams = connectParams as TransportConnectionParams;
            }
          }
          await this._transport.connect(cxnParams);
          await this._transport.sendReadyMessage();
        } catch (e) {
          this.disconnect();
          reject(e);
          return;
        }
      })();
    });
  }

  /**
   * Disconnect the voice client from the transport
   * Reset / reinitialize transport and abort any pending requests
   */
  public async disconnect(): Promise<void> {
    await this._transport.disconnect();
    this._messageDispatcher.clearQueue();
  }

  private _initialize() {
    this._transport.initialize(this._options, this.handleMessage.bind(this));

    // Create a new message dispatch queue for async message handling
    this._messageDispatcher = new MessageDispatcher(
      this._transport.sendMessage.bind(this._transport)
    );
  }

  /**
   * Get the current state of the transport
   */
  public get connected(): boolean {
    return ["connected", "ready"].includes(this._transport.state);
  }

  public get transport(): Transport {
    return this._transportWrapper.proxy;
  }

  public get state(): TransportState {
    return this._transport.state;
  }

  public get version(): string {
    return packageJson.version;
  }

  // ------ Device methods

  public async getAllMics(): Promise<MediaDeviceInfo[]> {
    return await this._transport.getAllMics();
  }

  public async getAllCams(): Promise<MediaDeviceInfo[]> {
    return await this._transport.getAllCams();
  }

  public async getAllSpeakers(): Promise<MediaDeviceInfo[]> {
    return await this._transport.getAllSpeakers();
  }

  public get selectedMic() {
    return this._transport.selectedMic;
  }

  public get selectedCam() {
    return this._transport.selectedCam;
  }

  public get selectedSpeaker() {
    return this._transport.selectedSpeaker;
  }

  public updateMic(micId: string) {
    this._transport.updateMic(micId);
  }

  public updateCam(camId: string) {
    this._transport.updateCam(camId);
  }

  public updateSpeaker(speakerId: string) {
    this._transport.updateSpeaker(speakerId);
  }

  public enableMic(enable: boolean) {
    this._transport.enableMic(enable);
  }

  public get isMicEnabled(): boolean {
    return this._transport.isMicEnabled;
  }

  public enableCam(enable: boolean) {
    this._transport.enableCam(enable);
  }

  public get isCamEnabled(): boolean {
    return this._transport.isCamEnabled;
  }

  public tracks(): Tracks {
    return this._transport.tracks();
  }

  public enableScreenShare(enable: boolean) {
    return this._transport.enableScreenShare(enable);
  }

  public get isSharingScreen(): boolean {
    return this._transport.isSharingScreen;
  }

  // ------ Messages

  /**
   * Directly send a message to the bot via the transport
   * @param message - RTVIMessage object to send
   */
  @transportReady
  public sendClientMessage(
    data: unknown,
    callback?: (data: unknown) => void
  ): void {
    this._messageDispatcher.dispatch(data).then(callback);
  }

  public registerFunctionCallHandler(
    functionName: string,
    callback: FunctionCallCallback
  ) {
    this._functionCallCallbacks[functionName] = callback;
  }

  @transportReady
  public async appendToUserContext(
    content: unknown,
    runImmediately: boolean = false
  ) {
    const response = await this._messageDispatcher.dispatch(
      {
        role: "user",
        content,
        runImmediately,
      } as LLMContextMessage,
      RTVIMessageType.APPEND_TO_CONTEXT
    );
    const responseData = response.data as AppendToContextResultData;
    return !!responseData.result;
  }

  /**
   * Disconnects the bot, but keeps the session alive
   */
  @transportReady
  public disconnectBot(): void {
    this._transport.sendMessage(
      new RTVIMessage(RTVIMessageType.DISCONNECT_BOT, {})
    );
  }

  protected handleMessage(ev: RTVIMessage): void {
    logger.debug("[PCI Message]", ev);

    switch (ev.type) {
      case RTVIMessageType.BOT_READY:
        clearTimeout(this._connectionTimeout);
        this._startResolve?.(ev.data as BotReadyData);
        this._options.callbacks?.onBotReady?.(ev.data as BotReadyData);
        break;
      case RTVIMessageType.ERROR:
        this._options.callbacks?.onError?.(ev);
        break;
      case RTVIMessageType.SERVER_RESPONSE: {
        this._messageDispatcher.resolve(ev);
        break;
      }
      case RTVIMessageType.ERROR_RESPONSE: {
        const resp = this._messageDispatcher.reject(ev);
        this._options.callbacks?.onMessageError?.(resp as RTVIMessage);
        break;
      }
      case RTVIMessageType.USER_STARTED_SPEAKING:
        this._options.callbacks?.onUserStartedSpeaking?.();
        break;
      case RTVIMessageType.USER_STOPPED_SPEAKING:
        this._options.callbacks?.onUserStoppedSpeaking?.();
        break;
      case RTVIMessageType.BOT_STARTED_SPEAKING:
        this._options.callbacks?.onBotStartedSpeaking?.();
        break;
      case RTVIMessageType.BOT_STOPPED_SPEAKING:
        this._options.callbacks?.onBotStoppedSpeaking?.();
        break;
      case RTVIMessageType.USER_TRANSCRIPTION: {
        const TranscriptData = ev.data as TranscriptData;
        this._options.callbacks?.onUserTranscript?.(TranscriptData);
        break;
      }
      case RTVIMessageType.BOT_TRANSCRIPTION: {
        this._options.callbacks?.onBotTranscript?.(ev.data as BotLLMTextData);
        break;
      }
      case RTVIMessageType.BOT_LLM_TEXT:
        this._options.callbacks?.onBotLlmText?.(ev.data as BotLLMTextData);
        break;
      case RTVIMessageType.BOT_LLM_STARTED:
        this._options.callbacks?.onBotLlmStarted?.();
        break;
      case RTVIMessageType.BOT_LLM_STOPPED:
        this._options.callbacks?.onBotLlmStopped?.();
        break;
      case RTVIMessageType.BOT_TTS_TEXT:
        this._options.callbacks?.onBotTtsText?.(ev.data as BotTTSTextData);
        break;
      case RTVIMessageType.BOT_TTS_STARTED:
        this._options.callbacks?.onBotTtsStarted?.();
        break;
      case RTVIMessageType.BOT_TTS_STOPPED:
        this._options.callbacks?.onBotTtsStopped?.();
        break;
      case RTVIMessageType.METRICS:
        this.emit(RTVIEvent.Metrics, ev.data as PipecatMetricsData);
        this._options.callbacks?.onMetrics?.(ev.data as PipecatMetricsData);
        break;
      case RTVIMessageType.APPEND_TO_CONTEXT_RESULT:
      case RTVIMessageType.SERVER_MESSAGE: {
        this._options.callbacks?.onServerMessage?.(ev.data);
        this.emit(RTVIEvent.ServerMessage, ev.data);
        break;
      }
      case RTVIMessageType.LLM_FUNCTION_CALL: {
        const data = ev.data as LLMFunctionCallData;
        const fc = this._functionCallCallbacks[data.function_name];
        if (fc) {
          const params = {
            functionName: data.function_name,
            arguments: data.args,
          };
          fc(params).then((result) => {
            this._transport.sendMessage(
              new RTVIMessage(RTVIMessageType.LLM_FUNCTION_CALL_RESULT, {
                function_name: data.function_name,
                tool_call_id: data.tool_call_id,
                arguments: data.args,
                result,
              })
            );
          });
        }
        break;
      }
      case RTVIMessageType.BOT_LLM_SEARCH_RESPONSE: {
        const data = ev.data as BotLLMSearchResponseData;
        this._options.callbacks?.onBotLlmSearchResponse?.(data);
        this.emit(RTVIEvent.BotLlmSearchResponse, data);
        break;
      }
      default: {
        logger.debug("[Pipecat Client] Unrecognized message type", ev.type);
        break;
      }
    }
  }

  // ------ Helpers
}
