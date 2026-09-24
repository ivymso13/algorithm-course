import { getD1 } from "@/db";
import { parseAlgorithmSteps } from "./algorithmSteps";
import { configuredJevMode, createJevService, type BatchTrialResult } from "./jev";
import { JevRequestError, validateJevSteps } from "./jevRequest";
import { claimTrialSlot, releaseTrialSlot, runGuardedTrial, settleTrial, GLOBAL_TRIAL_SLOTS, SLOT_HELD_SQL, type TrialSlot } from "./jevRunner";
import { WarmupStateError } from "./warmupStore";

/** Randomized trials graded automatically for every maxbox submission revision. */
export const AUTO_TRIALS = 10;
/** Failed waves in a row before a run stops retrying on its own. */
export const AUTO_MAX_FAILED_WAVES = 4;
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 60_000;

export type AutoRunStatus = "queued" | "running" | "completed" | "failed" | "skipped" | "cancelled" | "superseded" | "transferred";

interface AutoRunRow {
  id: number; course_id: number; round_id: number; submission_id: number; submission_version: number;
  student_key: string; algorithm_text: string; mode: string; target_trials: number; status: AutoRunStatus;
  consecutive_failures: number; next_attempt_at: number; last_error: string | null;
  updated_at: string; completed_at: string | null;
}

/**
 * Saves a maxbox submission and registers its grading run in ONE D1 batch
 * (a transaction): there is never a saved revision without its run, or a run
 * for a revision that was not saved. Every statement, including the final
 * read, requires the round to still be open in this course, so a round that
 * closes just before the batch changes nothing and reports failure.
 * Identical text keeps the revision, so a repeated submit lands on the same
 * run (and requeues it only if it had failed). Changed text bumps the
 * revision and supersedes older active runs.
 */
