// End-to-end Jev job flow against the built worker (dist/server), in
// Miniflare. Every outbound request is answered by a local fake of the
// TypeSafe System One endpoint — no real network, no API cost, no real key.
import assert from "node:assert/strict";
import test from "node:test";
import {
  FAKE_KEY, JOBS, CORRECT_ALGORITHM, NO_COMPARE_ALGORITHM, STUDENTS, withApp, requestJson, expectStatus, d1All,
  login, createRound, closeRound, submit, closedMaxBoxRound, startJob, jobAction, advanceUntilSettled, studentResult, autoAction,
} from "./support/jevHarness.mjs";

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

    // Omitted trials defaults to 10, the same count students get automatically.
    const started = await startJob(app, openRound);
    assert.equal(started.data.job.trialsPerStudent, 10);
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

test("full run: one student's trials in parallel per advance, checkpointed; students see only their own teacher/API snapshot", async () => {
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
    await autoAction(app, "auto-cancel", roundId);

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

    // Checkpoints: each advance runs the current student's remaining trials
    // (up to the 5 global slots) in parallel and persists them.
    for (let expected = TRIALS; expected <= 2 * TRIALS; expected += TRIALS) {
      const callsBefore = app.fake.calls;
      const job = (await jobAction(app, "advance", job0.id)).data.job;
      assert.equal(job.completedTrials, expected, `after advance ${expected}`);
      const waveCalls = app.fake.calls - callsBefore;
      assert.ok(waveCalls > 0 && waveCalls <= 60 * TRIALS, `one wave made ${waveCalls} API calls`);
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
    const jobId = (await startJob(app, roundId, 8)).data.job.id;

    assert.equal((await jobAction(app, "advance", jobId)).data.job.completedTrials, 5, "one wave = 5 global slots");
    const cancelled = (await jobAction(app, "cancel", jobId)).data.job;
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.completedTrials, 5);

    const calls = app.fake.calls;
    const stillCancelled = (await jobAction(app, "advance", jobId)).data.job;
    assert.equal(stillCancelled.status, "cancelled");
    assert.equal(stillCancelled.completedTrials, 5);
    assert.equal(app.fake.calls, calls, "a cancelled job makes no API calls");
    assert.equal(await studentResult(app, students[0].cookie), null, "partial trials are not a student result");

    const resumed = (await jobAction(app, "resume", jobId)).data.job;
    assert.equal(resumed.status, "queued");
    assert.equal(resumed.completedTrials, 5);

    const done = await advanceUntilSettled(app, jobId);
    assert.equal(done.status, "completed");
    assert.equal(done.completedTrials, 8);

    const [item] = await d1All(app, "SELECT trials FROM jev_job_items WHERE job_id = ?", jobId);
    assert.deepEqual(JSON.parse(item.trials).map((t) => t.trialIndex), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.equal((await studentResult(app, students[0].cookie)).totalTrials, 8);

    // Cancel/resume on a finished job are no-ops.
    assert.equal((await jobAction(app, "cancel", jobId)).data.job.status, "completed");
    assert.equal((await jobAction(app, "resume", jobId)).data.job.status, "completed");
  });
});

