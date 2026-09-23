import test from "node:test";
import assert from "node:assert/strict";
import {
  MockJevService,
  executeAlgorithm,
  batchEvaluate,
  JEV_EXECUTION_THRESHOLD,
  DEFAULT_INITIAL_STATE,
} from "../lib/jev";

test("MockJevService: evaluates valid algorithm steps with high confidence", async () => {
  const service = new MockJevService();
  const state = { ...DEFAULT_INITIAL_STATE };

  const s1 = await service.evaluateStep({
    stepIndex: 1,
    stepText: "첫 번째 숫자를 최댓값으로 정한다.",
    allSteps: ["첫 번째 숫자를 최댓값으로 정한다."],
    currentState: state,
  });
  assert.equal(s1.executable, true);
  assert.equal(s1.action, "ASSIGN");
  assert.ok(s1.confidence >= JEV_EXECUTION_THRESHOLD);

  const s2 = await service.evaluateStep({
    stepIndex: 2,
    stepText: "다음 숫자를 확인한다.",
    allSteps: ["다음 숫자를 확인한다."],
    currentState: state,
  });
  assert.equal(s2.executable, true);
  assert.equal(s2.action, "MOVE");
  assert.ok(s2.confidence >= JEV_EXECUTION_THRESHOLD);

  const s3 = await service.evaluateStep({
    stepIndex: 3,
    stepText: "현재 최댓값보다 크면 최댓값을 그 숫자로 변경한다.",
    allSteps: ["현재 최댓값보다 크면 최댓값을 그 숫자로 변경한다."],
    currentState: state,
  });
  assert.equal(s3.executable, true);
  assert.equal(s3.action, "COMPARE");
  assert.ok(s3.confidence >= JEV_EXECUTION_THRESHOLD);

  const s4 = await service.evaluateStep({
    stepIndex: 4,
    stepText: "확인하지 않은 숫자가 있으면 2단계부터 반복한다.",
    allSteps: ["확인하지 않은 숫자가 있으면 2단계부터 반복한다."],
    currentState: state,
  });
  assert.equal(s4.executable, true);
  assert.equal(s4.action, "REPEAT");
  assert.ok(s4.confidence >= JEV_EXECUTION_THRESHOLD);

  const s5 = await service.evaluateStep({
    stepIndex: 5,
    stepText: "현재 최댓값을 출력한다.",
    allSteps: ["현재 최댓값을 출력한다."],
    currentState: state,
  });
  assert.equal(s5.executable, true);
  assert.equal(s5.action, "OUTPUT");
  assert.ok(s5.confidence >= JEV_EXECUTION_THRESHOLD);
});

test("MockJevService: Rule 1 & 2 - fails on ambiguous target without guessing ('큰 것으로 바꾼다', '바꾼다')", async () => {
  const service = new MockJevService();
  const state = { ...DEFAULT_INITIAL_STATE };

  const res1 = await service.evaluateStep({
    stepIndex: 1,
    stepText: "큰 것으로 바꾼다.",
    allSteps: ["큰 것으로 바꾼다."],
    currentState: state,
  });
  assert.equal(res1.executable, false);
  assert.equal(res1.action, "UNKNOWN");
  assert.ok(res1.confidence < JEV_EXECUTION_THRESHOLD);

  const res2 = await service.evaluateStep({
    stepIndex: 1,
    stepText: "바꾼다.",
    allSteps: ["바꾼다."],
    currentState: state,
  });
  assert.equal(res2.executable, false);
  assert.equal(res2.action, "UNKNOWN");

  const res3 = await service.evaluateStep({
    stepIndex: 3,
    stepText: "현재 최댓값보다 크면 바꾼다.",
    allSteps: ["현재 최댓값보다 크면 바꾼다."],
    currentState: state,
  });
  assert.equal(res3.executable, false);
  assert.equal(res3.action, "UNKNOWN");
});

test("MockJevService: Rule 3 - fails on vague conditions ('적당하면 바꾼다')", async () => {
  const service = new MockJevService();
  const state = { ...DEFAULT_INITIAL_STATE };

  const res = await service.evaluateStep({
    stepIndex: 1,
    stepText: "적당하면 바꾼다.",
    allSteps: ["적당하면 바꾼다."],
    currentState: state,
  });
  assert.equal(res.executable, false);
  assert.equal(res.action, "UNKNOWN");
  assert.match(res.reason ?? "", /조건이 불명확/);
});