export async function saveMaxboxSubmission(input: {
  courseId: number; roundId: number; studentKey: string; studentId: string; studentName: string; algorithmText: string;
}) {
  const db = await getD1();
  const now = new Date().toISOString();
  let status: AutoRunStatus = "queued";
  let skipReason: string | null = null;
  try {
    validateJevSteps(parseAlgorithmSteps(input.algorithmText));
  } catch (error) {
    if (!(error instanceof JevRequestError)) throw error;
    status = "skipped";
    skipReason = `AI가 실행할 수 없는 형식입니다: ${error.message}`;
  }
  const { courseId, roundId, studentKey } = input;
  const open = "EXISTS (SELECT 1 FROM warmup_rounds WHERE id = ? AND course_id = ? AND status = 'open')";
  const mine = "SELECT id FROM warmup_submissions WHERE round_id = ? AND student_key = ?";
  const results = await db.batch([
    db.prepare(`INSERT INTO warmup_submissions
      (round_id, student_key, student_id, student_name, anon_label, algorithm_text, revision, is_demo, created_at, updated_at)
      SELECT ?1, ?2, ?3, ?4, '참가자 ' || (SELECT count(*) + 1 FROM warmup_submissions WHERE round_id = ?1 AND is_demo = 0), ?5, 1, 0, ?6, ?6
      FROM warmup_rounds WHERE id = ?1 AND course_id = ?7 AND status = 'open'
      ON CONFLICT(round_id, student_key) DO UPDATE SET algorithm_text = excluded.algorithm_text,
        updated_at = excluded.updated_at, revision = warmup_submissions.revision + 1
      WHERE warmup_submissions.algorithm_text IS NOT excluded.algorithm_text
        AND EXISTS (SELECT 1 FROM warmup_rounds WHERE id = ?1 AND course_id = ?7 AND status = 'open')`)
      .bind(roundId, studentKey, input.studentId, input.studentName, input.algorithmText, now, courseId),
    db.prepare(`UPDATE jev_auto_runs SET status = 'superseded', epoch = epoch + 1, updated_at = ?
      WHERE submission_id = (${mine}) AND status IN ('queued', 'running', 'failed')
        AND submission_version < (SELECT revision FROM warmup_submissions WHERE round_id = ? AND student_key = ?)
        AND ${open}`)
      .bind(now, roundId, studentKey, roundId, studentKey, roundId, courseId),
    db.prepare(`INSERT INTO jev_auto_runs (course_id, round_id, submission_id, submission_version, student_key, student_id,
        student_name, algorithm_text, mode, target_trials, status, last_error, created_at, updated_at)
      SELECT r.course_id, s.round_id, s.id, s.revision, s.student_key, s.student_id, s.student_name, s.algorithm_text, ?, ?, ?, ?, ?, ?
      FROM warmup_submissions s JOIN warmup_rounds r ON r.id = s.round_id
      WHERE s.round_id = ? AND s.student_key = ? AND r.course_id = ? AND r.status = 'open' AND s.algorithm_text = ?
      ON CONFLICT(submission_id, submission_version) DO UPDATE SET status = 'queued', epoch = jev_auto_runs.epoch + 1,
        consecutive_failures = 0, next_attempt_at = 0, last_error = NULL, updated_at = excluded.updated_at
      WHERE jev_auto_runs.status = 'failed'`)
      .bind(configuredJevMode(), AUTO_TRIALS, status, skipReason, now, now, roundId, studentKey, courseId, input.algorithmText),
    db.prepare(`WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i + 1 < ?)
      INSERT INTO jev_auto_trials (run_id, trial_index, status, updated_at)
      SELECT r.id, n.i, 'pending', ? FROM jev_auto_runs r
        JOIN warmup_submissions s ON s.id = r.submission_id AND s.revision = r.submission_version
        JOIN n
      WHERE s.round_id = ? AND s.student_key = ? AND r.status = 'queued' AND ${open}
      ON CONFLICT(run_id, trial_index) DO NOTHING`)
      .bind(AUTO_TRIALS, now, roundId, studentKey, roundId, courseId),
    db.prepare(`SELECT s.id, s.algorithm_text AS algorithmText, s.revision, s.created_at AS createdAt, s.updated_at AS updatedAt
      FROM warmup_submissions s
      JOIN warmup_rounds w ON w.id = s.round_id AND w.course_id = ? AND w.status = 'open'
      JOIN jev_auto_runs r ON r.submission_id = s.id AND r.submission_version = s.revision
      WHERE s.round_id = ? AND s.student_key = ? AND s.algorithm_text = ?`)
      .bind(courseId, roundId, studentKey, input.algorithmText),
  ]);
  const saved = results[4].results[0] as { id: number; algorithmText: string; revision: number; createdAt: string; updatedAt: string } | undefined;
  if (!saved) throw new WarmupStateError("현재 진행 중인 라운드가 아닙니다");
  return saved;
}

/**
 * Fence: this trial's lease is ours and unexpired, it was claimed in the
 * run's current epoch (cancel/resume/retry/transfer bump it), the run may
 * still accept results, the revision is the latest, and the slot is held.
 */
const TRIAL_CURRENT_SQL = `SELECT 1 FROM jev_auto_trials t
  JOIN jev_auto_runs r ON r.id = t.run_id
  JOIN warmup_submissions s ON s.id = r.submission_id AND s.revision = r.submission_version
  WHERE t.id = ? AND t.lease_token = ? AND t.lease_until > ? AND t.epoch = r.epoch
    AND r.status IN ('running', 'failed') AND ${SLOT_HELD_SQL}`;

interface ClaimedTrial { slot: TrialSlot; trialId: number; runId: number; trialIndex: number; epoch: number; algorithmText: string }

