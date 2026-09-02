const TEACHER_HEADER = "x-teacher-password";

/**
 * No default password. `TEACHER_PASSWORD` must be set as a real runtime env
 * var (see .env.example) — if it's missing or blank, every teacher request
 * fails closed (401) instead of silently accepting a well-known default.
 */
function expectedPassword(): string | null {
  const value = process.env.TEACHER_PASSWORD?.trim();
  return value ? value : null;
}

export function isTeacherConfigured(): boolean {
  return expectedPassword() !== null;
}

export function isTeacherPasswordValid(password: string | null | undefined): boolean {
  const expected = expectedPassword();
  if (!expected || !password) return false;
  return timingSafeEqual(password, expected);
}

/** Reads and checks the teacher password from the request header. */
export function isAuthorizedRequest(request: Request): boolean {
  return isTeacherPasswordValid(request.headers.get(TEACHER_HEADER));
}

export function unauthorizedResponse(): Response {
  if (!isTeacherConfigured()) {
    return Response.json(
      { error: "서버에 TEACHER_PASSWORD 환경변수가 설정되지 않았습니다. 관리자에게 문의하세요." },
      { status: 503 }
    );
  }
  return Response.json({ error: "교사 비밀번호가 올바르지 않습니다" }, { status: 401 });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export { TEACHER_HEADER };
