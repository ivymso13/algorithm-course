import { jsonWithCookie } from "@/lib/http";
import { buildExpiredSessionCookie, readSessionTokenFromRequest } from "@/lib/session";
import { deleteSessionByToken } from "@/lib/store";

export async function POST(request: Request) {
  const token = readSessionTokenFromRequest(request);
  if (token) await deleteSessionByToken(token);
  return jsonWithCookie({ ok: true }, buildExpiredSessionCookie());
}
