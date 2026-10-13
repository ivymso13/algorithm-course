import { getD1 } from "@/db";
import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { getOrCreateDefaultCourse } from "@/lib/store";
export async function GET(request:Request){
  if(!isAuthorizedRequest(request))return unauthorizedResponse();
  const course=await getOrCreateDefaultCourse(),db=await getD1(),roundId=Number(new URL(request.url).searchParams.get('roundId'));
  if(!Number.isSafeInteger(roundId))return Response.json({error:'라운드 번호가 필요합니다.'},{status:400});
  const rows=(await db.prepare(`SELECT s.id,s.student_id,s.student_name,s.revision,(SELECT count(*) FROM algorithm_review_assignments a JOIN algorithm_versions v ON v.id=a.version_id WHERE v.submission_id=s.id) AS required,(SELECT count(*) FROM algorithm_review_assignments a JOIN algorithm_versions v ON v.id=a.version_id WHERE v.submission_id=s.id AND a.status='completed') AS completed,o.reason AS override_reason FROM warmup_submissions s JOIN warmup_rounds r ON r.id=s.round_id LEFT JOIN algorithm_revision_overrides o ON o.submission_id=s.id WHERE r.course_id=? AND r.id=? AND s.is_demo=0 ORDER BY s.id`).bind(course.id,roundId).all()).results;
  return Response.json({rows});
}
