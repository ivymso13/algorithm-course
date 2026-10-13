// Shared Miniflare harness for the Jev end-to-end suites: the built worker
// (dist/server) with every outbound request answered by a local fake of the
// TypeSafe System One endpoint — no real network, no API cost, no real key.
import assert from "node:assert/strict";
import { readFile,readdir } from "node:fs/promises";
import path from "node:path";
import { Miniflare, Response as MfResponse } from "miniflare";

export const serverRoot = path.resolve("dist/server");
export const teacherPassword = "jev-flow-test";
export const FAKE_KEY = "fake-typesafe-key-for-tests";
export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const JOBS = "/api/teacher/warmup/jev-batch-run";

export const CORRECT_ALGORITHM = [
  "1. 상자를 확인한다.",
  "2. 메모지에 기록한다.",
  "3. 오른쪽으로 이동한다.",
  "4. 상자를 확인한다.",
  "5. 방금 확인한 상자가 메모지보다 크면 메모지에 기록한다.",
  "6. 확인하지 않은 상자가 있으면 3단계부터 반복한다.",
  "7. 메모지에 적힌 사과 개수를 정답으로 제출한다.",
].join("\n");

// Loop never compares: the memo keeps the first box, so it is (almost always) wrong.
export const NO_COMPARE_ALGORITHM = [
  "1. 상자를 확인한다.",
  "2. 메모지에 기록한다.",
  "3. 오른쪽으로 이동한다.",
  "4. 상자를 확인한다.",
  "5. 확인하지 않은 상자가 있으면 3단계부터 반복한다.",
  "6. 메모지에 적힌 사과 개수를 정답으로 제출한다.",
].join("\n");

export const STUDENTS = [
  { school: "서해고", studentId: "10401" },
  { school: "서해고", studentId: "10403" },
  { school: "서해고", studentId: "10432" },
  { school: "정왕고", studentId: "10111" },
  { school: "정왕고", studentId: "10113" },
  { school: "정왕고", studentId: "10208" },
  { school: "정왕고", studentId: "10221" },
  { school: "정왕고", studentId: "10225" },
];

// ---------- fake Jev upstream ----------

/** Picks the schema action a clear student sentence names, like the real `choice` question would. */
export function chooseAction(stepText) {
  if (stepText.includes("크면")) return "UPDATE_MEMO_IF_GREATER";
  if (stepText.includes("반복")) return "REPEAT_STUDENT_STEPS";
  if (stepText.includes("제출")) return "SUBMIT_ANSWER";
  if (stepText.includes("오른쪽으로 이동")) return "MOVE_RIGHT_BOX";
  if (stepText.includes("상자를 확인")) return "CHECK_SELECTED_BOX";
  if (stepText.includes("메모지에 기록")) return "WRITE_MEMO";
  return "NONE_OF_THESE";
}

export function createFakeJev() {
  const fake = {
    calls: 0,
    /** When set, every call returns this HTTP status instead of an answer. */
    failWithStatus: null,
    /** The next N calls fail with HTTP 503 (then calls succeed again). */
    failNextCalls: 0,
    /** Calls currently being answered, and the most ever at once. */
    inFlight: 0,
    maxInFlight: 0,
    /** When set, every call waits on this promise before answering. */
    gate: null,
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
      fake.inFlight++;
      fake.maxInFlight = Math.max(fake.maxInFlight, fake.inFlight);
      try {
        return await fake.answer(request);
      } finally {
        fake.inFlight--;
      }
    },
    async answer(request) {
      if (fake.gate) await fake.gate;
      if (fake.failNextCalls > 0) {
        fake.failNextCalls--;
        return new MfResponse("upstream secret stack trace", { status: 503 });
      }
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

export async function collectJavaScriptModules(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectJavaScriptModules(fullPath)));
    else if (entry.name.endsWith(".js")) files.push(fullPath);
  }
  return files;
}