async function claimAutoTrial(slot: TrialSlot, filter: AdvanceAutoOptions, mode: string, now: number): Promise<ClaimedTrial | null> {
  const db = await getD1();
  // A running trial from an older epoch (cancelled, then resumed) may be
  // reclaimed at once: its old holder is fenced out by the epoch and keeps
  // its own global slot until it stops.
  const [claim, , text] = await db.batch([
    db.prepare(`UPDATE jev_auto_trials SET status = 'running', lease_token = ?1, lease_until = ?2, updated_at = ?3,
        epoch = (SELECT r.epoch FROM jev_auto_runs r WHERE r.id = jev_auto_trials.run_id)
      WHERE id = (
        SELECT t.id FROM jev_auto_trials t
        JOIN jev_auto_runs r ON r.id = t.run_id
        JOIN warmup_submissions s ON s.id = r.submission_id AND s.revision = r.submission_version
        WHERE r.course_id = ?4 AND r.mode = ?5 AND r.status IN ('queued', 'running') AND r.next_attempt_at <= ?6
          AND (?7 IS NULL OR r.id = ?7) AND (?8 IS NULL OR r.round_id = ?8)
          AND (t.status = 'pending' OR (t.status = 'running' AND (t.lease_until < ?6 OR t.epoch != r.epoch)))
        ORDER BY r.id, t.trial_index LIMIT 1)
      RETURNING id, run_id AS runId, trial_index AS trialIndex, epoch`)
      .bind(slot.token, slot.leaseUntil, new Date(now).toISOString(), filter.courseId, mode,
        now, filter.onlyRunId ?? null, filter.roundId ?? null),
    db.prepare(`UPDATE jev_auto_runs SET status = 'running', updated_at = ?
      WHERE id = (SELECT run_id FROM jev_auto_trials WHERE lease_token = ?) AND status = 'queued'`)
      .bind(new Date(now).toISOString(), slot.token),
    db.prepare(`SELECT r.algorithm_text AS algorithmText FROM jev_auto_trials t JOIN jev_auto_runs r ON r.id = t.run_id
      WHERE t.lease_token = ?`).bind(slot.token),
  ]);
  const row = claim.results[0] as { id: number; runId: number; trialIndex: number; epoch: number } | undefined;
  if (!row) return null;
  const algorithmText = (text.results[0] as { algorithmText: string } | undefined)?.algorithmText ?? "";
  return { slot, trialId: row.id, runId: row.runId, trialIndex: row.trialIndex, epoch: row.epoch, algorithmText };
}

/** Hands back a claim that never started running (setup failed part way). */
async function releaseUnstarted(claimed: ClaimedTrial[]): Promise<void> {
  const db = await getD1();
  await Promise.allSettled(claimed.map(async (c) => {
    await db.prepare(`UPDATE jev_auto_trials SET status = 'pending', lease_token = NULL, lease_until = NULL
      WHERE id = ? AND lease_token = ? AND status = 'running'`).bind(c.trialId, c.slot.token).run();
    await releaseTrialSlot(c.slot);
  }));
}

