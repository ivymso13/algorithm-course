import assert from "node:assert/strict";
import test from "node:test";
import { ASSIGNMENTS, PROBLEM_TYPES, ROSTER, studentKeyOf } from "../lib/assignments.ts";

test("assignments: every roster student has an assignment and a masked name", () => {
  assert.equal(ROSTER.length, 16);
  for (const student of ROSTER) {
    const key = studentKeyOf(student.studentId, student.name);
    const assignment = ASSIGNMENTS.get(key);
    assert.ok(assignment, `missing assignment for ${key}`);
    assert.match(student.name, /^.(OO)$/);
  }
});

test("assignments: every student's execute pair is exactly the complement of their write pair", () => {
  for (const assignment of ASSIGNMENTS.values()) {
    const combined = new Set([...assignment.write, ...assignment.execute]);
    assert.equal(combined.size, 4, "write and execute must together cover all 4 types with no overlap");
    for (const type of PROBLEM_TYPES) assert.ok(combined.has(type));
  }
});
