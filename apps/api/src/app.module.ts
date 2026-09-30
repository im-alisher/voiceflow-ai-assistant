import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { RolesGuard } from './common/guards/roles.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AppConfigModule } from './config/config.module';
import { CONFIG_NAMESPACE, type HttpConfig } from './config';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
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
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Order is significant: throttle, then authenticate, then authorise.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector) => new RolesGuard(reflector),
      inject: [Reflector],
    },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
