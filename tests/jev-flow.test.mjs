// End-to-end Jev job flow against the built worker (dist/server), in
// Miniflare. Every outbound request is answered by a local fake of the
// TypeSafe System One endpoint — no real network, no API cost, no real key.
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { Miniflare, Response as MfResponse } from "miniflare";

const serverRoot = path.resolve("dist/server");
const teacherPassword = "jev-flow-test";
const FAKE_KEY = "fake-typesafe-key-for-tests";
const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JOBS = "/api/teacher/warmup/jev-batch-run";

const CORRECT_ALGORITHM = [
  "1. 상자를 확인한다.",
  "2. 메모지에 기록한다.",
  "3. 오른쪽으로 이동한다.",
  "4. 상자를 확인한다.",
  "5. 방금 확인한 상자가 메모지보다 크면 메모지에 기록한다.",
  "6. 확인하지 않은 상자가 있으면 3단계부터 반복한다.",
  "7. 메모지에 적힌 사과 개수를 정답으로 제출한다.",
].join("\n");

// Loop never compares: the memo keeps the first box, so it is (almost always) wrong.
const NO_COMPARE_ALGORITHM = [
  "1. 상자를 확인한다.",
  "2. 메모지에 기록한다.",
  "3. 오른쪽으로 이동한다.",
  "4. 상자를 확인한다.",
  "5. 확인하지 않은 상자가 있으면 3단계부터 반복한다.",
  "6. 메모지에 적힌 사과 개수를 정답으로 제출한다.",
].join("\n");

const STUDENTS = [
  { school: "서해고", studentId: "10401" },
  { school: "서해고", studentId: "10403" },
  { school: "서해고", studentId: "10432" },
];

// ---------- fake Jev upstream ----------

/** Picks the schema action a clear student sentence names, like the real `choice` question would. */
function chooseAction(stepText) {
  if (stepText.includes("크면")) return "UPDATE_MEMO_IF_GREATER";
  if (stepText.includes("반복")) return "REPEAT_STUDENT_STEPS";
  if (stepText.includes("제출")) return "SUBMIT_ANSWER";
  if (stepText.includes("오른쪽으로 이동")) return "MOVE_RIGHT_BOX";
  if (stepText.includes("상자를 확인")) return "CHECK_SELECTED_BOX";
  if (stepText.includes("메모지에 기록")) return "WRITE_MEMO";
  return "NONE_OF_THESE";
}

function createFakeJev() {
  const fake = {
    calls: 0,
    /** When set, every call returns this HTTP status instead of an answer. */
    failWithStatus: null,
    unexpected: [],
    badAuth: 0,
    /** Set by holdNextCall(): the next upstream call blocks until released. */
    held: null,
    /** Blocks the next Jev call mid-flight; returns { reached, release }. */
    holdNextCall() {
      let release;
      let reached;
      const gate = new Promise((resolve) => (release = resolve));
      const reachedPromise = new Promise((resolve) => (reached = resolve));
      fake.held = { gate, reached };
      return { reached: reachedPromise, release };
    },
    async handle(request) {
      if (request.url !== JEV_ENDPOINT || request.method !== "POST") {
        fake.unexpected.push(`${request.method} ${request.url}`);
        return new MfResponse("unexpected outbound request", { status: 599 });
      }
      if (request.headers.get("authorization") !== `Bearer ${FAKE_KEY}`) {
        fake.badAuth++;
        return new MfResponse("unauthorized", { status: 401 });
      }
      fake.calls++;
      if (fake.held) {
        const { gate, reached } = fake.held;
        fake.held = null;
        reached();
        await gate;
      }
      if (fake.failWithStatus) {
        return new MfResponse("upstream secret stack trace", { status: fake.failWithStatus });
      }
      const body = await request.json();
      const stepText = /다음 지시: "([\s\S]*)"$/.exec(body.state)?.[1] ?? "";
      const criteria = body.questions?.action_id?.criteria ?? {};
      const wanted = chooseAction(stepText);
      const choice = wanted in criteria ? wanted : "NONE_OF_THESE";
      return MfResponse.json({
        model: "fake-jev",
        answers: {
          executable: { type: "noul", noul: choice === "NONE_OF_THESE" ? 0.05 : 0.9 },
          action_id: { type: "choice", choice, confidence: 0.97 },
        },
      });
    },
  };
  return fake;
}

