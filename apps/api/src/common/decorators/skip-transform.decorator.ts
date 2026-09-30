import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const SKIP_TRANSFORM_KEY = 'response:skipTransform';

/**
 * Marks a handler whose return value is already in wire format.
 *
 * Required by anything that streams (SSE) or returns a `Set-Cookie`-bearing
 * raw response, because the transform interceptor must not re-wrap it.
 */
export const SkipTransform = (): CustomDecorator<string> => SetMetadata(SKIP_TRANSFORM_KEY, true);
