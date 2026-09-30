import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AiProviderId,
  AppError,
  CompletionChunk,
  CompletionRequest,
  CompletionResult,
  Result,
} from '@voiceflow/shared';
import { AI_PROVIDER_REGISTRY, AppException } from '../../common';
import type { AiProvider, ProviderCallContext } from '../../common/interfaces';
import { CONFIG_NAMESPACE, type AiConfig } from '../../config';
import { AiProviderRegistry } from './providers/ai-provider.registry';

/**
 * Facade the rest of the application uses to reach an AI backend.
 *
 * It owns the two cross-cutting concerns every caller would otherwise repeat:
 *  - applying deployment defaults (model, temperature, output budget)
 *  - converting an `AppError` *returned* by a provider into a thrown
 *    `AppException`, so provider failures travel the same path as every other
 *    error in the system
 *
 * Provider *selection* is deliberately not its concern — that is the registry's
 * job, which keeps this class free to grow orchestration behaviour later.
 */
@Injectable()
export class AiService {
  private readonly defaults: AiConfig;

  constructor(
    @Inject(AI_PROVIDER_REGISTRY) private readonly registry: AiProviderRegistry,
    config: ConfigService,
  ) {
    this.defaults = config.getOrThrow<AiConfig>(CONFIG_NAMESPACE.AI);
  }

  get defaultModel(): string {
    return this.defaults.defaultModel;
  }

  get defaultProviderId(): AiProviderId {
    return this.registry.defaultProviderId;
  }

  listProviders() {
    return this.registry.describeAll();
  }

  resolve(providerId?: AiProviderId): AiProvider {
    return this.registry.get(providerId);
  }

  /**
   * Buffered completion.
   *
   * @throws {AppException} when the provider reports a failure.
   */
  async complete(
    request: CompletionRequest,
    context: ProviderCallContext,
    providerId?: AiProviderId,
  ): Promise<CompletionResult> {
    const provider = this.registry.get(providerId);

    const result: Result<CompletionResult, AppError> = await provider.complete(
      this.withDefaults(request),
      context,
    );

    if (!result.ok) {
      throw new AppException(result.error.code, result.error.message, result.error.details);
    }

    return result.value;
  }

  /**
   * Streaming completion.
   *
   * A provider failure after the first chunk is reported as a terminal `error`
   * chunk rather than a thrown exception: bytes have already been written to
   * the client, and throwing would corrupt the SSE frame stream.
   */
  async *stream(
    request: CompletionRequest,
    context: ProviderCallContext,
    providerId?: AiProviderId,
  ): AsyncGenerator<CompletionChunk, void, unknown> {
    const provider = this.registry.get(providerId);

    if (!provider.capabilities.streaming || !provider.stream) {
      // Degrade to a single chunk rather than failing: the contract promises a
      // stream, and a client that renders deltas is correct either way.
      const result = await this.complete(request, context, provider.id);
      yield {
        delta: result.content,
        done: true,
        finishReason: result.finishReason,
        usage: result.usage,
      };
      return;
    }

    try {
      yield* provider.stream(this.withDefaults(request), context);
    } catch {
      yield { delta: '', done: true, finishReason: 'error' };
    }
  }

  /** Applies deployment defaults without overriding explicit caller intent. */
  private withDefaults(request: CompletionRequest): CompletionRequest {
    return {
      ...request,
      model: request.model ?? this.defaults.defaultModel,
      temperature: request.temperature ?? this.defaults.temperature,
      maxOutputTokens: request.maxOutputTokens ?? this.defaults.maxOutputTokens,
    };
  }
}
