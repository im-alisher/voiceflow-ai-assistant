import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  ActivityConversationDto,
  AnalyticsTotalsDto,
  ConversationStatus,
} from '@voiceflow/shared';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../conversations/entities/message.entity';
import type { AnalyticsReader, ProviderUsageRow, UsageBucketRow } from './analytics.reader';

/**
 * TypeORM implementation of {@link AnalyticsReader}.
 *
 * Every query is scoped through `conversations.user_id` rather than carrying its
 * own `user_id` column: a message has no owner of its own, so joining is the
 * only way to guarantee a user can never see another user's volume. The join
 * uses the existing `idx_conversations_user_*` indexes, so the cost is an index
 * seek on the user followed by a lookup on `idx_messages_conversation_sequence`.
 */
@Injectable()
export class TypeOrmAnalyticsReader implements AnalyticsReader {
  constructor(
    @InjectRepository(Conversation) private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
  ) {}

  async totals(userId: string): Promise<AnalyticsTotalsDto> {
    const conversationTotals = await this.conversations
      .createQueryBuilder('conversation')
      .select('COUNT(*)::int', 'conversations')
      .addSelect(
        `COUNT(*) FILTER (WHERE conversation.status = 'active')::int`,
        'activeConversations',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE conversation.status = 'archived')::int`,
        'archivedConversations',
      )
      .where('conversation.user_id = :userId', { userId })
      .getRawOne<{
        conversations: number;
        activeConversations: number;
        archivedConversations: number;
      }>();

    const messageTotals = await this.messages
      .createQueryBuilder('message')
      .select('COUNT(*)::int', 'messages')
      .addSelect(`COUNT(*) FILTER (WHERE message.input_mode = 'voice')::int`, 'voiceMessages')
      .addSelect('COALESCE(SUM(message.token_count), 0)::int', 'tokens')
      .innerJoin('message.conversation', 'conversation')
      .where('conversation.user_id = :userId', { userId })
      .getRawOne<{ messages: number; voiceMessages: number; tokens: number }>();

    return {
      conversations: conversationTotals?.conversations ?? 0,
      activeConversations: conversationTotals?.activeConversations ?? 0,
      archivedConversations: conversationTotals?.archivedConversations ?? 0,
      messages: messageTotals?.messages ?? 0,
      voiceMessages: messageTotals?.voiceMessages ?? 0,
      tokens: messageTotals?.tokens ?? 0,
    };
  }

  async latencies(userId: string): Promise<readonly number[]> {
    const rows = await this.messages
      .createQueryBuilder('message')
      .select('message.latency_ms', 'latency')
      .where('message.latency_ms IS NOT NULL')
      .andWhere('message.role = :role', { role: 'assistant' })
      .innerJoin('message.conversation', 'conversation')
      .andWhere('conversation.user_id = :userId', { userId })
      .orderBy('message.latency_ms', 'ASC')
      .getRawMany<{ latency: number | string }>();

    return rows.map((row) => Number(row.latency));
  }

  async providerUsage(userId: string): Promise<readonly ProviderUsageRow[]> {
    const rows = await this.messages
      .createQueryBuilder('message')
      .select('message.provider_id', 'providerId')
      .addSelect('message.model', 'model')
      .addSelect('COUNT(*)::int', 'messages')
      .addSelect('COALESCE(SUM(message.token_count), 0)::int', 'tokens')
      .innerJoin('message.conversation', 'conversation')
      .where('conversation.user_id = :userId', { userId })
      .groupBy('message.provider_id')
      .addGroupBy('message.model')
      .orderBy('messages', 'DESC')
      .getRawMany<{
        providerId: string | null;
        model: string | null;
        messages: number;
        tokens: number;
      }>();

    // A turn recorded before a provider was resolved has a null id; grouping it
    // as "unknown" is more honest than dropping it and under-reporting volume.
    return rows.map((row) => ({
      providerId: row.providerId ?? 'unknown',
      model: row.model ?? null,
      messages: Number(row.messages),
      tokens: Number(row.tokens),
    }));
  }

  async usageBuckets(userId: string, from: Date, to: Date): Promise<readonly UsageBucketRow[]> {
    const rows = await this.messages
      .createQueryBuilder('message')
      .select(`TO_CHAR(date_trunc('day', message.created_at), 'YYYY-MM-DD')`, 'date')
      .addSelect('COUNT(*)::int', 'messages')
      .addSelect('COALESCE(SUM(message.token_count), 0)::int', 'tokens')
      .addSelect(`COUNT(*) FILTER (WHERE message.input_mode = 'voice')::int`, 'voiceMessages')
      .innerJoin('message.conversation', 'conversation')
      .where('conversation.user_id = :userId', { userId })
      .andWhere('message.created_at >= :from', { from })
      .andWhere('message.created_at <= :to', { to })
      .groupBy(`date_trunc('day', message.created_at)`)
      .orderBy(`date_trunc('day', message.created_at)`, 'ASC')
      .getRawMany<{
        date: string;
        messages: number;
        tokens: number;
        voiceMessages: number;
      }>();

    return rows.map((row) => ({
      date: row.date,
      messages: Number(row.messages),
      tokens: Number(row.tokens),
      voiceMessages: Number(row.voiceMessages),
    }));
  }

  async recentConversations(
    userId: string,
    limit: number,
  ): Promise<readonly ActivityConversationDto[]> {
    const rows = await this.conversations
      .createQueryBuilder('conversation')
      .select('conversation.id', 'id')
      .addSelect('conversation.title', 'title')
      .addSelect('conversation.status', 'status')
      .addSelect('conversation.is_pinned', 'isPinned')
      .addSelect('conversation.message_count', 'messageCount')
      .addSelect('conversation.last_message_at', 'lastMessageAt')
      .addSelect(
        'COALESCE(SUM(message.token_count) FILTER (WHERE message.id IS NOT NULL), 0)::int',
        'tokens',
      )
      .leftJoin(Message, 'message', 'message.conversation_id = conversation.id')
      .where('conversation.user_id = :userId', { userId })
      .groupBy('conversation.id')
      .orderBy('COALESCE(conversation.last_message_at, conversation.updated_at)', 'DESC')
      .limit(limit)
      .getRawMany<{
        id: string;
        title: string;
        status: ConversationStatus;
        isPinned: boolean;
        messageCount: number;
        lastMessageAt: Date | null;
        tokens: number;
      }>();

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      isPinned: row.isPinned,
      messageCount: Number(row.messageCount),
      tokens: Number(row.tokens),
      lastMessageAt: row.lastMessageAt ? new Date(row.lastMessageAt).toISOString() : null,
    }));
  }
}