// ---------- app harness (same built-worker pattern as classroom-flow) ----------

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

async function createTestApp({ bindings = { TYPESAFE_API_KEY: FAKE_KEY }, fake = createFakeJev() } = {}) {
  const files = await collectJavaScriptModules(serverRoot);
  const mainPath = path.join(serverRoot, "index.js");
  const modules = [mainPath, ...files.filter((file) => file !== mainPath)].map((file) => ({
    type: "ESModule",
    path: file,
  }));

  const app = new Miniflare({
    modules,
    modulesRoot: serverRoot,
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"],
    bindings: {
      TEACHER_PASSWORD: teacherPassword,
      COURSE_CODE: "JEVFLOW2026",
      SESSION_TTL_SECONDS: "28800",
      ...bindings,
    },
    outboundService: (request) => fake.handle(request),
  });
  app.fake = fake;
  return app;
}

async function withApp(options, fn) {
  const app = await createTestApp(options);
  try {
    await fn(app);
    assert.deepEqual(app.fake.unexpected, [], "worker must not call anything but the fake Jev endpoint");
    assert.equal(app.fake.badAuth, 0, "worker must send the configured key");
  } finally {
    await app.dispose();
  }
}

async function requestJson(app, pathname, { method = "GET", body, rawBody, cookie, teacher = false, password } = {}) {
  const headers = new Headers();
  if (body !== undefined || rawBody !== undefined) headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  if (teacher) headers.set("x-teacher-password", teacherPassword);
  if (password) headers.set("x-teacher-password", password);
  const response = await app.dispatchFetch(`http://localhost${pathname}`, {
    method,
    headers,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data };
}

async function expectStatus(app, pathname, options, expectedStatus) {
  const result = await requestJson(app, pathname, options);
  assert.equal(result.response.status, expectedStatus, `${options?.method ?? "GET"} ${pathname}: ${JSON.stringify(result.data)}`);
  return result;
}

async function d1All(app, sql, ...params) {
  const db = await app.getD1Database("DB");
  const { results } = await db.prepare(sql).bind(...params).all();
  return results;
}

async function login(app, student) {
  const res = await expectStatus(app, "/api/student/login", { method: "POST", body: { ...student, consent: true } }, 200);
  const setCookie = res.response.headers.get("set-cookie");
  assert.ok(setCookie, "student login must issue a session cookie");
  return setCookie.split(";", 1)[0];
}

async function createRound(app, problemId = "max-box") {
  const created = await expectStatus(app, "/api/teacher/warmup/rounds", { method: "POST", teacher: true, body: { problemId } }, 200);
  const roundId = created.data.round.id;
  await expectStatus(app, "/api/teacher/warmup/publish", { method: "POST", teacher: true, body: { roundId } }, 200);
  return roundId;
}

async function closeRound(app, roundId) {
  const closed = await expectStatus(app, "/api/teacher/warmup/close", { method: "POST", teacher: true, body: { roundId } }, 200);
  assert.equal(closed.data.round.status, "closed");
}

async function submit(app, cookie, algorithmText) {
  const res = await expectStatus(app, "/api/warmup/submit", { method: "POST", cookie, body: { algorithmText } }, 200);
  return res.data.mySubmission.id;
}

/**
 * A closed max-box round with the given students' submissions.
 * Returns { roundId, students: [{ cookie, submissionId, text }] }.
 */
async function closedMaxBoxRound(app, texts) {
  const roundId = await createRound(app);
  const students = [];
  for (const [index, text] of texts.entries()) {
    const cookie = await login(app, STUDENTS[index]);
    const submissionId = await submit(app, cookie, text);
    students.push({ cookie, submissionId, text });
  }
  await closeRound(app, roundId);
  return { roundId, students };
}

const startJob = (app, roundId, trials) =>
  expectStatus(app, JOBS, { method: "POST", teacher: true, body: { action: "start", roundId, trials } }, 202);
const jobAction = (app, action, jobId, status = 200) =>
  expectStatus(app, JOBS, { method: "POST", teacher: true, body: { action, jobId } }, status);

async function advanceUntilSettled(app, jobId, limit = 50) {
  let job;
  for (let i = 0; i < limit; i++) {
    job = (await jobAction(app, "advance", jobId)).data.job;
    if (!["queued", "running"].includes(job.status)) return job;
  }
  assert.fail(`job ${jobId} did not settle within ${limit} advances: ${JSON.stringify(job)}`);
}

const studentResult = async (app, cookie) =>
  (await expectStatus(app, "/api/warmup/jev-result", { cookie }, 200)).data.result;

// ---------- tests ----------

test("auth fails closed on every Jev endpoint; legacy batch endpoint is retired", async () => {
  await withApp({}, async (app) => {
    const cookie = await login(app, STUDENTS[0]);

    for (const options of [{}, { password: "wrong" }, { cookie }]) {
      await expectStatus(app, JOBS, options, 401);
      await expectStatus(app, JOBS, { ...options, method: "POST", body: { roundId: 1 } }, 401);
      await expectStatus(app, "/api/jev/execute", { ...options, method: "POST", body: { steps: ["상자를 확인한다."] } }, 401);
      await expectStatus(app, "/api/jev/batch-execute", options, 401);
      await expectStatus(app, "/api/jev/batch-execute", { ...options, method: "POST", body: { steps: ["x"] } }, 401);
    }
    await expectStatus(app, "/api/warmup/jev-result", {}, 401);

    await expectStatus(app, "/api/jev/batch-execute", { teacher: true }, 410);
    await expectStatus(app, "/api/jev/batch-execute", { teacher: true, method: "POST", body: { steps: ["x"] } }, 410);

    assert.equal(app.fake.calls, 0, "no rejected request may reach the paid API");
    assert.deepEqual(await d1All(app, "SELECT id FROM jev_jobs"), []);
  });
});

test("/api/jev/execute is a teacher-only diagnostic that uses the configured API and rejects client overrides", async () => {
  await withApp({}, async (app) => {
    const steps = CORRECT_ALGORITHM.split("\n").map((line) => line.replace(/^\d+\.\s*/, ""));
    const ok = await expectStatus(app, "/api/jev/execute", { method: "POST", teacher: true, body: { steps } }, 200);
    assert.equal(ok.data.executable, true);
    assert.equal(ok.data.correct, true);
    assert.equal(ok.data.diagnostics.mode, "jev-api");
    assert.ok(app.fake.calls > 0);

    const before = app.fake.calls;
    await expectStatus(app, "/api/jev/execute", { method: "POST", teacher: true, body: { steps, threshold: 0 } }, 400);
    await expectStatus(app, "/api/jev/execute", { method: "POST", teacher: true, body: { steps, initialState: { numbers: [1] } } }, 400);
    await expectStatus(app, "/api/jev/execute", { method: "POST", teacher: true, body: { steps: [] } }, 400);
    await expectStatus(app, "/api/jev/execute", { method: "POST", teacher: true, rawBody: "{not json" }, 400);
    assert.equal(app.fake.calls, before, "invalid requests must not reach the paid API");

    // Written to no student table (the route never touches the DB, so the table may not even exist yet).
    const tables = await d1All(app, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'jev_batch_evaluations'");
    if (tables.length) assert.deepEqual(await d1All(app, "SELECT id FROM jev_batch_evaluations"), []);
  });
});

test("missing API key → 503 with no persisted job; production refuses the mock service", async () => {
  for (const bindings of [{}, { USE_JEV_MOCK: "true" }, { USE_JEV_MOCK: "true", TYPESAFE_API_KEY: FAKE_KEY }]) {
    await withApp({ bindings }, async (app) => {
      const { roundId } = await closedMaxBoxRound(app, [CORRECT_ALGORITHM]);
      const start = await expectStatus(app, JOBS, { method: "POST", teacher: true, body: { roundId, trials: 1 } }, 503);
      assert.ok(typeof start.data.error === "string" && !start.data.error.includes(FAKE_KEY), JSON.stringify(bindings));
      assert.deepEqual(await d1All(app, "SELECT id FROM jev_jobs"), [], `no job for ${JSON.stringify(bindings)}`);
      assert.deepEqual(await d1All(app, "SELECT id FROM jev_job_items"), []);

      await expectStatus(app, "/api/jev/execute", { method: "POST", teacher: true, body: { steps: ["상자를 확인한다."] } }, 503);
      assert.equal(app.fake.calls, 0);
    });
  }
});

test("start validates round eligibility (closed, max-box, same course) and input", async () => {
  await withApp({}, async (app) => {
    const openRound = await createRound(app);
    const cookie = await login(app, STUDENTS[0]);
    await submit(app, cookie, CORRECT_ALGORITHM);
    await expectStatus(app, JOBS, { method: "POST", teacher: true, body: { roundId: openRound, trials: 1 } }, 409);
    await closeRound(app, openRound);

    const otherProblem = await createRound(app, "hidden-card");
    await closeRound(app, otherProblem);
    await expectStatus(app, JOBS, { method: "POST", teacher: true, body: { roundId: otherProblem, trials: 1 } }, 400);

    await expectStatus(app, JOBS, { method: "POST", teacher: true, body: { roundId: 999999, trials: 1 } }, 404);
    for (const trials of [0, 51, 2.5, "5", null]) {
      await expectStatus(app, JOBS, { method: "POST", teacher: true, body: { roundId: openRound, trials } }, 400);
    }
    for (const roundId of [0, -1, "abc", undefined]) {
      await expectStatus(app, JOBS, { method: "POST", teacher: true, body: { roundId, trials: 1 } }, 400);
    }
    await expectStatus(app, JOBS, { method: "POST", teacher: true, body: { action: "advance", jobId: 424242 } }, 404);
    await expectStatus(app, JOBS, { method: "POST", teacher: true, rawBody: "[]" }, 400);

    assert.deepEqual(await d1All(app, "SELECT id FROM jev_jobs"), [], "no ineligible request may reserve a job");
    assert.equal(app.fake.calls, 0);

    // Omitted trials defaults to 20.
    const started = await startJob(app, openRound);
    assert.equal(started.data.job.trialsPerStudent, 20);
    // Unknown actions are rejected once the job itself exists.
    await expectStatus(app, JOBS, { method: "POST", teacher: true, body: { action: "explode", jobId: started.data.job.id } }, 400);
  });
});

test("duplicate starts (sequential and concurrent) share one job per round", async () => {
  await withApp({}, async (app) => {
    const { roundId } = await closedMaxBoxRound(app, [CORRECT_ALGORITHM, NO_COMPARE_ALGORITHM]);

    const concurrent = await Promise.all(
      Array.from({ length: 5 }, () => requestJson(app, JOBS, { method: "POST", teacher: true, body: { roundId, trials: 2 } }))
    );
    for (const { response, data } of concurrent) assert.equal(response.status, 202, JSON.stringify(data));
    const ids = new Set(concurrent.map(({ data }) => data.job.id));
    assert.equal(ids.size, 1, `concurrent starts returned ${[...ids]}`);
    const [jobId] = ids;

    const again = await startJob(app, roundId, 7);
    assert.equal(again.data.job.id, jobId);
    assert.equal(again.data.job.trialsPerStudent, 2, "a duplicate start does not rewrite the active job");

    assert.equal((await d1All(app, "SELECT id FROM jev_jobs WHERE round_id = ?", roundId)).length, 1);
    assert.equal((await d1All(app, "SELECT id FROM jev_job_items WHERE job_id = ?", jobId)).length, 2);
    assert.equal(app.fake.calls, 0, "start alone never calls the API");

    const list = await expectStatus(app, JOBS, { teacher: true }, 200);
    assert.deepEqual(list.data.jobs.map((job) => job.id), [jobId]);
    assert.equal(list.response.headers.get("cache-control"), "no-store");
  });
});

test("full run: exactly one trial per advance, checkpointed; students see only their own teacher/API snapshot", async () => {
  await withApp({}, async (app) => {
    const roundId = await createRound(app);
    const correct = { cookie: await login(app, STUDENTS[0]) };
    const wrong = { cookie: await login(app, STUDENTS[1]) };
    const bystander = { cookie: await login(app, STUDENTS[2]) };

    // A revised submission: the job must snapshot the latest text and revision.
    correct.submissionId = await submit(app, correct.cookie, NO_COMPARE_ALGORITHM);
    assert.equal(await submit(app, correct.cookie, CORRECT_ALGORITHM), correct.submissionId);
    wrong.submissionId = await submit(app, wrong.cookie, NO_COMPARE_ALGORITHM);
    await closeRound(app, roundId);

    const TRIALS = 2;
    const start = await startJob(app, roundId, TRIALS);
    const job0 = start.data.job;
    assert.equal(job0.status, "queued");
    assert.equal(job0.mode, "jev-api");
    assert.equal(job0.totalStudents, 2);
    assert.equal(job0.completedTrials, 0);

    const [snapshot] = await d1All(app, "SELECT submission_version, algorithm_text FROM jev_job_items WHERE submission_id = ?", correct.submissionId);
    assert.equal(snapshot.submission_version, 2);
    assert.equal(snapshot.algorithm_text, CORRECT_ALGORITHM);

    // Checkpoints: each advance persists exactly one more trial.
    for (let expected = 1; expected <= 2 * TRIALS; expected++) {
      const callsBefore = app.fake.calls;
      const job = (await jobAction(app, "advance", job0.id)).data.job;
      assert.equal(job.completedTrials, expected, `after advance ${expected}`);
      const perTrialCalls = app.fake.calls - callsBefore;
      assert.ok(perTrialCalls > 0 && perTrialCalls <= 60, `one trial made ${perTrialCalls} API calls`);
      assert.equal(job.status, expected === 2 * TRIALS ? "completed" : "running");
      if (expected === TRIALS) {
        // First student finished → their result is visible before the whole job is done.
        assert.equal((await studentResult(app, correct.cookie))?.totalTrials, TRIALS);
        assert.equal(await studentResult(app, wrong.cookie), null);
      }
    }

    const done = (await jobAction(app, "advance", job0.id)).data.job;
    assert.equal(done.status, "completed");
    assert.equal(done.completedStudents, 2);
    const calls = app.fake.calls;
    await jobAction(app, "advance", job0.id);
    assert.equal(app.fake.calls, calls, "advancing a finished job makes no API calls");

    const mine = await studentResult(app, correct.cookie);
    assert.equal(mine.totalTrials, TRIALS);
    assert.equal(mine.correctCount, TRIALS);
    assert.equal(mine.errorCount, 0);
    assert.equal(mine.submissionVersion, 2);
    assert.equal(mine.submissionText, CORRECT_ALGORITHM);
    assert.deepEqual(mine.examples, []);

    const theirs = await studentResult(app, wrong.cookie);
    assert.equal(theirs.totalTrials, TRIALS);
    assert.equal(theirs.submissionText, NO_COMPARE_ALGORITHM, "never another student's result");
    assert.equal(theirs.correctCount + theirs.incorrectCount, TRIALS);
    for (const example of theirs.examples) {
      assert.notEqual(example.correct, true);
      assert.ok(example.failureReason, "wrong examples explain themselves");
    }

    assert.equal(await studentResult(app, bystander.cookie), null, "a student with no submission sees nothing");

    const rows = await d1All(app, "SELECT source, mode, round_id AS roundId FROM jev_batch_evaluations");
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.source === "teacher" && row.mode === "jev-api" && row.roundId === roundId));

    // A new start after completion creates a new job (the old one is no longer active).
    const rerun = await startJob(app, roundId, 1);
    assert.notEqual(rerun.data.job.id, job0.id);
    const list = await expectStatus(app, JOBS, { teacher: true }, 200);
    assert.deepEqual(list.data.jobs.map((job) => job.id), [rerun.data.job.id], "GET lists only the latest job per round");
  });
});

