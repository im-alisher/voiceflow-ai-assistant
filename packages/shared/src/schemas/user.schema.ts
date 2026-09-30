import { z } from 'zod';
import { AI_PROVIDER_IDS, FONT_SCALES, THEME_MODES } from '../enums';
import { localeSchema, timeZoneSchema } from './common.schema';

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(64).optional(),
    avatarUrl: z.string().url().max(2048).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export const voicePreferencesSchema = z.object({
  autoListen: z.boolean(),
  autoSpeak: z.boolean(),
  speechRate: z.number().min(0.5).max(2),
  speechPitch: z.number().min(0).max(2),
  speechVolume: z.number().min(0).max(1),
  preferredLocale: localeSchema,
  silenceTimeoutMs: z.number().int().min(500).max(30000),
});

export const aiPreferencesSchema = z.object({
  providerId: z.enum(AI_PROVIDER_IDS),
  model: z.string().trim().min(1).max(120),
  temperature: z.number().min(0).max(2),
  systemPrompt: z.string().trim().max(4000).nullable(),
  maxHistoryMessages: z.number().int().min(0).max(100),
  streamingEnabled: z.boolean(),
});

export const notificationPreferencesSchema = z.object({
  email: z.boolean(),
  push: z.boolean(),
  desktop: z.boolean(),
});

export const accessibilityPreferencesSchema = z.object({
  reducedMotion: z.boolean(),
  highContrast: z.boolean(),
  captions: z.boolean(),
});

export const updatePreferencesSchema = z
  .object({
    theme: z.enum(THEME_MODES).optional(),
    fontScale: z.enum(FONT_SCALES).optional(),
    language: localeSchema.optional(),
    timezone: timeZoneSchema.optional(),
    voice: voicePreferencesSchema.partial().optional(),
    ai: aiPreferencesSchema.partial().optional(),
    notifications: notificationPreferencesSchema.partial().optional(),
    accessibility: accessibilityPreferencesSchema.partial().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one preference must be provided',
  });

export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesRequest = z.infer<typeof updatePreferencesSchema>;
export type VoicePreferencesInput = z.infer<typeof voicePreferencesSchema>;
export type AiPreferencesInput = z.infer<typeof aiPreferencesSchema>;
