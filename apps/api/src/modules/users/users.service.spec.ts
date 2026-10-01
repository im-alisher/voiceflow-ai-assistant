import type { UserPreferencesDto } from '@voiceflow/shared';
import { AppException } from '../../common';
import type { Repository } from 'typeorm';
import type { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService preferences', () => {
  let repository: jest.Mocked<Repository<User>>;
  let service: UsersService;

  const existing = (preferences?: Partial<UserPreferencesDto>): User =>
    ({
      id: 'user-1',
      email: 'ada@example.com',
      displayName: 'Ada',
      avatarUrl: null,
      role: 'user',
      emailVerified: true,
      isActive: true,
      lastLoginAt: null,
      preferences: {
        ...defaults(),
        ...preferences,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as User;

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      save: jest.fn((entity: User) => Promise.resolve(entity)),
      create: jest.fn((partial: Partial<User>) => partial as User),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    service = new UsersService(repository);
  });

  it('merges a nested voice patch without disturbing sibling keys', async () => {
    repository.findOne.mockResolvedValue(
      existing({ voice: { ...defaults().voice, speechRate: 1.5 } }),
    );

    const updated = await service.updatePreferences('user-1', { voice: { autoSpeak: false } });

    expect(updated.preferences.voice.autoSpeak).toBe(false);
    expect(updated.preferences.voice.speechRate).toBe(1.5);
    expect(updated.preferences.theme).toBe('system');
  });

  it('applies a top-level patch', async () => {
    repository.findOne.mockResolvedValue(existing());

    const updated = await service.updatePreferences('user-1', { theme: 'dark' });

    expect(updated.preferences.theme).toBe('dark');
  });

  it('ignores an explicit undefined so a spread of absent fields is a no-op', async () => {
    repository.findOne.mockResolvedValue(existing());

    const updated = await service.updatePreferences('user-1', {
      theme: undefined,
      fontScale: undefined,
    });

    expect(updated.preferences.theme).toBe('system');
    expect(updated.preferences.fontScale).toBe('base');
  });

  it('throws NOT_FOUND for a user that no longer exists', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.updatePreferences('ghost', {})).rejects.toThrow(AppException);
  });

  it('trims and bounds a display name', async () => {
    repository.findOne.mockResolvedValue(existing());

    const updated = await service.updateProfile('user-1', {
      displayName: `  ${'x'.repeat(200)}  `,
    });

    expect(updated.displayName).toHaveLength(64);
    expect(updated.displayName.startsWith(' ')).toBe(false);
  });
});

function defaults(): UserPreferencesDto {
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