test("MockJevService: Rule 4 - fails on unclear loop range or termination ('계속 반복한다')", async () => {
  const service = new MockJevService();
  const state = { ...DEFAULT_INITIAL_STATE };

  const res = await service.evaluateStep({
    stepIndex: 2,
    stepText: "계속 반복한다.",
    allSteps: ["계속 반복한다."],
    currentState: state,
  });
  assert.equal(res.executable, false);
  assert.equal(res.action, "UNKNOWN");
  assert.match(res.reason ?? "", /반복 범위 또는 종료 조건이 불명확/);
});

test("MockJevService: Rule 6 - custom threshold blocks steps below threshold", async () => {
  const service = new MockJevService();
  const state = { ...DEFAULT_INITIAL_STATE };

  // Confidence for "다음 숫자를 확인한다" is 0.95. If threshold is 0.99, it should fail.
  const res = await service.evaluateStep({
    stepIndex: 2,
    stepText: "다음 숫자를 확인한다.",
    allSteps: ["다음 숫자를 확인한다."],
    currentState: state,
    threshold: 0.99,
  });
  assert.equal(res.executable, false);
});

test("executeAlgorithm: complete valid algorithm executes successfully and finds maximum 12", async () => {
  const steps = [
    "상자를 확인한다.",
    "메모지에 기록한다.",
    "오른쪽으로 이동한다.",
    "상자를 확인한다.",
    "방금 확인한 상자가 메모지보다 크면 메모지에 기록한다.",
    "확인하지 않은 상자가 있으면 3단계부터 반복한다.",
    "메모지에 적힌 사과 개수를 정답으로 제출한다.",
  ];

  const result = await executeAlgorithm(steps);

  assert.equal(result.executable, true);
  assert.equal(result.correct, true);
  assert.equal(result.failedStep, null);
  assert.equal(result.finalState.maxVal, 12);
  assert.equal(result.finalState.output, 12);
  assert.ok(result.trace.length > 5, "Trace should record step executions and iterations");
  assert.equal(result.trace.every((t) => t.status === "success"), true);
});

test("executeAlgorithm: REPEAT replays exactly the student's own referenced steps, not a system-known strategy — an incomplete loop body honestly produces a wrong answer", async () => {
  // Same shape as the algorithm above, but the repeated range (steps 3-4)
  // only moves and checks — it never includes the comparison step. If the
  // engine were silently completing the "keep the max" strategy on the
  // student's behalf, this would still land on 12. It must not: the memo
  // is only ever written once (step 2, with the first box's count) and is
  // never touched again during the replay, so the submitted answer should
  // honestly come out wrong.
  const steps = [
    "상자를 확인한다.",
    "메모지에 기록한다.",
    "오른쪽으로 이동한다.",
    "상자를 확인한다.",
    "확인하지 않은 상자가 있으면 3단계부터 반복한다.",
    "메모지에 적힌 사과 개수를 정답으로 제출한다.",
  ];

  const result = await executeAlgorithm(steps);

  assert.equal(result.executable, true, "a syntactically valid but strategically incomplete algorithm should still run to completion");
  assert.equal(result.finalState.maxVal, 7, "memo was only ever written once, at the first box (7) — the replayed range never compares");
  assert.equal(result.finalState.output, 7);
  assert.equal(result.correct, false, "7 is not the true max (12) — an honest wrong answer, not a silently-corrected one");
});

test("executeAlgorithm: REPEAT fails closed when the referenced step number is missing or unclear", async () => {
  const steps = [
    "상자를 확인한다.",
    "메모지에 기록한다.",
    "오른쪽으로 이동한다.",
    "상자를 확인한다.",
    "확인하지 않은 상자가 있으면 반복한다.", // no "N단계부터" — ambiguous range
  ];

  const result = await executeAlgorithm(steps);

  assert.equal(result.executable, false);
  assert.equal(result.correct, null);
  assert.equal(result.failedStep, 5);
});

