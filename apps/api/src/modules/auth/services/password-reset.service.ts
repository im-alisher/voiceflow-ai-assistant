import { randomBytes, createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException, CLOCK, type Clock } from '../../../common';
import { CONFIG_NAMESPACE, type AuthConfig } from '../../../config';
import { MailService } from '../../mail/mail.service';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { UsersService } from '../../users/users.service';

/** A freshly minted reset token: the raw value goes in the email, never the DB. */
export interface IssuedResetToken {
  readonly raw: string;
  readonly expiresAt: Date;
}

@Injectable()
export class PasswordResetService {
  private readonly ttlMinutes: number;

  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly tokens: Repository<PasswordResetToken>,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly mail: MailService,
    @Inject(CLOCK) private readonly clock: Clock,
    config: ConfigService,
  ) {
    this.ttlMinutes = config.get<AuthConfig>(CONFIG_NAMESPACE.AUTH)?.passwordResetTtlMinutes ?? 60;
  }

  get resetTtlMinutes(): number {
    return this.ttlMinutes;
  }

  /**
   * Issues a token for a known address and mails the link.
   *
   * The caller must only reach this method once it has established that the
   * address *is* registered; `forgotPassword` deliberately does that lookup
   * itself and answers identically either way, so this endpoint never becomes an
   * account-enumeration oracle.
   *
   * Issuing invalidates any outstanding token: the newest request wins, which
   * stops a token mailed earlier from being spent after a later request.
   */
  async issue(params: {
    userId: string;
    email: string;
    displayName: string;
    resetUrlBase: string;
    ipAddress?: string | null;
    requestId?: string;
  }): Promise<IssuedResetToken> {
    const raw = randomBytes(32).toString('base64url');
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + this.ttlMinutes * 60_000);

    // One live token per user at a time.
    await this.tokens
      .createQueryBuilder()
      .update(PasswordResetToken)
      .set({ revokedAt: now })
      .where('user_id = :userId', { userId: params.userId })
      .andWhere('used_at IS NULL')
      .andWhere('revoked_at IS NULL')
      .execute();

    await this.tokens.save(
      this.tokens.create({
        userId: params.userId,
        tokenHash: hashToken(raw),
        expiresAt,
        usedAt: null,
        revokedAt: null,
        email: params.email,
        requestedIp: params.ipAddress ?? null,
        requestedRole: null,
      }),
    );

    const delivered = await this.mail.sendPasswordReset({
      to: params.email,
      displayName: params.displayName,
      resetUrl: `${params.resetUrlBase}?token=${encodeURIComponent(raw)}`,
      ttlMinutes: this.ttlMinutes,
      requestId: params.requestId,
    });

    // A transport that refused the message must not leave a live token behind:
    // the user has no way to redeem it, and it would only be found by an
    // attacker reading the table.
    if (!delivered) {
      await this.tokens.delete({ userId: params.userId, tokenHash: hashToken(raw) });
    }

    return { raw, expiresAt };
  }

  /**
   * Exchanges a token for a new password.
   *
   * Every rejection uses the same message. Distinguishing "expired" from
   * "already used" from "unknown" would tell an attacker holding a stolen digest
   * how far it got.
   *
   * Every live session is revoked afterwards: whoever prompted the reset should
   * be the only one able to use the account.
   */
  async consume(params: { rawToken: string; newPassword: string }): Promise<void> {
    this.passwords.assertAcceptable(params.newPassword);

    const token = await this.tokens.findOne({ where: { tokenHash: hashToken(params.rawToken) } });
    const now = this.clock.now();

    if (!token || !token.isUsableAt(now)) {
      throw AppException.unprocessable('This reset link is invalid or has expired');
    }

    const user = await this.users.findActiveById(token.userId);
    if (!user) {
      await this.tokens.update({ id: token.id }, { revokedAt: now });
      throw AppException.unprocessable('This reset link is invalid or has expired');
    }

    await this.users.savePasswordHash(user.id, await this.passwords.hash(params.newPassword));

    // Spend the token before revoking sessions, so a failure later cannot leave
    // a reusable token attached to a changed password.
    await this.tokens.update({ id: token.id }, { usedAt: now, revokedAt: now });
    await this.sessions.revokeAllForUser(user.id);
  }
}

/** SHA-256, hex. A reset token is high-entropy, so no slow KDF is warranted. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
