/**
 * `@voiceflow/shared` — the single source of truth for everything the API and
 * the web client must agree on.
 *
 * Contents:
 *  - `enums`      closed value sets shared by both runtimes
 *  - `types`      transport + domain shapes (DTOs, provider ports)
 *  - `schemas`    Zod validators used for client forms *and* server DTOs
 *  - `constants`  route table, limits, token defaults
 *  - `config`     build-time identity and feature flags
 *  - `utils`      pure helpers with no framework dependency
 *
 * Rules for this package:
 *  - no NestJS, no React, no DOM globals
 *  - every module must be side-effect free and individually importable
 */
export * from './config';
export * from './constants';
export * from './enums';
export * from './schemas';
export * from './types';
export * from './utils';
