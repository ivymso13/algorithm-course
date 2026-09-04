import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNoDuplicateStudentId,
  assertRosterEntryExists,
  decideDeleteMode,
  planStudentIdentityChange,
  RosterDuplicateError,
  RosterNotFoundError,
} from "../lib/rosterGuards.ts";

test("assertRosterEntryExists: returns the row when it exists and is owned by the course", () => {
  const row = { courseId: 1, id: 5, name: "test" };
  assert.equal(assertRosterEntryExists(row, 1), row);
});

test("assertRosterEntryExists: rejects a missing row", () => {
  assert.throws(() => assertRosterEntryExists(null, 1), RosterNotFoundError);
});

test("assertRosterEntryExists: rejects a row belonging to a different course (ownership)", () => {
  assert.throws(() => assertRosterEntryExists({ courseId: 2 }, 1), RosterNotFoundError);
});

test("assertNoDuplicateStudentId: rejects the same (school, studentId) pair already used by another row", () => {
  const rows = [
    { id: 1, school: "정왕고", studentId: "10111", studentKey: "10111 박OO" },
    { id: 2, school: "정왕고", studentId: "10113", studentKey: "10113 박OO" },
  ];
  assert.throws(
    () => assertNoDuplicateStudentId(rows, { school: "정왕고", studentId: "10111", studentKey: "10111 다른이름" }),
    RosterDuplicateError
  );
});

test("assertNoDuplicateStudentId: allows the SAME student ID at a DIFFERENT school — school+studentId is the login identifier, not studentId alone", () => {
  const rows = [{ id: 1, school: "정왕고", studentId: "10111", studentKey: "10111 박OO" }];
  assert.doesNotThrow(() =>
    assertNoDuplicateStudentId(rows, { school: "서해고", studentId: "10111", studentKey: "10111 강OO" })
  );
});

test("assertNoDuplicateStudentId: rejects a studentKey already used by another row, even across different schools/student IDs", () => {
  // studentKey (student ID + name) is still the identity stamped on every
  // submission/vote/attempt/session row, independent of school — so it's
  // checked course-wide regardless of the (school, studentId) outcome.
  const rows = [{ id: 1, school: "정왕고", studentId: "10111", studentKey: "10111 박OO" }];
  assert.throws(
    () => assertNoDuplicateStudentId(rows, { school: "서해고", studentId: "99999", studentKey: "10111 박OO" }),
    RosterDuplicateError
  );
});

test("assertNoDuplicateStudentId: allows a school/studentId/studentKey combination with no conflict", () => {
  const rows = [{ id: 1, school: "정왕고", studentId: "10111", studentKey: "10111 박OO" }];
  assert.doesNotThrow(() =>
    assertNoDuplicateStudentId(rows, { school: "정왕고", studentId: "10999", studentKey: "10999 김OO" })
  );
});

test("assertNoDuplicateStudentId: excludeId lets an edit compare against every OTHER row without tripping on itself", () => {
  const rows = [
    { id: 1, school: "정왕고", studentId: "10111", studentKey: "10111 박OO" },
    { id: 2, school: "정왕고", studentId: "10113", studentKey: "10113 박OO" },
  ];
  assert.doesNotThrow(() =>
    assertNoDuplicateStudentId(rows, { school: "정왕고", studentId: "10111", studentKey: "10111 박OO" }, 1)
  );
  assert.throws(
    () => assertNoDuplicateStudentId(rows, { school: "정왕고", studentId: "10111", studentKey: "10111 박OO" }, 2),
    RosterDuplicateError
  );
});

test("assertNoDuplicateStudentId: rejects reusing a DEACTIVATED row's (school, studentId) — deactivated rows still count", () => {
  // A soft-deleted student can already own real history (submissions/votes/
  // attempts). Handing their (school, studentId) to a different roster row
  // would mix that history into the new row's identity, so the check must
  // not filter by `active` — the caller is expected to pass every row in
  // the course, deactivated included.
  const rowsIncludingDeactivated = [{ id: 1, school: "정왕고", studentId: "10111", studentKey: "10111 박OO" }];
  assert.throws(
    () =>
      assertNoDuplicateStudentId(rowsIncludingDeactivated, {
        school: "정왕고",
        studentId: "10111",
        studentKey: "10111 새이름",
      }),
    RosterDuplicateError
  );
});

test("planStudentIdentityChange: reports unchanged when student ID and name are identical", () => {
  const result = planStudentIdentityChange(
    { studentId: "10111", name: "박OO" },
    { studentId: "10111", name: "박OO" }
  );
  assert.equal(result.changed, false);
  assert.equal(result.oldStudentKey, result.newStudentKey);
});

test("planStudentIdentityChange: reports changed when student ID changes, and computes both keys", () => {
  const result = planStudentIdentityChange(
    { studentId: "10111", name: "박OO" },
    { studentId: "10999", name: "박OO" }
  );
  assert.equal(result.changed, true);
  assert.equal(result.oldStudentKey, "10111 박OO");
  assert.equal(result.newStudentKey, "10999 박OO");
});

test("planStudentIdentityChange: reports changed when only the name changes", () => {
  const result = planStudentIdentityChange(
    { studentId: "10111", name: "박OO" },
    { studentId: "10111", name: "박XX" }
  );
  assert.equal(result.changed, true);
});

test("decideDeleteMode: hard-deletes only when the student has no data anywhere", () => {
  assert.equal(
    decideDeleteMode({
      submissions: 0,
      executedAttempts: 0,
      warmupSubmissions: 0,
      warmupVotes: 0,
      warmupExperiences: 0,
      loginRecords: 0,
    }),
    "delete"
  );
});

test("decideDeleteMode: deactivates instead of deleting when any single field has data", () => {
  const zeroCounts = {
    submissions: 0,
    executedAttempts: 0,
    warmupSubmissions: 0,
    warmupVotes: 0,
    warmupExperiences: 0,
    loginRecords: 0,
  };
  for (const field of Object.keys(zeroCounts) as (keyof typeof zeroCounts)[]) {
    assert.equal(decideDeleteMode({ ...zeroCounts, [field]: 1 }), "deactivate", `field ${field} should force deactivate`);
  }
});
