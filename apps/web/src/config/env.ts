import { z } from 'zod';

/**
 * Client-side environment contract.
 *
 * Vite inlines `import.meta.env` at build time, so a typo in a variable name is
 * silently `undefined` in production. Parsing once at module load converts that
 * into an immediate, readable failure.
 */
const rawSchema = z.object({
  VITE_APP_NAME: z.string().min(1).default('Voiceflow'),
  VITE_API_BASE_URL: z.string().min(1).default('/api'),
  VITE_API_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(30_000),
  VITE_API_PROXY_TARGET: z.string().url().optional(),
  VITE_ENABLE_MOCK_AI: z.coerce.boolean().default(true),
  VITE_ENABLE_DEVTOOLS: z.coerce.boolean().default(true),
  MODE: z.string().default('development'),
});

const parsed = rawSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(
    `Invalid frontend environment configuration:\n${issues}\n\n` +
      'Copy `apps/web/.env.example` to `apps/web/.env` and fill in the values.',
  );
}

const raw = parsed.data;

export const env = {
  appName: raw.VITE_APP_NAME,
  apiBaseUrl: raw.VITE_API_BASE_URL.replace(/\/$/, ''),
  apiTimeoutMs: raw.VITE_API_TIMEOUT_MS,
  apiProxyTarget: raw.VITE_API_PROXY_TARGET,
  enableMockAi: raw.VITE_ENABLE_MOCK_AI,
  enableDevtools: raw.VITE_ENABLE_DEVTOOLS,
  isProduction: raw.MODE === 'production',
  isDevelopment: raw.MODE === 'development',
} as const;

export type Env = typeof env;
