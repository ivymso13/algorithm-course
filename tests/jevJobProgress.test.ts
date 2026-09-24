import test from "node:test";
import assert from "node:assert/strict";
import { jevJobProgress } from "../lib/jevJobProgress";

const job = (over: Partial<Parameters<typeof jevJobProgress>[0]> = {}) =>
  jevJobProgress({ totalStudents: 5, skippedStudents: 0, trialsPerStudent: 20, completedTrials: 0, ...over });

test("jevJobProgress: moves with every saved trial, not only when a student finishes", () => {
  assert.deepEqual(job(), { doneTrials: 0, totalTrials: 100, percent: 0 });
  assert.deepEqual(job({ completedTrials: 7 }), { doneTrials: 7, totalTrials: 100, percent: 7 });
  assert.deepEqual(job({ completedTrials: 100 }), { doneTrials: 100, totalTrials: 100, percent: 100 });
});

test("jevJobProgress: skipped students count as done; never exceeds 100%; empty job is 0%", () => {
  assert.deepEqual(job({ skippedStudents: 1, completedTrials: 40 }), { doneTrials: 60, totalTrials: 100, percent: 60 });
  assert.equal(job({ completedTrials: 150 }).percent, 100);
  // Rounds down: 99.5% is not shown as done.
  assert.equal(jevJobProgress({ totalStudents: 1, skippedStudents: 0, trialsPerStudent: 200, completedTrials: 199 }).percent, 99);
  assert.deepEqual(job({ totalStudents: 0 }), { doneTrials: 0, totalTrials: 0, percent: 0 });
});