export async function createTestApp({ bindings = { TYPESAFE_API_KEY: FAKE_KEY }, fake = createFakeJev(), assetsDirectory } = {}) {
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
    ...(assetsDirectory ? {serviceBindings:{ASSETS:async(request)=>{const file=path.resolve(assetsDirectory,'.'+decodeURIComponent(new URL(request.url).pathname));if(!file.startsWith(path.resolve(assetsDirectory)+path.sep))return new MfResponse('not found',{status:404});try{return new MfResponse(await readFile(file),{headers:{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'application/octet-stream'}});}catch{return new MfResponse('not found',{status:404});}}}} : {}),
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

export async function withApp(options, fn) {
  const app = await createTestApp(options);
  try {
    await fn(app);
    assert.deepEqual(app.fake.unexpected, [], "worker must not call anything but the fake Jev endpoint");
    assert.equal(app.fake.badAuth, 0, "worker must send the configured key");
  } finally {
    await app.dispose();
  }
}

export async function requestJson(app, pathname, { method = "GET", body, rawBody, cookie, teacher = false, password } = {}) {
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

export async function expectStatus(app, pathname, options, expectedStatus) {
  const result = await requestJson(app, pathname, options);
  assert.equal(result.response.status, expectedStatus, `${options?.method ?? "GET"} ${pathname}: ${JSON.stringify(result.data)}`);
  return result;
}

export async function d1All(app, sql, ...params) {
  const db = await app.getD1Database("DB");
  const { results } = await db.prepare(sql).bind(...params).all();
  return results;
}

export async function login(app, student) {
  const res = await expectStatus(app, "/api/student/login", { method: "POST", body: { ...student, consent: true } }, 200);
  const setCookie = res.response.headers.get("set-cookie");
  assert.ok(setCookie, "student login must issue a session cookie");
  return setCookie.split(";", 1)[0];
}

export async function createRound(app, problemId = "max-box") {
  const created = await expectStatus(app, "/api/teacher/warmup/rounds", { method: "POST", teacher: true, body: { problemId } }, 200);
  const roundId = created.data.round.id;
  await expectStatus(app, "/api/teacher/warmup/publish", { method: "POST", teacher: true, body: { roundId } }, 200);
  return roundId;
}

export async function closeRound(app, roundId) {
  const closed = await expectStatus(app, "/api/teacher/warmup/close", { method: "POST", teacher: true, body: { roundId } }, 200);
  assert.equal(closed.data.round.status, "closed");
}

export async function submit(app, cookie, algorithmText) {
  const current=await requestJson(app,"/api/warmup/round",{cookie});
  if(current.data?.mySubmission && current.data.mySubmission.algorithmText!==algorithmText){
    await expectStatus(app,"/api/teacher/warmup/revision-open",{method:"POST",teacher:true,body:{submissionId:current.data.mySubmission.id,reason:"테스트에서 실행 중 버전 변경과 취소를 검증하기 위한 개방"}},200);
  }
  const res = await expectStatus(app, "/api/warmup/submit", { method: "POST", cookie, body: { algorithmText,reason:"테스트에서 원문 변경과 실행 결과 분리를 검증합니다." } }, 200);
  return res.data.mySubmission.id;
}

/**
 * A closed max-box round with the given students' submissions.
 * Returns { roundId, students: [{ cookie, submissionId, text }] }.
 */
export async function closedMaxBoxRound(app, texts, { keepAuto = false } = {}) {
  const roundId = await createRound(app);
  const students = [];
  for (const [index, text] of texts.entries()) {
    const cookie = await login(app, STUDENTS[index]);
    const submissionId = await submit(app, cookie, text);
    students.push({ cookie, submissionId, text });
  }
  await closeRound(app, roundId);
  // Teacher-job tests stop the automatic per-submission runs first, so the
  // job runs (and is measured on) its own trials.
  if (!keepAuto) await autoAction(app, "auto-cancel", roundId);
  return { roundId, students };
}

export const startJob = (app, roundId, trials) =>
  expectStatus(app, JOBS, { method: "POST", teacher: true, body: { action: "start", roundId, trials } }, 202);
export const jobAction = (app, action, jobId, status = 200) =>
  expectStatus(app, JOBS, { method: "POST", teacher: true, body: { action, jobId } }, status);

export async function advanceUntilSettled(app, jobId, limit = 50) {
  let job;
  for (let i = 0; i < limit; i++) {
    job = (await jobAction(app, "advance", jobId)).data.job;
    if (!["queued", "running"].includes(job.status)) return job;
  }
  assert.fail(`job ${jobId} did not settle within ${limit} advances: ${JSON.stringify(job)}`);
}

export const studentResult = async (app, cookie) =>
  (await expectStatus(app, "/api/warmup/jev-result", { cookie }, 200)).data.result;

export const autoAction = async (app, action, roundId, status = 200) =>
  (await expectStatus(app, JOBS, { method: "POST", teacher: true, body: { action, roundId } }, status)).data.auto;

export const AUTO = "/api/warmup/jev-auto";
export const autoAdvance = async (app, cookie, roundId, action = "advance") =>
  (await expectStatus(app, AUTO, { method: "POST", cookie, body: { roundId, action } }, 200)).data;
export const autoStatus = async (app, cookie, roundId) =>
  (await expectStatus(app, `${AUTO}?roundId=${roundId}`, { cookie }, 200)).data.run;

/** Opens a max-box round and has students[i] submit texts[i]; returns cookies. */
export async function openMaxBoxRound(app, texts) {
  const roundId = await createRound(app);
  const students = [];
  for (const [index, text] of texts.entries()) {
    const cookie = await login(app, STUDENTS[index]);
    const submissionId = await submit(app, cookie, text);
    students.push({ cookie, submissionId, text });
  }
  return { roundId, students };
}

export async function autoUntilSettled(app, cookie, roundId, limit = 40) {
  let run;
  for (let i = 0; i < limit; i++) {
    run = (await autoAdvance(app, cookie, roundId)).run;
    if (!run || !["queued", "running", "retrying"].includes(run.status)) return run;
  }
  assert.fail(`auto run did not settle within ${limit} advances: ${JSON.stringify(run)}`);
}

/** Blocks every upstream call until release(); resolves once `count` calls are waiting. */
export async function blockCalls(app, count) {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  app.fake.gate = gate;
  return {
    release: () => { if (app.fake.gate === gate) app.fake.gate = null; release(); },
    /** New calls stop waiting; calls already blocked stay blocked until release(). */
    open: () => { if (app.fake.gate === gate) app.fake.gate = null; },
    reached: async () => {
      for (let i = 0; i < 200 && app.fake.inFlight < count; i++) await new Promise((r) => setTimeout(r, 10));
      assert.equal(app.fake.inFlight, count, `${count} calls blocked`);
    },
  };
}
