import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { assignExecuteAttempt, sanitizeAttempt } from "@/lib/store";

export async function POST(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();

  const result = await assignExecuteAttempt(session.studentKey, session.courseId);
  switch (result.kind) {
    case "waiting":
      return Response.json({ status: "waiting" });
    case "finished":
      return Response.json({ status: "finished" });
    case "noneAvailable":
      return Response.json({ status: "noneAvailable" });
    case "resumed":
    case "created":
      return Response.json({
        status: "ready",
        resumed: result.kind === "resumed",
        attempt: sanitizeAttempt(result.attempt, result.submission.algorithmText),
      });
    default:
      return Response.json({ error: "unexpected state" }, { status: 500 });
  }
}
