import type { ActionOutcome, GeneratedInstance, ProblemModule } from "./types";
import { randInt, shuffle } from "./types";

/**
 * Box count and the apple-count pool are plain constants, same as
 * MAX_HEIGHT in woodcut.ts — bump these later to retune difficulty without
 * touching the generation/scoring logic below.
 */
// A wider spread than a fixed 7~8 so a student's strategy actually gets
// tested against different-sized layouts each time, not just memorized for
// one shape.
export const MIN_BOXES = 8;
export const MAX_BOXES = 12;
export const MAX_APPLES = 30;

export type MaxBoxInput = {
  n: number;
  /** Apple count in each box, left to right. Fully visible to the problem
   * module; hidden from the student by the sandbox UI, not by this data. */
  counts: number[];
};

export type MaxBoxOpenLog = { position: number; value: number };

export type MaxBoxState = {
  /**
   * Every "open" click, in the order they happened. Boxes can be reopened
   * any number of times in any order — there's no "already opened" lock —
   * so this is a click log (its length is the click count), not a
   * completion tally.
   */
  log: MaxBoxOpenLog[];
};

export const maxBoxProblem: ProblemModule<MaxBoxInput> = {
  type: "maxbox",
  label: "상자 속 사과 — 가장 많은 사과가 든 상자 찾기",
  actions: ["open"],

  generate(): GeneratedInstance<MaxBoxInput> {
    const n = randInt(MIN_BOXES, MAX_BOXES);
    const counts = shuffle(Array.from({ length: MAX_APPLES }, (_, i) => i + 1)).slice(0, n);
    const input: MaxBoxInput = { n, counts };
    const state: MaxBoxState = { log: [] };
    return {
      input,
      correctAnswer: Math.max(...counts),
      // Boxes can be reopened freely, but the shortest path to a confident
      // answer still checks each one exactly once and keeps the running max.
      referenceActionCount: n,
      state,
    };
  },

  applyAction(rawState, input, action, params): ActionOutcome {
    const state = rawState as MaxBoxState;
    if (action !== "open") throw new Error(`unknown action: ${action}`);

    const position = Number(params.position);
    if (!Number.isInteger(position) || position < 1 || position > input.n) {
      throw new Error(`position must be an integer between 1 and ${input.n}`);
    }

    const value = input.counts[position - 1];
    const entry: MaxBoxOpenLog = { position, value };
    const next: MaxBoxState = { log: [...state.log, entry] };
    return { state: next, result: entry, counted: true };
  },
};