test("cancel fences further work; resume keeps completed trials and runs only the rest", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await closedMaxBoxRound(app, [CORRECT_ALGORITHM]);
    const jobId = (await startJob(app, roundId, 3)).data.job.id;

    await jobAction(app, "advance", jobId);
    await jobAction(app, "advance", jobId);
    const cancelled = (await jobAction(app, "cancel", jobId)).data.job;
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.completedTrials, 2);

    const calls = app.fake.calls;
    const stillCancelled = (await jobAction(app, "advance", jobId)).data.job;
    assert.equal(stillCancelled.status, "cancelled");
    assert.equal(stillCancelled.completedTrials, 2);
    assert.equal(app.fake.calls, calls, "a cancelled job makes no API calls");
    assert.equal(await studentResult(app, students[0].cookie), null, "partial trials are not a student result");

    const resumed = (await jobAction(app, "resume", jobId)).data.job;
    assert.equal(resumed.status, "queued");
    assert.equal(resumed.completedTrials, 2);

    const done = await advanceUntilSettled(app, jobId);
    assert.equal(done.status, "completed");
    assert.equal(done.completedTrials, 3);

    const [item] = await d1All(app, "SELECT trials FROM jev_job_items WHERE job_id = ?", jobId);
    assert.deepEqual(JSON.parse(item.trials).map((t) => t.trialIndex), [0, 1, 2]);
    assert.equal((await studentResult(app, students[0].cookie)).totalTrials, 3);

    // Cancel/resume on a finished job are no-ops.
    assert.equal((await jobAction(app, "cancel", jobId)).data.job.status, "completed");
    assert.equal((await jobAction(app, "resume", jobId)).data.job.status, "completed");
  });
});

