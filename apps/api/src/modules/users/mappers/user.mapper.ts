import type { AuthUserDto, UserDto } from '@voiceflow/shared';
import type { User } from '../entities/user.entity';

/** Entity -> transport mappers. Never expose an entity directly from a controller. */

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    emailVerified: user.emailVerified,
    preferences: user.preferences,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/** Narrower projection for token payloads and `/auth/me`. */
export function toAuthUserDto(user: User): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}