async function runClaimedAutoTrial(claimed: ClaimedTrial): Promise<void> {
  const db = await getD1();
  const { slot, trialId, runId, epoch } = claimed;
  const stillCurrent = async () => Boolean(await db.prepare(TRIAL_CURRENT_SQL)
    .bind(trialId, slot.token, Date.now(), slot.slotId, slot.token, Date.now()).first());
  try {
    const outcome = await settleTrial(() =>
      runGuardedTrial(parseAlgorithmSteps(claimed.algorithmText), claimed.trialIndex, slot.leaseUntil, stillCurrent));
    const now = Date.now(); const iso = new Date(now).toISOString();
    if (outcome.kind === "done") {
      // A success still counts while the run is paused as failed by a sibling's
      // outage in the same wave — but never once cancelled, superseded,
      // transferred, or retried under a newer epoch.
      await db.batch([
        db.prepare(`UPDATE jev_auto_trials SET status = 'done', result = ?, committed_by = ?, lease_token = NULL, lease_until = NULL, updated_at = ?
          WHERE id = ? AND lease_token = ? AND lease_until > ? AND epoch = ? AND ${SLOT_HELD_SQL} AND EXISTS (
            SELECT 1 FROM jev_auto_runs r JOIN warmup_submissions s ON s.id = r.submission_id AND s.revision = r.submission_version
            WHERE r.id = ? AND r.status IN ('running', 'failed') AND r.epoch = ?)`)
          .bind(JSON.stringify(outcome.result), slot.token, iso, trialId, slot.token, now, epoch,
            slot.slotId, slot.token, now, runId, epoch),
        // Clears the visible outage message once calls succeed again (not while a
        // sibling's backoff from this wave is pending). The failure budget is
        // deliberately NOT reset by successes.
        db.prepare(`UPDATE jev_auto_runs SET last_error = NULL, updated_at = ?
          WHERE id = ? AND status = 'running' AND next_attempt_at <= ?
            AND EXISTS (SELECT 1 FROM jev_auto_trials WHERE id = ? AND committed_by = ?)`)
          .bind(iso, runId, now, trialId, slot.token),
        db.prepare(`UPDATE jev_auto_runs SET status = 'completed', completed_at = ?, updated_at = ?
          WHERE id = ? AND status IN ('running', 'failed') AND epoch = ?
            AND NOT EXISTS (SELECT 1 FROM jev_auto_trials WHERE run_id = ? AND status != 'done')`)
          .bind(iso, iso, runId, epoch, runId),
      ]);
    } else if (outcome.kind === "retry") {
      // Trials of one wave fail together in an outage; only the first failure
      // in a wave counts toward giving up, and it sets the backoff.
      await db.batch([
        db.prepare(`UPDATE jev_auto_runs SET
            consecutive_failures = consecutive_failures + (next_attempt_at <= ?1),
            next_attempt_at = CASE WHEN next_attempt_at <= ?1 THEN ?1 + min(?2, ?3 * (1 << consecutive_failures)) ELSE next_attempt_at END,
            status = CASE WHEN next_attempt_at <= ?1 AND consecutive_failures + 1 >= ?4 THEN 'failed' ELSE status END,
            last_error = ?5, updated_at = ?6
          WHERE id = ?7 AND status = 'running' AND epoch = ?10
            AND EXISTS (SELECT 1 FROM jev_auto_trials WHERE id = ?8 AND lease_token = ?9 AND epoch = ?10)`)
          .bind(now, BACKOFF_MAX_MS, BACKOFF_BASE_MS, AUTO_MAX_FAILED_WAVES, outcome.message, iso, runId, trialId, slot.token, epoch),
        db.prepare(`UPDATE jev_auto_trials SET status = 'pending', attempts = attempts + 1, lease_token = NULL, lease_until = NULL, updated_at = ?
          WHERE id = ? AND lease_token = ?`).bind(iso, trialId, slot.token),
      ]);
    } else {
      // Stale: hand the trial back untouched if nobody else has taken it.
      await db.prepare(`UPDATE jev_auto_trials SET status = 'pending', lease_token = NULL, lease_until = NULL
        WHERE id = ? AND lease_token = ? AND status = 'running'`).bind(trialId, slot.token).run();
    }
  } finally {
    await releaseTrialSlot(slot);
  }
}

export interface AdvanceAutoOptions {
  courseId: number;
  /** Only this run: a student's own run, or a teacher job waiting on it. */
  onlyRunId?: number | null;
  /** Only this round (the teacher panel). */
  roundId?: number | null;
  maxTrials?: number;
}

/**
 * One bounded, foreground step of automatic grading: claims up to
 * `maxTrials` global slots, pairs each with one pending (or lease-expired /
 * older-epoch) trial, and runs them in parallel. Returns how many trials
 * were attempted. Progress happens only while some page keeps calling this.
 */
export async function advanceAutoRuns(options: AdvanceAutoOptions): Promise<number> {
  const mode = createJevService().mode; // Misconfiguration fails before claiming anything.
  const max = Math.min(GLOBAL_TRIAL_SLOTS, Math.max(1, options.maxTrials ?? GLOBAL_TRIAL_SLOTS));
  const claimed: ClaimedTrial[] = [];
  try {
    while (claimed.length < max) {
      const slot = await claimTrialSlot(`auto:${options.courseId}`);
      if (!slot) break;
      let trial: ClaimedTrial | null;
      try {
        trial = await claimAutoTrial(slot, options, mode, Date.now());
      } catch (error) {
        await releaseTrialSlot(slot).catch(() => {});
        throw error;
      }
      if (!trial) { await releaseTrialSlot(slot); break; }
      claimed.push(trial);
    }
  } catch (error) {
    await releaseUnstarted(claimed);
    throw error;
  }
  // Every started trial is awaited (each releases its own slot) before any
  // error propagates, so no sibling is left running unobserved.
  const settled = await Promise.allSettled(claimed.map(runClaimedAutoTrial));
  const failure = settled.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failure) throw failure.reason;
  return claimed.length;
}

