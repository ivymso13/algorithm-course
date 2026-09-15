import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { getOrCreateDefaultCourse } from "@/lib/store";
import { reassignPendingPeerAssignments, WarmupNotFoundError, WarmupStateError } from "@/lib/warmupStore";

export async function POST(request:Request){
  if(!isAuthorizedRequest(request))return unauthorizedResponse();
  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  const course=await getOrCreateDefaultCourse();
  try{
    const result=await reassignPendingPeerAssignments({roundId:Number(body.roundId),courseId:course.id,fromEvaluatorStudentKey:String(body.fromEvaluatorStudentKey??""),toEvaluatorStudentKey:String(body.toEvaluatorStudentKey??"")});
    return Response.json(result);
  }catch(error){
    if(error instanceof WarmupNotFoundError)return Response.json({error:error.message},{status:404});
    if(error instanceof WarmupStateError)return Response.json({error:error.message},{status:400});
    throw error;
  }
}
