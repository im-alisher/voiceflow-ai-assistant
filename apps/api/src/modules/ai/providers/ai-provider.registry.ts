import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiProviderId } from '@voiceflow/shared';
import { AI_PROVIDER_REGISTRY, AppException } from '../../../common';
import type { AiProvider, AiProviderDescriptor } from '../../../common/interfaces';
import { CONFIG_NAMESPACE, type AiConfig } from '../../../config';

/**
 * Name service for AI providers.
 *
 * Holds no behaviour of its own — the only reason it exists is so that
 * resolution happens in exactly one place. Every consumer asks the registry
 * for a provider by id, which keeps the "which backend is this?" decision out
 * of the orchestration layer and makes an unregistered id an explicit,
 * actionable error instead of an `undefined` dereference.
 *
 * Registration order also defines the fallback order, so a future provider can
 * be added by being appended to the `AiModule` providers list.
 */
@Injectable()
export class AiProviderRegistry {
  private readonly providers: ReadonlyMap<AiProviderId, AiProvider>;
  private readonly configuredDefault: AiProviderId;

  constructor(
    providers: AiProvider[],
    private readonly config: ConfigService,
  ) {
    this.providers = new Map(providers.map((provider) => [provider.id, provider]));
    this.configuredDefault = this.config.getOrThrow<AiConfig>(CONFIG_NAMESPACE.AI).provider;
  }

  /** Provider configured as the deployment default. */
  get defaultProviderId(): AiProviderId {
    return this.providers.has(this.configuredDefault)
      ? this.configuredDefault
      : (this.providers.keys().next().value as AiProviderId);
  }

  has(id: string): boolean {
    return this.providers.has(id as AiProviderId);
  }

  /** Throws `AI_NOT_CONFIGURED` for an unknown id — never returns undefined. */
  get(id?: AiProviderId): AiProvider {
    const providerId = id ?? this.defaultProviderId;
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new AppException(
        'AI_NOT_CONFIGURED',
        `AI provider "${providerId}" is not registered. Available: ${[...this.providers.keys()].join(', ')}`,
      );
    }
    return provider;
  }

  all(): AiProvider[] {
    return [...this.providers.values()];
  }

  /**
   * Availability of every registered provider.
   *
   * Probes are executed concurrently and failures are swallowed: a provider
   * being down must degrade the listing, not break it.
   */
  async describeAll(): Promise<AiProviderDescriptor[]> {
    const aiConfig = this.config.getOrThrow<AiConfig>(CONFIG_NAMESPACE.AI);
    return Promise.all(
      this.all().map(async (provider) => ({
        id: provider.id,
        displayName: provider.displayName,
        available: await safeProbe(provider),
        capabilities: provider.capabilities,
        defaultModel: aiConfig.defaultModel,
      })),
    );
  }
}

async function safeProbe(provider: AiProvider): Promise<boolean> {
  try {
    return await provider.isAvailable();
  } catch {
    return false;
  }
}

/** Injection token for the registry, so it can be mocked in isolation. */
export const AI_REGISTRY = AI_PROVIDER_REGISTRY;
