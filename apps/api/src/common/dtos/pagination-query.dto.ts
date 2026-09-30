import { LIMITS } from '@voiceflow/shared';

/** Query parameters shared by every list endpoint. */
export class PaginationQueryDto {
  /** Opaque token from a previous `page.nextCursor`. Never construct it. */
  readonly cursor?: string;

  readonly limit: number = LIMITS.PAGE_SIZE_DEFAULT;
}
