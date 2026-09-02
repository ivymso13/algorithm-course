import { getSessionByToken, type ActiveSession } from "@/lib/store";
import { readSessionTokenFromRequest } from "@/lib/session";

export const SESSION_ERROR_RESPONSE = () =>
  Response.json({ error: "로그인이 필요합니다. 학번+이름으로 다시 시작하세요." }, { status: 401 });

/**
 * Resolves the caller's identity from the session cookie only — every
 * write/execute endpoint must call this instead of trusting a client-
 * supplied studentKey, or a student could act as anyone just by sending a
 * different string in the request body (IDOR).
 */
export async function requireStudentSession(request: Request): Promise<ActiveSession | null> {
  const token = readSessionTokenFromRequest(request);
  if (!token) return null;
  return getSessionByToken(token);
}
