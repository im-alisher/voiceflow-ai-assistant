import type { UserRole } from '@voiceflow/shared';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entity';

/**
 * A single-use password-reset grant.
 *
 * The raw token is never stored: only its SHA-256 digest is, exactly as with
 * refresh tokens. A dump of this table therefore does not hand an attacker a way
 * to reset anyone's password — which is the whole reason the token is random and
 * single-use rather than a signed JWT that stays valid until it expires.
 */
@Entity({ name: 'password_reset_tokens' })
@Index('idx_password_reset_user', ['userId'])
@Index('idx_password_reset_expires', ['expiresAt'])
export class PasswordResetToken extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /**
   * SHA-256 of the emailed token, hex encoded.
   *
   * Unique so a collision is rejected by the database rather than silently
   * resolving to the wrong user's row.
   */
  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** Set the moment the token is spent; a second attempt is refused. */
  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt!: Date | null;

  /** Revoked when the password changes by any other route. */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  /** Stored so the reset page can be prefilled and the address confirmed. */
  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ name: 'requested_ip', type: 'varchar', length: 64, nullable: true })
  requestedIp!: string | null;

  @Column({ name: 'requested_role', type: 'varchar', length: 16, nullable: true })
  requestedRole!: UserRole | null;

  isUsableAt(now: Date): boolean {
    return (
      this.usedAt === null && this.revokedAt === null && this.expiresAt.getTime() > now.getTime()
    );
  }
}
