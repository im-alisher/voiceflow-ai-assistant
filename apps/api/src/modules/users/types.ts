import type { UserRole } from '@voiceflow/shared';

export interface CreateUserInput {
  readonly email: string;
  readonly passwordHash: string;
  readonly displayName: string;
  readonly role?: UserRole;
}

export interface UpdateProfileInput {
  readonly displayName?: string;
  readonly avatarUrl?: string | null;
}
