/**
 * Pure index/id navigation for the one-at-a-time peer-algorithm review
 * carousel on /write/explore. Tracking the "current" entry by submission id
 * (not raw array index) is what keeps the carousel stable across a board
 * refresh: `loadBoard()` re-fetches and replaces the whole array (new
 * object identities, possibly reordered), but as long as the same
 * submission id is still present, `resolveCarouselIndex` finds it again
 * instead of silently jumping the viewer to a different entry.
 */

export type CarouselEntryLike = { id: number };

/** Index of `currentId` within `entries`, or 0 if not found / entries empty. */
export function resolveCarouselIndex<T extends CarouselEntryLike>(
  entries: readonly T[],
  currentId: number | null
): number {
  if (entries.length === 0 || currentId === null) return 0;
  const idx = entries.findIndex((e) => e.id === currentId);
  return idx === -1 ? 0 : idx;
}

/**
 * The id to focus after clicking "다음 아이디어" — advances by one and
 * wraps back to the first entry past the last one, so the reviewer can
 * always keep clicking through without hitting a dead end.
 */
export function nextCarouselId<T extends CarouselEntryLike>(
  entries: readonly T[],
  currentId: number | null
): number | null {
  if (entries.length === 0) return null;
  const idx = resolveCarouselIndex(entries, currentId);
  const nextIdx = (idx + 1) % entries.length;
  return entries[nextIdx].id;
}

/**
 * Picks the id to display for a (possibly just-changed) board: keeps the
 * current id if it's still on the board, otherwise falls back to the first
 * entry (covers first load and the rare case the current entry disappeared).
 */
export function reconcileCarouselId<T extends CarouselEntryLike>(
  entries: readonly T[],
  currentId: number | null
): number | null {
  if (entries.length === 0) return null;
  if (currentId !== null && entries.some((e) => e.id === currentId)) return currentId;
  return entries[0].id;
}

/** True once every entry currently on the board has been viewed at least once. */
export function isCarouselFullyReviewed<T extends CarouselEntryLike>(
  entries: readonly T[],
  viewedIds: ReadonlySet<number>
): boolean {
  return entries.length > 0 && entries.every((e) => viewedIds.has(e.id));
}
