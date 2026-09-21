import type { ActionOutcome, GeneratedInstance, ProblemModule } from "./types";
import { randInt, shuffle } from "./types";

/**
 * Every instance draws heights from this fixed range, so the executor always
 * knows the search domain [0, MAX_HEIGHT] — mirrors how "12coins" always
 * fixes n = 12. Unlike coins/cards, the heights themselves are NOT hidden:
 * the hard part of parametric search isn't discovering the data (all N
 * heights are visible up front, same as the source BOJ problem), it's that
 * checking one candidate height costs a full pass over the data and the
 * candidate range is large (0..MAX_HEIGHT) — so trying every candidate is
 * too slow, and binary-searching the candidates is the actual lesson.
 */
export const MAX_HEIGHT = 100;

export type WoodcutInput = {
  n: number;
  heights: number[];
  target: number; // minimum total wood (M) required
};

export type WoodcutState = {
  history: { height: number; collected: number }[];
  queryCount: number;
};

export function totalWood(heights: number[], height: number): number {
  return heights.reduce((sum, h) => sum + Math.max(0, h - height), 0);
}

export const woodcutProblem: ProblemModule<WoodcutInput> = {
  type: "woodcut",
  label: "나무 자르기 — 목표 목재량을 채우는 최대 절단 높이 찾기",
  actions: ["cut"],

  generate(): GeneratedInstance<WoodcutInput> {
    const n = randInt(6, 9);
    const heights = shuffle(Array.from({ length: MAX_HEIGHT }, (_, i) => i + 1)).slice(0, n);

    const maxTreeHeight = Math.max(...heights);
    const lo = Math.max(1, Math.floor(maxTreeHeight * 0.1));
    const hi = Math.max(lo, Math.floor(maxTreeHeight * 0.9));
    const answerHeight = randInt(lo, hi);
    const target = totalWood(heights, answerHeight);

    const input: WoodcutInput = { n, heights, target };
    const state: WoodcutState = { history: [], queryCount: 0 };
    return {
      input,
      correctAnswer: answerHeight,
      referenceActionCount: Math.ceil(Math.log2(MAX_HEIGHT + 1)),
      state,
    };
  },

  applyAction(rawState, input, action, params): ActionOutcome {
    const state = rawState as WoodcutState;
    if (action !== "cut") throw new Error(`unknown action: ${action}`);

    const height = Number(params.height);
    if (!Number.isInteger(height) || height < 0 || height > MAX_HEIGHT) {
      throw new Error(`height must be an integer between 0 and ${MAX_HEIGHT}`);
    }
    const collected = totalWood(input.heights, height);
    const next: WoodcutState = {
      history: [...state.history, { height, collected }],
      queryCount: state.queryCount + 1,
    };
    return { state: next, result: { height, collected }, counted: true };
  },
};
