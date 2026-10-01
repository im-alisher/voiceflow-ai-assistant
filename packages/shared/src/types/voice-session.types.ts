import type { VoiceErrorCode } from '../enums/voice.enum';

/**
 * Server-side result of a speech-to-text call.
 *
 * `providerId` is always echoed back so the UI can show which engine produced
 * a transcript instead of implying a real vendor was involved.
 */
export interface TranscriptionResultDto {
  readonly transcript: string;
  /** 0–1. Deterministic providers return a documented fixed value. */
  readonly confidence: number;
  readonly locale: string;
  readonly durationMs: number;
  readonly isFinal: boolean;
  readonly providerId: string;
}

/**
 * Server-side synthesis result.
 *
 * `audioBase64` is null whenever the active provider cannot produce audio
 * (which is the case for the bundled mock). The client then falls back to the
 * browser's own speech engine rather than reporting a silent failure.
 */
export interface SynthesisResultDto {
  readonly audioBase64: string | null;
  readonly mimeType: string | null;
  readonly characterCount: number;
  readonly estimatedDurationMs: number;
  readonly locale: string;
  readonly rate: number;
  readonly pitch: number;
  readonly volume: number;
  readonly providerId: string;
  /** Set when the request failed; lets the UI degrade to browser synthesis. */
  readonly errorCode?: VoiceErrorCode;
}

/** A synthesis voice offered by the API. */
export interface VoiceOptionDto {
  readonly id: string;
  readonly name: string;
  readonly locale: string;
  readonly gender: 'female' | 'male' | 'neutral';
  readonly providerId: string;
  readonly isDefault: boolean;
}

/** Request-time hints for synthesis. */
export interface SynthesisOptions {
  readonly locale: string;
  readonly rate: number;
  readonly pitch: number;
  readonly volume: number;
}
