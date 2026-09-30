/**
 * Barrel for the cross-cutting layer.
 *
 * Feature modules should import from here rather than reaching into individual
 * files, which keeps the internal layout of `common/` free to change.
 */
export * from './constants';
export * from './decorators';
export * from './dtos';
export * from './entity';
export * from './errors';
export * from './guards';
export * from './interfaces';
export * from './interceptors';
export * from './logger';
export * from './utils';
