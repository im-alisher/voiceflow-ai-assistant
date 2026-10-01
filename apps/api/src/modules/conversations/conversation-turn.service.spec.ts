import type { AgentStreamEvent, TurnDto } from '@voiceflow/shared';
import { ConversationTurnService } from './conversation-turn.service';
import type { Conversation } from './entities/conversation.entity';
import type { ConversationsService } from './conversations.service';
import type { Clock } from '../../common';

const FIXED_NOW = new Date('2026-03-01T12:00:00.000Z');
const USER_ID = '11111111-1111-4111-8111-111111111111';

const clock: Clock = { now: () => FIXED_NOW, nowMs: () => FIXED_NOW.getTime() };

const REQUEST = {
  userId: USER_ID,
  conversationId: '22222222-2222-4222-8222-222222222222',
  content: 'How does streaming work?',
  inputMode: 'text' as const,
  contextTurns: 20,
  requestId: 'req-1',
};

function buildConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: REQUEST.conversationId,
    userId: USER_ID,
    title: 'Thread',
    status: 'active',
    model: 'mock-assistant-v1',
    providerId: 'mock',
    systemPrompt: null,
    messageCount: 0,
    lastMessagePreview: null,
    lastMessageAt: null,
    isPinned: false,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  } as Conversation;
}

function messageDto(sequence: number, role: 'user' | 'assistant', content: string) {
  return {
    id: `message-${sequence}`,
    conversationId: REQUEST.conversationId,
    role,
    content,
    inputMode: 'text',
    sequence,
    confidence: null,
    tokenCount: 3,
    model: role === 'assistant' ? 'mock-assistant-v1' : null,
    providerId: role === 'assistant' ? 'mock' : null,
    latencyMs: role === 'assistant' ? 12 : null,
    createdAt: FIXED_NOW.toISOString(),
    updatedAt: FIXED_NOW.toISOString(),
  };
}

interface Harness {
  readonly service: ConversationTurnService;
  readonly conversations: {
    findOwned: jest.Mock<Promise<Conversation>, [string, string]>;
    appendMessage: jest.Mock<
      Promise<{ message: ReturnType<typeof messageDto>; created: boolean }>,
      [unknown]
    >;
    recentContext: jest.Mock<
      Promise<readonly { role: 'user' | 'assistant'; content: string }[]>,
      [string, number]
    >;
    findFirstAssistantReply: jest.Mock<
      Promise<ReturnType<typeof messageDto> | null>,
      [string, number]
    >;
  };
  readonly ai: { complete: jest.Mock; stream: jest.Mock };
}

function createHarness(): Harness {
  const conversations = {
    findOwned: jest.fn().mockResolvedValue(buildConversation()),
    appendMessage: jest
      .fn()
      .mockResolvedValue({ message: messageDto(1, 'user', REQUEST.content), created: true }),
    recentContext: jest.fn().mockResolvedValue([{ role: 'user', content: REQUEST.content }]),
    findFirstAssistantReply: jest.fn().mockResolvedValue(null),
  };

  const ai = {
    complete: jest.fn().mockResolvedValue({
      content: 'Streaming emits deltas as they arrive.',
      model: 'mock-assistant-v1',
      provider: 'mock',
      usage: { promptTokens: 12, completionTokens: 7, totalTokens: 19 },
      finishReason: 'stop',
      latencyMs: 40,
    }),
    stream: jest.fn(),
  };

  return {
    service: new ConversationTurnService(
      conversations as unknown as ConversationsService,
      ai as never,
      clock,
    ),
    conversations,
    ai,
  };
}

