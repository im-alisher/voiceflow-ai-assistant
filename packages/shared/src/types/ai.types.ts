import type { MessageRole } from '../enums/message-role.enum';
import type { AiProviderId } from '../enums/ai-provider.enum';

/** Token accounting reported by the provider that produced a completion. */
export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export const EMPTY_TOKEN_USAGE: TokenUsage = Object.freeze({
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
});

/** A single message as exchanged with any AI provider. */
export interface ChatMessage {
  readonly role: MessageRole;
  readonly content: string;
  /** Optional stable identifier so providers can de-duplicate / cache. */
  readonly name?: string;
}

/** Normalised request handed to an `AiProvider` implementation. */
export interface CompletionRequest {
  readonly messages: readonly ChatMessage[];
  readonly model?: string;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly stopSequences?: readonly string[];
  /** Correlates a completion with the log lines and stored message row. */
  readonly requestId?: string;
  /** Free-form provider hints (e.g. Ollama `format: 'json'`). */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Normalised, non-streamed provider result. */
export interface CompletionResult {
  readonly content: string;
  readonly model: string;
  readonly provider: AiProviderId;
  readonly usage: TokenUsage;
  readonly finishReason: FinishReason;
  readonly latencyMs: number;
}

export const FINISH_REASONS = ['stop', 'length', 'content_filter', 'error', 'cancelled'] as const;

export type FinishReason = (typeof FINISH_REASONS)[number];

/**
 * Incremental provider update. `delta` is the text appended since the previous
 * chunk; a provider that only supports batch completion yields exactly one
 * chunk and then terminates.
 */
export interface CompletionChunk {
  readonly delta: string;
  readonly done: boolean;
  readonly finishReason?: FinishReason;
  readonly usage?: TokenUsage;
}

/**
 * Capability matrix a provider advertises. The orchestrator uses this to pick
 * between buffered and streamed execution without instanceof checks.
 */
export interface AiProviderCapabilities {
  readonly streaming: boolean;
  readonly systemPrompt: boolean;
  readonly toolCalling: boolean;
  readonly maxContextTokens: number;
  readonly maxOutputTokens: number;
  readonly deterministic: boolean;
}
