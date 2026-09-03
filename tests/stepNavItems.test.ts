import assert from "node:assert/strict";
import test from "node:test";
import { computeStepNavItems } from "../components/write/stepNavItems.ts";

function byNumber(items: ReturnType<typeof computeStepNavItems>, number: 1 | 2 | 3 | 4) {
  return items.find((item) => item.number === number)!;
}

test("computeStepNavItems: steps 1 and 2 are never locked, regardless of submission status", () => {
  for (const hasSubmitted of [true, false]) {
    for (const currentStep of [1, 2, 3, 4] as const) {
      const items = computeStepNavItems(currentStep, hasSubmitted);
      assert.equal(byNumber(items, 1).isLocked, false);
      assert.equal(byNumber(items, 2).isLocked, false);
    }
  }
});

test("computeStepNavItems: steps 3 and 4 are locked until the algorithm is submitted", () => {
  const items = computeStepNavItems(1, false);
  assert.equal(byNumber(items, 3).isLocked, true);
  assert.equal(byNumber(items, 4).isLocked, true);
});

test("computeStepNavItems: steps 3 and 4 unlock once submitted, from any current step", () => {
  for (const currentStep of [1, 2, 3, 4] as const) {
    const items = computeStepNavItems(currentStep, true);
    assert.equal(byNumber(items, 3).isLocked, false);
    assert.equal(byNumber(items, 4).isLocked, false);
  }
});

test("computeStepNavItems: a student on step 3 or 4 can always navigate back to steps 1 and 2 (never current, never locked)", () => {
  for (const currentStep of [3, 4] as const) {
    const items = computeStepNavItems(currentStep, true);
    assert.equal(byNumber(items, 1).isCurrent, false);
    assert.equal(byNumber(items, 1).isLocked, false);
    assert.equal(byNumber(items, 2).isCurrent, false);
    assert.equal(byNumber(items, 2).isLocked, false);
  }
});

test("computeStepNavItems: a student on step 4 can always navigate back to step 3 once submitted", () => {
  const items = computeStepNavItems(4, true);
  const step3 = byNumber(items, 3);
  assert.equal(step3.isCurrent, false);
  assert.equal(step3.isLocked, false);
});

test("computeStepNavItems: exactly one step is marked current, matching the given currentStep", () => {
  for (const currentStep of [1, 2, 3, 4] as const) {
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
  assert.equal(byNumber(computeStepNavItems(4, true), 2).isCompleted, true);
});

test("computeStepNavItems: hrefs point at the 4 intended routes", () => {
  const items = computeStepNavItems(1, false);
  assert.deepEqual(
    items.map((i) => i.href),
    ["/write", "/write/algorithm", "/write/explore", "/execute"]
  );
});
