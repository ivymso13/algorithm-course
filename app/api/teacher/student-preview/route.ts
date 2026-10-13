import {isAuthorizedRequest,unauthorizedResponse} from "@/lib/teacherAuth";
import {createStudentPreview} from "@/lib/studentPreview";
import {buildSessionCookie} from "@/lib/session";
import {jsonWithCookie} from "@/lib/http";
export async function POST(request:Request){
  if(!isAuthorizedRequest(request))return unauthorizedResponse();
  const body=await request.json().catch(()=>({})) as {problemId?:string};
  if(body.problemId && !["even-count","card-flip"].includes(body.problemId))return Response.json({error:"체험할 문제를 선택하세요."},{status:400});
  const {token}=await createStudentPreview(body.problemId as "even-count"|"card-flip"|undefined);
  return jsonWithCookie({ok:true,url:"/write"},buildSessionCookie(token));
}
