/**
 * How an individual turn entered the system.
 *
 * The UI uses this to pick an icon / badge and to allow per-turn analytics
 * without inspecting the raw payload.
 */
export const MESSAGE_INPUT_MODES = ['text', 'voice'] as const;

export type MessageInputMode = (typeof MESSAGE_INPUT_MODES)[number];

/** Terminal state of a voice capture (speech-to-text) operation. */
export const SPEECH_SESSIONS_STATUSES = ['idle', 'listening', 'processing', 'failed'] as const;

export type SpeechSessionStatus = (typeof SPEECH_SESSIONS_STATUSES)[number];

/** Terminal state of a speech synthesis (text-to-speech) operation. */
export const SPEECH_SYNTHESIS_STATUSES = [
  'idle',
  'speaking',
  'paused',
  'stopped',
  'failed',
] as const;

export type SpeechSynthesisStatus = (typeof SPEECH_SYNTHESIS_STATUSES)[number];

/**
 * Why a voice interaction failed, independent of the concrete engine.
 *
 * These are transport-level codes; the API maps them onto `ApiErrorCode` before
 * they reach a client.
 */
export const VOICE_ERROR_CODES = [
  'NOT_SUPPORTED',
  'PERMISSION_DENIED',
  'NO_SPEECH_DETECTED',
  'NETWORK_ERROR',
  'CANCELLED',
  'ENGINE_ERROR',
] as const;

export type VoiceErrorCode = (typeof VOICE_ERROR_CODES)[number];
