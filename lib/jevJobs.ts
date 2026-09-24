import { getD1 } from "@/db";
import { parseAlgorithmSteps } from "./algorithmSteps";
import { createJevService, type BatchTrialResult } from "./jev";
import { advanceAutoRuns, loadAutoTrials, transferAutoRun } from "./jevAuto";
import { claimTrialSlot, releaseTrialSlot, runGuardedTrial, settleTrial, GLOBAL_TRIAL_SLOTS, SLOT_HELD_SQL, TRIAL_LEASE_MS, type TrialSlot } from "./jevRunner";
import { JevRequestError, validateJevSteps } from "./jevRequest";
import type { JevJobSummary } from "./jevJobTypes";

// A job lease covers one advance, which is at most one wave of trials.
const LEASE_MS = TRIAL_LEASE_MS;
const SELECT_SUMMARY = `SELECT j.id, j.round_id AS roundId, j.status, j.mode, j.last_error AS lastError,
 j.trials_per_student AS trialsPerStudent, count(i.id) AS totalStudents,
 coalesce(sum(i.status = 'completed'), 0) AS completedStudents,
 coalesce(sum(i.status = 'failed'), 0) AS failedStudents,
 coalesce(sum(i.status = 'skipped'), 0) AS skippedStudents,
 coalesce(sum(json_array_length(i.trials)), 0) AS completedTrials
 FROM jev_jobs j LEFT JOIN jev_job_items i ON i.job_id = j.id`;

export async function listJevJobs(courseId: number): Promise<JevJobSummary[]> {
  const db = await getD1();
  const { results } = await db.prepare(`${SELECT_SUMMARY}
    WHERE j.course_id = ? AND j.id IN (SELECT max(id) FROM jev_jobs WHERE course_id = ? GROUP BY round_id)
    GROUP BY j.id ORDER BY j.id DESC`).bind(courseId, courseId).all<JevJobSummary>();
  return results;
}
export async function getJevJob(courseId: number, id: number): Promise<JevJobSummary> {
  const db = await getD1();
  const job = await db.prepare(`${SELECT_SUMMARY} WHERE j.course_id = ? AND j.id = ? GROUP BY j.id`)
    .bind(courseId, id).first<JevJobSummary>();
  if (!job) throw new JevRequestError("실행 작업을 찾을 수 없습니다.", 404);
  return job;
}
export async function createJevJob(courseId: number, roundId: number, trials: number): Promise<JevJobSummary> {
  const service = createJevService(); // Fail before reserving a job if production is misconfigured.
  const db = await getD1();
  const active = await db.prepare("SELECT id FROM jev_jobs WHERE course_id = ? AND round_id = ? AND status IN ('queued','running')")
    .bind(courseId, roundId).first<{id: number}>();
  if (active) return getJevJob(courseId, active.id);
  const key = crypto.randomUUID(); const now = new Date().toISOString();
  try {
    await db.batch([
      db.prepare(`INSERT INTO jev_jobs(request_key,course_id,round_id,status,mode,trials_per_student,created_at,updated_at)
        SELECT ?,?,?,'queued',?,?,?,? FROM warmup_rounds WHERE id = ? AND course_id = ? AND status = 'closed'`)
        .bind(key,courseId,roundId,service.mode,trials,now,now,roundId,courseId),
      db.prepare(`INSERT INTO jev_job_items(job_id,submission_id,submission_version,student_key,student_id,student_name,algorithm_text)
        SELECT j.id,s.id,s.revision,s.student_key,s.student_id,s.student_name,s.algorithm_text
        FROM warmup_submissions s JOIN jev_jobs j ON j.round_id = s.round_id
        WHERE j.request_key = ? AND s.is_demo = 0`).bind(key),
    ]);
  } catch (error) {
    // A racing double click is resolved by the unique partial index, never two paid runs.
    const existing = await db.prepare("SELECT id FROM jev_jobs WHERE course_id = ? AND round_id = ? AND status IN ('queued','running')")
      .bind(courseId, roundId).first<{id:number}>();
    if (existing) return getJevJob(courseId, existing.id);
    throw error;
  }
  const row = await db.prepare("SELECT id FROM jev_jobs WHERE request_key = ?").bind(key).first<{id:number}>();
  if (!row) throw new JevRequestError("종료된 라운드에서만 실행할 수 있습니다.",409);
  return getJevJob(courseId,row.id);
}

