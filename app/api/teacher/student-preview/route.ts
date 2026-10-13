import {isAuthorizedRequest,unauthorizedResponse} from "@/lib/teacherAuth";
import {createStudentPreview} from "@/lib/studentPreview";
import {buildSessionCookie} from "@/lib/session";
import {jsonWithCookie} from "@/lib/http";
export async function POST(request:Request){
  if(!isAuthorizedRequest(request))return unauthorizedResponse();
  const {token}=await createStudentPreview();
  return jsonWithCookie({ok:true,url:"/write"},buildSessionCookie(token));
}
