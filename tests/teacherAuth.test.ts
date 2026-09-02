import assert from "node:assert/strict";
import test from "node:test";
import {
  isAuthorizedRequest,
  isTeacherConfigured,
  isTeacherPasswordValid,
  TEACHER_HEADER,
  unauthorizedResponse,
} from "../lib/teacherAuth.ts";

function withTeacherPassword<T>(value: string | undefined, fn: () => T): T {
  const original = process.env.TEACHER_PASSWORD;
  try {
    if (value === undefined) delete process.env.TEACHER_PASSWORD;
    else process.env.TEACHER_PASSWORD = value;
    return fn();
  } finally {
    if (original === undefined) delete process.env.TEACHER_PASSWORD;
    else process.env.TEACHER_PASSWORD = original;
  }
}

test("teacherAuth: fails closed (never authorizes) when TEACHER_PASSWORD is unset — no built-in default", () => {
  withTeacherPassword(undefined, () => {
    assert.equal(isTeacherConfigured(), false);
    assert.equal(isTeacherPasswordValid("teacher123"), false);
    assert.equal(isTeacherPasswordValid(""), false);
    assert.equal(isTeacherPasswordValid(null), false);
  });
});

test("teacherAuth: fails closed when TEACHER_PASSWORD is set but blank", () => {
  withTeacherPassword("   ", () => {
    assert.equal(isTeacherConfigured(), false);
    assert.equal(isTeacherPasswordValid("anything"), false);
  });
});

test("teacherAuth: the historical default 'teacher123' is never accepted once a real password is configured", () => {
  withTeacherPassword("s3cr3t", () => {
    assert.equal(isTeacherPasswordValid("teacher123"), false);
    assert.equal(isTeacherPasswordValid("s3cr3t"), true);
    assert.equal(isTeacherPasswordValid("wrong"), false);
  });
});

test("isAuthorizedRequest: reads the x-teacher-password header", () => {
  withTeacherPassword("s3cr3t", () => {
    const ok = new Request("https://example.com", { headers: { [TEACHER_HEADER]: "s3cr3t" } });
    const bad = new Request("https://example.com", { headers: { [TEACHER_HEADER]: "nope" } });
    const missing = new Request("https://example.com");
    assert.equal(isAuthorizedRequest(ok), true);
    assert.equal(isAuthorizedRequest(bad), false);
    assert.equal(isAuthorizedRequest(missing), false);
  });
});

test("unauthorizedResponse: reports 503 (misconfigured) when unset, 401 (wrong password) otherwise", async () => {
  await withTeacherPassword(undefined, async () => {
    const res = unauthorizedResponse();
    assert.equal(res.status, 503);
  });
  await withTeacherPassword("s3cr3t", async () => {
    const res = unauthorizedResponse();
    assert.equal(res.status, 401);
  });
});
