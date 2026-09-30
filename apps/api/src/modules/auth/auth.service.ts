import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthUserDto, AuthTokensDto } from '@voiceflow/shared';
import { AppException } from '../../common';
import { UsersService } from '../users/users.service';
import { TokenService } from './services/token.service';

/**
 * Orchestrates authentication concerns.
 *
 * Scoped narrowly: credential verification and session lifecycle live here,
 * while token *cryptography* lives in `TokenService` and password *hashing* in
 * `PasswordService`. Neither of those needs to know about HTTP.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Resolves the principal for an already-authenticated request.
   *
   * Re-reads the user so a deactivated account loses access immediately rather
   * than at the end of the access token's lifetime.
   */
  async resolvePrincipal(userId: string): Promise<AuthUserDto> {
    const user = await this.users.findActiveById(userId);
    if (!user) {
      throw AppException.unauthorized('Account is no longer active');
    }
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }

  /** Fresh session identifier stamped into every token pair. */
  createSessionId(): string {
    return randomUUID();
  }

  async issueTokenPair(params: {
    userId: string;
    email: string;
    role: AuthUserDto['role'];
    sessionId: string;
    rememberMe: boolean;
  }): Promise<{ tokens: AuthTokensDto; refreshToken: string; refreshExpiresAt: Date }> {
    const access = await this.tokens.signAccessToken({
      userId: params.userId,
      email: params.email,
      role: params.role,
      sessionId: params.sessionId,
    });

    const refreshToken = this.tokens.generateRefreshToken();
    const refreshExpiresAt = new Date(
      Date.now() + this.tokens.refreshLifetimeFor(params.rememberMe) * 1000,
    );

    return {
      refreshToken,
      refreshExpiresAt,
      tokens: {
        accessToken: access.token,
        refreshToken,
        accessTokenExpiresAt: access.expiresAt.toISOString(),
        refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
        tokenType: 'Bearer',
      },
    };
  }
}
