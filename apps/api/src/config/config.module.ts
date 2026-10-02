import { resolve } from 'node:path';
import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ZodError, type ZodIssue } from 'zod';
import { buildConfig } from './configuration';
import { envSchema, type EnvironmentVariables } from './config.types';

/**
 * Parses and memoises the environment.
 *
 * `validate` and `load` both need the result, and Nest calls them in an order
 * that is not part of its public contract — memoising removes the ordering
 * dependency and guarantees a single, consistent snapshot.
 */
let cached: RootConfigSnapshot | undefined;

function snapshot(): RootConfigSnapshot {
  if (!cached) {
    const parsed = parseEnv();
    cached = { env: parsed, config: buildConfig(parsed) };
  }
  return cached;
}

type RootConfigSnapshot = {
  env: EnvironmentVariables;
  config: ReturnType<typeof buildConfig>;
};

function formatIssues(error: ZodError): string {
  const lines = error.issues.map((issue: ZodIssue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `  - ${path}: ${issue.message}`;
  });
  return [
    'Invalid environment configuration. The API refused to start.',
    ...lines,
    '',
    'Copy `apps/api/.env.example` to `apps/api/.env` and fill in the missing values.',
  ].join('\n');
}

function parseEnv(): EnvironmentVariables {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(formatIssues(result.error));
  }
  return result.data;
}

const isProduction = process.env['NODE_ENV'] === 'production';

/**
 * Path to the repository-root `.env`.
 *
 * The root `.env.example` documents a single environment contract shared by
 * every workspace, but this process runs with its working directory set to
 * `apps/api`, so a bare `.env` resolves to `apps/api/.env` and the root file is
 * never read. Resolving from `__dirname` puts the root contract back in play
 * without depending on where the process was started from; both `src/config`
 * (ts-node) and `dist/config` (built) sit at the same depth.
 */
const repositoryEnvPath = resolve(__dirname, '..', '..', '..', '..', '.env');

/**
 * Global configuration module.
 *
 * - `.env` files are read only outside production; in production configuration
 *   comes exclusively from the real environment, so a stale file on the host
 *   can never override an injected secret.
 * - The repository root is listed **last** on purpose. `@nestjs/config` merges
 *   files so that earlier entries win, which makes a workspace-local
 *   `apps/api/.env` an override of the shared contract rather than something it
 *   silently loses to. Real environment variables still beat every file.
 * - `expandVariables` lets a secret reference another (`DB_URL=${OTHER}`).
 * - Results are cached so every consumer observes the same snapshot.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: isProduction
        ? []
        : ['.env.local', '.env.development', '.env', repositoryEnvPath],
      validate: () => {
        snapshot();
        return snapshot().env;
      },
      load: [() => snapshot().config],
    }),
  ],
  exports: [NestConfigModule],
})
export class AppConfigModule {}
