import test from "node:test";
import assert from "node:assert/strict";
import { executeAlgorithm, splitCompoundStep, type IJevService, type JevStepEvaluation, type ActionType } from "../lib/jev";

test("splitCompoundStep: splits consecutive actions at connectives, keeping each clause's wording", () => {
  const cases: [string, string[]][] = [
    ["상자를 확인하고 메모지에 기록한다", ["상자를 확인하고", "메모지에 기록한다"]],
    ["상자를 확인하고, 메모지에 적는다.", ["상자를 확인하고,", "메모지에 적는다."]],
    ["상자를 확인하고 나서 메모지에 기록한다", ["상자를 확인하고 나서", "메모지에 기록한다"]],
    ["상자를 확인한 뒤 메모지에 기록한다", ["상자를 확인한 뒤", "메모지에 기록한다"]],
    ["상자를 확인한 후에 메모지에 기록한다", ["상자를 확인한 후에", "메모지에 기록한다"]],
    ["상자를 확인한다. 그리고 메모지에 기록한다.", ["상자를 확인한다.", "메모지에 기록한다."]],
    ["메모지에 적고 오른쪽으로 이동하고 상자를 확인한다", ["메모지에 적고", "오른쪽으로 이동하고", "상자를 확인한다"]],
  ];
  for (const [step, clauses] of cases) assert.deepEqual(splitCompoundStep(step), clauses, step);
});

test("splitCompoundStep: leaves single actions, loops, adjectives, quotes and progressives whole", () => {
  for (const step of [
    "상자를 확인한다",
    "방금 확인한 상자가 메모지보다 크면 메모지에 기록한다",
    "확인하지 않은 상자가 있으면 3단계부터 반복한다",
    "상자를 확인하고 3단계부터 반복한다",
    "메모지보다 크고 마지막 상자가 아니면 기록한다",
    "사과가 많다고 생각되면 기록한다",
    "상자를 확인하고 있는 동안 기록한다",
    "메모지에 적힌 수를 답으로 제출한다",
    "",
  ]) {
    assert.deepEqual(splitCompoundStep(step), [step.trim()], step);
  }
  // "다음" is a sequence word only right after an -ㄴ verb, not as "the next box".
  assert.deepEqual(splitCompoundStep("메모지에 기록하고 다음 상자로 이동한다"), ["메모지에 기록하고", "다음 상자로 이동한다"]);
});

/** Fake service answering each clause from a fixed table. */
function scripted(table: Record<string, Partial<JevStepEvaluation> & { action: ActionType }>): IJevService & { seen: string[] } {
  return {
    mode: "mock",
    seen: [],
    async evaluateStep({ stepIndex, stepText }) {
      this.seen.push(stepText);
      const entry = table[stepText];
      if (!entry) throw new Error(`unscripted clause: ${stepText}`);
      return { stepIndex, stepText, executable: true, confidence: 0.99, ...entry };
    },
  };
}

const CLAUSES = {
  "상자를 확인한다": { action: "MOVE", actionId: "CHECK_SELECTED_BOX" },
  "상자를 확인하고": { action: "MOVE", actionId: "CHECK_SELECTED_BOX" },
  "메모지에 기록한다": { action: "ASSIGN", actionId: "WRITE_MEMO" },
  "오른쪽으로 이동한다": { action: "MOVE", actionId: "MOVE_RIGHT_BOX" },
  "오른쪽으로 이동하고": { action: "MOVE", actionId: "MOVE_RIGHT_BOX" },
  "메모지보다 크면 메모지에 기록한다": { action: "COMPARE", actionId: "UPDATE_MEMO_IF_GREATER" },
  "확인하지 않은 상자가 있으면 2단계부터 반복한다": { action: "REPEAT", actionId: "REPEAT_STUDENT_STEPS" },
  "메모지의 수를 제출한다": { action: "OUTPUT", actionId: "SUBMIT_ANSWER" },
} as const;

test("compound steps run every clause in order under one step number, including inside loops", async () => {
  const service = scripted(CLAUSES);
  const result = await executeAlgorithm(
    [
      "상자를 확인하고 메모지에 기록한다",
      "오른쪽으로 이동하고 상자를 확인한다",
      "메모지보다 크면 메모지에 기록한다",
      "확인하지 않은 상자가 있으면 2단계부터 반복한다",
      "메모지의 수를 제출한다",
    ],
    { numbers: [7, 3, 12, 5, 9] },
    { service }
  );
  assert.equal(result.executable, true, result.failureReason);
  assert.equal(result.correct, true);
  assert.equal(result.finalState.output, 12);
  assert.deepEqual(service.seen.slice(0, 3), ["상자를 확인하고", "메모지에 기록한다", "오른쪽으로 이동하고"]);
  // Trace keeps the student's own step number for both clauses.
  assert.deepEqual(result.trace.slice(0, 2).map((t) => t.stepNumber), [1, 1]);
});

test("a failing clause fails its step number; a REPEAT fused with another action is refused", async () => {
  const bad = scripted({ ...CLAUSES, "메모지에 기록한다": { action: "UNKNOWN", executable: false, reason: "애매함" } });
  const failed = await executeAlgorithm(["상자를 확인하고 메모지에 기록한다", "메모지의 수를 제출한다"], undefined, { service: bad });
  assert.equal(failed.executable, false);
  assert.equal(failed.failedStep, 1);
  assert.equal(failed.failureReason, "애매함");
  assert.equal(failed.finalState.currentValue, 7, "the first clause already ran");

  const fused = scripted({ ...CLAUSES, "메모지에 적고": { action: "REPEAT", actionId: "REPEAT_STUDENT_STEPS" } });
  const refused = await executeAlgorithm(["상자를 확인한다", "메모지에 적고 오른쪽으로 이동한다"], undefined, { service: fused });
  assert.equal(refused.failedStep, 2);
  assert.match(refused.failureReason ?? "", /반복은 다른 행동과 나눠/);
});
