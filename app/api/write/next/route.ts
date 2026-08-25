import { writePhaseSnapshot } from "@/lib/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const studentKey = url.searchParams.get("studentKey")?.trim() ?? "";
  if (!studentKey) {
    return Response.json({ error: "studentKey is required" }, { status: 400 });
  }

  const snapshot = await writePhaseSnapshot(studentKey);
  if (!snapshot) {
    return Response.json({ error: "알 수 없는 학생입니다" }, { status: 404 });
  }
  return Response.json(snapshot);
}
