import type { ConversationStatus } from '@voiceflow/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * A chat thread.
 *
 * The denormalised `messageCount` / `lastMessagePreview` / `lastMessageAt`
 * columns exist so the sidebar can be rendered from one ordered query. They are
 * maintained inside the same transaction as the message write, which is what
 * keeps them consistent with the `messages` table.
 */
@Entity({ name: 'conversations' })
// Serves the default listing: one user's threads, newest first, optionally
// filtered by status.
@Index('idx_conversations_user_updated', ['userId', 'status', 'updatedAt'])
@Index('idx_conversations_user_created', ['userId', 'createdAt'])
export class Conversation {
  @Column({ name: 'id', type: 'uuid', primary: true })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: ConversationStatus;

  @Column({ type: 'varchar', length: 120 })
  model!: string;

  @Column({ name: 'provider_id', type: 'varchar', length: 60 })
  providerId!: string;

  @Column({ name: 'system_prompt', type: 'varchar', length: 4000, nullable: true })
  systemPrompt!: string | null;

  @Column({ name: 'message_count', type: 'int', default: 0 })
  messageCount!: number;

  /** First line of the most recent message, for the sidebar. */
  @Column({ name: 'last_message_preview', type: 'varchar', length: 200, nullable: true })
  lastMessagePreview!: string | null;

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt!: Date | null;

  @Column({ name: 'is_pinned', type: 'boolean', default: false })
  isPinned!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
