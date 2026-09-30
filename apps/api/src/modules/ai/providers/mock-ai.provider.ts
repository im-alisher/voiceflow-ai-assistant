import { Injectable } from '@nestjs/common';
import {
  EMPTY_TOKEN_USAGE,
  estimateTokens,
  type AiProviderCapabilities,
  type AiProviderId,
  type AppError,
  type CompletionChunk,
  type CompletionRequest,
  type CompletionResult,
  type Result,
  err,
  ok,
} from '@voiceflow/shared';
import type { AiProvider, ProviderCallContext } from '../../../common/interfaces';

/**
 * Zero-dependency AI backend used for development, CI and demos.
 *
 * It is *not* a stub: it performs intent detection, honours the system prompt,
 * reports real token accounting and supports streaming. That means every layer
 * above it — orchestration, persistence, the chat UI — is exercised end to end
 * without an account, an API key or a network call.
 *
 * Determinism is a feature, not a limitation: responses are chosen by hashing
 * the prompt, so a test can assert exact output and a demo can be reproduced.
 */

/** FNV-1a. Small, fast and good enough to pick a stable response variant. */
function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const LATENCY_PER_CHUNK_MS = 18;
const CHUNK_SIZE = 3;

interface IntentRule {
  readonly name: string;
  readonly pattern: RegExp;
  readonly respond: (match: RegExpMatchArray, context: IntentContext) => string;
}

interface IntentContext {
  readonly lastUserMessage: string;
  readonly turnCount: number;
  readonly systemPrompt: string | null;
}

const INTENTS: readonly IntentRule[] = [
  {
    name: 'greeting',
    pattern: /^\s*(hi|hey|hello|yo|good\s(morning|afternoon|evening))\b/i,
    respond: (_m, ctx) =>
      `Hello${ctx.turnCount > 1 ? ' again' : ''}! I am the Voiceflow assistant running on the built-in mock provider, so everything you see here works without an external AI account.\n\nTry one of these:\n- "what can you do"\n- "add 21 * 2"\n- "start a new conversation"\n- or just talk to me about whatever is on your mind.`,
  },
  {
    name: 'capabilities',
    pattern: /\b(what can you do|who are you|your capabilities|help me|features)\b/i,
    respond: () =>
      [
        'I am running on the **mock** provider, which means my replies are generated locally.',
        '',
        'What is real in this build:',
        '- **Conversations** are persisted with cursor-paginated history',
        '- **Voice** input and read-aloud through the Web Speech API, with mock fallbacks',
        '- **Streaming** responses over server-sent events',
        '- **Context** is assembled from the last N turns, so I remember this thread',
        '',
        'What is simulated: the language model itself. Swapping in a hosted provider is a configuration change, not a rewrite — see `AiProvider` in the API.',
      ].join('\n'),
  },
  {
    name: 'arithmetic',
    pattern:
      /\b(?:add|sum|total|calculate|compute)\b.*?(\d+(?:\.\d+)?)\s*([+\-*/x×])\s*(\d+(?:\.\d+)?)/i,
    respond: (match) => {
      // `RegExpMatchArray[0]` is the full match, so groups are read by index.
      const leftRaw = match[1] ?? '';
      const operatorRaw = match[2] ?? '';
      const rightRaw = match[3] ?? '';
      const left = Number(leftRaw);
      const operator = operatorRaw === 'x' || operatorRaw === '×' ? '*' : operatorRaw;
      const right = Number(rightRaw);
      const result = applyOperator(left, operator, right);
      if (result === null) {
        return `I could not work out ${leftRaw} ${operator} ${rightRaw}. Try a different expression.`;
      }
      return `${left} ${operator} ${right} = ${result}`;
    },
  },
  {
    name: 'provider',
    pattern: /\b(what model|which model|who are you running|which provider)\b/i,
    respond: () =>
      'Model: `mock-assistant-v1` — a deterministic, offline provider. It detects a handful of intents and otherwise replies from a curated response bank, so demos and tests are reproducible.',
  },
  {
    name: 'voice',
    pattern: /\b(voice|speak|read aloud|out loud|microphone)\b/i,
    respond: () =>
      'The voice layer is a pair of interfaces — `SpeechToTextProvider` and `TextToSpeechProvider` — with a browser-native implementation and a mock one. If your browser does not expose the Web Speech API, the mock provider takes over automatically and the UI keeps working.',
  },
  {
    name: 'thanks',
    pattern: /\b(thanks|thank you|cheers|appreciate it)\b/i,
    respond: () => 'Any time. Ask me something else whenever you are ready.',
  },
];

const ACKNOWLEDGEMENTS: readonly string[] = [
  'Understood. Here is how I would think about that.',
  'Noted. Let me break that down.',
  'Good question. Here is a structured take.',
  'Let me work through that with you.',
];

const FOLLOW_UPS: readonly string[] = [
  'Would you like me to go deeper on any part of this?',
  'Want me to turn that into a checklist?',
  'I can expand on that, or we can move on to something else.',
  'Shall I summarise that into three bullet points?',
];

const SYSTEM_PROMPT_ACK =
  'I am following the system prompt configured for this conversation, which shapes the tone of these replies.';

@Injectable()
export class MockAiProvider implements AiProvider {
  readonly id: AiProviderId = 'mock';

  readonly displayName = 'Mock Assistant (offline, deterministic)';

  readonly capabilities: AiProviderCapabilities = {
    streaming: true,
    systemPrompt: true,
    toolCalling: false,
    maxContextTokens: 8_000,
    maxOutputTokens: 1_024,
    deterministic: true,
  };

  isAvailable(): Promise<boolean> {
    // Nothing to reach: availability is a constant, and `isAvailable` stays on
    // the port so a networked provider can genuinely fail.
    return Promise.resolve(true);
  }