test("upstream 503 pauses the job as failed without scoring the student; retry finishes only remaining trials", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await closedMaxBoxRound(app, [CORRECT_ALGORITHM, NO_COMPARE_ALGORITHM]);
    const jobId = (await startJob(app, roundId, 2)).data.job.id;

    assert.equal((await jobAction(app, "advance", jobId)).data.job.completedTrials, 1);

    app.fake.failWithStatus = 503;
    const failed = (await jobAction(app, "advance", jobId)).data.job;
    assert.equal(failed.status, "failed");
    assert.equal(failed.failedStudents, 1);
    assert.equal(failed.completedTrials, 1, "the failed trial is not recorded");
    assert.ok(failed.lastError && !failed.lastError.includes("upstream secret"), `safe error: ${failed.lastError}`);
    assert.equal(await studentResult(app, students[0].cookie), null, "an outage is never shown as the student's score");
    assert.deepEqual(await d1All(app, "SELECT id FROM jev_batch_evaluations"), []);

    const callsWhileFailed = app.fake.calls;
    assert.equal((await jobAction(app, "advance", jobId)).data.job.status, "failed", "failed jobs stay paused");
    assert.equal(app.fake.calls, callsWhileFailed);

    app.fake.failWithStatus = null;
    const resumed = (await jobAction(app, "resume", jobId)).data.job;
    assert.equal(resumed.status, "queued");
    assert.equal(resumed.failedStudents, 0);
    assert.equal(resumed.lastError, null);

    const done = await advanceUntilSettled(app, jobId);
    assert.equal(done.status, "completed");
    assert.equal(done.completedTrials, 4, "2 students × 2 trials, the pre-failure trial kept");

    const first = await studentResult(app, students[0].cookie);
    assert.equal(first.totalTrials, 2);
    assert.equal(first.errorCount, 0);
    assert.equal(first.correctCount, 2);
    assert.equal((await studentResult(app, students[1].cookie)).totalTrials, 2);
  });
});

