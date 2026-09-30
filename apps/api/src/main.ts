import 'reflect-metadata';

import { Logger, ValidationPipe, type INestApplication, type ValidationPipeOptions } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { APP_CONFIG } from '@voiceflow/shared';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger';
import { CONFIG_NAMESPACE, type HttpConfig, type LogConfig } from './config';

/**
 * Shared behaviour of the global `ValidationPipe`.
 *
 * `forbidNonWhitelisted` is deliberate: a client that sends a misspelled field
 * gets told, instead of silently watching their setting not apply.
 */
const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: false },
  stopAtFirstError: false,
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Buffering would break SSE; every log line is written as it happens.
    // The logger is *not* disabled here: `useLogger` can only be called once
    // the app exists, and a failure during creation must still be visible.
    bufferLogs: false,
  });

  const config = app.get(ConfigService);
  const http = config.getOrThrow<HttpConfig>(CONFIG_NAMESPACE.HTTP);
  const log = config.getOrThrow<LogConfig>(CONFIG_NAMESPACE.LOG);
  const logger = new AppLogger('Bootstrap', log.pretty);
  app.useLogger(logger.child('Nest'));

  // Behind exactly one reverse proxy: required for `req.ip` to be the client IP
  // rather than the load balancer, which the rate limiter depends on.
  // The Express instance is intentionally untyped: `trust proxy` is a
  // framework-level setting with no NestJS surface.
  const httpAdapterInstance = app.getHttpAdapter().getInstance() as {
    set(key: string, value: number): void;
  };
  httpAdapterInstance.set('trust proxy', 1);

  app.use(
    helmet({
      // The API serves JSON, never HTML, so a restrictive CSP costs nothing and
      // blocks any attempt to reflect a payload into a browser context.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: { maxAge: 31_536_000, includeSubDomains: true },
    }),
  );

  // Size limits are enforced by the body parser, before a payload is buffered.
  app.use(json({ limit: http.bodyLimit }));
  app.use(urlencoded({ extended: true, limit: http.bodyLimit }));
  app.use(cookieParser());

  app.enableCors({
    origin: [...http.corsOrigins],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Api-Version'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86_400,
  });

  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
  app.setGlobalPrefix(http.globalPrefix);
  app.enableShutdownHooks();

  if (!config.get<boolean>('app.isProduction')) {
    mountOpenApi(app, http.globalPrefix, logger);
  }

  await app.listen(http.port, http.host);

  logger.log(
    `${APP_CONFIG.name} API listening on http://${http.host}:${http.port}/${http.globalPrefix}`,
  );
}

/**
 * OpenAPI is mounted outside production on purpose: it is a full description
 * of the attack surface and is of no use to consumers once deployed.
 */
function mountOpenApi(app: INestApplication, prefix: string, logger: AppLogger): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(`${APP_CONFIG.name} API`)
      .setDescription(APP_CONFIG.description)
      .setVersion(APP_CONFIG.version)
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .addTag('auth', 'Authentication and session management')
      .addTag('users', 'Profile and preferences')
      .addTag('conversations', 'Conversation and message history')
      .addTag('ai', 'AI providers and orchestration')
      .addTag('voice', 'Speech-to-text and text-to-speech')
      .addTag('health', 'Liveness and readiness probes')
      .build(),
  );

  SwaggerModule.setup(`${prefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  logger.log(`OpenAPI documentation available at /${prefix}/docs`);
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