  /**
   * Buffered completion.
   *
   * Synchronous by nature (there is no upstream to await), but exposed as a
   * promise so a networked provider is a drop-in replacement.
   */
  complete(
    request: CompletionRequest,
    context: ProviderCallContext,
  ): Promise<Result<CompletionResult, AppError>> {
    return Promise.resolve(this.completeSync(request, context));
  }

  private completeSync(
    request: CompletionRequest,
    context: ProviderCallContext,
  ): Result<CompletionResult, AppError> {
    const promptTokens = request.messages.reduce(
      (total, message) => total + estimateTokens(message.content),
      0,
    );

    if (promptTokens > this.capabilities.maxContextTokens) {
      return err({
        code: 'AI_CONTEXT_OVERFLOW',
        message: `Prompt of ${promptTokens} tokens exceeds the ${this.capabilities.maxContextTokens} token window`,
      });
    }

    if (context.signal?.aborted) {
      return err({ code: 'BAD_REQUEST', message: 'Request cancelled before dispatch' });
    }

    const text = this.compose(request);
    const completionTokens = estimateTokens(text);
    const maxOutputTokens = request.maxOutputTokens ?? this.capabilities.maxOutputTokens;

    return ok({
      content: this.truncateToTokenBudget(text, maxOutputTokens, completionTokens),
      model: request.model ?? 'mock-assistant-v1',
      provider: this.id,
      usage: {
        promptTokens,
        completionTokens: Math.min(completionTokens, maxOutputTokens),
        totalTokens: promptTokens + Math.min(completionTokens, maxOutputTokens),
      },
      finishReason: completionTokens > maxOutputTokens ? 'length' : 'stop',
      latencyMs: 0,
    });
  }

  /**
   * Incremental completion.
   *
   * Chunks are emitted on a short delay so the client's rendering, scrolling
   * and interruption handling are genuinely exercised rather than receiving the
   * whole answer in one frame.
   */
  async *stream(
    request: CompletionRequest,
    context: ProviderCallContext,
  ): AsyncGenerator<CompletionChunk, void, unknown> {
    const startedAt = Date.now();
    const promptTokens = request.messages.reduce(
      (total, message) => total + estimateTokens(message.content),
      0,
    );

    if (promptTokens > this.capabilities.maxContextTokens) {
      yield {
        delta: '',
        done: true,
        finishReason: 'error',
        usage: EMPTY_TOKEN_USAGE,
      };
      return;
    }

    const full = this.compose(request);
    let emitted = '';

    for (let index = 0; index < full.length; index += CHUNK_SIZE) {
      if (context.signal?.aborted) {
        yield { delta: '', done: true, finishReason: 'cancelled' };
        return;
      }

      const delta = full.slice(index, index + CHUNK_SIZE);
      emitted += delta;
      await delay(LATENCY_PER_CHUNK_MS, context.signal);
      yield { delta, done: false };
    }

    yield {
      delta: '',
      done: true,
      finishReason: 'stop',
      usage: {
        promptTokens,
        completionTokens: estimateTokens(emitted),
        totalTokens: promptTokens + estimateTokens(emitted),
      },
    };

    // `latencyMs` is not part of the chunk contract; the orchestrator measures it.
    void startedAt;
  }

  /**
   * Intent detection followed by a deterministic, varied fallback.
   *
   * Kept as a pure function of the request so it is directly unit-testable.
   */
  private compose(request: CompletionRequest): string {
    const lastUserMessage =
      [...request.messages].reverse().find((message) => message.role === 'user')?.content ?? '';
    const systemPrompt =
      request.messages.find((message) => message.role === 'system')?.content ?? null;
    const turnCount = request.messages.filter((message) => message.role === 'user').length;

    const context: IntentContext = { lastUserMessage, turnCount, systemPrompt };

    for (const intent of INTENTS) {
      const match = lastUserMessage.match(intent.pattern);
      if (match) {
        return withSystemPromptAck(intent.respond(match, context), systemPrompt);
      }
    }

    const seed = stableHash(lastUserMessage);
    const acknowledgement = ACKNOWLEDGEMENTS[seed % ACKNOWLEDGEMENTS.length] as string;
    const followUp = FOLLOW_UPS[(seed >>> 8) % FOLLOW_UPS.length] as string;
    const echo = lastUserMessage.length > 0 ? `\n\nYou said: "${lastUserMessage}"` : '';

    return withSystemPromptAck(
      [
        `${acknowledgement}${echo}`,
        '',
        'I am the offline mock provider, so I cannot reason about arbitrary topics the way a hosted model would. Everything around me — conversation storage, streaming, voice, preferences — is fully implemented.',
        '',
        followUp,
      ].join('\n'),
      systemPrompt,
    );
  }

  private truncateToTokenBudget(text: string, maxTokens: number, actualTokens: number): string {
    if (actualTokens <= maxTokens) return text;
    const limit = Math.max(0, Math.floor(text.length * (maxTokens / actualTokens)));
    return `${text.slice(0, limit).trimEnd()}…`;
  }
}

function withSystemPromptAck(text: string, systemPrompt: string | null): string {
  // Only acknowledged for non-scripted replies; a greeting should not open with
  // a paragraph about its own configuration.
  if (!systemPrompt || text.startsWith('Model:')) return text;
  return `${text}\n\n---\n_${SYSTEM_PROMPT_ACK}_`;
}

function applyOperator(left: number, operator: string, right: number): number | null {
  switch (operator) {
    case '+':
      return round(left + right);
    case '-':
      return round(left - right);
    case '*':
      return round(left * right);
    case '/':
      return right === 0 ? null : round(left / right);
    default:
      return null;
  }
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** Abort-aware sleep; resolves early (without throwing) when cancelled. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      resolve();
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