test("resuming a failed job while a newer job for the round is active is refused", async () => {
  await withApp({}, async (app) => {
    const { roundId } = await closedMaxBoxRound(app, [CORRECT_ALGORITHM]);
    const oldId = (await startJob(app, roundId, 1)).data.job.id;
    app.fake.failWithStatus = 500;
    assert.equal((await jobAction(app, "advance", oldId)).data.job.status, "failed");
    app.fake.failWithStatus = null;

    const newId = (await startJob(app, roundId, 1)).data.job.id;
    assert.notEqual(newId, oldId);
    await jobAction(app, "resume", oldId, 409);
    assert.equal((await d1All(app, "SELECT status FROM jev_jobs WHERE id = ?", oldId))[0].status, "failed");
    assert.equal((await d1All(app, "SELECT count(*) AS n FROM jev_jobs WHERE status IN ('queued','running')"))[0].n, 1);
  });
});

test("legacy and mock rows are never shown to students as AI results", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await closedMaxBoxRound(app, [CORRECT_ALGORITHM, NO_COMPARE_ALGORITHM]);
    const db = await app.getD1Database("DB");
    const [owner] = await d1All(app, "SELECT course_id AS courseId FROM warmup_rounds WHERE id = ?", roundId);
    const [sub] = await d1All(app, "SELECT student_key, student_id, student_name FROM warmup_submissions WHERE id = ?", students[0].submissionId);
    const insert = (source, mode) =>
      db
        .prepare(`INSERT INTO jev_batch_evaluations
          (course_id, round_id, student_key, student_id, student_name, problem_id, submission_id, submission_version,
           submission_text, mode, source, algorithm_steps, total_trials, correct_count, incorrect_count, error_count, trials)
          VALUES (?, ?, ?, ?, ?, 'max-finding', ?, 1, 'fixture', ?, ?, '[]', 9, 9, 0, 0, '[]')`)
        .bind(owner.courseId, roundId, sub.student_key, sub.student_id, sub.student_name, students[0].submissionId, mode, source)
        .run();
    await insert("legacy", "legacy");
    await insert("teacher", "mock");
    await insert("student", "jev-api");

    assert.equal(await studentResult(app, students[0].cookie), null);
    assert.equal(await studentResult(app, students[1].cookie), null);

    // A real run is then shown, and only to its owner.
    const jobId = (await startJob(app, roundId, 1)).data.job.id;
    await advanceUntilSettled(app, jobId);
    const mine = await studentResult(app, students[0].cookie);
    assert.equal(mine.totalTrials, 1);
    assert.equal(mine.submissionText, CORRECT_ALGORITHM);
  });
});

