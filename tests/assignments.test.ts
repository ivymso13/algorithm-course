import assert from "node:assert/strict";
import test from "node:test";
import { ASSIGNMENTS, PROBLEM_TYPES, studentKeyOf } from "../lib/assignments.ts";

// Mirrors the 12-student example table in references/알고리즘 체험 사이트.md §1.
const EXPECTED_PAIRS: [string, string][] = [
  ["12coins", "card"],
  ["12coins", "card"],
  ["12coins", "josephus"],
  ["12coins", "josephus"],
  ["12coins", "pancake"],
  ["12coins", "pancake"],
  ["card", "josephus"],
  ["card", "josephus"],
  ["card", "pancake"],
  ["card", "pancake"],
  ["josephus", "pancake"],
  ["josephus", "pancake"],
];

test("assignments: default 12-student roster matches the spec's example table", () => {
  for (let i = 0; i < 12; i += 1) {
    const studentId = String(10101 + i);
    const key = studentKeyOf(studentId, `학생${i + 1}`);
    const assignment = ASSIGNMENTS.get(key);
    assert.ok(assignment, `missing assignment for ${key}`);
    assert.deepEqual([...assignment!.write].sort(), [...EXPECTED_PAIRS[i]].sort());
  }
});

test("assignments: every student's execute pair is exactly the complement of their write pair", () => {
  for (const assignment of ASSIGNMENTS.values()) {
    const combined = new Set([...assignment.write, ...assignment.execute]);
    assert.equal(combined.size, 4, "write and execute must together cover all 4 types with no overlap");
    for (const type of PROBLEM_TYPES) assert.ok(combined.has(type));
  }
});
