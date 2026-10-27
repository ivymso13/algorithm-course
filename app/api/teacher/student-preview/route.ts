import {isAuthorizedRequest,unauthorizedResponse} from "@/lib/teacherAuth";
import {createStudentPreview,STUDENT_PREVIEW_PROBLEM_IDS,type StudentPreviewProblemId} from "@/lib/studentPreview";
import {buildSessionCookie} from "@/lib/session";
import {jsonWithCookie} from "@/lib/http";
export async function POST(request:Request){
  if(!isAuthorizedRequest(request))return unauthorizedResponse();
  const body=await request.json().catch(()=>({})) as {problemId?:string};
  if(body.problemId && !STUDENT_PREVIEW_PROBLEM_IDS.includes(body.problemId as StudentPreviewProblemId))return Response.json({error:"체험할 문제를 선택하세요."},{status:400});
  const {token}=await createStudentPreview(body.problemId as StudentPreviewProblemId|undefined);
  return jsonWithCookie({ok:true,url:"/write"},buildSessionCookie(token));
}
