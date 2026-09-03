import assert from "node:assert/strict";
import test from "node:test";
import { studentKeyOf } from "../lib/assignments.ts";
import { WARMUP_PROBLEMS } from "../lib/warmupProblems.ts";
import {
  demoStudentKey,
  getDemoAlgorithmsForProblem,
  isDemoStudentKey,
  resolveDemoProblemId,
  WARMUP_DEMO_SUBMISSIONS_ENABLED,
} from "../lib/warmupDemoAlgorithms.ts";

test("resolveDemoProblemId: restores the source id for a legacy round without problemId", () => {
  const problem = WARMUP_PROBLEMS[0];
  assert.equal(
    resolveDemoProblemId({ problemId: null, title: problem.title, prompt: problem.prompt }),
    problem.id
  );
});

test("getDemoAlgorithmsForProblem: every source problem has exactly 3 examples, labeled A/B/C, each with real content", () => {
  for (const problem of WARMUP_PROBLEMS) {
    const examples = getDemoAlgorithmsForProblem(problem.id);
    assert.ok(examples, `missing demo set for ${problem.id}`);
    assert.equal(examples!.length, 3);
    assert.deepEqual(
      examples!.map((e) => e.label),
      ["A", "B", "C"]
    );
    for (const example of examples!) {
      assert.ok(example.algorithmText.trim().length >= 10, `${problem.id}/${example.label} too short`);
      // Each example should read as its own numbered algorithm, not a stub.
      assert.match(example.algorithmText, /^1\./);
    }
  }
});

test("getDemoAlgorithmsForProblem: the 3 examples for one problem are genuinely different from each other", () => {
  for (const problem of WARMUP_PROBLEMS) {
    const examples = getDemoAlgorithmsForProblem(problem.id)!;
    const texts = examples.map((e) => e.algorithmText);
    assert.equal(new Set(texts).size, 3, `${problem.id} has duplicate example text`);
  }
});

test("getDemoAlgorithmsForProblem: returns undefined for an unknown or null problemId", () => {
  assert.equal(getDemoAlgorithmsForProblem("not-a-real-problem"), undefined);
  assert.equal(getDemoAlgorithmsForProblem(null), undefined);
});

test("demoStudentKey: distinct per problem and per label", () => {
  const a = demoStudentKey("fake-coin", "A");
  const b = demoStudentKey("fake-coin", "B");
  const otherProblem = demoStudentKey("josephus", "A");
  assert.notEqual(a, b);
  assert.notEqual(a, otherProblem);
});

test("isDemoStudentKey: recognizes keys produced by demoStudentKey", () => {
  assert.equal(isDemoStudentKey(demoStudentKey("pancake-sort", "C")), true);
});

test("isDemoStudentKey: never matches a real studentKeyOf() output — the reserved prefix can't collide with a real student", () => {
  // Real student IDs/names can never contain ":" (see lib/validation.ts's
  // STUDENT_ID_PATTERN/NAME_PATTERN), so a demo key — which always does —
  // can never equal, or be produced by, a real student's key.
  const realKeys = [studentKeyOf("10111", "박OO"), studentKeyOf("A1", "Jane Doe"), studentKeyOf("99999", "김철수")];
  for (const key of realKeys) {
    assert.equal(isDemoStudentKey(key), false);
    assert.ok(!key.includes(":"), "a real studentKey should never contain ':'");
  }
});

test("WARMUP_DEMO_SUBMISSIONS_ENABLED: is a plain boolean switch", () => {
  assert.equal(typeof WARMUP_DEMO_SUBMISSIONS_ENABLED, "boolean");
});
