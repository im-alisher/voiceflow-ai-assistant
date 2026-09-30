import type { FontScale, ThemeMode, UserRole } from '../enums';

/** Public projection of a user. Never contains credentials. */
export interface UserDto {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly role: UserRole;
  readonly emailVerified: boolean;
  readonly preferences: UserPreferencesDto;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface UpdateProfileInput {
  readonly displayName?: string;
  readonly avatarUrl?: string | null;
}

export interface UserPreferencesDto {
  readonly theme: ThemeMode;
  readonly fontScale: FontScale;
  readonly language: string;
  readonly timezone: string;
  readonly voice: VoicePreferencesDto;
  readonly ai: AiPreferencesDto;
  readonly notifications: NotificationPreferencesDto;
  readonly accessibility: AccessibilityPreferencesDto;
}

export interface VoicePreferencesDto {
  readonly autoListen: boolean;
  readonly autoSpeak: boolean;
  readonly speechRate: number;
  readonly speechPitch: number;
  readonly speechVolume: number;
  readonly preferredLocale: string;
  readonly silenceTimeoutMs: number;
}

export interface AiPreferencesDto {
  readonly providerId: string;
  readonly model: string;
  readonly temperature: number;
  readonly systemPrompt: string | null;
  readonly maxHistoryMessages: number;
  readonly streamingEnabled: boolean;
}

export interface NotificationPreferencesDto {
  readonly email: boolean;
  readonly push: boolean;
  readonly desktop: boolean;
}

export interface AccessibilityPreferencesDto {
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
  readonly captions: boolean;
}
