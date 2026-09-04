/**
 * Pure paging helpers for the peer-algorithm review grid on /write/explore,
 * which shows `BOARD_PAGE_SIZE` entries at a time with page navigation.
 * Entries are always fetched in stable ascending-id order (see
 * listBoardSubmissions), so a given page index keeps showing the same
 * entries across a board refresh — new submissions only extend the last
 * page or add new ones past it, they never reshuffle earlier pages.
 */

export const BOARD_PAGE_SIZE = 3;

export type BoardPageEntryLike = { id: number };

/** Number of pages needed to show every entry, `pageSize` per page. */
export function pageCount(entryCount: number, pageSize: number = BOARD_PAGE_SIZE): number {
  return entryCount === 0 ? 0 : Math.ceil(entryCount / pageSize);
}

/** Clamps a page index into `[0, totalPages - 1]`, or 0 when there are no pages. */
export function clampPageIndex(page: number, totalPages: number): number {
  if (totalPages <= 0) return 0;
  return Math.min(Math.max(page, 0), totalPages - 1);
}

/** The slice of entries to show on `page` (0-indexed). */
export function entriesForPage<T>(
  entries: readonly T[],
  page: number,
  pageSize: number = BOARD_PAGE_SIZE
): T[] {
  const start = page * pageSize;
  return entries.slice(start, start + pageSize);
}

/** True once every entry currently on the board has been viewed at least once. */
export function isBoardFullyReviewed<T extends BoardPageEntryLike>(
  entries: readonly T[],
  viewedIds: ReadonlySet<number>
): boolean {
  return entries.length > 0 && entries.every((e) => viewedIds.has(e.id));
}
