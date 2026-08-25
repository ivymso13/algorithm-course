/**
 * Hardcoded student -> problem-type assignment, per spec section 1.
 *
 * Edit ROSTER below with the real class list before a session. Everything
 * else (the write/execute pairing) is derived automatically so the
 * "write 2 types" / "execute the complementary 2 types" guarantee always
 * holds, no matter how many students are on the roster.
 */

export const PROBLEM_TYPES = ["12coins", "card", "josephus", "pancake"] as const;
export type ProblemType = (typeof PROBLEM_TYPES)[number];

export type Roster = { studentId: string; name: string }[];

export type Assignment = {
  studentId: string;
  name: string;
  studentKey: string;
  write: [ProblemType, ProblemType];
  execute: [ProblemType, ProblemType];
};

// The 6 ways to choose 2-of-4 problem types, each paired with its exact
// complement (the other 2 types), so a student's `execute` list can never
// overlap their `write` list. Order here also doubles as the round-robin
// order used to balance the roster across combos.
const COMBOS: [[ProblemType, ProblemType], [ProblemType, ProblemType]][] = [
  [["12coins", "card"], ["josephus", "pancake"]],
  [["12coins", "josephus"], ["card", "pancake"]],
  [["12coins", "pancake"], ["card", "josephus"]],
  [["card", "josephus"], ["12coins", "pancake"]],
  [["card", "pancake"], ["12coins", "josephus"]],
  [["josephus", "pancake"], ["12coins", "card"]],
];

/**
 * Default 12-student roster matching the example table in the spec.
 * Replace with the real class roster; any length works.
 */
export const ROSTER: Roster = [
  { studentId: "10101", name: "학생1" },
  { studentId: "10102", name: "학생2" },
  { studentId: "10103", name: "학생3" },
  { studentId: "10104", name: "학생4" },
  { studentId: "10105", name: "학생5" },
  { studentId: "10106", name: "학생6" },
  { studentId: "10107", name: "학생7" },
  { studentId: "10108", name: "학생8" },
  { studentId: "10109", name: "학생9" },
  { studentId: "10110", name: "학생10" },
  { studentId: "10111", name: "학생11" },
  { studentId: "10112", name: "학생12" },
];

export function studentKeyOf(studentId: string, name: string): string {
  return `${studentId.trim()} ${name.trim()}`;
}

function buildAssignments(roster: Roster): Map<string, Assignment> {
  const map = new Map<string, Assignment>();
  roster.forEach((student, index) => {
    // Pair students up 2-by-2 onto each combo (matching the spec's example
    // table: students 1-2 share a combo, 3-4 share the next, ...), instead
    // of cycling combos one student at a time.
    const combo = COMBOS[Math.floor(index / 2) % COMBOS.length];
    const studentKey = studentKeyOf(student.studentId, student.name);
    map.set(studentKey, {
      studentId: student.studentId,
      name: student.name,
      studentKey,
      write: combo[0],
      execute: combo[1],
    });
  });
  return map;
}

export const ASSIGNMENTS = buildAssignments(ROSTER);

export function getAssignment(studentKey: string): Assignment | undefined {
  return ASSIGNMENTS.get(studentKey);
}

export function listAssignments(): Assignment[] {
  return Array.from(ASSIGNMENTS.values());
}
