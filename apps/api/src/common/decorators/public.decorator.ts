import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:isPublic';

/**
 * Opts a route out of the globally registered `JwtAuthGuard`.
 *
 * Authentication is deny-by-default: a new controller is protected unless it
 * explicitly declares itself public, so forgetting the guard can never
 * accidentally publish an endpoint.
 */
export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);
