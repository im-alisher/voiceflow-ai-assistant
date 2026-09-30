import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthUserDto, UserDto, UserPreferencesDto } from '@voiceflow/shared';
import { LIMITS } from '@voiceflow/shared';
import { AppException } from '../../common';
import type { DeepPartial } from './dto/update-preferences.dto';
import type { CreateUserInput, UpdateProfileInput } from './types';
import { createDefaultUserPreferences, User } from './entities/user.entity';
import { toAuthUserDto, toUserDto } from './mappers/user.mapper';

/**
 * Owns the `users` aggregate.
 *
 * Other modules depend on this service, never on the repository, so the
 * persistence strategy can change without rippling through the codebase.
 */
@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  /**
   * Creates a user.
   *
   * The unique index on `email` is the final arbiter: a check-then-insert race
   * is caught by the `23505` violation and translated into a `CONFLICT` rather
   * than a 500.
   */
  async create(input: CreateUserInput): Promise<User> {
    const user = this.users.create({
      email: input.email.trim().toLowerCase(),
      passwordHash: input.passwordHash,
      displayName: input.displayName.trim(),
      avatarUrl: null,
      role: input.role ?? 'user',
      emailVerified: false,
      isActive: true,
      lastLoginAt: null,
      preferences: createDefaultUserPreferences(),
    });

    try {
      return await this.users.save(user);
    } catch (error) {
      if (isUniqueViolation(error, 'idx_users_email')) {
        throw AppException.conflict('An account with this email already exists', {
          field: 'email',
        });
      }
      throw error;
    }
  }

  /**
   * Case-insensitive lookup by email.
   *
   * `passwordHash` is `select: false` on the entity, so it is added explicitly
   * and then removed again unless the caller actually needs it. Authentication
   * needs it; the password-change flow does; nothing else should ever see it.
   */
  async findByEmail(email: string, options: { withPassword?: boolean } = {}): Promise<User | null> {
    const builder = this.users
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: email.trim() });

    if (!options.withPassword) {
      builder.select([
        'user.id',
        'user.email',
        'user.displayName',
        'user.avatarUrl',
        'user.role',
        'user.emailVerified',
        'user.isActive',
        'user.lastLoginAt',
        'user.preferences',
        'user.createdAt',
        'user.updatedAt',
      ]);
    } else {
      builder.addSelect('user.passwordHash');
    }

    return builder.getOne();
  }

  async findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  /** Same as `findById` but ignores deactivated accounts. */
  async findActiveById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id, isActive: true } });
  }

  /**
   * Loads a user *including* the password hash.
   *
   * Used only by credential verification and the password-change flow. Kept as
   * an explicit, narrowly named method so its callers are easy to audit, and
   * separate from `findActiveById` so the hash cannot be pulled in by accident.
   */
  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
  }

  /** Replaces the stored hash, e.g. after a rehash or a password change. */
  async savePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.users.update({ id }, { passwordHash });
  }

  async recordLogin(id: string, at: Date): Promise<void> {
    await this.users.update({ id }, { lastLoginAt: at });
  }

  async updateProfile(id: string, input: UpdateProfileInput): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw AppException.notFound('User');

    if (input.displayName !== undefined) {
      user.displayName = input.displayName.trim().slice(0, LIMITS.DISPLAY_NAME_MAX_LENGTH);
    }
    if (input.avatarUrl !== undefined) {
      user.avatarUrl = input.avatarUrl;
    }

    return this.users.save(user);
  }

  /**
   * Shallow-merges a preference patch.
   *
   * Nested groups are merged one level deep, so sending
   * `{ voice: { autoSpeak: false } }` cannot wipe the speech rate the user
   * already chose.
   */
  async updatePreferences(id: string, patch: DeepPartial<UserPreferencesDto>): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw AppException.notFound('User');

    user.preferences = mergePreferences(user.preferences, patch);
    return this.users.save(user);
  }

  toDto(user: User): UserDto {
    return toUserDto(user);
  }

  toAuthDto(user: User): AuthUserDto {
    return toAuthUserDto(user);
  }
}

/** Mutable mirror of `UserPreferencesDto`; the DTO type is deeply readonly. */
type MutablePreferences = {
  -readonly [K in keyof UserPreferencesDto]: UserPreferencesDto[K] extends object
    ? Record<string, unknown>
    : UserPreferencesDto[K];
};

function mergePreferences(
  current: UserPreferencesDto,
  patch: DeepPartial<UserPreferencesDto>,
): UserPreferencesDto {
  const next = { ...current } as unknown as MutablePreferences;

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;

    const typedKey = key as keyof MutablePreferences;
    const existing = next[typedKey];

    if (isPlainRecord(value) && isPlainRecord(existing)) {
      next[typedKey] = { ...existing, ...value } as never;
    } else {
      next[typedKey] = value as never;
    }
  }

  return next as unknown as UserPreferencesDto;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** PostgreSQL `unique_violation`. */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: string; constraint?: string };
  return candidate.code === '23505' && candidate.constraint === constraint;
}
