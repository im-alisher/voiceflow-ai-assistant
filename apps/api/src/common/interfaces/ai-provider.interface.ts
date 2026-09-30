import type {
  AiProviderCapabilities,
  AiProviderId,
  AppError,
  CompletionChunk,
  CompletionRequest,
  CompletionResult,
  Result,
} from '@voiceflow/shared';

/** Ambient information a provider may use for logging and cancellation. */
export interface ProviderCallContext {
  readonly requestId: string;
  readonly userId?: string;
  /** Aborts the upstream call when the client disconnects. */
  readonly signal?: AbortSignal;
  /** Free-form, non-persisted diagnostics. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * The single seam between the orchestration layer and any AI backend.
 *
 * Design rules that keep the abstraction honest:
 *  - implementors return `Result`, they never throw for expected failures
 *  - they never log, never touch the database and never import NestJS
 *  - they accept and honour an `AbortSignal` so a cancelled request stops
 *    consuming a quota slot
 *
 * Adding a paid provider later is therefore a single `AiProvider` class plus
 * one line in the registry — no change to any call site.
 */
export interface AiProvider {
  readonly id: AiProviderId;
  readonly displayName: string;
  readonly capabilities: AiProviderCapabilities;

  /** Cheap readiness probe used by `/health/ready` and the providers endpoint. */
  isAvailable(): Promise<boolean>;

  /** Buffered completion. Always implemented. */
  complete(
    request: CompletionRequest,
    context: ProviderCallContext,
  ): Promise<Result<CompletionResult, AppError>>;

  /**
   * Incremental completion.
   *
   * Optional: callers must check `capabilities.streaming` and fall back to
   * `complete`, so a provider without streaming support still works.
   */
  stream?(
    request: CompletionRequest,
    context: ProviderCallContext,
  ): AsyncGenerator<CompletionChunk, void, unknown>;
}

/** Public, serialisable description of a registered provider. */
export interface AiProviderDescriptor {
  readonly id: AiProviderId;
  readonly displayName: string;
  readonly available: boolean;
  readonly capabilities: AiProviderCapabilities;
  readonly defaultModel: string;
}
