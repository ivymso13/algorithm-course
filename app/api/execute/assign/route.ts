import { assignExecuteAttempt, sanitizeAttempt } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { studentKey?: string };
  const studentKey = body.studentKey?.trim() ?? "";
  if (!studentKey) {
    return Response.json({ error: "studentKey is required" }, { status: 400 });
  }

  const result = await assignExecuteAttempt(studentKey);
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
