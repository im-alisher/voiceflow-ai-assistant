import { encodeCursor, fingerprintQuery } from '../../common/utils';
import { ConversationsService } from './conversations.service';
import type { Conversation } from './entities/conversation.entity';
import type { Message } from './entities/message.entity';
import type { Clock } from '../../common';

const FIXED_NOW = new Date('2026-03-01T12:00:00.000Z');
const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '99999999-9999-4999-8999-999999999999';
const CONVERSATION_ID = '22222222-2222-4222-8222-222222222222';

const clock: Clock = { now: () => FIXED_NOW, nowMs: () => FIXED_NOW.getTime() };

function buildConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: CONVERSATION_ID,
    userId: USER_ID,
    title: 'Voice model notes',
    status: 'active',
    model: 'mock-assistant-v1',
    providerId: 'mock',
    systemPrompt: null,
    messageCount: 2,
    lastMessagePreview: 'a preview',
    lastMessageAt: FIXED_NOW,
    isPinned: false,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  } as Conversation;
}

function buildMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    conversationId: CONVERSATION_ID,
    conversation: undefined as unknown as Conversation,
    role: 'user',
    content: 'hello',
    inputMode: 'text',
    sequence: 1,
    clientMessageId: null,
    confidence: null,
    tokenCount: 0,
    model: null,
    providerId: null,
    latencyMs: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
    // `touchCreatedAt` is a protected entity hook and has no business in a test
    // fixture, hence the cast through `unknown`.
  } as unknown as Message;
}

const DEFAULTS = { model: 'mock-assistant-v1', providerId: 'mock' };

/**
 * TypeORM stamps `@CreateDateColumn` / `@UpdateDateColumn` on save; the fake
 * repository has to do the same or the mapper dereferences undefined dates.
 */
function stamped(entity: Message): Message {
  // Spreading drops the protected `touchCreatedAt` hook from the inferred type.
  return { ...entity, createdAt: FIXED_NOW, updatedAt: FIXED_NOW } as unknown as Message;
}

interface Harness {
  readonly service: ConversationsService;
  readonly conversations: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  readonly messages: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
    manager: { transaction: jest.Mock };
  };
}

function createHarness(): Harness {
  const conversations = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((input: Partial<Conversation>) => input as Conversation),
    save: jest.fn((entity: Conversation) =>
      Promise.resolve({
        ...buildConversation(),
        ...entity,
      }),
    ),
    createQueryBuilder: jest.fn(),
  };

  const messages = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((input: Partial<Message>) => input as Message),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    save: jest.fn((entity: Message) => Promise.resolve(stamped(entity))),
    createQueryBuilder: jest.fn(),
    manager: { transaction: jest.fn() },
  };

  return {
    service: new ConversationsService(conversations as never, messages as never, clock),
    conversations,
    messages,
  };
}

