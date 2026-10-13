import { getD1 } from "@/db";
import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { getOrCreateDefaultCourse } from "@/lib/store";
export async function POST(request:Request) {
  if(!isAuthorizedRequest(request))return unauthorizedResponse();
  const body=await request.json() as {submissionId?:number;reason?:string};
  if(!Number.isSafeInteger(body.submissionId)||typeof body.reason!=="string"||body.reason.trim().length<5||body.reason.length>2000)return Response.json({error:"제출 번호와 예외 개방 사유를 5자 이상 적어 주세요."},{status:400});
  const db=await getD1(),course=await getOrCreateDefaultCourse();
  const row=await db.prepare(`INSERT INTO algorithm_revision_overrides(submission_id,reason,created_at) SELECT s.id,?,? FROM warmup_submissions s JOIN warmup_rounds r ON r.id=s.round_id WHERE s.id=? AND r.course_id=? AND r.status='open' ON CONFLICT(submission_id) DO UPDATE SET reason=excluded.reason,created_at=excluded.created_at RETURNING submission_id`).bind(body.reason,new Date().toISOString(),body.submissionId,course.id).first();
  return row?Response.json({ok:true}):Response.json({error:"진행 중인 제출을 찾을 수 없습니다."},{status:404});
}