test("deleting a submission or round cleans up jobs and hides results", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await closedMaxBoxRound(app, [CORRECT_ALGORITHM, NO_COMPARE_ALGORITHM]);
    const jobId = (await startJob(app, roundId, 1)).data.job.id;
    await advanceUntilSettled(app, jobId);
    assert.ok(await studentResult(app, students[1].cookie));

    await expectStatus(app, `/api/teacher/warmup/submission?id=${students[1].submissionId}`, { method: "DELETE", teacher: true }, 200);
    assert.equal(await studentResult(app, students[1].cookie), null);
    assert.deepEqual(await d1All(app, "SELECT id FROM jev_batch_evaluations WHERE submission_id = ?", students[1].submissionId), []);
    assert.deepEqual(await d1All(app, "SELECT id FROM jev_job_items WHERE submission_id = ?", students[1].submissionId), []);
    assert.equal((await jobAction(app, "advance", jobId)).data.job.totalStudents, 1);
    assert.ok(await studentResult(app, students[0].cookie), "other students keep their results");

    await expectStatus(app, `/api/teacher/warmup/round?id=${roundId}`, { method: "DELETE", teacher: true }, 200);
    assert.equal(await studentResult(app, students[0].cookie), null);
    for (const table of ["jev_jobs", "jev_job_items", "jev_batch_evaluations"]) {
      assert.deepEqual(await d1All(app, `SELECT * FROM ${table}`), [], `${table} cleaned up`);
    }
    await jobAction(app, "advance", jobId, 404);
  });
});