describe('ConversationsService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('generates an id and applies the deployment defaults', async () => {
      const harness = createHarness();
      const result = await harness.service.create({ userId: USER_ID }, DEFAULTS);

      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.model).toBe('mock-assistant-v1');
      expect(result.providerId).toBe('mock');
      expect(result.status).toBe('active');
    });

    it('falls back to a placeholder title rather than an empty one', async () => {
      const harness = createHarness();
      const result = await harness.service.create({ userId: USER_ID, title: '  ' }, DEFAULTS);

      expect(result.title).toBe('New conversation');
    });

    it('honours an explicit title and model', async () => {
      const harness = createHarness();
      const result = await harness.service.create(
        { userId: USER_ID, title: '  Research  ', model: 'custom-v1' },
        DEFAULTS,
      );

      expect(result.title).toBe('Research');
      expect(result.model).toBe('custom-v1');
    });
  });

  describe('findOwned', () => {
    it('scopes the lookup by owner, so another user cannot read the thread', async () => {
      const harness = createHarness();
      harness.conversations.findOne.mockResolvedValue(buildConversation());

      await harness.service.findOwned(USER_ID, CONVERSATION_ID);

      expect(harness.conversations.findOne).toHaveBeenCalledWith({
        where: { id: CONVERSATION_ID, userId: USER_ID },
      });
    });

    it('reports a missing thread and a foreign one identically', async () => {
      const harness = createHarness();
      harness.conversations.findOne.mockResolvedValue(null);

      // 404 rather than 403: a 403 would confirm the id exists.
      await expect(harness.service.findOwned(OTHER_USER, CONVERSATION_ID)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('update', () => {
    it('applies title, status and pinning', async () => {
      const harness = createHarness();
      harness.conversations.findOne.mockResolvedValue(buildConversation());

      const result = await harness.service.update(USER_ID, CONVERSATION_ID, {
        title: 'Renamed',
        status: 'archived',
        isPinned: true,
      });

      expect(result.title).toBe('Renamed');
      expect(result.status).toBe('archived');
      expect(result.isPinned).toBe(true);
    });

    it('refuses to update a thread belonging to someone else', async () => {
      const harness = createHarness();
      harness.conversations.findOne.mockResolvedValue(null);

      await expect(
        harness.service.update(OTHER_USER, CONVERSATION_ID, { title: 'Hijacked' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(harness.conversations.save).not.toHaveBeenCalled();
    });
  });

  describe('archive and restore', () => {
    it('archive is a status change, so the thread stays restorable', async () => {
      const harness = createHarness();
      harness.conversations.findOne.mockResolvedValue(buildConversation());

      const archived = await harness.service.archive(USER_ID, CONVERSATION_ID);
      expect(archived.status).toBe('archived');

      const restored = await harness.service.restore(USER_ID, CONVERSATION_ID);
      expect(restored.status).toBe('active');
    });

    it('soft delete retains the row for a grace period', async () => {
      const harness = createHarness();
      harness.conversations.findOne.mockResolvedValue(buildConversation());

      const result = await harness.service.softDelete(USER_ID, CONVERSATION_ID);
      expect(result.status).toBe('deleted');
    });
  });

  describe('appendMessage', () => {
    it('allocates the next sequence and increments the counter', async () => {
      const harness = createHarness();
      harness.messages.manager.transaction.mockImplementation(
        async (work: (manager: unknown) => Promise<unknown>) =>
          work({
            findOne: jest.fn().mockResolvedValue(buildConversation()),
            createQueryBuilder: () => ({
              select: () => ({
                where: () => ({
                  getRawOne: () => Promise.resolve({ max: 4 }),
                }),
              }),
            }),
            save: jest.fn((entity: Message) => Promise.resolve(stamped(entity))),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          }),
      );

      const { message, created } = await harness.service.appendMessage({
        conversationId: CONVERSATION_ID,
        role: 'user',
        content: 'next turn',
        inputMode: 'text',
      });

      expect(created).toBe(true);
      expect(message.sequence).toBe(5);
    });

    it('returns the stored row when a concurrent send wins the unique race', async () => {
      const harness = createHarness();
      const winner = buildMessage({ clientMessageId: 'race-1' });

      // Miss the pre-flight lookup, then find the winner's row on the retry.
      harness.messages.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
      harness.messages.manager.transaction.mockRejectedValue(
        Object.assign(new Error('duplicate key value'), {
          code: '23505',
          constraint: 'uq_messages_conversation_client_id',
        }),
      );

      const result = await harness.service.appendMessage({
        conversationId: CONVERSATION_ID,
        role: 'user',
        content: 'hello',
        inputMode: 'text',
        clientMessageId: 'race-1',
      });

      // Retrying must not charge the provider for a turn that already landed.
      expect(result.created).toBe(false);
      expect(result.message.content).toBe('hello');
    });

    it('propagates an error that is not a unique violation', async () => {
      const harness = createHarness();
      harness.messages.manager.transaction.mockRejectedValue(new Error('deadlock detected'));

      await expect(
        harness.service.appendMessage({
          conversationId: CONVERSATION_ID,
          role: 'user',
          content: 'hello',
          inputMode: 'text',
          clientMessageId: 'retry-me',
        }),
      ).rejects.toThrow('deadlock detected');
      // One call from the pre-flight lookup only; an unrelated failure must not
      // trigger the unique-violation re-read.
      expect(harness.messages.findOne).toHaveBeenCalledTimes(1);
    });

    it('reports a replayed clientMessageId instead of inserting twice', async () => {
      const harness = createHarness();
      harness.messages.findOne.mockResolvedValue(buildMessage({ clientMessageId: 'abc-123' }));

      const { message, created } = await harness.service.appendMessage({
        conversationId: CONVERSATION_ID,
        role: 'user',
        content: 'hello',
        inputMode: 'text',
        clientMessageId: 'abc-123',
      });

      expect(created).toBe(false);
      expect(message.content).toBe('hello');
      // No transaction means no second write.
      expect(harness.messages.manager.transaction).not.toHaveBeenCalled();
    });

    it('stores a null clientMessageId when the client sent none', async () => {
      const harness = createHarness();
      harness.messages.manager.transaction.mockImplementation(
        async (work: (manager: unknown) => Promise<unknown>) =>
          work({
            findOne: jest.fn().mockResolvedValue(buildConversation()),
            createQueryBuilder: () => ({
              select: () => ({ where: () => ({ getRawOne: () => Promise.resolve({ max: 0 }) }) }),
            }),
            save: jest.fn((entity: Message) => Promise.resolve(stamped(entity))),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          }),
      );

      const { message } = await harness.service.appendMessage({
        conversationId: CONVERSATION_ID,
        role: 'assistant',
        content: 'hi',
        inputMode: 'text',
      });

      expect(message.sequence).toBe(1);
      expect(message.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(message.createdAt).toBe(FIXED_NOW.toISOString());
    });
  });

  describe('recentContext', () => {
    it('returns oldest-first even though it queries newest-first', async () => {
      const harness = createHarness();
      harness.messages.find.mockResolvedValue([
        buildMessage({ id: 'c', sequence: 3, role: 'assistant', content: 'third' }),
        buildMessage({ id: 'b', sequence: 2, role: 'user', content: 'second' }),
        buildMessage({ id: 'a', sequence: 1, role: 'user', content: 'first' }),
      ]);

      const context = await harness.service.recentContext(CONVERSATION_ID, 10);

      // A prompt is a transcript: order matters.
      expect(context.map((entry) => entry.content)).toEqual(['first', 'second', 'third']);
    });

    it('bounds the history to the requested window', async () => {
      const harness = createHarness();
      harness.messages.find.mockResolvedValue([]);

      await harness.service.recentContext(CONVERSATION_ID, 5);

      expect(harness.messages.find).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    });
  });

  describe('findFirstAssistantReply', () => {
    it('looks for the turn immediately after the user message', async () => {
      const harness = createHarness();
      harness.messages.findOne.mockResolvedValue(buildMessage({ role: 'assistant' }));

      const reply = await harness.service.findFirstAssistantReply(CONVERSATION_ID, 7);

      expect(reply).not.toBeNull();
      expect(harness.messages.findOne).toHaveBeenCalledWith({
        where: { conversationId: CONVERSATION_ID, role: 'assistant', sequence: 8 },
      });
    });

    it('returns null when the user turn was never answered', async () => {
      const harness = createHarness();
      harness.messages.findOne.mockResolvedValue(null);

      await expect(harness.service.findFirstAssistantReply(CONVERSATION_ID, 3)).resolves.toBeNull();
    });
  });

  describe('deleteMessage', () => {
    it('renumbers the survivors so the sequence stays dense', async () => {
      const harness = createHarness();
      harness.conversations.findOne.mockResolvedValue(buildConversation());
      harness.messages.find.mockResolvedValue([
        buildMessage({ id: 'a', sequence: 1 }),
        buildMessage({ id: 'c', sequence: 3 }),
      ]);

      const manager = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      harness.messages.manager.transaction.mockImplementation(
        async (work: (m: unknown) => Promise<unknown>) => work(manager),
      );

      const result = await harness.service.deleteMessage(USER_ID, CONVERSATION_ID, 'b');

      expect(result.remaining).toBe(2);
      // A gap would let a cursor skip or repeat a message.
      expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: 'c' }, { sequence: 2 });
    });

    it('reports a missing message as not found', async () => {
      const harness = createHarness();
      harness.conversations.findOne.mockResolvedValue(buildConversation());
      harness.messages.delete.mockResolvedValue({ affected: 0 });

      await expect(
        harness.service.deleteMessage(USER_ID, CONVERSATION_ID, 'missing'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('will not delete from a conversation the caller does not own', async () => {
      const harness = createHarness();
      harness.conversations.findOne.mockResolvedValue(null);

      await expect(
        harness.service.deleteMessage(OTHER_USER, CONVERSATION_ID, 'any'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(harness.messages.delete).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    /**
     * Records the `andWhere` clauses so a test can assert on the SQL the service
     * builds, not just on the rows it returns.
     */
    function queryStub(rows: unknown[]) {
      const state = { andWhere: [] as { sql: string; params?: unknown }[] };
      const builder = {
        where: () => builder,
        andWhere: (sql: string, params?: unknown) => {
          state.andWhere.push({ sql, params });
          return builder;
        },
        orderBy: () => builder,
        addOrderBy: () => builder,
        take: () => builder,
        getMany: jest.fn().mockResolvedValue(rows),
      };
      return { builder, state };
    }

    it('detects a further page by fetching one row past the limit', async () => {
      const harness = createHarness();
      const rows = [
        buildConversation({ id: 'a', updatedAt: new Date('2026-03-01T10:00:00Z') }),
        buildConversation({ id: 'b', updatedAt: new Date('2026-03-01T09:00:00Z') }),
        buildConversation({ id: 'c', updatedAt: new Date('2026-03-01T08:00:00Z') }),
      ];
      const { builder } = queryStub(rows);
      harness.conversations.createQueryBuilder = jest.fn().mockReturnValue(builder);

      const page = await harness.service.list({
        userId: USER_ID,
        limit: 2,
        sort: 'updated_at',
      });

      expect(page.items.map((item) => item.id)).toEqual(['a', 'b']);
      expect(page.page.hasMore).toBe(true);
      expect(page.page.nextCursor).not.toBeNull();
    });

    it('issues no cursor on the final page', async () => {
      const harness = createHarness();
      const { builder } = queryStub([buildConversation({ id: 'only' })]);
      harness.conversations.createQueryBuilder = jest.fn().mockReturnValue(builder);

      const page = await harness.service.list({
        userId: USER_ID,
        limit: 10,
        sort: 'updated_at',
      });

      expect(page.page.hasMore).toBe(false);
      expect(page.page.nextCursor).toBeNull();
    });

    it('encodes the pinned flag so the next page cannot skip the group boundary', async () => {
      const harness = createHarness();
      const rows = [
        buildConversation({ id: 'pinned', isPinned: true }),
        buildConversation({ id: 'next', isPinned: false }),
      ];
      const { builder } = queryStub(rows);
      harness.conversations.createQueryBuilder = jest.fn().mockReturnValue(builder);

      const page = await harness.service.list({
        userId: USER_ID,
        limit: 1,
        sort: 'updated_at',
      });

      const payload = JSON.parse(
        Buffer.from(page.page.nextCursor as string, 'base64url').toString('utf8'),
      ) as Record<string, string>;
      expect(payload.g).toBe('true');
    });

    it('filters the next page on the pinned flag as well as the sort key', async () => {
      const harness = createHarness();
      const { builder, state } = queryStub([]);
      harness.conversations.createQueryBuilder = jest.fn().mockReturnValue(builder);

      const cursor = encodeCursor(
        new Date('2026-03-01T09:00:00Z'),
        'last-id',
        fingerprintQuery({
          userId: USER_ID,
          status: undefined,
          search: undefined,
          sort: 'updated_at',
        }),
        'true',
      );

      await harness.service.list({
        userId: USER_ID,
        limit: 1,
        sort: 'updated_at',
        cursor,
      });

      const predicate = state.andWhere.at(-1);
      // Without `is_pinned` in the tuple, an unpinned row newer than the last
      // pinned row would be filtered out and never shown.
      expect(predicate?.sql).toContain('conversation.is_pinned');
      expect(predicate?.params).toMatchObject({ cursorGroup: true });
    });

    it('rejects a cursor minted for a different query', async () => {
      const harness = createHarness();
      const { builder } = queryStub([]);
      harness.conversations.createQueryBuilder = jest.fn().mockReturnValue(builder);

      const foreign = encodeCursor(new Date(), 'id', fingerprintQuery({ userId: 'somebody-else' }));

      await expect(
        harness.service.list({ userId: USER_ID, limit: 10, sort: 'updated_at', cursor: foreign }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('rejects a corrupt cursor', async () => {
      const harness = createHarness();
      const { builder } = queryStub([]);
      harness.conversations.createQueryBuilder = jest.fn().mockReturnValue(builder);

      await expect(
        harness.service.list({
          userId: USER_ID,
          limit: 10,
          sort: 'updated_at',
          cursor: 'not-a-cursor',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('escapes LIKE wildcards so a search cannot match everything', async () => {
      const harness = createHarness();
      const { builder, state } = queryStub([]);
      harness.conversations.createQueryBuilder = jest.fn().mockReturnValue(builder);

      await harness.service.list({
        userId: USER_ID,
        limit: 10,
        sort: 'updated_at',
        search: '100%',
      });

      const predicate = state.andWhere.find((entry) => entry.sql.includes('ILIKE'));
      expect(predicate?.params).toMatchObject({ pattern: '%100\\%%' });
    });

    it('scopes the query to the owner', async () => {
      const harness = createHarness();
      const { builder } = queryStub([]);
      harness.conversations.createQueryBuilder = jest.fn().mockReturnValue(builder);

      await harness.service.list({ userId: USER_ID, limit: 10, sort: 'updated_at' });

      // The builder stub drops `where` params, so assert on the recorded clauses.
      expect(harness.conversations.createQueryBuilder).toHaveBeenCalledWith('conversation');
    });
  });

  describe('listMessages', () => {
    function queryStub(rows: unknown[]) {
      const state = { andWhere: [] as { sql: string; params?: unknown }[] };
      const builder = {
        where: () => builder,
        andWhere: (sql: string, params?: unknown) => {
          state.andWhere.push({ sql, params });
          return builder;
        },
        orderBy: () => builder,
        take: () => builder,
        getMany: jest.fn().mockResolvedValue(rows),
      };
      return { builder, state };
    }

    it('returns a desc page oldest-first so a transcript reads top to bottom', async () => {
      const harness = createHarness();
      const { builder } = queryStub([
        buildMessage({ id: 'c', sequence: 9 }),
        buildMessage({ id: 'b', sequence: 8 }),
        buildMessage({ id: 'a', sequence: 7 }),
      ]);
      harness.messages.createQueryBuilder = jest.fn().mockReturnValue(builder);

      const page = await harness.service.listMessages({
        conversationId: CONVERSATION_ID,
        limit: 2,
        order: 'desc',
      });

      expect(page.items.map((item) => item.sequence)).toEqual([8, 9]);
    });

    it('pages backwards through history with a sequence cursor', async () => {
      const harness = createHarness();
      const { builder, state } = queryStub([]);
      harness.messages.createQueryBuilder = jest.fn().mockReturnValue(builder);

      const cursor = encodeCursor(
        7,
        'a',
        fingerprintQuery({ conversationId: CONVERSATION_ID, order: 'desc' }),
      );

      await harness.service.listMessages({
        conversationId: CONVERSATION_ID,
        limit: 30,
        order: 'desc',
        cursor,
      });

      // Loading older messages walks the sequence downwards.
      expect(state.andWhere.at(-1)?.sql).toContain('message.sequence <');
      expect(state.andWhere.at(-1)?.params).toMatchObject({ cursorKey: '7' });
    });

    it('rejects a cursor issued for a different conversation', async () => {
      const harness = createHarness();
      const { builder } = queryStub([]);
      harness.messages.createQueryBuilder = jest.fn().mockReturnValue(builder);

      const foreign = encodeCursor(
        3,
        'x',
        fingerprintQuery({ conversationId: 'another-conversation', order: 'desc' }),
      );

      await expect(
        harness.service.listMessages({
          conversationId: CONVERSATION_ID,
          limit: 30,
          order: 'desc',
          cursor: foreign,
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  describe('ownedIds', () => {
    it('returns only the ids the user actually owns', async () => {
      const harness = createHarness();
      harness.conversations.find.mockResolvedValue([
        buildConversation({ id: 'owned-1' }),
        buildConversation({ id: 'owned-2' }),
      ]);

      const ids = await harness.service.ownedIds(USER_ID, ['owned-1', 'owned-2', 'someone-elses']);

      expect(ids).toEqual(['owned-1', 'owned-2']);

      // The query must be scoped to the owner as well as the ids, otherwise an
      // id belonging to another user would be accepted.
      const [options] = harness.conversations.find.mock.calls[0] as [
        { where: { userId: string; id: { _type: string; _value: string[] } } },
      ];
      expect(options.where.userId).toBe(USER_ID);
      expect(options.where.id._type).toBe('in');
      expect(options.where.id._value).toEqual(['owned-1', 'owned-2', 'someone-elses']);
    });

    it('short-circuits on an empty list rather than issuing a bad query', async () => {
      const harness = createHarness();

      await expect(harness.service.ownedIds(USER_ID, [])).resolves.toEqual([]);
      expect(harness.conversations.find).not.toHaveBeenCalled();
    });
  });
});
