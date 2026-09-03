/**
 * Pure problem-type-assignment logic + the one-time seed data for the class
 * roster, per spec section 1.
 *
 * The roster itself now lives in the `roster` D1 table (see `lib/roster.ts`)
 * so a teacher can add/edit/remove students at runtime — `DEFAULT_ROSTER`
 * below is only the seed used to populate that table the first time a course
 * is used, so existing deployments keep their current class list unchanged.
 * Everything here has no DB dependency, so it stays synchronous and directly
 * unit-testable.
 */

export const PROBLEM_TYPES = ["12coins", "card", "josephus", "pancake"] as const;
export type ProblemType = (typeof PROBLEM_TYPES)[number];

export type Roster = { school: string; studentId: string; name: string }[];

export type Assignment = {
  id: number;
  studentId: string;
  name: string;
  school: string;
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
 * Every roster row gets a permanent `sortOrder` the moment it's created
 * (see `lib/roster.ts`), and a student's write/execute pair is derived only
 * from their own `sortOrder` — never from their position among currently
 * active students. That's what makes assignment stable: adding, editing, or
 * removing *other* students can never reshuffle a student's own pairing.
 * Pairs of two consecutive sortOrders share a combo (matching the spec's
 * example table: students 1-2 share a combo, 3-4 share the next, ...).
 */
export function comboForSortOrder(sortOrder: number): {
  write: [ProblemType, ProblemType];
  execute: [ProblemType, ProblemType];
} {
  const combo = COMBOS[Math.floor(sortOrder / 2) % COMBOS.length];
  return { write: combo[0], execute: combo[1] };
}

/** Seed roster, applied once per course. Names are masked for privacy; phone numbers are never stored. */
export const DEFAULT_ROSTER: Roster = [
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
