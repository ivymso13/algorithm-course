import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { readJevBody } from "@/lib/jevRequest";
import { runResearchAI } from "@/lib/researchAI";
export async function POST(request:Request){const session=await requireStudentSession(request);if(!session)return SESSION_ERROR_RESPONSE();const body=await readJevBody(request);if(!Number.isSafeInteger(body.versionId))return Response.json({error:"올바른 제출 버전이 필요합니다."},{status:400});return await runResearchAI(session.courseId,session.studentKey,body.versionId as number)?Response.json({ok:true}):Response.json({error:"대상 제출을 찾을 수 없습니다."},{status:404});}
