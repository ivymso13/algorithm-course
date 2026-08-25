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

export type Roster = { school: string; studentId: string; name: string }[];

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

/** Class roster. Names are masked for privacy; phone numbers are never stored. */
export const ROSTER: Roster = [
  { school: "경기스마트고", studentId: "10118", name: "전OO" },
  { school: "서해고", studentId: "10401", name: "강OO" },
  { school: "서해고", studentId: "10403", name: "김OO" },
  { school: "서해고", studentId: "10432", name: "조OO" },
  { school: "시흥고", studentId: "10201", name: "바OO" },
  { school: "정왕고", studentId: "10111", name: "박OO" },
  { school: "정왕고", studentId: "10113", name: "박OO" },
  { school: "정왕고", studentId: "10208", name: "김OO" },
  { school: "정왕고", studentId: "10221", name: "이OO" },
  { school: "정왕고", studentId: "10225", name: "이OO" },
  { school: "정왕고", studentId: "10233", name: "헤OO" },
  { school: "정왕고", studentId: "10301", name: "강OO" },
  { school: "정왕고", studentId: "10308", name: "남OO" },
  { school: "정왕고", studentId: "10311", name: "박OO" },
  { school: "정왕고", studentId: "10616", name: "양OO" },
  { school: "정왕고", studentId: "10702", name: "강OO" },
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
