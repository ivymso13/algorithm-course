import { getD1 } from "@/db";
import {requireStudentSession,SESSION_ERROR_RESPONSE} from "@/lib/requireStudentSession";
export async function GET(request:Request){const session=await requireStudentSession(request);if(!session)return SESSION_ERROR_RESPONSE();const db=await getD1();const rows=(await db.prepare(`SELECT r.id,r.title,r.status,s.revision,s.updated_at FROM warmup_submissions s JOIN warmup_rounds r ON r.id=s.round_id WHERE r.course_id=? AND s.student_key=? AND s.is_demo=0 ORDER BY r.id DESC`).bind(session.courseId,session.studentKey).all()).results;return Response.json({rows});}
