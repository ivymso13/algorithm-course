import test from "node:test";
import assert from "node:assert/strict";
import {
  MockJevService,
  JevService,
  JevApiError,
  JevConfigurationError,
  createJevService,
  executeAlgorithm,
  batchEvaluate,
  isJevInfrastructureError,
  MAX_EVALUATIONS_PER_RUN,
  NO_OUTPUT_REASON,
  DEFAULT_INITIAL_STATE,
  type IJevService,
  type JevStepEvaluation,
  type ActionType,
} from "../lib/jev";

const CORRECT_ALGORITHM = [
  "상자를 확인한다.",
  "메모지에 기록한다.",
  "오른쪽으로 이동한다.",
  "상자를 확인한다.",
  "방금 확인한 상자가 메모지보다 크면 메모지에 기록한다.",
  "확인하지 않은 상자가 있으면 3단계부터 반복한다.",
  "메모지에 적힌 사과 개수를 정답으로 제출한다.",
];

/** Fake service: answers each step text from a fixed table, counting calls. */
function scriptedService(
  table: Record<string, Partial<JevStepEvaluation> & { action: ActionType }>
): IJevService & { calls: number } {
  return {
    mode: "mock",
    calls: 0,
    async evaluateStep({ stepIndex, stepText }) {
      this.calls++;
      const entry = table[stepText];
      if (!entry) throw new Error(`unscripted step: ${stepText}`);
      return { stepIndex, stepText, executable: true, confidence: 0.99, ...entry };
    },
  };
}

// ---------- action resolution ----------

test("resolved actionId whose appliesWhen is false fails the step instead of applying it", async () => {
  // WRITE_MEMO requires a checked box (currentValue != null); nothing was checked.
  const service = scriptedService({ "메모지에 기록한다.": { action: "ASSIGN", actionId: "WRITE_MEMO" } });
  const result = await executeAlgorithm(["메모지에 기록한다."], undefined, { service });

  assert.equal(result.executable, false);
  assert.equal(result.failedStep, 1);
  assert.equal(result.finalState.maxVal, null, "memo must not be written with null");
  assert.match(result.failureReason ?? "", /지금 상태에서는/);
  assert.equal(result.trace[0].status, "failed");
});

test("unknown actionId is rejected, not silently resolved by category", async () => {
  const service = scriptedService({ "상자를 확인한다.": { action: "MOVE", actionId: "TELEPORT" } });
  const result = await executeAlgorithm(["상자를 확인한다."], undefined, { service });
  assert.equal(result.executable, false);
  assert.equal(result.failedStep, 1);
  assert.match(result.failureReason ?? "", /정의되지 않은 행동/);
});

test("executable step with no matching schema action is rejected (no silent no-op)", async () => {
  const service = scriptedService({ "두 수를 더한다.": { action: "CALCULATE" } });
  const result = await executeAlgorithm(["두 수를 더한다."], undefined, { service });
  assert.equal(result.executable, false);
  assert.equal(result.failedStep, 1);
});

test("category-only evaluation that matches several applicable actions is rejected as ambiguous", async () => {
  // At box 1: MOVE_RIGHT_BOX and CHECK_SELECTED_BOX both apply.
  const service = scriptedService({ "움직인다.": { action: "MOVE" } });
  const result = await executeAlgorithm(["움직인다."], undefined, { service });
  assert.equal(result.executable, false);
  assert.match(result.failureReason ?? "", /여러 가지/);
});

test("category-only evaluation resolves when exactly one action applies", async () => {
  const service = scriptedService({
    "상자를 확인한다.": { action: "MOVE", actionId: "CHECK_SELECTED_BOX" },
    "메모한다.": { action: "ASSIGN" }, // only WRITE_MEMO is ASSIGN
    "제출한다.": { action: "OUTPUT" },
  });
  const result = await executeAlgorithm(["상자를 확인한다.", "메모한다.", "제출한다."], { numbers: [5] }, { service });
  assert.equal(result.executable, true);
  assert.equal(result.correct, true);
});

