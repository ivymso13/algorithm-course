import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { getOpenWarmupRound,getWarmupRound } from "@/lib/warmupStore";
import { researchView } from "@/lib/researchStore";
import { getD1 } from "@/db";
export async function GET(request:Request) {
  const session=await requireStudentSession(request);if(!session)return SESSION_ERROR_RESPONSE();
  const selected=new URL(request.url).searchParams.get('roundId');
  if(selected!==null&&(!Number.isSafeInteger(Number(selected))||Number(selected)<=0))return Response.json({error:'올바른 라운드 번호가 필요합니다.'},{status:400});
  const round=selected?await getWarmupRound(Number(selected)):await getOpenWarmupRound(session.courseId);
  if(round&&round.courseId!==session.courseId)return Response.json({error:'활동을 찾을 수 없습니다.'},{status:404});
  if(!round)return Response.json({versions:[],incoming:[],outgoing:[],canRevise:false});
  return Response.json(await researchView(session.courseId,round.id,session.studentKey),{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request) {
  const session=await requireStudentSession(request);if(!session)return SESSION_ERROR_RESPONSE();
  const body=await request.json() as {versionId?:number;agrees?:boolean;note?:string};
  if(!Number.isSafeInteger(body.versionId)||typeof body.agrees!=="boolean"||typeof body.note!=="string"||body.note.length>2000||(!body.agrees&&body.note.trim().length<5))return Response.json({error:"해석에 대한 의견과, 불일치할 때는 이유를 5자 이상 적어 주세요."},{status:400});
  const db=await getD1();
  const result=await db.prepare(`INSERT INTO algorithm_interpretation_notes(version_id,student_key,agrees,note,created_at) SELECT v.id,s.student_key,?,?,? FROM algorithm_versions v JOIN warmup_submissions s ON s.id=v.submission_id JOIN warmup_rounds r ON r.id=v.round_id WHERE v.id=? AND v.course_id=? AND s.student_key=? AND r.status='open' ON CONFLICT(version_id,student_key) DO UPDATE SET agrees=excluded.agrees,note=excluded.note,created_at=excluded.created_at RETURNING id`).bind(body.agrees?1:0,body.note,new Date().toISOString(),body.versionId,session.courseId,session.studentKey).first();
  return result?Response.json({ok:true}):Response.json({error:"대상 제출을 찾을 수 없습니다."},{status:404});
}
