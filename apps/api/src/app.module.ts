import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RolesGuard } from './common/guards/roles.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { AppConfigModule } from './config/config.module';
import { CONFIG_NAMESPACE, type HttpConfig } from './config';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';

/**
 * Composition root.
 *
 * Only wiring lives here — no business logic, and no feature module is
 * reachable except through this file. Adding a context is a one-line change.
 *
 * Global providers are registered here (rather than in `main.ts`) so the same
 * wiring applies to the e2e test harness, where a `Test.createTestingModule`
 * bootstrap would otherwise silently skip them.
 */
@Module({
  imports: [
    AppConfigModule,

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const http = config.getOrThrow<HttpConfig>(CONFIG_NAMESPACE.HTTP);
        return [
          {
            ttl: http.rateLimit.ttlMs,
            limit: http.rateLimit.max,
          },
        ];
      },
    }),

    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    AiModule,
    ConversationsModule,
  ],
  providers: [
    RequestContextMiddleware,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Order is significant: throttle, then authenticate, then authorise.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector) => new RolesGuard(reflector),
      inject: [Reflector],
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Correlation context runs ahead of every guard so a throttled, rejected, or
    // failed request still carries an id into the logs and the error envelope.
    consumer.apply(RequestContextMiddleware).forRoutes('*path');
  }
}
