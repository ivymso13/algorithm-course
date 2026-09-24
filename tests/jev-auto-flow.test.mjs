// End-to-end automatic JEV grading on student submit, against the built
// worker in Miniflare with a local fake of the TypeSafe endpoint (no real
// network, key or API cost). Covers registration atomicity, idempotence,
// superseding, the global 5-trial limit, fencing, leases, retries and the
// teacher job's reuse of automatic results.
import assert from "node:assert/strict";
import test from "node:test";
import {
  JOBS, CORRECT_ALGORITHM, NO_COMPARE_ALGORITHM, STUDENTS, withApp, requestJson, expectStatus, d1All,
  login, createRound, closeRound, submit, startJob, jobAction, advanceUntilSettled, studentResult,
  autoAction, AUTO, autoAdvance, autoStatus, openMaxBoxRound, autoUntilSettled, blockCalls,
} from "./support/jevHarness.mjs";

const runsOf = (app, roundId) =>
  d1All(app, "SELECT id, submission_id AS submissionId, submission_version AS version, status FROM jev_auto_runs WHERE round_id = ? ORDER BY id", roundId);
const trialsOf = (app, runId) =>
  d1All(app, "SELECT trial_index AS trialIndex, status, result FROM jev_auto_trials WHERE run_id = ? ORDER BY trial_index", runId);
const leasedSlots = async (app) => (await d1All(app, "SELECT count(*) AS n FROM jev_trial_slots WHERE lease_token IS NOT NULL"))[0].n;
const clearBackoff = async (app) => (await app.getD1Database("DB")).prepare("UPDATE jev_auto_runs SET next_attempt_at = 0").run();

test("submit registers the run and its 10 trials atomically; non-maxbox and invalid submissions cost nothing", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await openMaxBoxRound(app, [CORRECT_ALGORITHM]);
    const [run] = await runsOf(app, roundId);
    assert.deepEqual({ ...run, id: undefined }, { id: undefined, submissionId: students[0].submissionId, version: 1, status: "queued" });
    const trials = await trialsOf(app, run.id);
    assert.deepEqual(trials.map((t) => t.trialIndex), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.ok(trials.every((t) => t.status === "pending"));
    assert.equal(app.fake.calls, 0, "submitting never calls the API itself");

    const status = await autoStatus(app, students[0].cookie, roundId);
    assert.equal(status.status, "queued");
    assert.equal(status.totalTrials, 10);
    assert.equal(status.doneTrials, 0);
    await closeRound(app, roundId);

    // A non-maxbox round is untouched by automatic grading.
    const other = await createRound(app, "hidden-card");
    const cookie = await login(app, STUDENTS[1]);
    await submit(app, cookie, CORRECT_ALGORITHM);
    assert.deepEqual(await runsOf(app, other), []);
    await closeRound(app, other);

    // Text the engine refuses (41+ steps) is recorded as skipped: no trials, no calls.
    const third = await createRound(app);
    const tooManySteps = Array.from({ length: 45 }, (_, i) => `${i + 1}. 상자를 확인한다.`).join("\n");
    await submit(app, cookie, tooManySteps);
    const [skipped] = await runsOf(app, third);
    assert.equal(skipped.status, "skipped");
    assert.deepEqual(await trialsOf(app, skipped.id), []);
    const view = (await autoAdvance(app, cookie, third)).run;
    assert.equal(view.status, "skipped");
    assert.ok(view.message.includes("40"));
    assert.equal(app.fake.calls, 0);
  });
});

