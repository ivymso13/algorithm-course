import { getD1 } from "@/db";
import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { resolveWarmupSandboxProblemType } from "@/lib/warmupProblems";

/** Keep initial session/activity loading independent of the full research history. */
export async function GET(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();
  const db=await getD1();
  const row=await db.prepare(`
    SELECT r.id,r.title,r.prompt,r.status,r.problem_id,r.review_opened_at,
      s.id AS submission_id,s.algorithm_text,s.created_at,s.updated_at,
      (EXISTS(SELECT 1 FROM algorithm_revision_overrides o WHERE o.submission_id=s.id)
       OR (EXISTS(SELECT 1 FROM algorithm_review_assignments a JOIN algorithm_versions v ON v.id=a.version_id WHERE v.submission_id=s.id)
       AND NOT EXISTS(SELECT 1 FROM algorithm_review_assignments a JOIN algorithm_versions v ON v.id=a.version_id WHERE v.submission_id=s.id AND a.status!='completed'))) AS can_revise
    FROM warmup_rounds r
    LEFT JOIN warmup_submissions s ON s.round_id=r.id AND s.student_key=?
    WHERE r.course_id=? AND r.status='open' ORDER BY r.id DESC LIMIT 1
  `).bind(session.studentKey,session.courseId).first<{
    id:number;title:string;prompt:string;status:string;problem_id:string|null;review_opened_at:string|null;
    submission_id:number|null;algorithm_text:string|null;created_at:string|null;updated_at:string|null;can_revise:number;
  }>();
  if(!row)return Response.json({studentKey:session.studentKey,round:null,mySubmission:null},{headers:{"Cache-Control":"no-store"}});
  return Response.json({
    studentKey:session.studentKey,
    round:{id:row.id,title:row.title,prompt:row.prompt,status:row.status,reviewOpenedAt:row.review_opened_at,
      problemType:resolveWarmupSandboxProblemType({problemId:row.problem_id,title:row.title,prompt:row.prompt}),
      canRevise:!!row.can_revise},
    mySubmission:row.submission_id?{id:row.submission_id,algorithmText:row.algorithm_text,createdAt:row.created_at,updatedAt:row.updated_at}:null,
  },{headers:{"Cache-Control":"no-store"}});
}