test("fails closed when a service reports executable without a valid confidence", async () => {
  for (const confidence of [Number.NaN, undefined as unknown as number, 0.1]) {
    const service = scriptedService({ "상자를 확인한다.": { action: "MOVE", actionId: "CHECK_SELECTED_BOX", confidence } });
    const result = await executeAlgorithm(["상자를 확인한다."], undefined, { service });
    assert.equal(result.executable, false, `confidence ${confidence} must not execute`);
    assert.equal(result.finalState.currentValue, null);
  }
});

// ---------- output & termination ----------

test("no explicit output means not correct — the memo is never used as a fallback answer", async () => {
  const steps = CORRECT_ALGORITHM.slice(0, 6); // everything except the submit step
  const result = await executeAlgorithm(steps);
  assert.equal(result.executable, true);
  assert.equal(result.finalState.maxVal, 12, "memo holds the max...");
  assert.equal(result.finalState.output, null);
  assert.equal(result.correct, false, "...but nothing was submitted");
  assert.equal(result.failureReason, NO_OUTPUT_REASON);
});

test("STOP terminates execution: later steps are neither evaluated nor applied", async () => {
  const service = new MockJevService();
  let calls = 0;
  const counting: IJevService = {
    mode: "mock",
    evaluateStep: (p) => {
      calls++;
      return service.evaluateStep(p);
    },
  };
  const result = await executeAlgorithm(
    ["상자를 확인한다.", "메모지에 기록한다.", "메모지 값을 출력한다.", "종료한다.", "바꾼다."],
    { numbers: [3, 1] },
    { service: counting }
  );
  assert.equal(result.executable, true, "the ambiguous step after STOP never runs");
  assert.equal(result.correct, true);
  assert.equal(result.finalState.isTerminated, true);
  assert.equal(calls, 4);
  assert.equal(result.diagnostics.executedSteps, 4);
  assert.equal(result.trace.at(-1)?.logMessage, "→ 실행 종료");
});

// ---------- loops ----------

test("documented forward scan with explicit numbered start still solves every box count 1..12", async () => {
  for (let n = 1; n <= 12; n++) {
    const numbers = Array.from({ length: n }, (_, i) => ((i * 7 + 3) % 13) + 1);
    const result = await executeAlgorithm(CORRECT_ALGORITHM, { numbers });
    if (n === 1) {
      // Can't move right from the only box: an honest failure at step 3, not a crash.
      assert.equal(result.executable, false);
      assert.equal(result.failedStep, 3);
      continue;
    }
    assert.equal(result.executable, true, `n=${n}: ${result.failureReason}`);
    assert.equal(result.correct, true, `n=${n}`);
    assert.ok(result.diagnostics.evaluations.length <= MAX_EVALUATIONS_PER_RUN);
  }
});

test("REPEAT whose guard is already false runs zero iterations instead of failing appliesWhen", async () => {
  // Two boxes: after step 3 the robot is at the right edge.
  const result = await executeAlgorithm(CORRECT_ALGORITHM, { numbers: [4, 9] });
  assert.equal(result.executable, true);
  assert.equal(result.correct, true);
  assert.equal(result.trace.some((t) => t.iteration !== undefined), false);
});

test("'마지막 상자까지' is accepted as the same forward-scan condition", async () => {
  const steps = [...CORRECT_ALGORITHM];
  steps[5] = "마지막 상자까지 3단계부터 반복한다.";
  const result = await executeAlgorithm(steps);
  assert.equal(result.correct, true);
});

test("loop that never advances is rejected early as nonterminating, with the real failure state", async () => {
  const steps = [
    "상자를 확인한다.",
    "메모지에 기록한다.",
    "상자를 확인한다.", // body never moves right
    "확인하지 않은 상자가 있으면 3단계부터 반복한다.",
    "메모지에 적힌 사과 개수를 정답으로 제출한다.",
  ];
  const result = await executeAlgorithm(steps);
  assert.equal(result.executable, false);
  assert.equal(result.correct, null);
  assert.equal(result.failedStep, 4);
  assert.match(result.failureReason ?? "", /무한 반복/);
  assert.equal(result.finalState.currentValue, 7, "failure state is where the loop actually stood");
  assert.equal(result.finalState.output, null, "step 5 never ran");
  // Detected on the 2nd iteration, not after 1000.
  assert.ok(result.diagnostics.evaluations.length < 10, `evaluations: ${result.diagnostics.evaluations.length}`);
  assert.equal(result.trace.at(-1)?.status, "failed");
});