test("upstream 503 pauses the job as failed without scoring the student; retry finishes only remaining trials", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await closedMaxBoxRound(app, [CORRECT_ALGORITHM, NO_COMPARE_ALGORITHM]);
    const jobId = (await startJob(app, roundId, 7)).data.job.id;

    // One of the five parallel trials hits an outage: the other four are kept.
    app.fake.failNextCalls = 1;
    const partial = (await jobAction(app, "advance", jobId)).data.job;
    assert.equal(partial.status, "failed");
    assert.equal(partial.completedTrials, 4, "successful trials of a failing wave are persisted");
    app.fake.failNextCalls = 0;
    assert.equal((await jobAction(app, "resume", jobId)).data.job.status, "queued");

    app.fake.failWithStatus = 503;
    const failed = (await jobAction(app, "advance", jobId)).data.job;
    assert.equal(failed.status, "failed");
    assert.equal(failed.failedStudents, 1);
    assert.equal(failed.completedTrials, 4, "the failed trials are not recorded");
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
    assert.equal(done.completedTrials, 14, "2 students × 7 trials, the pre-failure trials kept");

    const first = await studentResult(app, students[0].cookie);
    assert.equal(first.totalTrials, 7);
    assert.equal(first.errorCount, 0);
    assert.equal(first.correctCount, 7);
    assert.equal((await studentResult(app, students[1].cookie)).totalTrials, 7);
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
    for (const table of ["jev_jobs", "jev_job_items", "jev_batch_evaluations", "jev_auto_runs", "jev_auto_trials"]) {
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
    const jobId = (await startJob(app, roundId, 1)).data.job.id;

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
    assert.equal(afterFirst.status, "completed");

    const [item] = await d1All(app, "SELECT trials FROM jev_job_items WHERE job_id = ?", jobId);
    assert.deepEqual(JSON.parse(item.trials).map((t) => t.trialIndex), [0]);
    assert.equal((await studentResult(app, students[0].cookie)).totalTrials, 1);
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

test('teacher can read job snapshots and trial outcomes without rerunning the AI',async()=>{
 await withApp({},async(app)=>{
  const {roundId,students}=await closedMaxBoxRound(app,[CORRECT_ALGORITHM,NO_COMPARE_ALGORITHM]);
  const jobId=(await startJob(app,roundId,2)).data.job.id;
  const url=`${JOBS}?jobId=${jobId}`;
  await expectStatus(app,url,{},401);
  await expectStatus(app,url,{cookie:students[0].cookie},401);
  for(const invalid of ['0','abc','1.5',''])await expectStatus(app,`${JOBS}?jobId=${invalid}`,{teacher:true},400);
  await expectStatus(app,`${JOBS}?jobId=999999`,{teacher:true},404);
  const pending=(await expectStatus(app,url,{teacher:true},200)).data;
  assert.equal(pending.items.length,2);assert.ok(pending.items.every(i=>i.completedTrials===0));
  assert.ok(pending.items.every(i=>!('trials'in i)&&!('submissionText'in i)&&!('studentKey'in i)));
  await advanceUntilSettled(app,jobId);
  const calls=app.fake.calls;
  const response=await expectStatus(app,url,{teacher:true},200);
  assert.equal(response.response.headers.get('cache-control'),'no-store');
  const items=response.data.items;assert.equal(items.length,2);
  for(const item of items){
   assert.equal(item.status,'completed');assert.equal(item.completedTrials,2);assert.equal(item.correctCount+item.incorrectCount+item.errorCount,2);
   const detail=(await expectStatus(app,`${url}&itemId=${item.id}`,{teacher:true},200)).data.item;
   assert.equal(detail.trials.length,2);assert.equal(detail.submissionVersion,1);
   assert.equal(detail.submissionText,item.studentId===STUDENTS[0].studentId?CORRECT_ALGORITHM:NO_COMPARE_ALGORITHM);
   assert.ok(!('studentKey'in detail)&&!('token'in detail));
  }
  assert.equal(items.find(i=>i.studentId===STUDENTS[0].studentId).correctCount,2);
  const db=await app.getD1Database('DB');
  await db.prepare('UPDATE warmup_submissions SET algorithm_text=?,revision=revision+1 WHERE id=?').bind('newer text',students[0].submissionId).run();
  const original=(await expectStatus(app,`${url}&itemId=${items[0].id}`,{teacher:true},200)).data.item;
  assert.equal(original.submissionText,CORRECT_ALGORITHM);assert.equal(original.submissionVersion,1);
  const newer=(await startJob(app,roundId,1)).data.job.id;
  await expectStatus(app,`${JOBS}?jobId=${newer}&itemId=${items[0].id}`,{teacher:true},404);
  const [owner]=await d1All(app,'SELECT course_id AS courseId FROM jev_jobs WHERE id=?',newer);
  await db.prepare('UPDATE jev_jobs SET course_id=? WHERE id=?').bind(owner.courseId+100,newer).run();
  await expectStatus(app,`${JOBS}?jobId=${newer}`,{teacher:true},404);
  assert.equal(app.fake.calls,calls,'reading results and snapshots never invokes the AI');
 });
});

test('teacher results include saved partial trials while service failure remains separate',async()=>{
 await withApp({},async(app)=>{
  const {roundId}=await closedMaxBoxRound(app,[CORRECT_ALGORITHM]);
  const jobId=(await startJob(app,roundId,7)).data.job.id;
  app.fake.failNextCalls=1;
  const failed=(await jobAction(app,'advance',jobId)).data.job;assert.equal(failed.status,'failed');assert.equal(failed.completedTrials,4);
  const calls=app.fake.calls;
  const list=(await expectStatus(app,`${JOBS}?jobId=${jobId}`,{teacher:true},200)).data;
  const item=list.items[0];assert.equal(item.status,'failed');assert.equal(item.completedTrials,4);assert.equal(item.correctCount,4);assert.equal(item.errorCount,0);assert.ok(item.lastError);
  const detail=(await expectStatus(app,`${JOBS}?jobId=${jobId}&itemId=${item.id}`,{teacher:true},200)).data.item;
  assert.equal(detail.trials.length,4);assert.equal(app.fake.calls,calls);
 });
});
