import type { PageInfo } from '@voiceflow/shared';

/**
 * Cursor-paginated collection.
 *
 * Offsets are intentionally avoided: an insert during scrolling silently
 * duplicates or skips rows, and `conversationId`-scoped history is exactly the
 * workload where that shows up as duplicated messages.
 */
export class PaginatedDto<T> {
  readonly items!: readonly T[];
  readonly page!: PageInfo;

  private constructor(items: readonly T[], page: PageInfo) {
    this.items = items;
    this.page = page;
  }

  static of<T>(
    items: readonly T[],
    options: { nextCursor: string | null; limit: number; total?: number },
  ): PaginatedDto<T> {
    return new PaginatedDto(items, {
      nextCursor: options.nextCursor,
      hasMore: options.nextCursor !== null,
      limit: options.limit,
      ...(options.total !== undefined ? { total: options.total } : {}),
    });
  }
}
