import { JevTrialAbortedError } from "./errors";

/**
 * The check a runner performs before every upstream call. `stillCurrent` is
 * an awaited DB fence, so the deadline is checked again after it: a slow
 * fence must not let a call start past the deadline.
 */
export function createTrialGuard(deadline: number, stillCurrent: () => Promise<boolean>, now: () => number = Date.now) {
  return async () => {
    if (now() > deadline) throw new JevTrialAbortedError("deadline");
    const current = await stillCurrent();
    if (now() > deadline) throw new JevTrialAbortedError("deadline");
    if (!current) throw new JevTrialAbortedError("stale");
  };
}