test("identical resubmits (sequential and concurrent) are idempotent: one revision, one run", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await openMaxBoxRound(app, [CORRECT_ALGORITHM]);
    const { cookie } = students[0];
    await autoAdvance(app, cookie, roundId); // 5 trials done
    await submit(app, cookie, CORRECT_ALGORITHM);
    const concurrent = await Promise.all(Array.from({ length: 5 }, () =>
      requestJson(app, "/api/warmup/submit", { method: "POST", cookie, body: { algorithmText: CORRECT_ALGORITHM } })));
    for (const { response } of concurrent) assert.equal(response.status, 200);

    const runs = await runsOf(app, roundId);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].version, 1);
    const [sub] = await d1All(app, "SELECT revision FROM warmup_submissions WHERE id = ?", students[0].submissionId);
    assert.equal(sub.revision, 1);
    assert.equal((await trialsOf(app, runs[0].id)).filter((t) => t.status === "done").length, 5, "finished trials are kept, not rerun");

    const done = await autoUntilSettled(app, cookie, roundId);
    assert.equal(done.status, "completed");
    assert.equal(done.result.totalTrials, 10);
    const calls = app.fake.calls;
    await submit(app, cookie, CORRECT_ALGORITHM);
    assert.equal((await autoAdvance(app, cookie, roundId)).run.status, "completed");
    assert.equal(app.fake.calls, calls, "resubmitting a graded text never pays again");
  });
});

test("one student's 10 trials run as two parallel waves; results are the student's own latest revision", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await openMaxBoxRound(app, [CORRECT_ALGORITHM, NO_COMPARE_ALGORITHM]);
    const [me, them] = students;

    const first = (await autoAdvance(app, me.cookie, roundId)).run;
    assert.equal(first.status, "running");
    assert.equal(first.doneTrials, 5, "first wave fills the 5 global slots with my own trials");
    const second = (await autoAdvance(app, me.cookie, roundId)).run;
    assert.equal(second.status, "completed");
    assert.equal(second.doneTrials, 10);
    assert.equal(second.result.totalTrials, 10);
    assert.equal(second.result.correctCount, 10);
    assert.equal(second.result.errorCount, 0);
    assert.equal(second.result.submissionText, CORRECT_ALGORITHM);
    assert.equal(await leasedSlots(app), 0, "every slot is released after a wave");

    const theirs = await autoUntilSettled(app, them.cookie, roundId);
    assert.equal(theirs.result.submissionText, NO_COMPARE_ALGORITHM, "never another student's result");
    assert.equal(theirs.result.totalTrials, 10);
    assert.deepEqual(await autoStatus(app, me.cookie, roundId), second);
  });
});

test("global limit: 8 students advancing at once never run more than 5 trials; every run completes exactly once", async () => {
  await withApp({}, async (app) => {
    const texts = STUDENTS.map((_, i) => (i % 2 ? NO_COMPARE_ALGORITHM : CORRECT_ALGORITHM));
    const { roundId, students } = await openMaxBoxRound(app, texts);

    const block = await blockCalls(app, 5);
    const wave = students.map((s) => autoAdvance(app, s.cookie, roundId));
    await block.reached();
    assert.equal(await leasedSlots(app), 5);
    // The teacher panel competing for slots gets none either.
    await autoAction(app, "auto-advance", roundId);
    assert.equal(app.fake.inFlight, 5);
    block.release();
    await Promise.all(wave);

    for (let round = 0; round < 30; round++) {
      const views = await Promise.all(students.map((s) => autoAdvance(app, s.cookie, roundId)));
      if (views.every((v) => v.run.status === "completed")) break;
    }
    assert.ok(app.fake.maxInFlight <= 5, `at most 5 concurrent API calls, saw ${app.fake.maxInFlight}`);
    const runs = await runsOf(app, roundId);
    assert.equal(runs.length, 8);
    for (const run of runs) {
      assert.equal(run.status, "completed");
      const trials = await trialsOf(app, run.id);
      assert.deepEqual(trials.map((t) => t.trialIndex), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      assert.ok(trials.every((t) => t.status === "done" && t.result));
    }
    const summary = await autoAction(app, "auto-status", roundId);
    assert.equal(summary.completed, 8);
    assert.equal(summary.doneTrials, 80);
    assert.equal(await leasedSlots(app), 0);
  });
});

test("changed resubmit supersedes the old run; a late result for the old revision is fenced out", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await openMaxBoxRound(app, [NO_COMPARE_ALGORITHM]);
    const { cookie, submissionId } = students[0];

    const block = await blockCalls(app, 5);
    const stale = autoAdvance(app, cookie, roundId);
    await block.reached();
    await submit(app, cookie, CORRECT_ALGORITHM);
    const runs = await runsOf(app, roundId);
    assert.deepEqual(runs.map((r) => [r.version, r.status]), [[1, "superseded"], [2, "queued"]]);
    assert.equal((await autoStatus(app, cookie, roundId)).submissionVersion, 2);

    const callsBeforeRelease = app.fake.calls;
    block.release();
    await stale;
    // All five old-revision trials were mid-call; none may commit and none may
    // start another call after noticing the new revision.
    assert.equal(app.fake.calls, callsBeforeRelease, "stale trials stop before their next API call");
    assert.ok((await trialsOf(app, runs[0].id)).every((t) => t.status !== "done"), "no result for the superseded revision");
    assert.equal(await leasedSlots(app), 0);

    const done = await autoUntilSettled(app, cookie, roundId);
    assert.equal(done.status, "completed");
    assert.equal(done.submissionVersion, 2);
    assert.equal(done.result.submissionText, CORRECT_ALGORITHM);
    assert.equal(done.result.correctCount, 10);
    const [sub] = await d1All(app, "SELECT revision FROM warmup_submissions WHERE id = ?", submissionId);
    assert.equal(sub.revision, 2);
  });
});

