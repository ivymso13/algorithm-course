/**
 * Pure session token + cookie helpers. Deliberately has no `db/index.ts` (and
 * therefore no `cloudflare:workers`) import so it can be unit tested under
 * plain Node — the DB-backed session CRUD lives in lib/store.ts instead.
 *
 * Security model: the cookie carries an opaque, high-entropy random token.
 * Only its SHA-256 hash is ever persisted (see db/schema.ts `sessions`), so
 * a leaked DB row/backup can't be replayed as a live session, and the token
 * itself never appears in logs or query strings.
 */

export const SESSION_COOKIE_NAME = "algo_session";

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours — a class period plus slack

export function sessionTtlSeconds(): number {
  const raw = process.env.SESSION_TTL_SECONDS?.trim();
  if (!raw) return DEFAULT_SESSION_TTL_SECONDS;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return DEFAULT_SESSION_TTL_SECONDS;
  return n;
}

/** 256 bits of randomness, hex-encoded (64 chars) — the raw cookie value. */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/** SHA-256 hex digest of the raw token — the only form ever stored in D1. */
export async function hashSessionToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Builds the Set-Cookie header value for a freshly issued session. */
export function buildSessionCookie(token: string, maxAgeSeconds = sessionTtlSeconds()): string {
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ].join("; ");
}

/** Builds the Set-Cookie header value that clears the session cookie. */
export function buildExpiredSessionCookie(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
}

/** Reads the raw session token out of an incoming `Cookie` header, if present. */
export function readSessionTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    const value = part.slice(eq + 1).trim();
    return value || null;
  }
  return null;
}

export function expiresAtFromNow(ttlSeconds = sessionTtlSeconds()): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

export function isExpired(expiresAtIso: string, now = new Date()): boolean {
  const expiresAt = Date.parse(expiresAtIso);
  if (Number.isNaN(expiresAt)) return true;
  return expiresAt <= now.getTime();
}
