import type { ActionOutcome, GeneratedInstance, ProblemModule } from "./types";
import { randInt } from "./types";

export type JosephusInput = {
  n: number;
  k: number;
};

export type JosephusState = {
  alive: number[]; // remaining people, in circular (seating) order
  removedOrder: number[];
  nextUp: number | null; // person immediately after the last removal, for reference
};

function simulateJosephus(n: number, k: number): number {
  const people = Array.from({ length: n }, (_, i) => i + 1);
  let idx = 0;
  while (people.length > 1) {
    idx = (idx + k - 1) % people.length;
    people.splice(idx, 1);
    if (idx === people.length) idx = 0;
  }
  return people[0];
}

export const josephusProblem: ProblemModule<JosephusInput> = {
  type: "josephus",
  label: "조세퍼스 — 원형으로 매 k번째 제거",
  actions: ["remove"],

  generate(): GeneratedInstance<JosephusInput> {
    const input: JosephusInput = { n: randInt(8, 12), k: randInt(2, 4) };
    const correctAnswer = simulateJosephus(input.n, input.k);
    const state: JosephusState = {
      alive: Array.from({ length: input.n }, (_, i) => i + 1),
      removedOrder: [],
      nextUp: null,
    };
    return { input, correctAnswer, referenceActionCount: input.n - 1, state };
  },

  applyAction(rawState, _input, action, params): ActionOutcome {
    const state = rawState as JosephusState;
    if (action !== "remove") throw new Error(`unknown action: ${action}`);

    const person = Number(params.person);
    const index = state.alive.indexOf(person);
    if (index === -1) {
      throw new Error("이미 제거되었거나 존재하지 않는 번호입니다");
    }
    if (state.alive.length <= 1) {
      throw new Error("한 명만 남아 더 이상 제거할 수 없습니다");
    }

    const alive = [...state.alive];
    alive.splice(index, 1);
    const nextIndex = index === alive.length ? 0 : index;
    const nextUp = alive.length > 0 ? alive[nextIndex] : null;

    const next: JosephusState = {
      alive,
      removedOrder: [...state.removedOrder, person],
      nextUp,
    };
    return { state: next, result: { removed: person, nextUp, remaining: alive.length }, counted: true };
  },
};