test("auth and isolation: session required, own course only, other courses' runs are never claimed", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await openMaxBoxRound(app, [CORRECT_ALGORITHM, NO_COMPARE_ALGORITHM]);
    await expectStatus(app, `${AUTO}?roundId=${roundId}`, {}, 401);
    await expectStatus(app, AUTO, { method: "POST", body: { roundId } }, 401);
    await expectStatus(app, JOBS, { method: "POST", body: { action: "auto-advance", roundId } }, 401);
    await expectStatus(app, JOBS, { method: "POST", cookie: students[0].cookie, body: { action: "auto-advance", roundId } }, 401);

    // A foreign course's round and queued run (same DB, different course).
    const db = await app.getD1Database("DB");
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO warmup_rounds (id, course_id, title, prompt, status, problem_id, created_at) VALUES (9001, 777, 't', 'p', 'open', 'max-box', ?)").bind(now).run();
    await db.prepare(`INSERT INTO warmup_submissions (id, round_id, student_key, student_id, student_name, anon_label, algorithm_text, revision, created_at, updated_at)
      VALUES (9001, 9001, 'x', 'x', 'x', 'a', ?, 1, ?, ?)`).bind(CORRECT_ALGORITHM, now, now).run();
    await db.prepare(`INSERT INTO jev_auto_runs (id, course_id, round_id, submission_id, submission_version, student_key, student_id, student_name, algorithm_text, mode, target_trials, status, created_at, updated_at)
      VALUES (9001, 777, 9001, 9001, 1, 'x', 'x', 'x', ?, 'jev-api', 1, 'queued', ?, ?)`).bind(CORRECT_ALGORITHM, now, now).run();
    await db.prepare("INSERT INTO jev_auto_trials (run_id, trial_index) VALUES (9001, 0)").run();
    await expectStatus(app, `${AUTO}?roundId=9001`, { cookie: students[0].cookie }, 404);
    await expectStatus(app, AUTO, { method: "POST", cookie: students[0].cookie, body: { roundId: 9001 } }, 404);
    await expectStatus(app, AUTO, { method: "POST", cookie: students[0].cookie, body: { roundId, action: "explode" } }, 400);

    // My advances drive my course's runs (mine first), and only ever report mine.
    const view = await autoUntilSettled(app, students[0].cookie, roundId);
    assert.equal(view.result.submissionText, CORRECT_ALGORITHM);
    const response = await autoAdvance(app, students[0].cookie, roundId);
    assert.deepEqual(Object.keys(response).sort(), ["run", "serviceUnavailable"]);
    assert.equal((await d1All(app, "SELECT status FROM jev_auto_trials WHERE run_id = 9001"))[0].status, "pending", "another course's work is never claimed");
    const bystander = await login(app, STUDENTS[2]);
    assert.equal(await autoStatus(app, bystander, roundId), null);
  });
});

