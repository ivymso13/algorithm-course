import assert from "node:assert/strict";
import test from "node:test";
import { computeStepNavItems } from "../components/write/stepNavItems.ts";

function byNumber(items: ReturnType<typeof computeStepNavItems>, number: 1 | 2 | 3) {
  return items.find((item) => item.number === number)!;
}

test("computeStepNavItems: the flow has exactly 3 steps — peer-algorithm 체험 (/execute) is not a numbered step", () => {
  const items = computeStepNavItems(1, false);
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((i) => i.number),
    [1, 2, 3]
  );
});

test("computeStepNavItems: no label repeats its own step number (regression for the '3 3 아이디어·추천' duplicate-digit bug)", () => {
  for (const item of computeStepNavItems(1, true)) {
    assert.ok(
      !item.label.trimStart().startsWith(String(item.number)),
      `label for step ${item.number} must not start with its own number: ${JSON.stringify(item.label)}`
    );
  }
});

test("computeStepNavItems: hrefs point at the 3 intended routes, in order", () => {
  const items = computeStepNavItems(1, false);
  assert.deepEqual(
    items.map((i) => i.href),
    ["/write", "/write/algorithm", "/write/explore"]
  );
});

test("computeStepNavItems: steps 1 and 2 are never locked, regardless of submission status", () => {
  for (const hasSubmitted of [true, false]) {
    for (const currentStep of [1, 2, 3] as const) {
      const items = computeStepNavItems(currentStep, hasSubmitted);
      assert.equal(byNumber(items, 1).isLocked, false);
      assert.equal(byNumber(items, 2).isLocked, false);
    }
  }
});

test("computeStepNavItems: step 3 is locked until the algorithm is submitted", () => {
  const items = computeStepNavItems(1, false);
  assert.equal(byNumber(items, 3).isLocked, true);
});

test("computeStepNavItems: step 3 unlocks once submitted, from any current step", () => {
  for (const currentStep of [1, 2, 3] as const) {
    const items = computeStepNavItems(currentStep, true);
    assert.equal(byNumber(items, 3).isLocked, false);
  }
});

test("computeStepNavItems: a student on step 3 can always navigate back to steps 1 and 2 (never current, never locked)", () => {
  const items = computeStepNavItems(3, true);
  assert.equal(byNumber(items, 1).isCurrent, false);
  assert.equal(byNumber(items, 1).isLocked, false);
  assert.equal(byNumber(items, 2).isCurrent, false);
  assert.equal(byNumber(items, 2).isLocked, false);
});

test("computeStepNavItems: exactly one step is marked current, matching the given currentStep", () => {
  for (const currentStep of [1, 2, 3] as const) {
    const items = computeStepNavItems(currentStep, true);
    const current = items.filter((item) => item.isCurrent);
    assert.equal(current.length, 1);
    assert.equal(current[0].number, currentStep);
  }
});

test("computeStepNavItems: step 1 shows completed once the student has moved past it or submitted", () => {
  assert.equal(byNumber(computeStepNavItems(1, false), 1).isCompleted, false);
  assert.equal(byNumber(computeStepNavItems(2, false), 1).isCompleted, true);
  assert.equal(byNumber(computeStepNavItems(1, true), 1).isCompleted, true);
});

test("computeStepNavItems: step 2 shows completed only once submitted, regardless of current step", () => {
  assert.equal(byNumber(computeStepNavItems(2, false), 2).isCompleted, false);
  assert.equal(byNumber(computeStepNavItems(2, true), 2).isCompleted, true);
  assert.equal(byNumber(computeStepNavItems(3, true), 2).isCompleted, true);
});

test("computeStepNavItems: step 3 (terminal step) is never marked completed", () => {
  for (const currentStep of [1, 2, 3] as const) {
    for (const hasSubmitted of [true, false]) {
      assert.equal(byNumber(computeStepNavItems(currentStep, hasSubmitted), 3).isCompleted, false);
    }
  }
});
