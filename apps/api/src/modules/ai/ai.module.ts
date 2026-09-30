import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_PROVIDER_REGISTRY } from '../../common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiProviderRegistry } from './providers/ai-provider.registry';
import { MockAiProvider } from './providers/mock-ai.provider';

/**
 * AI bounded context.
 *
 * This module is the *only* place that knows which providers exist. Adding a
 * paid backend means appending a class here and to the registry factory below —
 * no controller, service or orchestration code is touched.
 */
@Module({
  controllers: [AiController],
  providers: [
    MockAiProvider,
    {
      provide: AI_PROVIDER_REGISTRY,
      useFactory: (mock: MockAiProvider, config: ConfigService) =>
        new AiProviderRegistry([mock], config),
      inject: [MockAiProvider, ConfigService],
    },
    AiService,
  ],
  exports: [AiService, AI_PROVIDER_REGISTRY],
})
export class AiModule {}
