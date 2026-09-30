import type { EnvironmentVariables, RootConfig } from './config.types';

/** Configuration namespace key used with `ConfigService.get<...>('http')`. */
export const CONFIG_NAMESPACE = {
  APP: 'app',
  HTTP: 'http',
  DATABASE: 'database',
  AUTH: 'auth',
  AI: 'ai',
  LOG: 'log',
} as const;

/**
 * Pure mapper from the validated environment to the typed configuration tree.
 *
 * Kept free of `process.env` access so it can be unit tested with fixtures and
 * reused by tooling (e.g. container config rendering).
 */
export function buildConfig(env: EnvironmentVariables): RootConfig {
  return {
    app: {
      nodeEnv: env.NODE_ENV,
      isProduction: env.NODE_ENV === 'production',
      isDevelopment: env.NODE_ENV === 'development',
      isTest: env.NODE_ENV === 'test',
    },
    http: {
      port: env.API_PORT,
      host: env.API_HOST,
      globalPrefix: env.API_GLOBAL_PREFIX,
      corsOrigins: env.API_CORS_ORIGINS,
      bodyLimit: env.API_BODY_LIMIT,
      rateLimit: {
        ttlMs: env.API_RATE_LIMIT_TTL_MS,
        max: env.API_RATE_LIMIT_MAX,
      },
    },
    database: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      username: env.DB_USERNAME,
      password: env.DB_PASSWORD,
      database: env.DB_DATABASE,
      schema: env.DB_SCHEMA,
      ssl: env.DB_SSL,
      poolSize: env.DB_POOL_SIZE,
      logging: env.DB_LOGGING,
      retryAttempts: env.DB_RETRY_ATTEMPTS,
      synchronize: false,
      migrationsRun: false,
    },
    auth: {
      accessSecret: env.JWT_ACCESS_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshSecret: env.JWT_REFRESH_SECRET,
      refreshTtl: env.JWT_REFRESH_TTL,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
      cookie: {
        domain: env.AUTH_COOKIE_DOMAIN || undefined,
        secure: env.AUTH_COOKIE_SECURE,
        sameSite: env.AUTH_COOKIE_SAME_SITE,
      },
    },
    ai: {
      provider: env.AI_PROVIDER,
      defaultModel: env.AI_DEFAULT_MODEL,
      requestTimeoutMs: env.AI_REQUEST_TIMEOUT_MS,
      maxContextTokens: env.AI_MAX_CONTEXT_TOKENS,
      maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
      temperature: env.AI_TEMPERATURE,
    },
    log: {
      level: env.LOG_LEVEL,
      pretty: env.LOG_PRETTY,
    },
  };
}
