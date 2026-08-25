import type { ActionOutcome, GeneratedInstance, ProblemModule } from "./types";
import { randInt } from "./types";

export type CoinsInput = {
  n: 12;
  fakeCoin: number; // 1-12, hidden from the executor, used only to simulate the scale
  fakeHeavier: boolean; // hidden, used only to simulate the scale
};

export type CoinsState = {
  left: number[];
  right: number[];
  weighCount: number;
  history: { left: number[]; right: number[]; result: "left" | "right" | "balanced" }[];
};

function validatePan(coins: unknown): number[] {
  if (!Array.isArray(coins)) throw new Error("coins must be an array");
  const nums = coins.map((c) => Number(c));
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 12)) {
    throw new Error("coin numbers must be integers between 1 and 12");
  }
  if (new Set(nums).size !== nums.length) {
    throw new Error("duplicate coin on the same pan");
  }
  return nums;
}

export const coinsProblem: ProblemModule<CoinsInput> = {
  type: "12coins",
  label: "12개의 동전 중 가짜 찾기",
  actions: ["placeLeft", "placeRight", "clearPans", "weigh"],

  publicInput(input) {
    return { n: input.n };
  },

  generate(): GeneratedInstance<CoinsInput> {
    const input: CoinsInput = {
      n: 12,
      fakeCoin: randInt(1, 12),
      fakeHeavier: Math.random() < 0.5,
    };
    const state: CoinsState = { left: [], right: [], weighCount: 0, history: [] };
    return { input, correctAnswer: input.fakeCoin, referenceActionCount: 3, state };
  },

  applyAction(rawState, input, action, params): ActionOutcome {
    const state = rawState as CoinsState;

    if (action === "placeLeft" || action === "placeRight") {
      const coins = validatePan(params.coins);
      const other = action === "placeLeft" ? state.right : state.left;
      if (coins.some((c) => other.includes(c))) {
        throw new Error("동일 동전을 양쪽 저울에 동시에 올릴 수 없습니다");
      }
      const next: CoinsState = {
        ...state,
        left: action === "placeLeft" ? coins : state.left,
        right: action === "placeRight" ? coins : state.right,
      };
      return { state: next, result: { left: next.left, right: next.right }, counted: false };
    }

    if (action === "clearPans") {
      const next: CoinsState = { ...state, left: [], right: [] };
      return { state: next, result: { left: [], right: [] }, counted: false };
    }

    if (action === "weigh") {
      if (state.left.length === 0 || state.right.length === 0) {
        throw new Error("양쪽 저울에 동전을 올린 뒤 저울질하세요");
      }
      let result: "left" | "right" | "balanced";
      if (state.left.includes(input.fakeCoin)) {
        result = input.fakeHeavier ? "left" : "right";
      } else if (state.right.includes(input.fakeCoin)) {
        result = input.fakeHeavier ? "right" : "left";
      } else {
        result = "balanced";
      }
      const history = [...state.history, { left: state.left, right: state.right, result }];
      const next: CoinsState = { left: [], right: [], weighCount: state.weighCount + 1, history };
      return { state: next, result, counted: true };
    }

    throw new Error(`unknown action: ${action}`);
  },
};