export async function cancelJevJob(courseId:number,id:number) {
  const db=await getD1();
  await db.prepare(`UPDATE jev_jobs SET status='cancelled',lease_token=NULL,lease_until=NULL,updated_at=?
    WHERE id=? AND course_id=? AND status IN ('queued','running')`).bind(new Date().toISOString(),id,courseId).run();
  return getJevJob(courseId,id);
}
export async function resumeJevJob(courseId:number,id:number) {
  const service=createJevService(); const db=await getD1(); const job=await getJevJob(courseId,id);
  if (job.mode!==service.mode) throw new JevRequestError("실행 모드가 바뀌었습니다. 새 작업을 시작하세요.",409);
  if (!["failed","cancelled"].includes(job.status)) return job;
  try {
    await db.batch([
      db.prepare(`UPDATE jev_jobs SET status='queued',lease_token=NULL,lease_until=NULL,last_error=NULL,updated_at=? WHERE id=? AND course_id=? AND status IN ('failed','cancelled')`)
        .bind(new Date().toISOString(),id,courseId),
      db.prepare(`UPDATE jev_job_items SET status='pending',last_error=NULL WHERE job_id=? AND status='failed'
        AND EXISTS(SELECT 1 FROM jev_jobs WHERE id=? AND status='queued')`).bind(id,id),
    ]);
  } catch (error) {
    const other = await db.prepare("SELECT id FROM jev_jobs WHERE course_id=? AND round_id=? AND id!=? AND status IN ('queued','running')").bind(courseId,job.roundId,id).first();
    if (!other) throw error;
    throw new JevRequestError("이 라운드의 다른 작업이 진행 중입니다. 완료하거나 중단한 뒤 재시도하세요.",409);
  }
  return getJevJob(courseId,id);
}

interface JobItem {
 id:number; submission_id:number; submission_version:number; student_key:string; student_id:string;
 student_name:string; algorithm_text:string; trials:string;
}
/** One bounded step per request: up to GLOBAL_TRIAL_SLOTS trials of the current student
 * in parallel, under the global slots. A job lease plus fencing token keeps overlapping
 * tabs, stale requests and cancelled runs from committing; every API call re-checks it.
 * A student's automatic result for the same revision and mode is reused, not paid twice. */
export async function advanceJevJob(courseId:number,id:number) {
  const db=await getD1(); const job=await getJevJob(courseId,id);
  if (!["queued","running"].includes(job.status)) return job;
  const service=createJevService();
  if(job.mode!==service.mode) throw new JevRequestError("실행 모드가 바뀌었습니다. 작업을 중단하고 새로 시작하세요.",409);
  const token=crypto.randomUUID(); const now=Date.now();
  const lock=await db.prepare(`UPDATE jev_jobs SET status='running',lease_token=?,lease_until=?,updated_at=?
    WHERE id=? AND course_id=? AND status IN ('queued','running') AND (lease_token IS NULL OR lease_until < ?)
    RETURNING id`).bind(token,now+LEASE_MS,new Date(now).toISOString(),id,courseId,now).first();
  if(!lock) return getJevJob(courseId,id);
  try {
    const item=await db.prepare("SELECT * FROM jev_job_items WHERE job_id=? AND status='pending' ORDER BY id LIMIT 1")
      .bind(id).first<JobItem>();
    if(item) await advanceJobItem(courseId,job,item,token,now+LEASE_MS);
    await db.prepare(`UPDATE jev_jobs SET status=CASE
      WHEN status!='running' THEN status
      WHEN EXISTS(SELECT 1 FROM jev_job_items WHERE job_id=? AND status='pending') THEN 'running'
      WHEN EXISTS(SELECT 1 FROM jev_job_items WHERE job_id=? AND status='failed') THEN 'failed'
      ELSE 'completed' END, lease_token=NULL,lease_until=NULL,updated_at=?
      WHERE id=? AND lease_token=?`).bind(id,id,new Date().toISOString(),id,token).run();
    return getJevJob(courseId,id);
  } finally {
    await db.prepare("UPDATE jev_jobs SET lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?").bind(id,token).run();
  }
}

/**
 * For a (submission, revision) the student's automatic run is the canonical
 * executor of its first trials: completed → reuse; active → drive it (with its
 * own backoff) instead of paying for the same trials twice; stopped (failed,
 * cancelled, superseded) → atomically freeze it as 'transferred' so nothing
 * can resume it, reuse its finished trials, and run only the rest here.
 */
