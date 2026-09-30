import type { ValidationPipeOptions } from '@nestjs/common';

/**
 * Shared behaviour of the global `ValidationPipe`.
 *
 * `forbidNonWhitelisted` is deliberate: a client that sends a misspelled field
 * gets told, instead of silently watching their setting not apply.
 *
 * This lives outside `main.ts` so tests can validate against the *same*
 * options the running application uses. A copy in a spec would drift, and a
 * drift here means a DTO passes its test and still rejects real traffic.
 */
export const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  // Implicit conversion would coerce query strings and path params using the
  // DTO's declared types; keeping it off means values are validated as sent.
  transformOptions: { enableImplicitConversion: false },
  stopAtFirstError: false,
};
