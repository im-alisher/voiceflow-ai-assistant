import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { ConversationDto, MessageDto, PageInfo } from '@voiceflow/shared';
import { AppException, CLOCK, type Clock } from '../../common';
import { decodeCursor, encodeCursor, fingerprintQuery } from '../../common/utils';
import { toConversationDto, toMessagePreview } from './mappers/conversation.mapper';
import { toMessageDto } from './mappers/message.mapper';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import type {
  AppendMessageInput,
  CreateConversationInput,
  ListConversationsInput,
  ListMessagesInput,
  ModelDefaults,
  UpdateConversationInput,
} from './types';

/** Placeholder title for a thread that has not been given one. */
const UNTITLED = 'New conversation';

/**
 * Owns the `conversations` aggregate.
 *
 * Two invariants are enforced here rather than in the controller, because both
 * have to hold for every entry point:
 *
 *  1. **Ownership.** Every query is scoped by `userId`. A conversation id alone
 *     is never sufficient to read or mutate a thread, so a guessed uuid cannot
 *     reach another user's transcript. A thread that exists but is not yours
 *     reports 404, not 403 — a 403 would confirm the id is real.
 *  2. **Sequence integrity.** `sequence` is allocated inside a transaction that
 *     locks the parent row, so two concurrent sends cannot claim the same value.
 */