test("loop that oscillates (left then right) is also detected as nonterminating", async () => {
  const steps = [
    "상자를 확인한다.",
    "메모지에 기록한다.",
    "오른쪽으로 이동한다.",
    "왼쪽으로 이동한다.",
    "확인하지 않은 상자가 있으면 3단계부터 반복한다.",
    "메모지 값을 출력한다.",
  ];
  const result = await executeAlgorithm(steps);
  assert.equal(result.executable, false);
  assert.equal(result.failedStep, 5);
  assert.match(result.failureReason ?? "", /무한 반복/);
});

test("evaluation budget caps paid calls per run and fails instead of truncating silently", async () => {
  const numbers = Array.from({ length: 30 }, (_, i) => i + 1);
  const result = await executeAlgorithm(CORRECT_ALGORITHM, { numbers });
  assert.equal(result.executable, false);
  assert.equal(result.correct, null);
  assert.equal(result.diagnostics.evaluations.length, MAX_EVALUATIONS_PER_RUN);
  assert.match(result.failureReason ?? "", /한도\(60회\)/);
  assert.ok(result.failedStep !== null && result.failedStep >= 3 && result.failedStep <= 5, "fails inside the loop body");

  const small = await executeAlgorithm(CORRECT_ALGORITHM, { numbers }, { maxEvaluations: 5 });
  assert.equal(small.failedStep, 6);
  assert.equal(small.diagnostics.evaluations.length, 5);
});

test("unsupported loop semantics are rejected clearly, never replaced by right-edge traversal", async () => {
  const cases: Array<[string, RegExp]> = [
    ["3단계부터 반복한다.", /종료 조건/], // no condition
    ["남은 상자가 없으면 3단계부터 반복한다.", /종료 조건/], // negated condition
    ["확인하지 않은 상자가 있으면 3단계부터 4번 반복한다.", /횟수/], // counted loop
    ["확인하지 않은 상자가 있으면 3단계부터 4단계까지 반복한다.", /범위/], // range ends before step 5
    ["확인하지 않은 상자가 있으면 9단계부터 반복한다.", /시작할 단계/], // forward reference
  ];
  for (const [repeatText, reason] of cases) {
    const steps = [...CORRECT_ALGORITHM];
    steps[5] = repeatText;
    const result = await executeAlgorithm(steps);
    assert.equal(result.executable, false, repeatText);
    assert.equal(result.failedStep, 6, repeatText);
    assert.match(result.failureReason ?? "", reason, repeatText);
    assert.equal(result.finalState.output, null);
  }

  // Explicit full range ending right before the REPEAT step is fine.
  const steps = [...CORRECT_ALGORITHM];
  steps[5] = "확인하지 않은 상자가 있으면 3단계부터 5단계까지 반복한다.";
  assert.equal((await executeAlgorithm(steps)).correct, true);
});

test("failure inside a loop reports the inner step and the state at that moment", async () => {
  const service = new MockJevService();
  let checks = 0;
  // The 3rd time step 4 is evaluated, the service refuses it.
  const flaky: IJevService = {
    mode: "mock",
    async evaluateStep(p) {
      if (p.stepText === "상자를 확인한다." && p.stepIndex === 4 && ++checks === 3) {
        return { stepIndex: p.stepIndex, stepText: p.stepText, executable: false, confidence: 0.1, action: "UNKNOWN", reason: "모호함" };
      }
      return service.evaluateStep(p);
    },
  };
  const result = await executeAlgorithm(CORRECT_ALGORITHM, undefined, { service: flaky });
  assert.equal(result.executable, false);
  assert.equal(result.failedStep, 4);
  assert.equal(result.failureReason, "모호함");
  // 1st check: top-level step 4 (box 2); 2nd: loop iteration 1 (box 3); 3rd: iteration 2 (box 4).
  assert.equal(result.finalState.currentIndex, 3, "robot had already moved to box 4 inside the loop");
  assert.equal(result.finalState.maxVal, 12, "memo updated at box 3 during iteration 1 is preserved");
  assert.equal(result.finalState.currentValue, null, "box 4 was never checked");
  assert.equal(result.trace.at(-1)?.iteration, 2);
});