test("deleting a submission mid-job lets the job finish for the remaining students", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await closedMaxBoxRound(app, [CORRECT_ALGORITHM, NO_COMPARE_ALGORITHM]);
    const jobId = (await startJob(app, roundId, 1)).data.job.id;
    await expectStatus(app, `/api/teacher/warmup/submission?id=${students[1].submissionId}`, { method: "DELETE", teacher: true }, 200);
    const done = await advanceUntilSettled(app, jobId);
    assert.equal(done.status, "completed");
    assert.equal(done.totalStudents, 1);
    assert.equal(await studentResult(app, students[1].cookie), null);
    assert.equal((await studentResult(app, students[0].cookie)).totalTrials, 1);
  });
});

test("a submission the engine cannot accept (e.g. 41+ steps) is skipped, not an outage that blocks the job", async () => {
  await withApp({}, async (app) => {
    // Allowed by the 4,000-char submit limit, rejected by validateJevSteps (max 40 steps).
    const tooManySteps = Array.from({ length: 45 }, (_, i) => `${i + 1}. 상자를 확인한다.`).join("\n");
    const { roundId, students } = await closedMaxBoxRound(app, [tooManySteps, CORRECT_ALGORITHM]);
    const jobId = (await startJob(app, roundId, 1)).data.job.id;

    const done = await advanceUntilSettled(app, jobId);
    assert.equal(done.status, "completed", `a student's own text must not pause the class run: ${done.lastError}`);
    assert.equal(done.skippedStudents, 1);
    assert.equal((await studentResult(app, students[1].cookie)).totalTrials, 1);
  });
});

