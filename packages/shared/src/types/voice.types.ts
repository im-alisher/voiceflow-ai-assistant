/**
 * Port exposed to the UI for speech-to-text.
 * Implementations: `WebSpeechSttProvider` (real, browser-native) and
 * `MockSttProvider` (deterministic, used in tests and when the browser lacks
 * the Web Speech API).
 */
export interface SpeechToTextProvider {
  readonly id: string;
  readonly isSupported: boolean;
  start(options?: StartListeningOptions): Promise<void>;
  stop(): Promise<SpeechToTextResult>;
  abort(): void;
  on(event: SttEventName, listener: SttEventListener): () => void;
}

export interface StartListeningOptions {
  readonly locale?: string;
  readonly continuous?: boolean;
  readonly interimResults?: boolean;
  readonly maxDurationMs?: number;
}

export const STT_EVENTS = ['result', 'partial', 'error', 'end', 'start', 'volume'] as const;

export type SttEventName = (typeof STT_EVENTS)[number];
export type SttEventListener = (payload: never) => void;

export interface SpeechToTextResult {
  readonly transcript: string;
  /** 0–1. Mock providers return a fixed, documented confidence. */
  readonly confidence: number;
  readonly locale: string;
  readonly durationMs: number;
  readonly isFinal: boolean;
}

/** Port exposed to the UI for text-to-speech. */
export interface TextToSpeechProvider {
  readonly id: string;
  readonly isSupported: boolean;
  speak(options: SpeakOptions): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  on(event: TtsEventName, listener: TtsEventListener): () => void;
}

export interface SpeakOptions {
  readonly text: string;
  readonly locale?: string;
  readonly rate?: number;
  readonly pitch?: number;
  readonly volume?: number;
  /** Fired per word so the UI can highlight while reading aloud. */
  readonly onBoundary?: (charIndex: number) => void;
}

export const TTS_EVENTS = ['start', 'end', 'error', 'boundary'] as const;

export type TtsEventName = (typeof TTS_EVENTS)[number];
export type TtsEventListener = (payload: never) => void;
