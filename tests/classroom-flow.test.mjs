import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { Miniflare } from "miniflare";

const serverRoot = path.resolve("dist/server");
const teacherPassword = "classroom-flow-test";

async function collectJavaScriptModules(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectJavaScriptModules(fullPath)));
    else if (entry.name.endsWith(".js")) files.push(fullPath);
  }
  return files;
}

async function createTestApp() {
  const files = await collectJavaScriptModules(serverRoot);
  const mainPath = path.join(serverRoot, "index.js");
  const modules = [mainPath, ...files.filter((file) => file !== mainPath)].map((file) => ({
    type: "ESModule",
    path: file,
  }));

  return new Miniflare({
    modules,
    modulesRoot: serverRoot,
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"],
    bindings: {
      TEACHER_PASSWORD: teacherPassword,
      COURSE_CODE: "FLOW2026",
      SESSION_TTL_SECONDS: "28800",
    },
  });
}

async function requestJson(app, pathname, { method = "GET", body, cookie, teacher = false } = {}) {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  if (teacher) headers.set("x-teacher-password", teacherPassword);
  const response = await app.dispatchFetch(`http://localhost${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { response, data };
}

async function expectStatus(app, pathname, options, expectedStatus) {
  const result = await requestJson(app, pathname, options);
  assert.equal(result.response.status, expectedStatus, `${pathname}: ${JSON.stringify(result.data)}`);
  return result;
}

test("교사 라운드 생성부터 학생 평가·결과 확인·종료까지 수업 흐름이 이어진다", async () => {
  const app = await createTestApp();
  try {
    await expectStatus(app, "/api/teacher/warmup/rounds", {}, 401);

    const created = await expectStatus(
      app,
      "/api/teacher/warmup/rounds",
      { method: "POST", teacher: true, body: { problemId: "hidden-card" } },
      200
    );
    const roundId = created.data.round.id;
    assert.equal(created.data.round.status, "draft");

    const published = await expectStatus(
      app,
      "/api/teacher/warmup/publish",
      { method: "POST", teacher: true, body: { roundId } },
      200
    );
    assert.equal(published.data.round.status, "open");

    const students = [
      { school: "경기스마트고", studentId: "10118" },
      { school: "서해고", studentId: "10401" },
      { school: "서해고", studentId: "10403" },
      { school: "서해고", studentId: "10432" },
    ];

    for (const [index, student] of students.entries()) {
      const login = await expectStatus(
        app,
        "/api/student/login",
        { method: "POST", body: { ...student, consent: true } },
        200
      );
      const setCookie = login.response.headers.get("set-cookie");
      assert.ok(setCookie, "학생 로그인에서 세션 쿠키가 발급되어야 합니다");
      student.cookie = setCookie.split(";", 1)[0];

      const submission = await expectStatus(
        app,
        "/api/warmup/submit",
        {
          method: "POST",
          cookie: student.cookie,
          body: {
            algorithmText: `1. 가운데 카드를 확인한다\n2. 목표값과 비교해 ${index + 1}번째 범위를 선택한다\n3. 찾을 때까지 반복한다`,
          },
        },
        200
      );
      student.submissionId = submission.data.mySubmission.id;
    }

    await expectStatus(app, "/api/warmup/board", { cookie: students[0].cookie }, 403);

    const reviewOpened = await expectStatus(
      app,
      "/api/teacher/warmup/review-open",
      { method: "POST", teacher: true, body: { roundId } },
      200
    );
    assert.ok(reviewOpened.data.round.reviewOpenedAt);

    for (const student of students) {
      const board = await expectStatus(app, "/api/warmup/board", { cookie: student.cookie }, 200);
      assert.equal(board.data.entries.length, 2);
      assert.ok(board.data.entries.every((entry) => entry.id !== student.submissionId));

      for (const entry of board.data.entries) {
        const vote = await expectStatus(
          app,
          "/api/warmup/vote",
          {
            method: "POST",
            cookie: student.cookie,
            body: { submissionId: entry.id, voteType: "clear" },
          },
          200
        );
        assert.equal(vote.data.voted, true);
      }

      for (const target of board.data.entries) {
      const experience = await expectStatus(
        app,
        "/api/warmup/experience",
        {
          method: "POST",
          cookie: student.cookie,
          body: {
            submissionId: target.id,
            checkedSteps: [1, 2, 3],
            executable: true,
            feedback: "단계가 구체적이어서 순서대로 실행할 수 있었습니다.",
          },
        },
        200
      );
      assert.equal(experience.data.experience.executable, true);
      }
    }

    const rounds = await expectStatus(app, "/api/teacher/warmup/rounds", { teacher: true }, 200);
    const summary = rounds.data.rounds.find((round) => round.id === roundId);
    assert.deepEqual(
      {
        submissionCount: summary.submissionCount,
        voteCount: summary.voteCount,
        experienceCount: summary.experienceCount,
        evaluatedCount: summary.evaluatedCount,
      },
      { submissionCount: 4, voteCount: 8, experienceCount: 8, evaluatedCount: 4 }
    );

    const detail = await expectStatus(
      app,
      `/api/teacher/warmup/round?id=${roundId}`,
      { teacher: true },
      200
    );
    assert.equal(detail.data.items.length, 4);
    assert.equal(detail.data.items.flatMap((item) => item.experiences).length, 8);
    for (const item of detail.data.items) {
      assert.equal(Object.values(item.voteCounts).reduce((sum, count) => sum + count, 0), 2);
    }

    const closed = await expectStatus(
      app,
      "/api/teacher/warmup/close",
      { method: "POST", teacher: true, body: { roundId } },
      200
    );
    assert.equal(closed.data.round.status, "closed");

    const afterClose = await expectStatus(app, "/api/warmup/round", { cookie: students[0].cookie }, 200);
    assert.equal(afterClose.data.round, null);

    const finalDetail = await expectStatus(
      app,
      `/api/teacher/warmup/round?id=${roundId}`,
      { teacher: true },
      200
    );
    assert.equal(finalDetail.data.round.status, "closed");
    assert.equal(finalDetail.data.items.length, 4);
  } finally {
    await app.dispose();
  }
});
