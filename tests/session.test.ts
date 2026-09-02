import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExpiredSessionCookie,
  buildSessionCookie,
  expiresAtFromNow,
  generateSessionToken,
  hashSessionToken,
  isExpired,
  readSessionTokenFromRequest,
  SESSION_COOKIE_NAME,
  sessionTtlSeconds,
} from "../lib/session.ts";

test("generateSessionToken: produces high-entropy, distinct 64-char hex tokens", () => {
  const a = generateSessionToken();
  const b = generateSessionToken();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.match(b, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});

test("hashSessionToken: deterministic SHA-256 hex digest, differs per input", async () => {
  const token = generateSessionToken();
  const h1 = await hashSessionToken(token);
  const h2 = await hashSessionToken(token);
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.notEqual(h1, token, "the hash must never equal the raw token");

  const otherHash = await hashSessionToken(generateSessionToken());
  assert.notEqual(h1, otherHash);
});

test("buildSessionCookie: sets HttpOnly, Secure, SameSite=Lax, Path=/", () => {
  const cookie = buildSessionCookie("abc123", 3600);
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE_NAME}=abc123;`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=3600/);
});

test("buildExpiredSessionCookie: clears the cookie (Max-Age=0, empty value) but keeps the security flags", () => {
  const cookie = buildExpiredSessionCookie();
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE_NAME}=;`));
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
});

test("readSessionTokenFromRequest: extracts the token from a Cookie header among others", () => {
  const req = new Request("https://example.com", {
    headers: { cookie: `foo=bar; ${SESSION_COOKIE_NAME}=deadbeef; other=1` },
  });
  assert.equal(readSessionTokenFromRequest(req), "deadbeef");
});

test("readSessionTokenFromRequest: returns null when the cookie is absent", () => {
  assert.equal(readSessionTokenFromRequest(new Request("https://example.com")), null);
  const noMatch = new Request("https://example.com", { headers: { cookie: "foo=bar" } });
  assert.equal(readSessionTokenFromRequest(noMatch), null);
});

test("sessionTtlSeconds: defaults sanely and rejects garbage env values", () => {
  const original = process.env.SESSION_TTL_SECONDS;
  try {
    delete process.env.SESSION_TTL_SECONDS;
    assert.equal(sessionTtlSeconds(), 60 * 60 * 8);

    process.env.SESSION_TTL_SECONDS = "not-a-number";
    assert.equal(sessionTtlSeconds(), 60 * 60 * 8);

    process.env.SESSION_TTL_SECONDS = "-5";
    assert.equal(sessionTtlSeconds(), 60 * 60 * 8);

    process.env.SESSION_TTL_SECONDS = "600";
    assert.equal(sessionTtlSeconds(), 600);
  } finally {
    if (original === undefined) delete process.env.SESSION_TTL_SECONDS;
    else process.env.SESSION_TTL_SECONDS = original;
  }
});

test("expiresAtFromNow / isExpired: round-trip and correctly flag the past", () => {
  const future = expiresAtFromNow(3600);
  assert.equal(isExpired(future), false);

  const past = new Date(Date.now() - 1000).toISOString();
  assert.equal(isExpired(past), true);

  assert.equal(isExpired("not-a-date"), true, "an unparsable timestamp must be treated as expired");
});
