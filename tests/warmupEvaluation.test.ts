import assert from "node:assert/strict";
import test from "node:test";
import { fullyEvaluatedStudentKeys } from "../lib/warmupEvaluation.ts";

const S1 = { id: 1, studentKey: "s1" };
const S2 = { id: 2, studentKey: "s2" };
const S3 = { id: 3, studentKey: "s3" };

test("fullyEvaluatedStudentKeys: a student who voted on every peer is complete", () => {
  const votes = [
    { submissionId: 2, voterStudentKey: "s1" },
    { submissionId: 3, voterStudentKey: "s1" },
  ];
  assert.deepEqual(fullyEvaluatedStudentKeys([S1, S2, S3], votes), ["s1"]);
});

test("fullyEvaluatedStudentKeys: missing even one peer vote keeps a student incomplete", () => {
  const votes = [{ submissionId: 2, voterStudentKey: "s1" }]; // missing S3
  assert.deepEqual(fullyEvaluatedStudentKeys([S1, S2, S3], votes), []);
});

test("fullyEvaluatedStudentKeys: multiple votes on the same peer still count as one", () => {
  const votes = [
    { submissionId: 2, voterStudentKey: "s1" },
    { submissionId: 2, voterStudentKey: "s1" }, // duplicate tag type on same peer
    { submissionId: 3, voterStudentKey: "s1" },
  ];
  assert.deepEqual(fullyEvaluatedStudentKeys([S1, S2, S3], votes), ["s1"]);
});

test("fullyEvaluatedStudentKeys: a lone submitter with no peers is never 'complete'", () => {
  assert.deepEqual(fullyEvaluatedStudentKeys([S1], []), []);
});

test("fullyEvaluatedStudentKeys: evaluates each real submitter independently", () => {
  const votes = [
    { submissionId: 2, voterStudentKey: "s1" },
    { submissionId: 3, voterStudentKey: "s1" },
    { submissionId: 1, voterStudentKey: "s2" },
    // s2 hasn't voted on s3 yet
  ];
  assert.deepEqual(fullyEvaluatedStudentKeys([S1, S2, S3], votes), ["s1"]);
});

test("fullyEvaluatedStudentKeys: no submissions at all yields no complete students", () => {
  assert.deepEqual(fullyEvaluatedStudentKeys([], []), []);
});
