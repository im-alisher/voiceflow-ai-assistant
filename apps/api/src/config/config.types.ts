import { z } from 'zod';

/**
 * Boot-time environment contract.
 *
 * The process refuses to start when this schema fails, which converts every
 * "undefined is not a function" bug at 3am into a loud, immediate failure.
 */
const booleanish = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .default(defaultValue)
    .transform((value) => (typeof value === 'boolean' ? value : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())));

const csv = (defaultValue: string) =>
  z
    .string()
    .default(defaultValue)
    .transform((value) =>
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    );

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),

  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_GLOBAL_PREFIX: z.string().default('api'),
  API_CORS_ORIGINS: csv('http://localhost:5173'),
  API_BODY_LIMIT: z.string().default('1mb'),
  API_RATE_LIMIT_TTL_MS: z.coerce.number().int().min(1000).default(60_000),
  API_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),

  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_USERNAME: z.string().min(1).default('postgres'),
  DB_PASSWORD: z.string().default(''),
  DB_DATABASE: z.string().min(1).default('voiceflow'),
  DB_SCHEMA: z.string().min(1).default('public'),
  DB_SSL: booleanish(false),
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  DB_LOGGING: booleanish(false),
  DB_RETRY_ATTEMPTS: z.coerce.number().int().min(0).max(60).default(10),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  JWT_ISSUER: z.string().default('voiceflow'),
  JWT_AUDIENCE: z.string().default('voiceflow-web'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  AUTH_COOKIE_SECURE: booleanish(false),
  AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  AI_PROVIDER: z.enum(['mock', 'openai', 'anthropic', 'ollama']).default('mock'),
  AI_DEFAULT_MODEL: z.string().min(1).default('mock-assistant-v1'),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600_000).default(30_000),
  AI_MAX_CONTEXT_TOKENS: z.coerce.number().int().min(256).default(8_000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(16).max(32_768).default(1024),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: booleanish(true),
});

export type EnvironmentVariables = z.infer<typeof envSchema>;

export interface AppConfig {
  readonly nodeEnv: EnvironmentVariables['NODE_ENV'];
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
}

export interface HttpConfig {
  readonly port: number;
  readonly host: string;
  readonly globalPrefix: string;
  readonly corsOrigins: readonly string[];
  readonly bodyLimit: string;
  readonly rateLimit: { readonly ttlMs: number; readonly max: number };
}

export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password: string;
  readonly database: string;
  readonly schema: string;
  readonly ssl: boolean;
  readonly poolSize: number;
  readonly logging: boolean;
  /** How many times to retry the initial connection before giving up. */
  readonly retryAttempts: number;
  /**
   * Hard-disabled. The schema is owned by hand-written migrations that the
   * operator applies; the application must never mutate it.
   */
  readonly synchronize: false;
  readonly migrationsRun: false;
}

export interface AuthConfig {
  readonly accessSecret: string;
  readonly accessTtl: string;
  readonly refreshSecret: string;
  readonly refreshTtl: string;
  readonly issuer: string;
  readonly audience: string;
  readonly bcryptSaltRounds: number;
  readonly cookie: {
    readonly domain?: string;
    readonly secure: boolean;
    readonly sameSite: 'lax' | 'strict' | 'none';
  };
}

export interface AiConfig {
  readonly provider: EnvironmentVariables['AI_PROVIDER'];
  readonly defaultModel: string;
  readonly requestTimeoutMs: number;
  readonly maxContextTokens: number;
  readonly maxOutputTokens: number;
  readonly temperature: number;
}

export interface LogConfig {
  readonly level: EnvironmentVariables['LOG_LEVEL'];
  readonly pretty: boolean;
}

export interface RootConfig {
  readonly app: AppConfig;
  readonly http: HttpConfig;
  readonly database: DatabaseConfig;
  readonly auth: AuthConfig;
  readonly ai: AiConfig;
  readonly log: LogConfig;
}
