const TEACHER_HEADER = "x-teacher-password";
const DEFAULT_PASSWORD = "teacher123";

function expectedPassword(): string {
  return process.env.TEACHER_PASSWORD?.trim() || DEFAULT_PASSWORD;
}

export function isTeacherPasswordValid(password: string | null | undefined): boolean {
  return Boolean(password) && password === expectedPassword();
}

/** Reads and checks the teacher password from the request header. */
export function isAuthorizedRequest(request: Request): boolean {
  return isTeacherPasswordValid(request.headers.get(TEACHER_HEADER));
}

export function unauthorizedResponse(): Response {
  return Response.json({ error: "교사 비밀번호가 올바르지 않습니다" }, { status: 401 });
}

export { TEACHER_HEADER };
