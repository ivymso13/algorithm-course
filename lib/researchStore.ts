import { getD1 } from "@/db";
import { WarmupStateError } from "./warmupRoundGuards";
import { sanitizeCheckedSteps, splitAlgorithmIntoSteps } from "./warmupSteps";
import { reviewPairs } from "./researchPolicy";

export async function snapshotRound(roundId:number) {
  const db=await getD1();
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO algorithm_versions(course_id,round_id,submission_id,revision,algorithm_text,origin,created_at)
      SELECT a.course_id,a.round_id,a.submission_id,a.submission_version,a.algorithm_text,'legacy-ai-snapshot',a.created_at FROM jev_auto_runs a JOIN warmup_submissions s ON s.id=a.submission_id WHERE a.round_id=? AND a.submission_version>0 AND s.is_demo=0`).bind(roundId),
    db.prepare(`INSERT OR IGNORE INTO algorithm_versions(course_id,round_id,submission_id,revision,algorithm_text,origin,created_at)
      SELECT j.course_id,j.round_id,i.submission_id,i.submission_version,i.algorithm_text,'legacy-job-snapshot',j.created_at FROM jev_job_items i JOIN jev_jobs j ON j.id=i.job_id JOIN warmup_submissions s ON s.id=i.submission_id WHERE j.round_id=? AND i.submission_version>0 AND s.is_demo=0`).bind(roundId),
  ]);
  await db.prepare(`INSERT OR IGNORE INTO algorithm_versions(course_id,round_id,submission_id,revision,algorithm_text,origin,created_at)
    SELECT r.course_id,s.round_id,s.id,s.revision,s.algorithm_text,'legacy',s.updated_at FROM warmup_submissions s JOIN warmup_rounds r ON r.id=s.round_id WHERE s.round_id=? AND s.is_demo=0`).bind(roundId).run();
}
export async function assignResearchReviews(roundId:number) {
  const db=await getD1();
  if(await db.prepare("SELECT 1 FROM algorithm_round_cohorts WHERE round_id=?").bind(roundId).first())return;
  await snapshotRound(roundId);
  const rows=(await db.prepare(`SELECT v.id,s.student_key FROM algorithm_versions v JOIN warmup_submissions s ON s.id=v.submission_id WHERE v.round_id=? AND v.revision=(SELECT min(revision) FROM algorithm_versions WHERE submission_id=v.submission_id) ORDER BY s.id`).bind(roundId).all<{id:number;student_key:string}>()).results;
  if(rows.length<2)return;
  // Cohort and its two-peer ring are frozen atomically; retries never change assignments.
  const token=crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO algorithm_round_cohorts(round_id,created_at) VALUES(?,?)").bind(roundId,token),
    ...reviewPairs(rows.map(r=>r.id)).map(p=>db.prepare(`INSERT OR IGNORE INTO algorithm_review_assignments(round_id,version_id,reviewer_key) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM algorithm_round_cohorts WHERE round_id=? AND created_at=?)`).bind(roundId,p.versionId,rows[p.reviewerIndex].student_key,roundId,token)),
  ]);
}

const ALLOWED = `(EXISTS(SELECT 1 FROM algorithm_revision_overrides o WHERE o.submission_id=warmup_submissions.id) OR
 (EXISTS(SELECT 1 FROM algorithm_review_assignments a JOIN algorithm_versions v ON v.id=a.version_id WHERE v.submission_id=warmup_submissions.id)
 AND NOT EXISTS(SELECT 1 FROM algorithm_review_assignments a JOIN algorithm_versions v ON v.id=a.version_id WHERE v.submission_id=warmup_submissions.id AND a.status!='completed')))`;
export async function saveResearchSubmission(input:{courseId:number;roundId:number;studentKey:string;studentId:string;studentName:string;algorithmText:string;reason:string}) {
  const db=await getD1();await snapshotRound(input.roundId);
  const old=await db.prepare("SELECT id,algorithm_text FROM warmup_submissions WHERE round_id=? AND student_key=?").bind(input.roundId,input.studentKey).first<{id:number;algorithm_text:string}>();
  if(old && old.algorithm_text!==input.algorithmText && input.reason.trim().length<5)throw new WarmupStateError("어떤 피드백을 참고해 무엇을 수정했는지 5자 이상 적어 주세요.");
  const now=new Date().toISOString();
  const res=await db.batch([
    db.prepare(`INSERT INTO warmup_submissions(round_id,student_key,student_id,student_name,anon_label,algorithm_text,revision,is_demo,created_at,updated_at)
      SELECT ?1,?2,?3,?4,'참가자 '||(SELECT count(*)+1 FROM warmup_submissions WHERE round_id=?1 AND is_demo=0),?5,1,0,?6,?6 FROM warmup_rounds WHERE id=?1 AND course_id=?7 AND status='open'
      ON CONFLICT(round_id,student_key) DO UPDATE SET algorithm_text=excluded.algorithm_text,revision=warmup_submissions.revision+1,updated_at=excluded.updated_at
      WHERE algorithm_text IS NOT excluded.algorithm_text AND ${ALLOWED} AND EXISTS(SELECT 1 FROM warmup_rounds WHERE id=?1 AND course_id=?7 AND status='open')`).bind(input.roundId,input.studentKey,input.studentId,input.studentName,input.algorithmText,now,input.courseId),
    db.prepare(`INSERT OR IGNORE INTO algorithm_versions(course_id,round_id,submission_id,revision,algorithm_text,reason,origin,created_at)
      SELECT ?1,s.round_id,s.id,s.revision,s.algorithm_text,?2,'submitted',s.updated_at FROM warmup_submissions s JOIN warmup_rounds r ON r.id=s.round_id WHERE s.round_id=?3 AND s.student_key=?4 AND s.algorithm_text=?5 AND r.course_id=?1 AND r.status='open'`).bind(input.courseId,input.reason,input.roundId,input.studentKey,input.algorithmText),
    db.prepare(`INSERT OR IGNORE INTO algorithm_ai_feedback(version_id,created_at,updated_at) SELECT v.id,?,? FROM algorithm_versions v JOIN warmup_submissions s ON s.id=v.submission_id WHERE s.round_id=? AND s.student_key=? AND s.algorithm_text=? AND v.revision=s.revision`).bind(now,now,input.roundId,input.studentKey,input.algorithmText),
    db.prepare(`SELECT s.id,s.algorithm_text AS algorithmText,s.created_at AS createdAt,s.updated_at AS updatedAt,s.revision FROM warmup_submissions s JOIN warmup_rounds r ON r.id=s.round_id WHERE s.round_id=? AND s.student_key=? AND s.algorithm_text=? AND r.course_id=? AND r.status='open'`).bind(input.roundId,input.studentKey,input.algorithmText,input.courseId),
  ]);
  const saved=res[3].results[0];if(!saved)throw new WarmupStateError("첫 제출은 고정됩니다. 배정된 동료 평가를 모두 받은 뒤 수정할 수 있습니다.");
  return saved as {id:number;algorithmText:string;createdAt:string;updatedAt:string;revision:number};
}

export async function researchView(courseId:number,roundId:number,studentKey:string) {
  const db=await getD1();await snapshotRound(roundId);
  const round=await db.prepare("SELECT review_opened_at,status FROM warmup_rounds WHERE id=? AND course_id=?").bind(roundId,courseId).first<{review_opened_at:string|null;status:string}>();
  if(!round)throw new WarmupStateError("라운드를 찾을 수 없습니다.");
  if(round.review_opened_at)await assignResearchReviews(roundId);
  const versions=(await db.prepare(`SELECT v.*,f.status AS ai_status,f.result AS ai_result,f.error AS ai_error,f.lease_until AS ai_lease_until,n.agrees,n.note FROM algorithm_versions v JOIN warmup_submissions s ON s.id=v.submission_id LEFT JOIN algorithm_ai_feedback f ON f.version_id=v.id LEFT JOIN algorithm_interpretation_notes n ON n.version_id=v.id AND n.student_key=s.student_key WHERE v.round_id=? AND v.course_id=? AND s.student_key=? ORDER BY v.revision`).bind(roundId,courseId,studentKey).all()).results;
  const incoming=(await db.prepare(`SELECT a.*,v.revision FROM algorithm_review_assignments a JOIN algorithm_versions v ON v.id=a.version_id JOIN warmup_submissions s ON s.id=v.submission_id WHERE a.round_id=? AND v.course_id=? AND s.student_key=? ORDER BY a.id`).bind(roundId,courseId,studentKey).all()).results;
  const outgoing=(await db.prepare(`SELECT a.id,a.version_id,a.status,s.id AS submission_id,s.anon_label,v.algorithm_text,v.revision FROM algorithm_review_assignments a JOIN algorithm_versions v ON v.id=a.version_id JOIN warmup_submissions s ON s.id=v.submission_id WHERE a.round_id=? AND v.course_id=? AND a.reviewer_key=? ORDER BY a.id`).bind(roundId,courseId,studentKey).all()).results;
  const override=versions.length?await db.prepare("SELECT reason FROM algorithm_revision_overrides WHERE submission_id=?").bind(versions[0].submission_id).first():null;
  return {roundStatus:round.status,versions,incoming:incoming.map(({reviewer_key:_key,...r})=>r),outgoing,canRevise:round.status==='open'&&(!!override||incoming.length>0&&incoming.every(r=>r.status==='completed')),overrideReason:override?.reason??null};
}

export async function completeResearchReview(courseId:number,submissionId:number,reviewerKey:string,feedback:string,executable:boolean,checked:unknown) {
  const db=await getD1();
  const assigned=await db.prepare(`SELECT a.id,v.algorithm_text FROM algorithm_review_assignments a JOIN algorithm_versions v ON v.id=a.version_id JOIN warmup_rounds r ON r.id=v.round_id WHERE a.reviewer_key=? AND v.submission_id=? AND v.course_id=? AND a.status='pending' AND r.status='open' AND r.review_opened_at IS NOT NULL`).bind(reviewerKey,submissionId,courseId).first<{id:number;algorithm_text:string}>();
  if(!assigned)throw new WarmupStateError("배정된 평가를 이미 제출했거나 현재 평가할 수 없습니다.");
  const checkedSteps=sanitizeCheckedSteps(checked,splitAlgorithmIntoSteps(assigned.algorithm_text).length);
  const result=await db.prepare(`UPDATE algorithm_review_assignments SET status='completed',feedback=?,executable=?,checked_steps=?,completed_at=? WHERE reviewer_key=? AND version_id IN(SELECT v.id FROM algorithm_versions v JOIN warmup_rounds r ON r.id=v.round_id WHERE v.submission_id=? AND r.course_id=? AND r.status='open' AND r.review_opened_at IS NOT NULL) AND status='pending' RETURNING id`).bind(feedback,executable?1:0,JSON.stringify(checkedSteps),new Date().toISOString(),reviewerKey,submissionId,courseId).first();
  if(!result)throw new WarmupStateError("배정된 평가를 이미 제출했거나 현재 평가할 수 없습니다.");
}

export async function researchProgress(courseId:number) {
  const db=await getD1();
  const rows=(await db.prepare(`SELECT a.round_id,a.reviewer_key,count(*) AS required,sum(a.status='completed') AS completed FROM algorithm_review_assignments a JOIN algorithm_versions v ON v.id=a.version_id WHERE v.course_id=? GROUP BY a.round_id,a.reviewer_key`).bind(courseId).all<{round_id:number;reviewer_key:string;required:number;completed:number}>()).results;
  return rows;
}
