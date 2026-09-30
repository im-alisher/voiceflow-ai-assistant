import type { UserRole } from '@voiceflow/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entity';
import { User } from '../../users/entities/user.entity';

/**
 * A single logged-in device.
 *
 * Refresh tokens are opaque random strings; only their SHA-256 digest is
 * stored. A database leak therefore yields nothing an attacker can replay, and
 * `revokedAt` gives per-device logout and reuse-detection without waiting for
 * an access token to expire.
 */
@Entity({ name: 'refresh_sessions' })
@Index('idx_refresh_sessions_user', ['userId'])
@Index('idx_refresh_sessions_expires', ['expiresAt'])
@Index('uq_refresh_sessions_token_hash', ['tokenHash'], { unique: true })
export class RefreshSession extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'token_hash', type: 'varchar', length: 128 })
  tokenHash!: string;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent!: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  /** Set when this session's token was exchanged, for reuse detection. */
  @Column({ name: 'rotated_at', type: 'timestamptz', nullable: true })
  rotatedAt!: Date | null;

  /** Last time a request was authorised by this session. */
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ name: 'role', type: 'varchar', length: 16, default: 'user' })
  role!: UserRole;

  isActiveAt(now: Date): boolean {
    return this.revokedAt === null && this.expiresAt.getTime() > now.getTime();
  }
}
