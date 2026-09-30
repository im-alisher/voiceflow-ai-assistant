import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { type UserRole } from '@voiceflow/shared';
import { AppException, CLOCK, type Clock } from '../../../common';
import { RefreshSession } from '../entities/refresh-session.entity';
import { TokenService } from '../services/token.service';

/** Session view returned by `GET /auth/sessions`; never includes the token. */
export interface SessionSummary {
  readonly id: string;
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
  readonly expiresAt: Date;
  readonly isActive: boolean;
  readonly isCurrent: boolean;
}

/** Metadata captured when a session is opened. */
export interface SessionContext {
  readonly userAgent?: string | null;
  readonly ipAddress?: string | null;
}

/**
 * Refresh-token session lifecycle.
 *
 * Three properties drive the design:
 *  - **Rotation** — every refresh mints a new token and marks the old row
 *    `rotatedAt`. A replayed, already-rotated token is treated as theft and
 *    revokes the whole family.
 *  - **Revocation is immediate** — because the access token is stateless, logout
 *    would otherwise not take effect until it expired. Revoking the session row
 *    and rejecting unknown session ids closes that window.
 *  - **Only digests are stored** — the raw refresh token exists only in the
 *    response and the `httpOnly` cookie.
 */
@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(RefreshSession)
    private readonly sessions: Repository<RefreshSession>,
    private readonly tokens: TokenService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async open(params: {
    userId: string;
    role: UserRole;
    refreshToken: string;
    expiresAt: Date;
    context: SessionContext;
  }): Promise<RefreshSession> {
    return this.sessions.save(
      this.sessions.create({
        userId: params.userId,
        tokenHash: this.tokens.hashRefreshToken(params.refreshToken),
        userAgent: truncate(params.context.userAgent ?? null, 512),
        ipAddress: truncate(params.context.ipAddress ?? null, 64),
        expiresAt: params.expiresAt,
        revokedAt: null,
        rotatedAt: null,
        lastUsedAt: this.clock.now(),
        role: params.role,
      }),
    );
  }

  /**
   * Validates a presented refresh token and returns its live session.
   *
   * Reuse detection: a token whose row is already rotated is proof that either
   * the client replayed it or it was stolen. Either way the safest response is
   * to revoke the entire session rather than continue the rotation chain.
   */
  async resolve(presentedToken: string): Promise<RefreshSession> {
    const tokenHash = this.tokens.hashRefreshToken(presentedToken);
    const session = await this.sessions.findOne({ where: { tokenHash } });

    if (!session) {
      throw AppException.unauthorized('Refresh token is not recognised');
    }

    if (session.rotatedAt !== null) {
      await this.revokeFamily(session.id);
      throw AppException.unauthorized('Refresh token has already been used');
    }

    if (!session.isActiveAt(this.clock.now())) {
      throw AppException.unauthorized('Session has expired or was signed out');
    }

    return session;
  }

  async findById(sessionId: string): Promise<RefreshSession | null> {
    return this.sessions.findOne({ where: { id: sessionId } });
  }

  /** Swaps the stored digest for a freshly minted token. */
  async rotate(
    session: RefreshSession,
    newRefreshToken: string,
    expiresAt: Date,
  ): Promise<RefreshSession> {
    session.tokenHash = this.tokens.hashRefreshToken(newRefreshToken);
    session.rotatedAt = this.clock.now();
    session.expiresAt = expiresAt;
    session.lastUsedAt = this.clock.now();
    return this.sessions.save(session);
  }

  /** Records activity without rotating, so `lastUsedAt` stays meaningful. */
  async touch(session: RefreshSession): Promise<void> {
    await this.sessions.update({ id: session.id }, { lastUsedAt: this.clock.now() });
  }

  async revoke(sessionId: string): Promise<void> {
    // `IsNull()` rather than `null`: the column is nullable, and TypeORM only
    // matches SQL NULL through an explicit operator.
    await this.sessions.update(
      { id: sessionId, revokedAt: IsNull() },
      { revokedAt: this.clock.now() },
    );
  }

  /** Signs out every device for a user, e.g. after a password change. */
  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.sessions.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: this.clock.now() },
    );
    return result.affected ?? 0;
  }

  private async revokeFamily(sessionId: string): Promise<void> {
    await this.sessions.update({ id: sessionId }, { revokedAt: this.clock.now() });
  }

  async listForUser(userId: string, currentSessionId: string): Promise<SessionSummary[]> {
    const now = this.clock.now();
    const rows = await this.sessions.find({
      where: { userId },
      order: { lastUsedAt: 'DESC' },
      take: 50,
    });

    return rows.map((row) => ({
      id: row.id,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt,
      // A session is stamped on creation, so this only falls back if a legacy
      // row predates the column.
      lastUsedAt: row.lastUsedAt ?? row.createdAt,
      expiresAt: row.expiresAt,
      isActive: row.isActiveAt(now),
      isCurrent: row.id === currentSessionId,
    }));
  }
}

/** Columns are bounded by the schema, so values are trimmed before persisting. */
function truncate(value: string | null | undefined, maxLength: number): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed.slice(0, maxLength);
}