/**
 * Freezes a run that stopped (failed, cancelled, superseded) so a teacher job
 * can take over its remaining trials as the only executor: no resume, retry
 * or old in-flight trial can add to it afterwards. False if it changed first.
 */
export async function transferAutoRun(runId: number): Promise<boolean> {
  const db = await getD1();
  const row = await db.prepare(`UPDATE jev_auto_runs SET status = 'transferred', epoch = epoch + 1, updated_at = ?
    WHERE id = ? AND status IN ('failed', 'cancelled', 'superseded') RETURNING id`)
    .bind(new Date().toISOString(), runId).first();
  return Boolean(row);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface AutoRunView {
  runId: number;
  status: AutoRunStatus | "retrying";
  submissionVersion: number;
  doneTrials: number;
  totalTrials: number;
  message: string | null;
  /** Completed in a non-API mode (mock): never presented as AI feedback. */
  resultHidden: boolean;
  result: AutoResult | null;
}

export interface AutoResult {
  totalTrials: number; correctCount: number; incorrectCount: number; errorCount: number;
  examples: BatchTrialResult[]; createdAt: string; submissionText: string;
}

export async function loadAutoTrials(runId: number, limit = AUTO_TRIALS): Promise<BatchTrialResult[]> {
  const db = await getD1();
  const { results } = await db.prepare("SELECT result FROM jev_auto_trials WHERE run_id = ? AND status = 'done' ORDER BY trial_index LIMIT ?")
    .bind(runId, limit).all<{ result: string }>();
  return results.map((r) => JSON.parse(r.result) as BatchTrialResult);
}

export function summarizeAutoTrials(trials: BatchTrialResult[], createdAt: string, submissionText: string): AutoResult {
  return {
    totalTrials: trials.length,
    correctCount: trials.filter((t) => t.correct === true).length,
    incorrectCount: trials.filter((t) => t.correct === false).length,
    errorCount: trials.filter((t) => !t.executable).length,
    examples: trials.filter((t) => t.correct !== true).slice(0, 3),
    createdAt,
    submissionText,
  };
}

/** Unfinished and showing an outage message: waiting to retry, never a wrong answer. */
const RETRYING_SQL = "(r.status IN ('queued', 'running') AND r.last_error IS NOT NULL)";

/** The caller's own run for its latest revision in this round (course- and student-scoped), or null. */
export async function getOwnAutoRun(courseId: number, roundId: number, studentKey: string): Promise<AutoRunView | null> {
  const db = await getD1();
  const run = await db.prepare(`SELECT r.*, ${RETRYING_SQL} AS retrying,
      (SELECT count(*) FROM jev_auto_trials WHERE run_id = r.id AND status = 'done') AS done_trials
    FROM jev_auto_runs r JOIN warmup_submissions s ON s.id = r.submission_id AND s.revision = r.submission_version
    JOIN warmup_rounds w ON w.id = r.round_id AND w.course_id = r.course_id
    WHERE r.course_id = ? AND r.round_id = ? AND r.student_key = ? AND s.student_key = r.student_key
    ORDER BY r.id DESC LIMIT 1`).bind(courseId, roundId, studentKey)
    .first<AutoRunRow & { done_trials: number; retrying: number }>();
  if (!run) return null;
  const real = run.mode === "jev-api";
  const completed = run.status === "completed";
  return {
    runId: run.id,
    status: run.retrying ? "retrying" : run.status,
    submissionVersion: run.submission_version,
    doneTrials: run.done_trials,
    totalTrials: run.target_trials,
    message: run.last_error,
    resultHidden: completed && !real,
    result: completed && real
      ? summarizeAutoTrials(await loadAutoTrials(run.id), run.completed_at ?? run.updated_at, run.algorithm_text)
      : null,
  };
}

/** Student retry of their own latest run after it gave up: a new epoch, finished trials kept. */
export async function retryOwnAutoRun(courseId: number, roundId: number, studentKey: string): Promise<void> {
  const db = await getD1();
  await db.prepare(`UPDATE jev_auto_runs SET status = 'queued', epoch = epoch + 1, consecutive_failures = 0, next_attempt_at = 0, updated_at = ?
    WHERE course_id = ? AND round_id = ? AND student_key = ? AND status = 'failed'
      AND EXISTS (SELECT 1 FROM warmup_submissions s WHERE s.id = submission_id AND s.revision = submission_version)`)
    .bind(new Date().toISOString(), courseId, roundId, studentKey).run();
}

export interface AutoRoundSummary {
  roundId: number;
  total: number; queued: number; running: number; retrying: number; completed: number;
  failed: number; skipped: number; cancelled: number; transferred: number;
  doneTrials: number; totalTrials: number;
}

/** Latest-revision runs of one round, for the teacher panel. */
export async function autoRoundSummary(courseId: number, roundId: number): Promise<AutoRoundSummary> {
  const db = await getD1();
  const row = await db.prepare(`SELECT count(*) AS total,
      coalesce(sum(r.status = 'queued' AND NOT ${RETRYING_SQL}), 0) AS queued,
      coalesce(sum(r.status = 'running' AND NOT ${RETRYING_SQL}), 0) AS running,
      coalesce(sum(${RETRYING_SQL}), 0) AS retrying,
      coalesce(sum(r.status = 'completed'), 0) AS completed, coalesce(sum(r.status = 'failed'), 0) AS failed,
      coalesce(sum(r.status = 'skipped'), 0) AS skipped, coalesce(sum(r.status = 'cancelled'), 0) AS cancelled,
      coalesce(sum(r.status = 'transferred'), 0) AS transferred,
      coalesce(sum(CASE WHEN r.status IN ('skipped', 'transferred') THEN 0 ELSE r.target_trials END), 0) AS totalTrials,
      coalesce(sum(CASE WHEN r.status = 'transferred' THEN 0 ELSE
        (SELECT count(*) FROM jev_auto_trials t WHERE t.run_id = r.id AND t.status = 'done') END), 0) AS doneTrials
    FROM jev_auto_runs r JOIN warmup_submissions s ON s.id = r.submission_id AND s.revision = r.submission_version
    WHERE r.course_id = ? AND r.round_id = ?`).bind(courseId, roundId).first<Omit<AutoRoundSummary, "roundId">>();
  return { roundId, ...(row ?? { total: 0, queued: 0, running: 0, retrying: 0, completed: 0, failed: 0, skipped: 0, cancelled: 0, transferred: 0, doneTrials: 0, totalTrials: 0 }) };
}

/**
 * Stops a round's unfinished runs under a new epoch: in-flight trials fail
 * their fence before the next API call and can never commit, even after a
 * resume. Their global slots stay held until those requests actually stop.
 */
export async function cancelAutoRuns(courseId: number, roundId: number): Promise<void> {
  const db = await getD1();
  await db.prepare(`UPDATE jev_auto_runs SET status = 'cancelled', epoch = epoch + 1, updated_at = ?
    WHERE course_id = ? AND round_id = ? AND status IN ('queued', 'running', 'failed')`)
    .bind(new Date().toISOString(), courseId, roundId).run();
}

/** Resumes a round's cancelled/failed latest-revision runs under a new epoch; only unfinished trials run again. */
export async function resumeAutoRuns(courseId: number, roundId: number): Promise<void> {
  const db = await getD1();
  await db.prepare(`UPDATE jev_auto_runs SET status = 'queued', epoch = epoch + 1, consecutive_failures = 0, next_attempt_at = 0,
      last_error = NULL, updated_at = ?
    WHERE course_id = ? AND round_id = ? AND status IN ('cancelled', 'failed')
      AND EXISTS (SELECT 1 FROM warmup_submissions s WHERE s.id = submission_id AND s.revision = submission_version)`)
    .bind(new Date().toISOString(), courseId, roundId).run();
}
