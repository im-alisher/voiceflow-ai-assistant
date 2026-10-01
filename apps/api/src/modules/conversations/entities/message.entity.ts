import type { MessageInputMode, PersistedMessageRole } from '@voiceflow/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entity';
import { Conversation } from './conversation.entity';

/**
 * One turn in a conversation.
 *
 * `sequence` is a per-conversation counter rather than a timestamp: ordering
 * messages by time is unstable when two rows share a millisecond, and the
 * cursor pagination depends on a total order.
 */
@Entity({ name: 'messages' })
@Index('idx_messages_conversation_sequence', ['conversationId', 'sequence'])
@Unique('uq_messages_conversation_client_id', ['conversationId', 'clientMessageId'])
export class Message extends BaseEntity {
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  @Column({ type: 'varchar', length: 16 })
  role!: PersistedMessageRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'input_mode', type: 'varchar', length: 16, default: 'text' })
  inputMode!: MessageInputMode;

  @Column({ type: 'int' })
  sequence!: number;

  /**
   * Client-generated idempotency key.
   *
   * A retried send must not create a second user turn, so the unique index below
   * is the real guarantee — the service catches the violation and returns the
   * original message.
   */
  @Column({ name: 'client_message_id', type: 'varchar', length: 120, nullable: true })
  clientMessageId!: string | null;

  /** 0–1 classifier confidence; `null` for user turns and the mock provider. */
  @Column({ type: 'float', nullable: true })
  confidence!: number | null;

  @Column({ name: 'token_count', type: 'int', default: 0 })
  tokenCount!: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model!: string | null;

  @Column({ name: 'provider_id', type: 'varchar', length: 60, nullable: true })
  providerId!: string | null;

  @Column({ name: 'latency_ms', type: 'int', nullable: true })
  latencyMs!: number | null;
}
