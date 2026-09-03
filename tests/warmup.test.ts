import assert from "node:assert/strict";
import test from "node:test";
import {
  isWarmupVoteType,
  WARMUP_VOTE_ICONS,
  WARMUP_VOTE_LABELS,
  WARMUP_VOTE_TYPES,
} from "../lib/warmupMeta.ts";
import { sanitizeCheckedSteps, splitAlgorithmIntoSteps } from "../lib/warmupSteps.ts";
import { getWarmupProblem, WARMUP_PROBLEMS } from "../lib/warmupProblems.ts";

test("source problem bank exposes unique, complete problems", () => {
  assert.ok(WARMUP_PROBLEMS.length > 0);
  assert.equal(new Set(WARMUP_PROBLEMS.map((problem) => problem.id)).size, WARMUP_PROBLEMS.length);
  for (const problem of WARMUP_PROBLEMS) {
    assert.ok(problem.title.length >= 2);
    assert.ok(problem.prompt.length >= 10);
    assert.equal(getWarmupProblem(problem.id), problem);
  }
  assert.equal(getWarmupProblem("unknown"), undefined);
});

test("WARMUP_VOTE_TYPES: exactly the 4 spec'd recommendation types, each with a short label and icon", () => {
  assert.equal(WARMUP_VOTE_TYPES.length, 4);
  for (const type of WARMUP_VOTE_TYPES) {
    assert.ok(WARMUP_VOTE_LABELS[type], `missing label for ${type}`);
    assert.ok(WARMUP_VOTE_LABELS[type].length <= 10, "labels should stay short");
    assert.ok(WARMUP_VOTE_ICONS[type], `missing icon for ${type}`);
  }
});

test("isWarmupVoteType: only accepts the 4 known types", () => {
  for (const type of WARMUP_VOTE_TYPES) assert.equal(isWarmupVoteType(type), true);
  assert.equal(isWarmupVoteType("bogus"), false);
  assert.equal(isWarmupVoteType(undefined), false);
  assert.equal(isWarmupVoteType(123), false);
});

test("splitAlgorithmIntoSteps: one step per non-empty line, trimmed", () => {
  const text = "1. 시작한다\n\n  2. 확인한다  \n3. 종료한다\n   \n";
  assert.deepEqual(splitAlgorithmIntoSteps(text), ["1. 시작한다", "2. 확인한다", "3. 종료한다"]);
});

test("splitAlgorithmIntoSteps: empty/whitespace-only text yields no steps", () => {
  assert.deepEqual(splitAlgorithmIntoSteps(""), []);
  assert.deepEqual(splitAlgorithmIntoSteps("   \n  \n"), []);
});

test("sanitizeCheckedSteps: keeps only in-range integers, dedups, sorts", () => {
  assert.deepEqual(sanitizeCheckedSteps([2, 0, 2, 1], 3), [0, 1, 2]);
});

test("sanitizeCheckedSteps: drops out-of-range, non-integer, and non-array input", () => {
  assert.deepEqual(sanitizeCheckedSteps([-1, 3, 1.5, "1", null, 1], 3), [1]);
  assert.deepEqual(sanitizeCheckedSteps("not-an-array", 3), []);
  assert.deepEqual(sanitizeCheckedSteps(undefined, 3), []);
});
