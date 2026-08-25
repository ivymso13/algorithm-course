import type { ActionOutcome, GeneratedInstance, ProblemModule } from "./types";
import { randInt, shuffle } from "./types";

export type PancakeInput = {
  n: number;
};

export type PancakeState = {
  stack: number[]; // top -> bottom, values are pancake sizes 1..n (1 = smallest)
  flipCount: number;
  history: { k: number }[];
};

function encodeAscending(n: number): number {
  return Number(Array.from({ length: n }, (_, i) => i + 1).join(""));
}

export const pancakeProblem: ProblemModule<PancakeInput> = {
  type: "pancake",
  label: "팬케이크 정렬",
  actions: ["flip"],

  generate(): GeneratedInstance<PancakeInput> {
    const n = randInt(4, 6);
    const sorted = Array.from({ length: n }, (_, i) => i + 1);
    let initial = shuffle(sorted);
    while (initial.join(",") === sorted.join(",")) {
      initial = shuffle(sorted);
    }

    const input: PancakeInput = { n };
    const correctAnswer = encodeAscending(n);
    const state: PancakeState = { stack: initial, flipCount: 0, history: [] };
    return { input, correctAnswer, referenceActionCount: 2 * (n - 1), state };
  },

  applyAction(rawState, input, action, params): ActionOutcome {
    const state = rawState as PancakeState;
    if (action !== "flip") throw new Error(`unknown action: ${action}`);

    const k = Number(params.k);
    if (!Number.isInteger(k) || k < 1 || k > input.n) {
      throw new Error(`k must be an integer between 1 and ${input.n}`);
    }
    const top = state.stack.slice(0, k).reverse();
    const rest = state.stack.slice(k);
    const stack = [...top, ...rest];
    const next: PancakeState = {
      stack,
      flipCount: state.flipCount + 1,
      history: [...state.history, { k }],
    };
    return { state: next, result: { stack }, counted: true };
  },
};

export { encodeAscending };
