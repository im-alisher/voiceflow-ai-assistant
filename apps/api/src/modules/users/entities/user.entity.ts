import type { UserPreferencesDto, UserRole } from '@voiceflow/shared';
import { Column, Entity, Index, type ValueTransformer } from 'typeorm';
import { BaseEntity } from '../../../common/entity';

/**
 * Preferences shipped with every new account.
 *
 * Keeping the defaults in one factory (rather than as a database default) means
 * the client, the API and a future migration all agree on the same object
 * shape, and "reset to defaults" is a single call.
 */
export function createDefaultUserPreferences(): UserPreferencesDto {
  return {
    theme: 'system',
    fontScale: 'base',
    language: 'en',
    timezone: 'UTC',
    voice: {
      autoListen: true,
      autoSpeak: true,
      speechRate: 1,
      speechPitch: 1,
      speechVolume: 1,
      preferredLocale: 'en-US',
      silenceTimeoutMs: 2500,
    },
    ai: {
      providerId: 'mock',
      model: 'mock-assistant-v1',
      temperature: 0.7,
      systemPrompt: null,
      maxHistoryMessages: 20,
      streamingEnabled: true,
    },
    notifications: { email: true, push: false, desktop: true },
    accessibility: { reducedMotion: false, highContrast: false, captions: false },
  };
}

/**
 * Merges a stored preferences blob over the defaults.
 *
 * A column that predates a new preference (or a row written by an older build)
 * would otherwise hydrate as a partial object and crash deep inside a consumer.
 * Re-applying defaults for anything missing makes adding a preference a
 * backwards-compatible change.
 */
export function withPreferenceDefaults(value: unknown): UserPreferencesDto {
  const defaults = createDefaultUserPreferences();
  if (!isRecord(value)) return defaults;

  const partial = value as Partial<UserPreferencesDto>;
  return {
    ...defaults,
    ...partial,
    voice: { ...defaults.voice, ...(isRecord(partial.voice) ? partial.voice : {}) },
    ai: { ...defaults.ai, ...(isRecord(partial.ai) ? partial.ai : {}) },
    notifications: {
      ...defaults.notifications,
      ...(isRecord(partial.notifications) ? partial.notifications : {}),
    },
    accessibility: {
      ...defaults.accessibility,
      ...(isRecord(partial.accessibility) ? partial.accessibility : {}),
    },
  };
}

export const userPreferencesTransformer: ValueTransformer = {
  to: withPreferenceDefaults,
  from: withPreferenceDefaults,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Entity({ name: 'users' })
@Index('idx_users_email', ['email'], { unique: true })
export class User extends BaseEntity {
  /** Normalised to lowercase at the application boundary, never in the DB. */
  @Column({ type: 'varchar', length: 254 })
  email!: string;

  /** Excluded from default selects so it can never leak through a list query. */
  @Column({ name: 'password_hash', type: 'varchar', length: 120, select: false })
  passwordHash!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 64 })
  displayName!: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 2048, nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'user' })
  role!: UserRole;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @Column({
    type: 'jsonb',
    default: () => "'{}'::jsonb",
    transformer: userPreferencesTransformer,
  })
  preferences!: UserPreferencesDto;
}