async function advanceJobItem(courseId:number,job:JevJobSummary,item:JobItem,token:string,jobLeaseUntil:number) {
  const db=await getD1(); const id=job.id;
  let trials:BatchTrialResult[]=JSON.parse(item.trials);
  const before=trials.length;
  let status="pending"; let lastError:string|null=null;
  const steps=parseAlgorithmSteps(item.algorithm_text);
  try {
    if(!steps.length) status="skipped";
    else validateJevSteps(steps);
  } catch(error) {
    if(!(error instanceof JevRequestError)) throw error;
    status="skipped"; lastError=error.message;
  }
  if(status==="pending" && trials.length===0) {
    const auto=await db.prepare("SELECT id,status FROM jev_auto_runs WHERE submission_id=? AND submission_version=? AND mode=?")
      .bind(item.submission_id,item.submission_version,job.mode).first<{id:number;status:string}>();
    if(auto && ["queued","running"].includes(auto.status)) {
      await advanceAutoRuns({courseId,onlyRunId:auto.id});
      return;
    }
    if(auto && ["failed","cancelled","superseded"].includes(auto.status) && !(await transferAutoRun(auto.id))) return; // Changed meanwhile; re-read next advance.
    if(auto && auto.status!=="skipped") {
      trials=(await loadAutoTrials(auto.id,job.trialsPerStudent)).map((t,i)=>({...t,trialIndex:i}));
    }
  }
  const need=status==="pending" ? job.trialsPerStudent-trials.length : 0;
  if(need>0) {
    const slots:TrialSlot[]=[];
    try {
      while(slots.length<Math.min(need,GLOBAL_TRIAL_SLOTS)) {
        const slot=await claimTrialSlot(`job:${id}`);
        if(!slot) break;
        slots.push(slot);
      }
      if(!slots.length && trials.length===before) return; // Every slot is busy; nothing to save yet.
      // Each trial's deadline comes from the earlier of the job and slot leases.
      const outcomes=await Promise.all(slots.map((slot,k)=>settleTrial(()=>runGuardedTrial(steps,trials.length+k,Math.min(jobLeaseUntil,slot.leaseUntil),async()=>Boolean(
        await db.prepare(`SELECT 1 FROM jev_jobs WHERE id=? AND lease_token=? AND status='running' AND lease_until>? AND ${SLOT_HELD_SQL}`)
          .bind(id,token,Date.now(),slot.slotId,slot.token,Date.now()).first())))));
      for(const outcome of outcomes) {
        if(outcome.kind==="done") trials.push({...outcome.result,trialIndex:trials.length});
        else if(outcome.kind==="retry") { status="failed"; lastError=outcome.message; }
      }
    } finally {
      await Promise.all(slots.map(releaseTrialSlot));
    }
  }
  if(status==="pending" && trials.length>=job.trialsPerStudent) status="completed";
  const statements=[db.prepare(`UPDATE jev_job_items SET trials=?,status=?,last_error=? WHERE id=?
    AND EXISTS(SELECT 1 FROM jev_jobs WHERE id=? AND lease_token=? AND status='running' AND lease_until>?)`)
    .bind(JSON.stringify(trials),status,lastError,item.id,id,token,Date.now())];
  if(status==="completed") {
    statements.push(db.prepare(`INSERT INTO jev_batch_evaluations
      (course_id,round_id,student_key,student_id,student_name,problem_id,job_item_id,submission_id,submission_version,submission_text,mode,source,algorithm_steps,total_trials,correct_count,incorrect_count,error_count,trials,created_at)
      SELECT ?,?,?,?,?,'max-finding',?,?,?,?,?,'teacher',?,?,?,?,?,?,?
      FROM jev_job_items i JOIN jev_jobs j ON j.id=i.job_id
      WHERE i.id=? AND i.status='completed' AND j.lease_token=? AND j.status='running'
      ON CONFLICT(job_item_id) DO NOTHING`)
      .bind(courseId,job.roundId,item.student_key,item.student_id,item.student_name,item.id,item.submission_id,item.submission_version,item.algorithm_text,job.mode,
        JSON.stringify(steps),trials.length,trials.filter(r=>r.correct===true).length,trials.filter(r=>r.correct===false).length,trials.filter(r=>!r.executable).length,JSON.stringify(trials),new Date().toISOString(),item.id,token));
  }
  // Infrastructure failures pause the job; saved trials stay. Retry resumes only unfinished work.
  if(status==="failed") statements.push(db.prepare("UPDATE jev_jobs SET status='failed',last_error=? WHERE id=? AND lease_token=? AND status='running'").bind(lastError,id,token));
  await db.batch(statements);
}
