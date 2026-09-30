import type { UserRole } from '../enums';

/** Public projection of the authenticated principal. */
export interface AuthUserDto {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: UserRole;
}

export interface AuthTokensDto {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessTokenExpiresAt: string;
  readonly refreshTokenExpiresAt: string;
  readonly tokenType: 'Bearer';
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
  /** Marks the session so the API can apply a longer refresh lifetime. */
  readonly rememberMe?: boolean;
}

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly acceptedTerms: boolean;
}

export interface RefreshInput {
  readonly refreshToken?: string;
}

export interface AuthSessionDto {
  readonly user: AuthUserDto;
  readonly tokens: AuthTokensDto;
}

export interface ChangePasswordInput {
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface TokenPairPayload {
  readonly userId: string;
  readonly email: string;
  readonly role: UserRole;
  /** `sessionId` lets a single device be revoked without touching the others. */
  readonly sessionId: string;
}
