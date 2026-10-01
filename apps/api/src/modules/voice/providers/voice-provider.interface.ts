import type {
  Result,
  SynthesisResultDto,
  TranscriptionResultDto,
  VoiceOptionDto,
  VoiceErrorCode,
} from '@voiceflow/shared';

export interface TranscriptionInput {
  readonly audio: Buffer;
  readonly mimeType: string;
  readonly locale: string;
  /** Client-measured capture length; providers that cannot measure use this. */
  readonly durationMs: number;
  readonly signal?: AbortSignal;
}

/**
 * Server-side speech-to-text port.
 *
 * Mirrors the client-side `SpeechToTextProvider` in shared, but for the case
 * where the browser has no Web Speech API (or the user declined the microphone)
 * and the clip has to be sent upstream instead.
 *
 * Implementors return a `Result` rather than throwing, for the same reason the
 * AI providers do: a permission denial or a missing engine is an expected
 * outcome, not an exceptional one.
 */
export interface ServerTranscriptionProvider {
  readonly id: string;
  isAvailable(): Promise<boolean>;
  transcribe(input: TranscriptionInput): Promise<Result<TranscriptionResultDto, VoiceErrorCode>>;
}

export interface SynthesisInput {
  readonly text: string;
  readonly locale: string;
  readonly rate: number;
  readonly pitch: number;
  readonly volume: number;
  readonly signal?: AbortSignal;
}

/**
 * Server-side text-to-speech port.
 *
 * `producesAudio` is explicit rather than inferred from a successful call: the
 * bundled mock always succeeds but returns no audio, and the client needs to
 * know in advance whether to fall back to the browser engine.
 */
export interface ServerSynthesisProvider {
  readonly id: string;
  readonly producesAudio: boolean;
  isAvailable(): Promise<boolean>;
  voices(): readonly VoiceOptionDto[];
  synthesize(input: SynthesisInput): Promise<Result<SynthesisResultDto, VoiceErrorCode>>;
}

/** Reported when no provider has been registered for the requested capability. */
export const NO_PROVIDER: VoiceErrorCode = 'NOT_SUPPORTED';