@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // ---------------------------------------------------------------- lifecycle

  async create(input: CreateConversationInput, defaults: ModelDefaults): Promise<ConversationDto> {
    const conversation = this.conversations.create({
      id: crypto.randomUUID(),
      userId: input.userId,
      title: input.title?.trim() || UNTITLED,
      status: 'active',
      model: input.model ?? defaults.model,
      providerId: input.providerId ?? defaults.providerId,
      systemPrompt: input.systemPrompt ?? null,
      messageCount: 0,
      lastMessagePreview: null,
      lastMessageAt: null,
      isPinned: false,
    });

    return toConversationDto(await this.conversations.save(conversation));
  }

  /**
   * Loads a conversation the caller owns.
   *
   * @throws {AppException} NOT_FOUND when absent *or* owned by somebody else.
   */
  async findOwned(userId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.conversations.findOne({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw AppException.notFound('Conversation');
    }
    return conversation;
  }

  async findOwnedDto(userId: string, conversationId: string): Promise<ConversationDto> {
    return toConversationDto(await this.findOwned(userId, conversationId));
  }

  async update(
    userId: string,
    conversationId: string,
    input: UpdateConversationInput,
  ): Promise<ConversationDto> {
    const conversation = await this.findOwned(userId, conversationId);

    if (input.title !== undefined) conversation.title = input.title.trim() || UNTITLED;
    if (input.status !== undefined) conversation.status = input.status;
    if (input.isPinned !== undefined) conversation.isPinned = input.isPinned;

    return toConversationDto(await this.conversations.save(conversation));
  }

  /** Archive is a status change, not a delete: the thread stays restorable. */
  async archive(userId: string, conversationId: string): Promise<ConversationDto> {
    return this.update(userId, conversationId, { status: 'archived' });
  }

  async restore(userId: string, conversationId: string): Promise<ConversationDto> {
    return this.update(userId, conversationId, { status: 'active' });
  }

  /**
   * Soft-deletes a thread.
   *
   * The rows are retained rather than destroyed so a purge job can honour a
   * grace period, and so a `deleted` conversation can still be restored.
   */
  async softDelete(userId: string, conversationId: string): Promise<ConversationDto> {
    return this.update(userId, conversationId, { status: 'deleted' });
  }

  // ------------------------------------------------------------------- listing

  /**
   * Cursor-paginated listing for the sidebar.
   *
   * Pinned threads sort first, then the requested key. `hasMore` is decided by
   * fetching one row beyond the limit, so the answer is exact without a second
   * count query.
   */
  async list(input: ListConversationsInput): Promise<{ items: ConversationDto[]; page: PageInfo }> {
    const fingerprint = fingerprintQuery({
      userId: input.userId,
      status: input.status,
      search: input.search,
      sort: input.sort,
    });

    const take = input.limit + 1;
    const order = this.sortOrderFor(input.sort);

    const query = this.conversations
      .createQueryBuilder('conversation')
      .where('conversation.user_id = :userId', { userId: input.userId })
      .orderBy('conversation.is_pinned', 'DESC')
      .addOrderBy(order.column, order.direction)
      // `id` breaks ties so the ordering is total; keyset pagination requires it.
      .addOrderBy('conversation.id', order.direction)
      .take(take);

    if (input.status) {
      query.andWhere('conversation.status = :status', { status: input.status });
    }

    if (input.search) {
      // Parameterised ILIKE. The wildcard characters are escaped so a user
      // searching for "100%" does not accidentally match everything.
      const pattern = `%${escapeLike(input.search)}%`;
      query.andWhere("conversation.title ILIKE :pattern ESCAPE '\\'", { pattern });
    }

    if (input.cursor) {
      const { key, tiebreaker, group } = this.decodeOrThrow(input.cursor, fingerprint);
      const comparison = order.direction === 'ASC' ? '>' : '<';

      if (group === null) {
        // A cursor minted before the pinned flag was added carries no group, so
        // fall back to comparing the sort key alone.
        query.andWhere(
          `(conversation.${order.column}, conversation.id) ${comparison} (:cursorKey, :cursorTie)`,
          { cursorKey: key, cursorTie: tiebreaker },
        );
      } else {
        // Encodes "(isPinned, sortKey, id) > (cursor...)" lexicographically.
        //
        // The pinned flag has to be part of the tuple. Without it, a page that
        // ends inside the pinned group filters the next page purely on the sort
        // key, which drops every unpinned row whose key is newer than the last
        // pinned row — a silently missing conversation.
        //
        // Only the flag is cast: `cursorKey` stays untyped so Postgres infers
        // the sort column's own type, which differs per sort (text vs timestamp).
        query.andWhere(
          `(conversation.is_pinned, ${order.column}, conversation.id) ${comparison}
           (CAST(:cursorGroup AS boolean), :cursorKey, :cursorTie)`,
          { cursorGroup: group === 'true', cursorKey: key, cursorTie: tiebreaker },
        );
      }
    }

    const rows = await query.getMany();
    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;

    const last = page.at(-1);
    return {
      items: page.map(toConversationDto),
      page: {
        hasMore,
        limit: input.limit,
        nextCursor:
          hasMore && last
            ? encodeCursor(last[order.property], last.id, fingerprint, String(last.isPinned))
            : null,
      },
    };
  }

  // ------------------------------------------------------------------ messages

  /**
   * Appends a message and updates the conversation's denormalised summary.
   *
   * Runs in one transaction with a row lock on the conversation: that lock is
   * what makes the read-max-plus-one and the update atomic, so two parallel
   * sends cannot produce duplicate sequences or a wrong `messageCount`.
   *
   * `created` is false when an existing row was returned because
   * `clientMessageId` had already been used, which is how the turn service knows
   * not to bill the provider twice for a retried send.
   */
  async appendMessage(
    input: AppendMessageInput,
  ): Promise<{ message: MessageDto; created: boolean }> {
    const existing = await this.findByClientMessageId(input.conversationId, input.clientMessageId);
    if (existing) return { message: toMessageDto(existing), created: false };

    const now = this.clock.now();
    const message = this.messages.create({
      id: crypto.randomUUID(),
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      inputMode: input.inputMode,
      sequence: 0, // Replaced inside the transaction, once the lock is held.
      clientMessageId: input.clientMessageId ?? null,
      confidence: input.confidence ?? null,
      tokenCount: input.tokenCount ?? 0,
      model: input.model ?? null,
      providerId: input.providerId ?? null,
      latencyMs: input.latencyMs ?? null,
    });

    try {
      const saved = await this.messages.manager.transaction(async (manager) => {
        // `pessimistic_write` serialises concurrent sends on the same thread.
        const owner = await manager.findOne(Conversation, {
          where: { id: input.conversationId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!owner) {
          throw AppException.notFound('Conversation');
        }

        const result = await manager
          .createQueryBuilder(Message, 'message')
          .select('COALESCE(MAX(message.sequence), 0)', 'max')
          .where('message.conversation_id = :conversationId', {
            conversationId: input.conversationId,
          })
          .getRawOne<{ max: string | number }>();

        message.sequence = Number(result?.max ?? 0) + 1;

        const persisted = await manager.save(message);

        await manager.update(
          Conversation,
          { id: input.conversationId },
          {
            messageCount: () => '"message_count" + 1',
            lastMessagePreview: toMessagePreview(input.content),
            lastMessageAt: now,
            // Bumps `updated_at`, the default sort key for the sidebar.
            updatedAt: now,
          },
        );

        return persisted;
      });

      return { message: toMessageDto(saved), created: true };
    } catch (error) {
      // A concurrent request with the same `clientMessageId` won the race. The
      // retry is a send, not a read, so the original turn is returned intact.
      if (isUniqueViolation(error, 'uq_messages_conversation_client_id')) {
        const raced = await this.findByClientMessageId(input.conversationId, input.clientMessageId);
        if (raced) return { message: toMessageDto(raced), created: false };
      }
      throw error;
    }
  }

  /**
   * The turn history handed to the AI layer.
   *
   * Ordered oldest-first because a prompt is a transcript, and truncated to the
   * most recent `limit` turns — the window is bounded so a long thread cannot
   * silently exceed a provider's context window.
   */
  async recentContext(
    conversationId: string,
    limit: number,
  ): Promise<readonly { role: 'user' | 'assistant'; content: string }[]> {
    const rows = await this.messages.find({
      where: { conversationId },
      order: { sequence: 'DESC' },
      take: limit,
    });

    return rows.reverse().map((row) => ({ role: row.role, content: row.content }));
  }

  async listMessages(input: ListMessagesInput): Promise<{ items: MessageDto[]; page: PageInfo }> {
    const fingerprint = fingerprintQuery({
      conversationId: input.conversationId,
      order: input.order,
    });
    const direction = input.order === 'asc' ? 'ASC' : 'DESC';
    const take = input.limit + 1;

    const query = this.messages
      .createQueryBuilder('message')
      .where('message.conversation_id = :conversationId', {
        conversationId: input.conversationId,
      })
      .orderBy('message.sequence', direction)
      .take(take);

    if (input.cursor) {
      const { key } = this.decodeOrThrow(input.cursor, fingerprint);
      query.andWhere(`message.sequence ${input.order === 'asc' ? '>' : '<'} :cursorKey`, {
        cursorKey: key,
      });
    }

    const rows = await query.getMany();
    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;

    // Returned oldest-first regardless of page direction: a transcript is read
    // top to bottom, and a desc page would otherwise render in reverse.
    const ordered = [...page].sort((left, right) => left.sequence - right.sequence);
    const last = page.at(-1);

    return {
      items: ordered.map(toMessageDto),
      page: {
        hasMore,
        limit: input.limit,
        nextCursor: hasMore && last ? encodeCursor(last.sequence, last.id, fingerprint) : null,
      },
    };
  }

  /**
   * The assistant turn that immediately followed a user turn.
   *
   * Used to answer a replayed send without calling the provider again: the reply
   * is already durable, so re-running the completion would only spend quota.
   */
  async findFirstAssistantReply(
    conversationId: string,
    afterSequence: number,
  ): Promise<MessageDto | null> {
    const message = await this.messages.findOne({
      where: { conversationId, role: 'assistant', sequence: afterSequence + 1 },
    });
    return message ? toMessageDto(message) : null;
  }

  /**
   * Removes a single message and renumbers the remainder.
   *
   * Renumbering keeps `sequence` dense, which is what lets the keyset cursor
   * stay correct: a gap would let a client skip or repeat a message.
   */
  async deleteMessage(
    userId: string,
    conversationId: string,
    messageId: string,
  ): Promise<{ remaining: number }> {
    const conversation = await this.findOwned(userId, conversationId);

    const result = await this.messages.delete({ id: messageId, conversationId });
    if (!result.affected) {
      throw AppException.notFound('Message');
    }

    const all = await this.messages.find({
      where: { conversationId: conversation.id },
      order: { sequence: 'ASC' },
    });

    await this.messages.manager.transaction(async (manager) => {
      for (const [index, message] of all.entries()) {
        if (message.sequence !== index + 1) {
          await manager.update(Message, { id: message.id }, { sequence: index + 1 });
        }
      }

      const remaining = all.length;
      await manager.update(
        Conversation,
        { id: conversationId },
        {
          messageCount: remaining,
          lastMessagePreview:
            remaining > 0 ? toMessagePreview((all.at(-1) as Message).content) : null,
          lastMessageAt: remaining > 0 ? (all.at(-1) as Message).createdAt : null,
        },
      );
    });

    return { remaining: all.length };
  }

  /** Ids of conversations a user owns, used to authorise a bulk operation. */
  async ownedIds(userId: string, ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.conversations.find({
      where: { userId, id: In([...ids]) },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async countSince(userId: string, since: Date): Promise<number> {
    return this.conversations
      .createQueryBuilder('conversation')
      .where('conversation.user_id = :userId', { userId })
      .andWhere('conversation.created_at > :since', { since })
      .getCount();
  }

  // -------------------------------------------------------------------- lookup

  private findByClientMessageId(
    conversationId: string,
    clientMessageId: string | undefined,
  ): Promise<Message | null> {
    if (!clientMessageId) return Promise.resolve(null);

    return this.messages.findOne({
      where: { conversationId, clientMessageId },
    });
  }

  private sortOrderFor(sort: ListConversationsInput['sort']): {
    column: string;
    property: 'updatedAt' | 'createdAt' | 'title';
    direction: 'ASC' | 'DESC';
  } {
    switch (sort) {
      case 'created_at':
        return { column: 'created_at', property: 'createdAt', direction: 'DESC' };
      case 'title':
        return { column: 'title', property: 'title', direction: 'ASC' };
      default:
        return { column: 'updated_at', property: 'updatedAt', direction: 'DESC' };
    }
  }

  /**
   * Cursors are opaque and signed by a query fingerprint, so a malformed or
   * replayed one is a client error rather than a confusing empty page.
   */
  private decodeOrThrow(
    cursor: string,
    fingerprint: string,
  ): { key: string; tiebreaker: string; group: string | null } {
    try {
      return decodeCursor(cursor, fingerprint);
    } catch (error) {
      throw AppException.badRequest(
        error instanceof Error ? error.message : 'Invalid pagination cursor',
      );
    }
  }
}

/** Makes `%`, `_` and `\` literal so a search term cannot act as a wildcard. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Postgres unique-violation SQLSTATE. */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  const candidate = error as {
    code?: string;
    constraint?: string;
    driverError?: { code?: string; constraint?: string };
  };
  const code = candidate?.code ?? candidate?.driverError?.code;
  const name = candidate?.constraint ?? candidate?.driverError?.constraint;
  return code === '23505' && name === constraint;
}
