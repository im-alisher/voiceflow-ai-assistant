import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  API_ROUTES,
  SPEECH_SESSIONS_STATUSES,
  type SpeechSessionStatus,
  type SpeechToTextProvider,
  type SynthesisResultDto,
  type VoiceOptionDto,
} from '@voiceflow/shared';
import { api } from '@/lib/api-client';
import {
  AudioCaptureError,
  MicrophoneRecorder,
  isRecordingSupported,
  type LevelMeter,
} from './recorder';
import { WebSpeechSttProvider, isSpeechRecognitionSupported } from './web-speech-stt';
import { MockSttProvider, WebSpeechTtsProvider } from './web-speech-tts';

export type SttEngine = 'web-speech' | 'mock' | 'server';

export interface VoiceLabState {
  readonly status: SpeechSessionStatus;
  /** Live microphone level, 0–1. */
  readonly level: number;
  /** Interim text while speaking; becomes the transcript on stop. */
  readonly interim: string;
  readonly transcript: string;
  readonly error: string | null;
  readonly engine: SttEngine;
  readonly canRecord: boolean;
  readonly elapsedMs: number;
}

const IDLE: VoiceLabState = {
  status: 'idle',
  level: 0,
  interim: '',
  transcript: '',
  error: null,
  engine: 'web-speech',
  canRecord: false,
  elapsedMs: 0,
};

function pickSttEngine(preferred: SttEngine): SpeechToTextProvider {
  if (preferred === 'web-speech' && isSpeechRecognitionSupported())
    return new WebSpeechSttProvider();
  if (preferred === 'mock') return new MockSttProvider();
  if (isSpeechRecognitionSupported()) return new WebSpeechSttProvider();
  return new MockSttProvider();
}

/**
 * Voice lab state machine.
 *
 * Two engines cooperate, and the distinction matters: `MediaRecorder` captures
 * audio (and feeds the level meter) while the speech-to-text provider
 * transcribes it. On browsers with the Web Speech API the provider does its own
 * capture and the recorded blob is only uploaded when the user explicitly asks
 * for server-side transcription.
 */
export function useVoiceLab(preferredEngine: SttEngine = 'web-speech') {
  const [state, setState] = useState<VoiceLabState>(IDLE);
  const recorderRef = useRef<MicrophoneRecorder | null>(null);
  const meterRef = useRef<LevelMeter | null>(null);
  const providerRef = useRef<SpeechToTextProvider | null>(null);
  const unsubscribesRef = useRef<(() => void)[]>([]);
  const startedAtRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const stopTimers = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (tickRef.current !== null) window.clearInterval(tickRef.current);
    frameRef.current = null;
    tickRef.current = null;
  }, []);

  const releaseEngine = useCallback(() => {
    for (const off of unsubscribesRef.current) off();
    unsubscribesRef.current = [];
    providerRef.current = null;
    meterRef.current?.dispose();
    meterRef.current = null;
  }, []);

  const stopMeters = useCallback(() => {
    stopTimers();
    meterRef.current?.dispose();
    meterRef.current = null;
  }, [stopTimers]);

  useEffect(
    () => () => {
      stopTimers();
      releaseEngine();
      recorderRef.current?.abort();
    },
    [releaseEngine, stopTimers],
  );

  const start = useCallback(async () => {
    setState((current) => ({
      ...current,
      status: 'listening',
      error: null,
      transcript: '',
      interim: '',
    }));

    const engine = pickSttEngine(preferredEngine);
    providerRef.current = engine;
    startedAtRef.current = Date.now();

    unsubscribesRef.current = [
      engine.on('partial', ((text: string) => {
        setState((current) => ({ ...current, interim: text }));
      }) as never),
      engine.on('error', ((detail: { code?: string }) => {
        setState((current) => ({
          ...current,
          status: 'failed',
          error: describeSttError(detail?.code),
        }));
      }) as never),
    ];

    // Level metering runs off the recorder when capture is possible; otherwise
    // the meter stays flat and the UI says so rather than faking motion.
    if (isRecordingSupported()) {
      try {
        const recorder = new MicrophoneRecorder();
        recorderRef.current = recorder;
        meterRef.current = await recorder.start();

        const pump = () => {
          setState((current) => ({ ...current, level: meterRef.current?.read() ?? 0 }));
          frameRef.current = requestAnimationFrame(pump);
        };
        frameRef.current = requestAnimationFrame(pump);
        tickRef.current = window.setInterval(() => {
          setState((current) => ({ ...current, elapsedMs: Date.now() - startedAtRef.current }));
        }, 100);
      } catch (error) {
        setState((current) => ({
          ...current,
          status: 'failed',
          error:
            error instanceof AudioCaptureError
              ? error.message
              : 'The microphone could not be started.',
        }));
        return;
      }
    }

    try {
      await engine.start({
        locale: 'en-US',
        interimResults: true,
        continuous: false,
        maxDurationMs: 30_000,
      });
    } catch (error) {
      stopMeters();
      releaseEngine();
      setState((current) => ({
        ...current,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Recognition could not start.',
      }));
    }
  }, [preferredEngine, releaseEngine, stopMeters]);

  const stop = useCallback(async () => {
    const provider = providerRef.current;
    setState((current) => ({ ...current, status: 'processing', interim: '' }));

    const result = provider ? await provider.stop() : null;
    if (recorderRef.current) await recorderRef.current.stop().catch(() => undefined);

    stopMeters();
    releaseEngine();
    recorderRef.current = null;

    const transcript = result?.transcript.trim() ?? '';
    setState((current) => ({
      ...current,
      status: 'idle',
      level: 0,
      elapsedMs: Date.now() - startedAtRef.current,
      transcript,
      interim: '',
      error: transcript ? null : (current.error ?? 'No speech was detected. Try again.'),
    }));
  }, [releaseEngine, stopMeters]);

  const cancel = useCallback(() => {
    providerRef.current?.abort();
    recorderRef.current?.abort();
    stopMeters();
    releaseEngine();
    recorderRef.current = null;
    setState(IDLE);
  }, [releaseEngine, stopMeters]);

  const clear = useCallback(() => {
    setState((current) => ({ ...IDLE, engine: current.engine }));
  }, []);

  return {
    state: { ...state, canRecord: isRecordingSupported() },
    start,
    stop,
    cancel,
    clear,
    statuses: SPEECH_SESSIONS_STATUSES,
  };
}

