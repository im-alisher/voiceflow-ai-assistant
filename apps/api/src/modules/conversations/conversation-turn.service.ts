import type {
  AgentStreamEvent,
  AiProviderId,
  ChatMessage,
  MessageDto,
  TurnDto,
} from '@voiceflow/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppException, CLOCK, type Clock } from '../../common';
import type { ProviderCallContext } from '../../common/interfaces';
import { AiService } from '../ai/ai.service';
import type { Conversation } from './entities/conversation.entity';
import { ConversationsService } from './conversations.service';

export interface SendMessageRequest {
  readonly userId: string;
  readonly conversationId: string;
  readonly content: string;
  readonly inputMode: 'text' | 'voice';
  readonly clientMessageId?: string;
  /** Turns of history considered when building the prompt. */
  readonly contextTurns: number;
  readonly signal?: AbortSignal;
  readonly requestId: string;
}

/**
 * Orchestrates one user turn: persist, call the provider, persist the reply.
 *
 * The two persistence steps and the provider call are deliberately *not* in a
 * single transaction. Holding a transaction open across a network call to a model
 * provider would pin a row lock for the provider's full latency, and the sequence
 * number is already durable after the first write. A crash between the two leaves
 * an unanswered user turn, which is recoverable by reloading and far better than
 * a stalled write path.
 *
 * An assistant turn is always written, even when a stream is cut short, so a
 * transcript can never end on a user message the assistant never answered.
 */
@Injectable()
export class ConversationTurnService {
  private readonly logger = new Logger(ConversationTurnService.name);

  constructor(
    private readonly conversations: ConversationsService,
    private readonly ai: AiService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Buffered turn.
   *
   * @throws {AppException} NOT_FOUND when the conversation is not the caller's.
   */
  async send(request: SendMessageRequest): Promise<TurnDto> {
    const conversation = await this.loadSendable(request);

    const appended = await this.conversations.appendMessage({
      conversationId: conversation.id,
      role: 'user',
      content: request.content,
      inputMode: request.inputMode,
      clientMessageId: request.clientMessageId,
    });

    // A replayed `clientMessageId` already has its answer on disk. Re-running the
    // provider would spend a second completion to produce identical text.
    if (!appended.created) {
      const existing = await this.replyAfter(conversation.id, appended.message);
      if (existing) return { userMessage: appended.message, assistantMessage: existing };
    }

    const startedAt = this.clock.nowMs();
    const messages = await this.buildPrompt(conversation, request);

    const result = await this.ai.complete(
      { messages, model: conversation.model, requestId: request.requestId },
      this.providerContext(request),
      conversation.providerId as AiProviderId,
    );

    const reply = await this.conversations.appendMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: result.content,
      inputMode: 'text',
      model: result.model,
      providerId: result.provider,
      tokenCount: result.usage.completionTokens,
      latencyMs: this.clock.nowMs() - startedAt,
    });

    return { userMessage: appended.message, assistantMessage: reply.message };
  }

  /**
   * Streamed turn.
   *
   * Emits the event vocabulary the web client consumes. `meta` comes first so
   * the client can label the bubble, and the assistant row is written once the
   * stream terminates.
   */
  async *sendStream(request: SendMessageRequest): AsyncGenerator<AgentStreamEvent, void, unknown> {
    const conversation = await this.loadSendable(request);

    const appended = await this.conversations.appendMessage({
      conversationId: conversation.id,
      role: 'user',
      content: request.content,
      inputMode: request.inputMode,
      clientMessageId: request.clientMessageId,
    });

    yield {
      type: 'meta',
      conversationId: conversation.id,
      model: conversation.model,
      providerId: conversation.providerId,
    };

    if (!appended.created) {
      // Replay of an already-answered turn: resend the stored answer rather than
      // streaming a second completion.
      const existing = await this.replyAfter(conversation.id, appended.message);
      if (existing) {
        yield { type: 'delta', delta: existing.content };
        yield { type: 'turn', userMessageId: appended.message.id, assistantMessageId: existing.id };
        yield {
          type: 'done',
          finishReason: 'stop',
          tokenUsage: { promptTokens: 0, completionTokens: existing.tokenCount, totalTokens: 0 },
        };
        return;
      }
    }

    const startedAt = this.clock.nowMs();
    const messages = await this.buildPrompt(conversation, request);
    const providerId = conversation.providerId as AiProviderId;

    let content = '';
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let finishReason = 'stop';

    try {
      for await (const chunk of this.ai.stream(
        { messages, model: conversation.model, requestId: request.requestId },
        this.providerContext(request),
        providerId,
      )) {
        if (chunk.delta) {
          content += chunk.delta;
          yield { type: 'delta', delta: chunk.delta };
        }
        if (chunk.usage) usage = chunk.usage;
        if (chunk.finishReason) finishReason = chunk.finishReason;
        if (chunk.done) break;
      }
    } catch (error) {
      // Bytes are already on the wire, so this cannot become an HTTP error; it is
      // reported as a terminal event instead.
      this.logger.warn(
        `Stream interrupted for conversation ${conversation.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      yield {
        type: 'error',
        code: 'AI_PROVIDER_ERROR',
        message: 'The assistant response was interrupted',
      };
      finishReason = 'error';
    }

    const reply = await this.conversations.appendMessage({
      conversationId: conversation.id,
      role: 'assistant',
      // Written even when empty, so the transcript cannot end on a user turn.
      content,
      inputMode: 'text',
      model: conversation.model,
      providerId,
      tokenCount: usage.completionTokens,
      latencyMs: this.clock.nowMs() - startedAt,
    });

    yield {
      type: 'turn',
      userMessageId: appended.message.id,
      assistantMessageId: reply.message.id,
    };
    yield { type: 'done', finishReason, tokenUsage: usage };
  }

  /**
   * Resolves the conversation and rejects one that cannot accept a turn.
   *
   * Archived and deleted are reported distinctly so the client can offer
   * "restore" instead of a dead-end error.
   */
  private async loadSendable(request: SendMessageRequest): Promise<Conversation> {
    const conversation = await this.conversations.findOwned(request.userId, request.conversationId);

    if (conversation.status === 'archived') {
      throw new AppException(
        'CONFLICT',
        'This conversation is archived. Restore it before sending a message.',
      );
    }

    if (conversation.status === 'deleted') {
      throw new AppException('GONE', 'This conversation has been deleted');
    }

    return conversation;
  }

  /**
   * Assembles the prompt.
   *
   * The system prompt is synthesised per request rather than stored as a `system`
   * row, which is why `MessageRole` carries a value that never reaches the
   * `messages` table. History already includes the just-persisted user turn, so
   * it must not be added again.
   */
  private async buildPrompt(
    conversation: Conversation,
    request: SendMessageRequest,
  ): Promise<ChatMessage[]> {
    const history = await this.conversations.recentContext(conversation.id, request.contextTurns);

    const messages: ChatMessage[] = conversation.systemPrompt
      ? [{ role: 'system', content: conversation.systemPrompt }]
      : [];

    for (const entry of history) {
      messages.push({ role: entry.role, content: entry.content });
    }

    return messages;
  }

  /** The assistant turn that immediately followed a user turn, if any. */
  private replyAfter(
    conversationId: string,
    userMessage: { sequence: number },
  ): Promise<MessageDto | null> {
    return this.conversations.findFirstAssistantReply(conversationId, userMessage.sequence);
  }

  private providerContext(request: SendMessageRequest): ProviderCallContext {
    return { requestId: request.requestId, userId: request.userId, signal: request.signal };
  }
}
