export * from './injection-tokens';

/**
 * Alias for the token map, kept for readability at call sites that inject a
 * whole family of cross-cutting ports.
 */
export { DI_TOKENS as CORE_TOKENS } from './injection-tokens';
