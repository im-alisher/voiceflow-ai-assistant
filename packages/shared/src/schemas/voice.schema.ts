import { z } from 'zod';
import { LIMITS } from '../constants/limits';
import { VOICE_ERROR_CODES } from '../enums/voice.enum';

/** BCP-47-ish tag: a language subtag, optionally with a region. */
const localeSchema = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'Locale must be a valid language tag');

/**
 * Synthesis request.
 *
 * Rates are bounded well away from the 0–2/0–1 ranges the Web Speech API
 * accepts: values outside this produce either silence or unintelligible output,
 * so they are rejected rather than clamped silently.
 */
export const synthesizeSchema = z.object({
  text: z.string().trim().min(1).max(LIMITS.SYNTHESIS_MAX_LENGTH),
  locale: localeSchema.default('en-US'),
  rate: z.coerce.number().min(0.5).max(2).default(1),
  pitch: z.coerce.number().min(0).max(2).default(1),
  volume: z.coerce.number().min(0).max(1).default(1),
});

/** Metadata for an uploaded clip; the bytes themselves travel as multipart. */
export const transcribeSchema = z.object({
  locale: localeSchema.default('en-US'),
  /** Client-measured capture length, used for the duration echoed back. */
  durationMs: z.coerce.number().int().min(0).max(LIMITS.SPEECH_MAX_DURATION_MS).default(0),
  mimeType: z.string().trim().max(120).default('audio/webm'),
});

export type SynthesizeRequest = z.infer<typeof synthesizeSchema>;
export type TranscribeRequest = z.infer<typeof transcribeSchema>;
export { localeSchema as voiceLocaleSchema, VOICE_ERROR_CODES };
