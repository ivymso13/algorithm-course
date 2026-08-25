import type { ActionOutcome, GeneratedInstance, ProblemModule } from "./types";
import { randInt, shuffle } from "./types";

export type CardsInput = {
  n: number;
  array: number[]; // ascending, distinct
  target: number;
  exists: boolean;
};

export type CardsState = {
  revealed: { position: number; value: number }[];
  flipCount: number;
};

export const cardsProblem: ProblemModule<CardsInput> = {
  type: "card",
  label: "정렬된 뒤집힌 카드에서 목표 숫자 찾기",
  actions: ["flip"],

  publicInput(input) {
    return { n: input.n, target: input.target };
  },

  generate(): GeneratedInstance<CardsInput> {
    const n = randInt(12, 18);
    const pool = shuffle(Array.from({ length: 60 }, (_, i) => i + 1)).slice(0, n);
    const array = pool.sort((a, b) => a - b);

    const exists = Math.random() >= 0.2; // ~20% chance the target is absent
    let target: number;
    if (exists) {
      target = array[randInt(0, n - 1)];
    } else {
      do {
        target = randInt(1, 60);
      } while (array.includes(target));
    }

    const input: CardsInput = { n, array, target, exists };
    const correctAnswer = exists ? array.indexOf(target) + 1 : 0;
    const referenceActionCount = Math.ceil(Math.log2(n + 1));
    const state: CardsState = { revealed: [], flipCount: 0 };
    return { input, correctAnswer, referenceActionCount, state };
  },

  applyAction(rawState, input, action, params): ActionOutcome {
    const state = rawState as CardsState;
    if (action !== "flip") throw new Error(`unknown action: ${action}`);

    const position = Number(params.position);
    if (!Number.isInteger(position) || position < 1 || position > input.n) {
      throw new Error(`position must be an integer between 1 and ${input.n}`);
    }
    const value = input.array[position - 1];
    const next: CardsState = {
      revealed: [...state.revealed, { position, value }],
      flipCount: state.flipCount + 1,
    };
    return { state: next, result: { position, value }, counted: true };
  },
};
