/**
 * Pure warm-up round guards/errors — no `@/db` import, so this module (unlike
 * `lib/warmupStore.ts`) can be unit-tested without a D1/Cloudflare Workers
 * runtime.
 */

/** A round isn't in the state an action requires (e.g. voting on a closed round). */
export class WarmupStateError extends Error {}
/** A caller tried to act on their own submission (self-vote/self-experience) or someone else's data. */
export class WarmupOwnershipError extends Error {}
/** No round exists with the given id for the given course — missing id and cross-course access look identical. */
export class WarmupNotFoundError extends Error {}

/**
 * Shared existence/ownership guard for every teacher round-lifecycle action
 * (publish, close, delete): missing id and cross-course access must look
 * identical (no ownership leak), so both throw the same WarmupNotFoundError.
 * Callers should only translate WarmupNotFoundError/WarmupStateError into
 * HTTP responses — anything else (e.g. a DB failure) must propagate as a
 * genuine 500, not get folded into "not found".
 */
export function assertWarmupRoundExists<T extends { courseId: number }>(round: T | null, courseId: number): T {
  if (!round || round.courseId !== courseId) throw new WarmupNotFoundError("라운드를 찾을 수 없습니다");
  return round;
}

/**
 * Guard for round deletion: builds on assertWarmupRoundExists, then also
 * blocks open rounds — they must be closed first since deletion is
 * irreversible.
 */
export function assertWarmupRoundDeletable(
  round: { courseId: number; status: string } | null,
  courseId: number
): void {
  const found = assertWarmupRoundExists(round, courseId);
  if (found.status === "open") {
    throw new WarmupStateError("진행 중인 라운드는 삭제할 수 없습니다. 먼저 종료하세요.");
  }
}
