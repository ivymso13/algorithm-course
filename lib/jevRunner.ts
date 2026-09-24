import { getD1 } from "@/db";
import { batchEvaluate, createJevService, createTrialGuard, DEFAULT_JEV_TIMEOUT_MS, isJevInfrastructureError, JevTrialAbortedError, type BatchTrialResult } from "./jev";
import { maxBoxProblem, type MaxBoxInput } from "./problems/maxbox";

/** Jev trials running at once across every course, student and teacher job. */
export const GLOBAL_TRIAL_SLOTS = 5;
/** How long a slot/trial lease (and a teacher job lease) lasts from its claim. */
export const TRIAL_LEASE_MS = 130_000;
/**
 * No API call may start later than this before the lease ends: one in-flight
 * call (at most DEFAULT_JEV_TIMEOUT_MS) plus slack for the commit. So once a
 * lease has expired its old holder can no longer be talking to the API, and
 * the slot or trial can safely be handed to someone else.
 */
export const CALL_MARGIN_MS = DEFAULT_JEV_TIMEOUT_MS + 12_000;
/** The absolute time after which a trial holding a lease until `leaseUntil` starts no new call. */
export const trialDeadline = (leaseUntil: number) => leaseUntil - CALL_MARGIN_MS;

export const INFRA_FAILURE_MESSAGE = "AI 서비스 응답을 받지 못했습니다. 학생 알고리즘의 오답으로 처리하지 않았습니다.";
export const INTERNAL_FAILURE_MESSAGE = "실행 처리 중 내부 오류가 발생했습니다. 완료한 결과는 보존되며 관리자 확인이 필요합니다.";

export interface TrialSlot { slotId: number; token: string; leaseUntil: number }

/** Takes a free (or expired) global slot, or null when all are busy. */
export async function claimTrialSlot(holder: string, now = Date.now()): Promise<TrialSlot | null> {
  const db = await getD1();
  const token = crypto.randomUUID();
  const leaseUntil = now + TRIAL_LEASE_MS;
  const row = await db.prepare(`UPDATE jev_trial_slots SET lease_token = ?, lease_until = ?, holder = ?
    WHERE id = (SELECT id FROM jev_trial_slots WHERE lease_token IS NULL OR lease_until < ? ORDER BY id LIMIT 1)
    RETURNING id`).bind(token, leaseUntil, holder, now).first<{ id: number }>();
  return row ? { slotId: row.id, token, leaseUntil } : null;
}

/** Only the holder releases its slot; after expiry someone else may already own it. */
export async function releaseTrialSlot(slot: TrialSlot): Promise<void> {
  const db = await getD1();
  await db.prepare("UPDATE jev_trial_slots SET lease_token = NULL, lease_until = NULL, holder = NULL WHERE id = ? AND lease_token = ?")
    .bind(slot.slotId, slot.token).run();
}

/** SQL predicate (2 binds: slot id, token) that the slot lease is still ours and unexpired. */
export const SLOT_HELD_SQL = "EXISTS (SELECT 1 FROM jev_trial_slots WHERE id = ? AND lease_token = ? AND lease_until > ?)";

function maxBoxInstance() {
  const instance = maxBoxProblem.generate();
  return { numbers: (instance.input as MaxBoxInput).counts, correctAnswer: instance.correctAnswer as number };
}

/**
 * Runs one randomized maxbox trial. Before every upstream call the deadline
 * (derived from the lease taken at claim time, not from when running began)
 * and `stillCurrent` (the caller's DB fence) are checked, so a cancelled,
 * superseded or expired trial stops before spending another call.
 */
export async function runGuardedTrial(steps: string[], trialIndex: number, leaseUntil: number, stillCurrent: () => Promise<boolean>): Promise<BatchTrialResult> {
  const service = createJevService(process.env, { beforeRequest: createTrialGuard(trialDeadline(leaseUntil), stillCurrent) });
  const result = await batchEvaluate(steps, 1, maxBoxInstance, { service, concurrency: 1 });
  return { ...result.trials[0], trialIndex };
}

export type TrialOutcome =
  | { kind: "done"; result: BatchTrialResult }
  | { kind: "stale" }
  | { kind: "retry"; message: string };

/** Classifies a trial's end: never turns an outage or abort into a wrong answer. */
export async function settleTrial(run: () => Promise<BatchTrialResult>): Promise<TrialOutcome> {
  try {
    return { kind: "done", result: await run() };
  } catch (error) {
    if (error instanceof JevTrialAbortedError && error.reason === "stale") return { kind: "stale" };
    if (error instanceof JevTrialAbortedError || isJevInfrastructureError(error)) return { kind: "retry", message: INFRA_FAILURE_MESSAGE };
    return { kind: "retry", message: INTERNAL_FAILURE_MESSAGE };
  }
}
