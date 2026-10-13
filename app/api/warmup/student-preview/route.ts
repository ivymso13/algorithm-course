import {requireStudentSession,SESSION_ERROR_RESPONSE} from "@/lib/requireStudentSession";
import {isStudentPreview,receivePreviewFeedback} from "@/lib/studentPreview";
export async function GET(request:Request){const session=await requireStudentSession(request);return Response.json({preview:session?await isStudentPreview(session.courseId):false});}
export async function POST(request:Request){
  const session=await requireStudentSession(request);if(!session)return SESSION_ERROR_RESPONSE();
  if(!await isStudentPreview(session.courseId))return Response.json({error:"학생 체험에서만 사용할 수 있습니다."},{status:403});
  try{await receivePreviewFeedback(session.courseId,session.studentKey);return Response.json({ok:true});}
  catch(e){return Response.json({error:e instanceof Error?e.message:"피드백을 준비하지 못했습니다."},{status:400});}
}
