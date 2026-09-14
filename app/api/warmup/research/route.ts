import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { getAssignment } from "@/lib/roster";
import { getResearchCycle, recordAuthorReflection, recordVersionExecution, WarmupOwnershipError } from "@/lib/warmupStore";

const RESULTS = ["success", "partial", "impossible", "wrong"];

export async function GET(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();
  const submissionId = Number(new URL(request.url).searchParams.get("submissionId"));
  if (!Number.isInteger(submissionId)) return Response.json({ error: "submissionId가 필요합니다" }, { status: 400 });
  try { return Response.json(await getResearchCycle(submissionId, session.studentKey, session.courseId)); }
  catch { return Response.json({ error: "기록을 찾을 수 없습니다" }, { status: 404 }); }
}

export async function POST(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    if (body.action === "execute") {
      if (!RESULTS.includes(String(body.result)) || String(body.executionNote ?? "").trim().length < 2) return Response.json({ error: "실행 결과와 기록을 입력하세요" }, { status: 400 });
      const assignment = await getAssignment(session.courseId, session.studentKey);
      if (!assignment) return Response.json({ error: "학생 정보를 찾을 수 없습니다" }, { status: 404 });
      return Response.json({ execution: await recordVersionExecution({ versionId: Number(body.versionId), executorStudentKey: session.studentKey, executorId: assignment.studentId, executorName: assignment.name, courseId: session.courseId, result: String(body.result), problemLocation: String(body.problemLocation ?? ""), executionNote: String(body.executionNote) }) });
    }
    if (body.action === "reflect") {
      if (!String(body.cause ?? "").trim() || !String(body.plannedRevision ?? "").trim()) return Response.json({ error: "생각해보기 항목을 모두 입력하세요" }, { status: 400 });
      return Response.json({ reflection: await recordAuthorReflection({ executionId: Number(body.executionId), studentKey: session.studentKey, courseId: session.courseId, expectedMatch: String(body.expectedMatch ?? ""), problemLocation: String(body.problemLocation ?? ""), cause: String(body.cause), plannedRevision: String(body.plannedRevision) }) });
    }
    return Response.json({ error: "지원하지 않는 작업입니다" }, { status: 400 });
  } catch (error) {
    if (error instanceof WarmupOwnershipError) return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "저장하지 못했습니다" }, { status: 400 });
  }
}
