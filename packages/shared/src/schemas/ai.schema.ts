import { z } from 'zod';
import { MESSAGE_INPUT_MODES, VOICE_ERROR_CODES } from '../enums';
import { aiProviderIdSchema, uuidSchema } from './common.schema';

/** Body accepted by the agent orchestrator (`POST /ai/agent/stream`). */
export const agentRequestSchema = z.object({
  conversationId: uuidSchema.optional(),
  message: z.string().trim().min(1).max(8000),
  inputMode: z.enum(MESSAGE_INPUT_MODES).default('text'),
  providerId: aiProviderIdSchema.optional(),
  model: z.string().trim().min(1).max(120).optional(),
  systemPrompt: z.string().trim().max(4000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().min(16).max(8192).optional(),
  clientMessageId: z.string().trim().min(8).max(120).optional(),
});

export const voiceTranscriptionSchema = z.object({
  conversationId: uuidSchema.optional(),
  locale: z.string().trim().min(2).max(16).default('en-US'),
  /** Base64 PCM/WAV payload produced by the browser capture pipeline. */
  audioBase64: z.string().min(1).optional(),
  /** Present when the browser performed recognition locally. */
  transcript: z.string().trim().min(1).max(8000).optional(),
  durationMs: z.number().int().min(0).max(300000).default(0),
});

export const voiceSynthesisSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  locale: z.string().trim().min(2).max(16).default('en-US'),
  rate: z.number().min(0.5).max(2).default(1),
  pitch: z.number().min(0).max(2).default(1),
  volume: z.number().min(0).max(1).default(1),
});

export const voiceErrorCodeSchema = z.enum(VOICE_ERROR_CODES);

export type AgentRequest = z.infer<typeof agentRequestSchema>;
export type VoiceTranscriptionRequest = z.infer<typeof voiceTranscriptionSchema>;
export type VoiceSynthesisRequest = z.infer<typeof voiceSynthesisSchema>;