interface StreamChunk {
  delta?: string;
  done?: boolean;
  finishReason?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

/**
 * Builds a provider stream as a plain generator: `for await` accepts a sync
 * iterable, and a sync generator keeps the linter's `require-await` rule happy.
 */
function* streamOf(chunks: (StreamChunk | Error)[]): Generator<StreamChunk, void, unknown> {
  for (const chunk of chunks) {
    if (chunk instanceof Error) throw chunk;
    yield chunk;
  }
}

async function collect(stream: AsyncGenerator<AgentStreamEvent, void, unknown>) {
  const events: AgentStreamEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe('ConversationTurnService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('send', () => {
    it('persists the user turn, then the assistant reply', async () => {
      const harness = createHarness();
      const reply = messageDto(2, 'assistant', 'Streaming emits deltas as they arrive.');
      harness.conversations.appendMessage
        .mockResolvedValueOnce({ message: messageDto(1, 'user', REQUEST.content), created: true })
        .mockResolvedValueOnce({ message: reply, created: true });

      const turn: TurnDto = await harness.service.send(REQUEST);

      expect(turn.userMessage.sequence).toBe(1);
      expect(turn.assistantMessage.role).toBe('assistant');
      expect(harness.ai.complete).toHaveBeenCalledTimes(1);
    });

    it('passes the conversation model through to the provider', async () => {
      const harness = createHarness();
      harness.conversations.findOwned.mockResolvedValue(
        buildConversation({ model: 'custom-model-v2' }),
      );

      await harness.service.send(REQUEST);

      const [request] = harness.ai.complete.mock.calls[0] as [{ model: string }];
      expect(request.model).toBe('custom-model-v2');
    });

    it('does not call the provider twice for a replayed clientMessageId', async () => {
      const harness = createHarness();
      const existing = messageDto(2, 'assistant', 'The answer you already have.');
      harness.conversations.appendMessage.mockResolvedValue({
        message: messageDto(1, 'user', REQUEST.content),
        created: false,
      });
      harness.conversations.findFirstAssistantReply.mockResolvedValue(existing);

      const turn = await harness.service.send(REQUEST);

      expect(harness.ai.complete).not.toHaveBeenCalled();
      expect(turn.assistantMessage.content).toBe('The answer you already have.');
    });

    it('continues past a replay when the earlier attempt never got a reply', async () => {
      const harness = createHarness();
      harness.conversations.appendMessage
        // The user turn already exists, so the append is a replay…
        .mockResolvedValueOnce({
          message: messageDto(1, 'user', REQUEST.content),
          created: false,
        })
        // …but the assistant turn is genuinely new.
        .mockResolvedValueOnce({
          message: messageDto(2, 'assistant', 'A fresh answer.'),
          created: true,
        });
      harness.conversations.findFirstAssistantReply.mockResolvedValue(null);

      const turn = await harness.service.send(REQUEST);

      expect(harness.ai.complete).toHaveBeenCalledTimes(1);
      expect(turn.assistantMessage.role).toBe('assistant');
    });

    it('refuses to send into an archived conversation', async () => {
      const harness = createHarness();
      harness.conversations.findOwned.mockResolvedValue(buildConversation({ status: 'archived' }));

      await expect(harness.service.send(REQUEST)).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(harness.ai.complete).not.toHaveBeenCalled();
    });

    it('reports a deleted conversation as gone', async () => {
      const harness = createHarness();
      harness.conversations.findOwned.mockResolvedValue(buildConversation({ status: 'deleted' }));

      await expect(harness.service.send(REQUEST)).rejects.toMatchObject({ code: 'GONE' });
    });

    it('prepends the system prompt ahead of the history', async () => {
      const harness = createHarness();
      harness.conversations.findOwned.mockResolvedValue(
        buildConversation({ systemPrompt: 'Answer as a pirate.' }),
      );

      await harness.service.send(REQUEST);

      const [request] = harness.ai.complete.mock.calls[0] as [
        { messages: { role: string; content: string }[] },
      ];
      expect(request.messages[0]?.role).toBe('system');
      expect(request.messages[0]?.content).toBe('Answer as a pirate.');
    });

    it('omits the system message when no prompt is configured', async () => {
      const harness = createHarness();
      await harness.service.send(REQUEST);

      const [request] = harness.ai.complete.mock.calls[0] as [{ messages: { role: string }[] }];
      expect(request.messages.some((message) => message.role === 'system')).toBe(false);
    });
  });

  describe('sendStream', () => {
    it('emits meta, one delta per chunk, then turn and done', async () => {
      const harness = createHarness();
      harness.ai.stream.mockReturnValue(
        streamOf([
          { delta: 'Stream' },
          { delta: 'ing works.' },
          {
            delta: '',
            done: true,
            finishReason: 'stop',
            usage: { promptTokens: 12, completionTokens: 3, totalTokens: 15 },
          },
        ]),
      );
      const reply = messageDto(2, 'assistant', 'Streaming works.');
      harness.conversations.appendMessage
        .mockResolvedValueOnce({ message: messageDto(1, 'user', REQUEST.content), created: true })
        .mockResolvedValueOnce({ message: reply, created: true });

      const events = await collect(harness.service.sendStream(REQUEST));

      expect(events.map((event) => event.type)).toEqual(['meta', 'delta', 'delta', 'turn', 'done']);
      expect(events[3]).toMatchObject({ type: 'turn', assistantMessageId: reply.id });
    });

    it('reassembles the streamed deltas into one stored message', async () => {
      const harness = createHarness();
      harness.ai.stream.mockReturnValue(
        streamOf([
          { delta: 'abc' },
          { delta: 'def' },
          { delta: '', done: true, finishReason: 'stop' },
        ]),
      );
      harness.conversations.appendMessage
        .mockResolvedValueOnce({ message: messageDto(1, 'user', REQUEST.content), created: true })
        .mockResolvedValueOnce({ message: messageDto(2, 'assistant', 'abcdef'), created: true });

      await collect(harness.service.sendStream(REQUEST));

      const assistantCall = harness.conversations.appendMessage.mock.calls[1]?.[0] as {
        role: string;
        content: string;
      };
      expect(assistantCall.role).toBe('assistant');
      expect(assistantCall.content).toBe('abcdef');
    });

    it('persists a truncated turn and reports an error when the stream throws', async () => {
      const harness = createHarness();
      harness.ai.stream.mockReturnValue(
        streamOf([{ delta: 'partial' }, new Error('upstream exploded')]),
      );
      harness.conversations.appendMessage
        .mockResolvedValueOnce({ message: messageDto(1, 'user', REQUEST.content), created: true })
        .mockResolvedValueOnce({ message: messageDto(2, 'assistant', 'partial'), created: true });

      const events = await collect(harness.service.sendStream(REQUEST));

      expect(events.some((event) => event.type === 'error')).toBe(true);
      // The partial text must survive, or the transcript loses the turn.
      const assistantCall = harness.conversations.appendMessage.mock.calls[1]?.[0] as {
        content: string;
      };
      expect(assistantCall.content).toBe('partial');
    });

    it('resends a stored answer instead of streaming again on replay', async () => {
      const harness = createHarness();
      harness.conversations.appendMessage.mockResolvedValue({
        message: messageDto(1, 'user', REQUEST.content),
        created: false,
      });
      harness.conversations.findFirstAssistantReply.mockResolvedValue(
        messageDto(2, 'assistant', 'already answered'),
      );

      const events = await collect(harness.service.sendStream(REQUEST));

      expect(harness.ai.stream).not.toHaveBeenCalled();
      expect(events).toContainEqual({ type: 'delta', delta: 'already answered' });
      expect(events.at(-1)?.type).toBe('done');
    });
  });
});