test("an outage keeps finished trials, backs off visibly, gives up after repeated waves, and retry runs only the rest", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await openMaxBoxRound(app, [CORRECT_ALGORITHM]);
    const { cookie } = students[0];

    app.fake.failNextCalls = 1;
    const partial = (await autoAdvance(app, cookie, roundId)).run;
    assert.equal(partial.doneTrials, 4, "the four successful trials of the wave are saved");
    assert.equal(partial.status, "retrying");
    assert.ok(partial.message && !partial.message.includes("upstream secret"));
    assert.equal(partial.result, null, "an outage is never a result");

    const calls = app.fake.calls;
    assert.equal((await autoAdvance(app, cookie, roundId)).run.doneTrials, 4);
    assert.equal(app.fake.calls, calls, "backoff: no calls before the retry time");

    app.fake.failWithStatus = 503;
    let view;
    for (let i = 0; i < 6; i++) {
      await clearBackoff(app);
      view = (await autoAdvance(app, cookie, roundId)).run;
      if (view.status === "failed") break;
    }
    assert.equal(view.status, "failed", "gives up after repeated failed waves");
    assert.equal(view.doneTrials, 4);
    const failedCalls = app.fake.calls;
    await autoAdvance(app, cookie, roundId);
    assert.equal(app.fake.calls, failedCalls, "a failed run stays paused");

    app.fake.failWithStatus = null;
    const retried = (await autoAdvance(app, cookie, roundId, "retry")).run;
    assert.ok(["running", "completed"].includes(retried.status));
    const done = await autoUntilSettled(app, cookie, roundId);
    assert.equal(done.status, "completed");
    assert.equal(done.result.totalTrials, 10);
    assert.equal(done.result.correctCount, 10, "the outage never counted as a wrong answer");
    assert.equal(done.result.errorCount, 0);
  });
});

test("an expired lease lets another request take over the trial and slot; the old holder cannot commit", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await openMaxBoxRound(app, [CORRECT_ALGORITHM]);
    const { cookie } = students[0];

    const block = await blockCalls(app, 5);
    const stale = autoAdvance(app, cookie, roundId);
    await block.reached();
    assert.equal(await leasedSlots(app), 5);
    // Simulate the stale request's leases running out (e.g. the tab closed mid-wave).
    const db = await app.getD1Database("DB");
    await db.prepare("UPDATE jev_trial_slots SET lease_until = 1").run();
    await db.prepare("UPDATE jev_auto_trials SET lease_until = 1 WHERE status = 'running'").run();

    block.open();
    const takeover = (await autoAdvance(app, cookie, roundId)).run;
    assert.equal(takeover.doneTrials, 5, "expired trials and slots are reclaimed");
    const callsBeforeRelease = app.fake.calls;
    block.release();
    await stale;
    assert.equal(app.fake.calls, callsBeforeRelease, "the old holder makes no further calls");
    const trials = (await runsOf(app, roundId))[0];
    const rows = await trialsOf(app, trials.id);
    assert.equal(rows.filter((t) => t.status === "done").length, 5, "the old holder committed nothing on top");
    assert.equal(await leasedSlots(app), 0);
    const done = await autoUntilSettled(app, cookie, roundId);
    assert.equal(done.result.totalTrials, 10);
  });
});

test("teacher cancel fences in-flight trials; resume finishes only the rest", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await openMaxBoxRound(app, [CORRECT_ALGORITHM]);
    const { cookie } = students[0];
    await autoAdvance(app, cookie, roundId);

    const block = await blockCalls(app, 5);
    const stale = autoAdvance(app, cookie, roundId);
    await block.reached();
    const cancelled = await autoAction(app, "auto-cancel", roundId);
    assert.equal(cancelled.cancelled, 1);
    assert.equal(await leasedSlots(app), 5, "cancel never frees a slot whose holder is still mid-call");
    block.release();
    await stale;
    assert.equal(await leasedSlots(app), 0, "holders free their slots once they stop");
    const view = await autoStatus(app, cookie, roundId);
    assert.equal(view.status, "cancelled");
    assert.equal(view.doneTrials, 5, "no trial committed after cancel");
    const calls = app.fake.calls;
    await autoAdvance(app, cookie, roundId);
    await autoAction(app, "auto-advance", roundId);
    assert.equal(app.fake.calls, calls, "a cancelled run makes no calls");

    const resumed = await autoAction(app, "auto-resume", roundId);
    assert.equal(resumed.queued + resumed.running, 1);
    const done = await autoUntilSettled(app, cookie, roundId);
    assert.equal(done.status, "completed");
    assert.equal(done.result.totalTrials, 10);
  });
});

