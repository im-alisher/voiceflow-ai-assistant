import { z } from 'zod';
import { AI_PROVIDER_IDS } from '../enums';

/**
 * Cursor pagination shared by every list endpoint.
 *
 * `cursor` is an opaque base64 token produced by the API — clients must never
 * construct one, only echo it back from `page.nextCursor`.
 */
export const paginationQuerySchema = z.object({
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

export const uuidSchema = z.string().uuid();

export const isoDateTimeSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Must be an ISO-8601 timestamp',
});

/**
 * Password policy enforced identically on the client (inline hints) and the
 * server (authoritative) so the two can never drift.
 */
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a digit');

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email('Enter a valid email address')
  .transform((value) => value.toLowerCase());

export const localeSchema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Expected a BCP-47 tag such as `en` or `en-US`');

export const timeZoneSchema = z.string().min(1).max(64);

export const aiProviderIdSchema = z.enum(AI_PROVIDER_IDS);
