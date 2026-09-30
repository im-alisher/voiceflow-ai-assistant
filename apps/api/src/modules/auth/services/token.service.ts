import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { TokenPairPayload, UserRole } from '@voiceflow/shared';
import { TOKEN_DEFAULTS } from '@voiceflow/shared';
import { AppException, CLOCK, type Clock } from '../../../common';
import { CONFIG_NAMESPACE, type AuthConfig } from '../../../config';

/** Access token lifetimes are short; this converts a `15m` string to seconds. */
const DURATION_PATTERN = /^(\d+)([smhd])$/;

export function durationToSeconds(value: string): number {
  const match = DURATION_PATTERN.exec(value);
  if (!match) return TOKEN_DEFAULTS.ACCESS_TTL_SECONDS;
  const amount = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  const multiplier = { s: 1, m: 60, h: 3600, d: 86_400 }[unit];
  return amount * multiplier;
}

/**
 * Issues and verifies the credential pair.
 *
 * Asymmetric by design:
 *  - the **access token** is a short-lived JWT and is stateless, so every
 *    request is authorised without a database round trip
 *  - the **refresh token** is an opaque 384-bit random string; only its SHA-256
 *    digest is persisted, which makes revocation immediate and a database leak
 *    worthless to an attacker
 */
@Injectable()
export class TokenService {
  private readonly auth: AuthConfig;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.auth = this.config.getOrThrow<AuthConfig>(CONFIG_NAMESPACE.AUTH);
    this.accessTtlSeconds = durationToSeconds(this.auth.accessTtl);
    this.refreshTtlSeconds = durationToSeconds(this.auth.refreshTtl);
  }

  get refreshLifetimeSeconds(): number {
    return this.refreshTtlSeconds;
  }

  /** `rememberMe` extends the refresh window without touching the access TTL. */
  refreshLifetimeFor(rememberMe: boolean): number {
    return rememberMe ? this.refreshTtlSeconds * 4 : this.refreshTtlSeconds;
  }

  async signAccessToken(payload: TokenPairPayload): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(this.clock.nowMs() + this.accessTtlSeconds * 1000);
    const token = await this.jwt.signAsync(
      { sub: payload.userId, email: payload.email, role: payload.role, sid: payload.sessionId },
      {
        secret: this.auth.accessSecret,
        expiresIn: this.accessTtlSeconds,
        issuer: this.auth.issuer,
        audience: this.auth.audience,
      },
    );
    return { token, expiresAt };
  }

  /** Raw, high-entropy refresh token. Only the digest is ever stored. */
  generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async verifyAccessToken(token: string): Promise<TokenPairPayload> {
    try {
      const claims = await this.jwt.verifyAsync<{
        sub: string;
        email: string;
        role: UserRole;
        sid: string;
      }>(token, {
        secret: this.auth.accessSecret,
        issuer: this.auth.issuer,
        audience: this.auth.audience,
        // Tolerate a small amount of clock skew between issuer and verifier.
        clockTolerance: TOKEN_DEFAULTS.LEEWAY_SECONDS,
      });

      return {
        userId: claims.sub,
        email: claims.email,
        role: claims.role,
        sessionId: claims.sid,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new AppException('TOKEN_EXPIRED', 'Access token has expired');
      }
      throw AppException.unauthorized('Invalid access token');
    }
  }
}