/** Synthesis voices offered by the API. */
export function useVoiceOptions() {
  return useQuery({
    queryKey: ['voice', 'voices'],
    queryFn: () => api.get<readonly VoiceOptionDto[]>(API_ROUTES.voice.voices),
    staleTime: 5 * 60_000,
  });
}

/**
 * Speaks text through the browser engine.
 *
 * Prefers local synthesis: it needs no round trip and the bundled provider
 * cannot produce audio anyway. The server route is only consulted when asked.
 */
export function useSpeaker() {
  const providerRef = useRef<WebSpeechTtsProvider | null>(null);

  const speak = useCallback(
    async (
      text: string,
      options?: { locale?: string; rate?: number; pitch?: number; volume?: number },
    ) => {
      providerRef.current ??= new WebSpeechTtsProvider();
      await providerRef.current.speak({
        text,
        locale: options?.locale ?? 'en-US',
        rate: options?.rate ?? 1,
        pitch: options?.pitch ?? 1,
        volume: options?.volume ?? 1,
      });
    },
    [],
  );

  const stop = useCallback(() => providerRef.current?.stop(), []);

  useEffect(() => () => providerRef.current?.stop(), []);

  return { speak, stop, isSupported: typeof window !== 'undefined' && 'speechSynthesis' in window };
}

/** Asks the API to synthesise, for deployments with a real engine configured. */
export async function requestServerSynthesis(body: {
  text: string;
  locale?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}): Promise<SynthesisResultDto> {
  return api.post<SynthesisResultDto>(API_ROUTES.voice.synthesize, {
    text: body.text,
    locale: body.locale ?? 'en-US',
    rate: body.rate ?? 1,
    pitch: body.pitch ?? 1,
    volume: body.volume ?? 1,
  });
}

function describeSttError(code?: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was denied. Allow it in your browser settings.';
    case 'no-speech':
      return 'No speech was detected. Try speaking closer to the microphone.';
    case 'audio-capture':
      return 'No microphone was found.';
    case 'network':
      return 'The recognition service could not be reached.';
    default:
      return 'Speech recognition failed.';
  }
}