test("race: a concurrent advance while a trial is in flight makes no calls and writes nothing", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await closedMaxBoxRound(app, [CORRECT_ALGORITHM]);
    const jobId = (await startJob(app, roundId, 2)).data.job.id;

    const hold = app.fake.holdNextCall();
    const first = jobAction(app, "advance", jobId);
    await hold.reached;
    assert.equal(app.fake.calls, 1);

    // Same job, second tab: lease is held, so it must return immediately.
    const second = (await jobAction(app, "advance", jobId)).data.job;
    assert.equal(second.status, "running");
    assert.equal(second.completedTrials, 0);
    assert.equal(app.fake.calls, 1, "the overlapping advance never reached the paid API");

    hold.release();
    const afterFirst = (await first).data.job;
    assert.equal(afterFirst.completedTrials, 1, "exactly one trial from the two overlapping advances");

    const [item] = await d1All(app, "SELECT trials FROM jev_job_items WHERE job_id = ?", jobId);
    assert.deepEqual(JSON.parse(item.trials).map((t) => t.trialIndex), [0]);

    const done = await advanceUntilSettled(app, jobId);
    assert.equal(done.completedTrials, 2);
    assert.equal((await studentResult(app, students[0].cookie)).totalTrials, 2);
    assert.equal((await d1All(app, "SELECT count(*) AS n FROM jev_batch_evaluations"))[0].n, 1);
  });
});

test("race: cancel + resume while a trial is in flight fences the stale request's results", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await closedMaxBoxRound(app, [CORRECT_ALGORITHM]);
    const jobId = (await startJob(app, roundId, 1)).data.job.id;

    const hold = app.fake.holdNextCall();
    const stale = jobAction(app, "advance", jobId);
    await hold.reached;

    assert.equal((await jobAction(app, "cancel", jobId)).data.job.status, "cancelled");
    assert.equal((await jobAction(app, "resume", jobId)).data.job.status, "queued");

    // The fresh lease runs the whole (only) trial while the stale request is still blocked.
    const fresh = (await jobAction(app, "advance", jobId)).data.job;
    assert.equal(fresh.status, "completed");
    assert.equal(fresh.completedTrials, 1);
    const freshTrials = (await d1All(app, "SELECT trials FROM jev_job_items WHERE job_id = ?", jobId))[0].trials;

    hold.release();
    const staleJob = (await stale).data.job;
    assert.equal(staleJob.status, "completed", "the stale request must not change the job status");
    assert.equal(staleJob.completedTrials, 1, "the stale trial is discarded, not appended");

    const [item] = await d1All(app, "SELECT trials, status FROM jev_job_items WHERE job_id = ?", jobId);
    assert.equal(item.status, "completed");
    assert.equal(item.trials, freshTrials, "stored trials are exactly the fresh request's");
    const [job] = await d1All(app, "SELECT status, lease_token AS leaseToken FROM jev_jobs WHERE id = ?", jobId);
    assert.deepEqual(job, { status: "completed", leaseToken: null });

    const evaluations = await d1All(app, "SELECT total_trials AS totalTrials FROM jev_batch_evaluations");
    assert.deepEqual(evaluations, [{ totalTrials: 1 }], "one student result, not a duplicate from the stale run");
    assert.equal((await studentResult(app, students[0].cookie)).totalTrials, 1);
  });
});

test("race: cancel while a trial is in flight keeps the job cancelled when the stale response lands", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await closedMaxBoxRound(app, [CORRECT_ALGORITHM]);
    const jobId = (await startJob(app, roundId, 1)).data.job.id;

    const hold = app.fake.holdNextCall();
    const stale = jobAction(app, "advance", jobId);
    await hold.reached;
    assert.equal((await jobAction(app, "cancel", jobId)).data.job.status, "cancelled");

    hold.release();
    const staleJob = (await stale).data.job;
    assert.equal(staleJob.status, "cancelled");
    assert.equal(staleJob.completedTrials, 0);
    assert.equal(await studentResult(app, students[0].cookie), null);
    assert.equal((await d1All(app, "SELECT count(*) AS n FROM jev_batch_evaluations"))[0].n, 0);
  });
});