test("teacher job reuses completed automatic results and drives unfinished ones instead of paying twice", async () => {
  await withApp({}, async (app) => {
    const { roundId, students } = await openMaxBoxRound(app, [CORRECT_ALGORITHM, NO_COMPARE_ALGORITHM, CORRECT_ALGORITHM]);
    const [graded, pending, extra] = students;
    await autoUntilSettled(app, graded.cookie, roundId);
    await closeRound(app, roundId);
    const autoResults = async (cookieIndex) => {
      const run = (await runsOf(app, roundId))[cookieIndex];
      return (await trialsOf(app, run.id)).map((t) => JSON.parse(t.result).numbers);
    };

    const jobId = (await startJob(app, roundId, 10)).data.job.id;
    const calls = app.fake.calls;
    const first = (await jobAction(app, "advance", jobId)).data.job;
    assert.equal(first.completedStudents, 1);
    assert.equal(first.completedTrials, 10);
    assert.equal(app.fake.calls, calls, "a completed automatic result is reused, not rerun");
    const [item] = await d1All(app, "SELECT trials FROM jev_job_items WHERE job_id = ? AND submission_id = ?", jobId, graded.submissionId);
    assert.deepEqual(JSON.parse(item.trials).map((t) => t.numbers), await autoResults(0));

    const done = await advanceUntilSettled(app, jobId);
    assert.equal(done.status, "completed");
    assert.equal(done.completedTrials, 30);
    for (const [index, student] of [[1, pending], [2, extra]].values()) {
      const run = (await runsOf(app, roundId))[index];
      assert.equal(run.status, "completed", "the job drove the student's own run to completion");
      const [row] = await d1All(app, "SELECT trials FROM jev_job_items WHERE job_id = ? AND submission_id = ?", jobId, student.submissionId);
      assert.deepEqual(JSON.parse(row.trials).map((t) => t.numbers), await autoResults(index), "same trials, no duplicate work");
    }
    assert.equal((await d1All(app, "SELECT count(*) AS n FROM jev_auto_trials WHERE status = 'done'"))[0].n, 30);

    const teacherView = await studentResult(app, graded.cookie);
    assert.equal(teacherView.totalTrials, 10);
    assert.equal(teacherView.submissionText, CORRECT_ALGORITHM);

    // More trials than the automatic 10: reuse 10, run only the remainder.
    const bigger = (await startJob(app, roundId, 12)).data.job.id;
    const before = app.fake.calls;
    const job = await advanceUntilSettled(app, bigger);
    assert.equal(job.completedTrials, 36);
    assert.ok(app.fake.calls > before);
    const [row] = await d1All(app, "SELECT trials FROM jev_job_items WHERE job_id = ? AND submission_id = ?", bigger, graded.submissionId);
    const trials = JSON.parse(row.trials);
    assert.deepEqual(trials.map((t) => t.trialIndex), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    assert.deepEqual(trials.slice(0, 10).map((t) => t.numbers), await autoResults(0));
  });
});

test("without a configured service the submission still saves and grading waits without calling anything", async () => {
  await withApp({ bindings: {} }, async (app) => {
    const { roundId, students } = await openMaxBoxRound(app, [CORRECT_ALGORITHM]);
    const response = await autoAdvance(app, students[0].cookie, roundId);
    assert.equal(response.serviceUnavailable, true);
    assert.equal(response.run.status, "queued");
    assert.equal(app.fake.calls, 0);
    assert.equal(await leasedSlots(app), 0);
  });
});