test("executeAlgorithm: halts immediately at failed step and leaves subsequent steps unexecuted", async () => {
  const steps = [
    "첫 번째 숫자를 최댓값으로 정한다.",
    "다음 숫자를 확인한다.",
    "현재 최댓값보다 크면 바꾼다.", // Ambiguous target -> failure
    "확인하지 않은 숫자가 있으면 2단계부터 반복한다.",
    "현재 최댓값을 출력한다.",
  ];

  const result = await executeAlgorithm(steps);

  assert.equal(result.executable, false);
  assert.equal(result.correct, null);
  assert.equal(result.failedStep, 3);
  assert.equal(result.trace.length, 3); // Steps 1, 2, and failed 3
  assert.equal(result.trace[2].status, "failed");
  assert.equal(result.trace[2].stepNumber, 3);
});

test("executeAlgorithm: distinguishes executable=true and correct=false for incomplete search", async () => {
  // An algorithm that only checks the first box and immediately outputs it
  const steps = ["상자를 확인한다.", "메모지에 기록한다.", "메모지 값을 출력한다."];

  const result = await executeAlgorithm(steps);

  assert.equal(result.executable, true);
  assert.equal(result.correct, false); // 7 is not max (12 is)
  assert.equal(result.failedStep, null);
  assert.equal(result.finalState.output, 7);
});

test("executeAlgorithm: handles empty input gracefully", async () => {
  const result = await executeAlgorithm([]);
  assert.equal(result.executable, false);
  assert.equal(result.failedStep, null);
  assert.equal(result.trace.length, 0);
});

test("API route POST /api/jev/execute returns execution result with mock fallback", async () => {
  const { POST } = await import("../app/api/jev/execute/route");
  const req = new Request("http://localhost/api/jev/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      steps: [
        "첫 번째 숫자를 최댓값으로 정한다.",
        "다음 숫자를 확인한다.",
        "현재 최댓값보다 크면 바꾼다.",
      ],
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 200);
  const data = (await res.json()) as { executable: boolean; failedStep: number };
  assert.equal(data.executable, false);
  assert.equal(data.failedStep, 3);
});


test("batchEvaluate: a correct algorithm scores 100% correct across many randomized instances", async () => {
  const steps = [
    "상자를 확인한다.",
    "메모지에 기록한다.",
    "오른쪽으로 이동한다.",
    "상자를 확인한다.",
    "방금 확인한 상자가 메모지보다 크면 메모지에 기록한다.",
    "확인하지 않은 상자가 있으면 3단계부터 반복한다.",
    "메모지에 적힌 사과 개수를 정답으로 제출한다.",
  ];

  let call = 0;
  const summary = await batchEvaluate(
    steps,
    10,
    () => {
      call++;
      // A different length and shuffled-ish arrangement each trial, so this
      // isn't just re-running the same fixed instance ten times.
      const len = 3 + (call % 4); // 3..6 elements
      const numbers = Array.from({ length: len }, (_, i) => ((i * 7 + call * 3) % 23) + 1);
      return { numbers, correctAnswer: Math.max(...numbers) };
    },
    { concurrency: 3 }
  );

  assert.equal(summary.totalTrials, 10);
  assert.equal(summary.correctCount, 10, "a correct algorithm should generalize to every randomized instance");
  assert.equal(summary.incorrectCount, 0);
  assert.equal(summary.errorCount, 0);
});

test("batchEvaluate: an algorithm missing the loop's comparison is unreliable across randomized instances", async () => {
  // Same "오답" shape as the single-run test above — the repeated range
  // (steps 3-4) never compares, so the memo only ever holds the FIRST box's
  // count. Instances are built so the first box is never the max, so this
  // is wrong on every single trial, not just some.
  const steps = [
    "상자를 확인한다.",
    "메모지에 기록한다.",
    "오른쪽으로 이동한다.",
    "상자를 확인한다.",
    "확인하지 않은 상자가 있으면 3단계부터 반복한다.",
    "메모지에 적힌 사과 개수를 정답으로 제출한다.",
  ];

  const summary = await batchEvaluate(
    steps,
    8,
    () => ({ numbers: [5, 11, 9, 14, 8], correctAnswer: 14 }),
    { concurrency: 3 }
  );

  assert.equal(summary.totalTrials, 8);
  assert.equal(summary.correctCount, 0, "an incomplete algorithm should honestly fail every trial, not get bailed out by luck");
  assert.equal(summary.incorrectCount, 8);
  assert.equal(summary.trials.every((t) => t.finalAnswer === 5), true, "memo was only ever written once, at the first box");
});