// ---------- infrastructure errors ----------

test("service errors propagate as infrastructure errors, not algorithm failures", async () => {
  const broken: IJevService = {
    mode: "jev-api",
    async evaluateStep() {
      throw new JevApiError("timeout", "Jev API 응답 시간이 초과되었습니다.");
    },
  };
  await assert.rejects(executeAlgorithm(CORRECT_ALGORITHM, undefined, { service: broken }), (e) => {
    assert.ok(isJevInfrastructureError(e));
    assert.equal((e as JevApiError).retryable, true);
    return true;
  });
  await assert.rejects(
    batchEvaluate(CORRECT_ALGORITHM, 3, () => ({ numbers: [1, 2], correctAnswer: 2 }), { service: broken }),
    JevApiError
  );
});

test("batchEvaluate exposes failureReason for failed and wrong trials only", async () => {
  const wrong = CORRECT_ALGORITHM.filter((_, i) => i !== 4); // no comparison in the loop
  const summary = await batchEvaluate(wrong, 2, () => ({ numbers: [5, 11, 9], correctAnswer: 11 }));
  assert.equal(summary.incorrectCount, 2);
  assert.match(summary.trials[0].failureReason ?? "", /5.*11/);

  const failing = await batchEvaluate(["바꾼다."], 1, () => ({ numbers: [1, 2], correctAnswer: 2 }));
  assert.equal(failing.errorCount, 1);
  assert.ok(failing.trials[0].failureReason);

  const ok = await batchEvaluate(CORRECT_ALGORITHM, 1, () => ({ numbers: [1, 2], correctAnswer: 2 }));
  assert.equal(ok.trials[0].failureReason, undefined);
});

// ---------- JevService with fake fetch ----------

const SECRET_KEY = "sk-test-secret-key";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const EVAL_PARAMS = {
  stepIndex: 1,
  stepText: "상자를 확인한다.",
  allSteps: ["상자를 확인한다."],
  currentState: { ...DEFAULT_INITIAL_STATE },
};

test("JevService: valid response resolves to a schema actionId, request is authenticated and abortable", async () => {
  let seen: RequestInit | undefined;
  const service = new JevService(SECRET_KEY, {
    fetchImpl: async (_url, init) => {
      seen = init;
      return jsonResponse({
        answers: { executable: { noul: 0.4 }, action_id: { choice: "CHECK_SELECTED_BOX", confidence: 0.97 } },
      });
    },
  });
  const res = await service.evaluateStep(EVAL_PARAMS);
  assert.equal(res.executable, true);
  assert.equal(res.actionId, "CHECK_SELECTED_BOX");
  assert.equal(res.confidence, 0.97);
  assert.ok(seen?.signal instanceof AbortSignal);
  assert.equal((seen?.headers as Record<string, string>).Authorization, `Bearer ${SECRET_KEY}`);
});

test("JevService: offers REPEAT as a choice even when its loop guard is already false", async () => {
  let criteria: Record<string, string> = {};
  const service = new JevService(SECRET_KEY, {
    fetchImpl: async (_url, init) => {
      criteria = JSON.parse(String(init?.body)).questions.action_id.criteria;
      return jsonResponse({
        answers: { executable: { noul: 0.9 }, action_id: { choice: "REPEAT_STUDENT_STEPS", confidence: 0.95 } },
      });
    },
  });
  const atRightEdge = { ...DEFAULT_INITIAL_STATE, currentIndex: DEFAULT_INITIAL_STATE.numbers.length - 1 };
  const res = await service.evaluateStep({ ...EVAL_PARAMS, currentState: atRightEdge });
  assert.ok("REPEAT_STUDENT_STEPS" in criteria);
  assert.equal(res.actionId, "REPEAT_STUDENT_STEPS");
});

test("JevService: missing or invalid confidence fails closed as invalid_response", async () => {
  const bodies = [
    {},
    { answers: { executable: { noul: 0.9 }, action_id: { choice: "CHECK_SELECTED_BOX" } } },
    { answers: { executable: { noul: 0.9 }, action_id: { choice: "CHECK_SELECTED_BOX", confidence: 1.7 } } },
    { answers: { action_id: { choice: "CHECK_SELECTED_BOX", confidence: 0.9 } } },
    { answers: { executable: { noul: "high" }, action_id: { choice: "CHECK_SELECTED_BOX", confidence: 0.9 } } },
  ];
  for (const body of bodies) {
    const service = new JevService(SECRET_KEY, { fetchImpl: async () => jsonResponse(body) });
    await assert.rejects(service.evaluateStep(EVAL_PARAMS), (e) => {
      assert.ok(e instanceof JevApiError);
      assert.equal(e.kind, "invalid_response");
      return true;
    }, JSON.stringify(body));
  }
});

test("JevService: HTTP errors are safe — no upstream body or key in the message", async () => {
  const service = new JevService(SECRET_KEY, {
    fetchImpl: async () => new Response(`internal trace; key=${SECRET_KEY}`, { status: 503 }),
  });
  await assert.rejects(service.evaluateStep(EVAL_PARAMS), (e) => {
    assert.ok(e instanceof JevApiError);
    assert.equal(e.kind, "http");
    assert.equal(e.status, 503);
    assert.equal(e.retryable, true);
    assert.ok(!e.message.includes(SECRET_KEY) && !e.message.includes("internal trace"));
    return true;
  });

  const badRequest = new JevService(SECRET_KEY, { fetchImpl: async () => new Response("nope", { status: 400 }) });
  await assert.rejects(badRequest.evaluateStep(EVAL_PARAMS), (e) => e instanceof JevApiError && !e.retryable);
});

test("JevService: bounded timeout aborts a hanging request", async () => {
  const service = new JevService(SECRET_KEY, {
    timeoutMs: 20,
    fetchImpl: (_url, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  });
  const started = Date.now();
  await assert.rejects(service.evaluateStep(EVAL_PARAMS), (e) => e instanceof JevApiError && e.kind === "timeout");
  assert.ok(Date.now() - started < 1000);
});

test("JevService: network failure maps to a safe network error; no internal retry", async () => {
  let calls = 0;
  const service = new JevService(SECRET_KEY, {
    fetchImpl: async () => {
      calls++;
      throw new TypeError(`connect ECONNREFUSED with ${SECRET_KEY}`);
    },
  });
  await assert.rejects(service.evaluateStep(EVAL_PARAMS), (e) => {
    assert.ok(e instanceof JevApiError);
    assert.equal(e.kind, "network");
    assert.ok(!e.message.includes(SECRET_KEY));
    return true;
  });
  assert.equal(calls, 1, "retries are the caller's job");
});

test("JevService: constructing without a key throws JevConfigurationError", () => {
  assert.throws(() => new JevService(""), JevConfigurationError);
});

// ---------- service factory ----------

test("createJevService: mock only when non-production AND USE_JEV_MOCK=true", () => {
  assert.equal(createJevService({ NODE_ENV: "development", USE_JEV_MOCK: "true" }).mode, "mock");
  assert.equal(createJevService({ USE_JEV_MOCK: "true" }).mode, "mock");
  assert.equal(createJevService({ NODE_ENV: "development", TYPESAFE_API_KEY: "k" }).mode, "jev-api");
  assert.equal(createJevService({ NODE_ENV: "production", TYPESAFE_API_KEY: "k" }).mode, "jev-api");
});

test("createJevService: no silent mock fallback — missing key or production mock throws typed error", () => {
  for (const env of [
    {},
    { NODE_ENV: "development" },
    { NODE_ENV: "development", USE_JEV_MOCK: "false", TYPESAFE_API_KEY: "   " },
    { NODE_ENV: "production" },
    { NODE_ENV: "production", USE_JEV_MOCK: "true" },
    { NODE_ENV: "production", USE_JEV_MOCK: "true", TYPESAFE_API_KEY: "k" },
  ]) {
    assert.throws(
      () => createJevService(env),
      (e) => e instanceof JevConfigurationError && e.code === "JEV_CONFIGURATION" && !/\bk\b/.test(e.message),
      JSON.stringify(env)
    );
  }
});
