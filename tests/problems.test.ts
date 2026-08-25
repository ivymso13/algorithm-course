import assert from "node:assert/strict";
import test from "node:test";
import { coinsProblem } from "../lib/problems/coins.ts";
import { cardsProblem } from "../lib/problems/cards.ts";
import { josephusProblem, type JosephusState } from "../lib/problems/josephus.ts";
import { pancakeProblem, encodeAscending } from "../lib/problems/pancake.ts";

test("12coins: weighing correctly reports which side the fake coin is on", () => {
  const { input, correctAnswer, state } = coinsProblem.generate();
  assert.equal(correctAnswer, input.fakeCoin);

  const others = Array.from({ length: 12 }, (_, i) => i + 1).filter((c) => c !== input.fakeCoin);
  const left = others.slice(0, 4);
  const right = others.slice(4, 8);

  let s = coinsProblem.applyAction(state, input, "placeLeft", { coins: left }).state;
  s = coinsProblem.applyAction(s, input, "placeRight", { coins: right }).state;
  const outcome = coinsProblem.applyAction(s, input, "weigh", {});
  assert.equal(outcome.result, "balanced");
  assert.equal(outcome.counted, true);
});

test("12coins: fake coin on the heavier side reports 'left' when heavier", () => {
  const input = { n: 12 as const, fakeCoin: 3, fakeHeavier: true };
  let s = coinsProblem.applyAction(
    { left: [], right: [], weighCount: 0, history: [] },
    input,
    "placeLeft",
    { coins: [3, 1, 2] }
  ).state;
  s = coinsProblem.applyAction(s, input, "placeRight", { coins: [4, 5, 6] }).state;
  const outcome = coinsProblem.applyAction(s, input, "weigh", {});
  assert.equal(outcome.result, "left");
});

test("12coins: rejects placing the same coin on both pans", () => {
  const input = { n: 12 as const, fakeCoin: 1, fakeHeavier: true };
  const s = coinsProblem.applyAction(
    { left: [], right: [], weighCount: 0, history: [] },
    input,
    "placeLeft",
    { coins: [1, 2] }
  ).state;
  assert.throws(() => coinsProblem.applyAction(s, input, "placeRight", { coins: [2, 3] }));
});

test("card: generated instance is ascending and correctAnswer matches target position (or 0)", () => {
  for (let i = 0; i < 50; i += 1) {
    const { input, correctAnswer } = cardsProblem.generate();
    for (let j = 1; j < input.array.length; j += 1) {
      assert.ok(input.array[j] > input.array[j - 1], "array must be strictly ascending");
    }
    if (input.exists) {
      assert.equal(input.array[correctAnswer - 1], input.target);
    } else {
      assert.equal(correctAnswer, 0);
      assert.ok(!input.array.includes(input.target));
    }
  }
});

test("card: flip reveals the value at that position and counts the action", () => {
  const input = { n: 3, array: [10, 20, 30], target: 20, exists: true };
  const outcome = cardsProblem.applyAction({ revealed: [], flipCount: 0 }, input, "flip", {
    position: 2,
  });
  assert.equal((outcome.result as { value: number }).value, 20);
  assert.equal(outcome.counted, true);
});

function independentJosephusSimulation(n: number, k: number): number {
  const people = Array.from({ length: n }, (_, i) => i + 1);
  let idx = 0;
  while (people.length > 1) {
    idx = (idx + k - 1) % people.length;
    people.splice(idx, 1);
    if (idx === people.length) idx = 0;
  }
  return people[0];
}

test("josephus: generated correctAnswer matches an independent re-simulation", () => {
  for (let i = 0; i < 100; i += 1) {
    const { input, correctAnswer } = josephusProblem.generate();
    assert.equal(correctAnswer, independentJosephusSimulation(input.n, input.k));
  }
});

test("josephus: hand-verified n=3,k=2 removal mechanics (survivor 3)", () => {
  const input = { n: 3, k: 2 };
  let state: JosephusState = { alive: [1, 2, 3], removedOrder: [], nextUp: null };
  let outcome = josephusProblem.applyAction(state, input, "remove", { person: 2 });
  state = outcome.state as JosephusState;
  assert.equal((outcome.result as { nextUp: number }).nextUp, 3);

  outcome = josephusProblem.applyAction(state, input, "remove", { person: 1 });
  state = outcome.state as JosephusState;
  assert.deepEqual(state.alive, [3]);
});

test("josephus: cannot remove someone already removed, or the last remaining person", () => {
  const input = { n: 3, k: 2 };
  let state: JosephusState = { alive: [1, 2, 3], removedOrder: [], nextUp: null };
  state = josephusProblem.applyAction(state, input, "remove", { person: 2 }).state as JosephusState;
  assert.throws(() => josephusProblem.applyAction(state, input, "remove", { person: 2 }));
  state = josephusProblem.applyAction(state, input, "remove", { person: 3 }).state as JosephusState;
  assert.throws(() => josephusProblem.applyAction(state, input, "remove", { person: 1 }));
});

test("pancake: generated initial order is never already sorted, and flip reverses the top k", () => {
  for (let i = 0; i < 20; i += 1) {
    const { input, state } = pancakeProblem.generate();
    const sorted = Array.from({ length: input.n }, (_, i2) => i2 + 1);
    assert.notDeepEqual((state as { stack: number[] }).stack, sorted);
  }

  const outcome = pancakeProblem.applyAction({ stack: [3, 1, 2], flipCount: 0, history: [] }, { n: 3 }, "flip", {
    k: 2,
  });
  assert.deepEqual((outcome.result as { stack: number[] }).stack, [1, 3, 2]);
});

test("pancake: ascending encoding matches the spec example (N=5 -> 12345)", () => {
  assert.equal(encodeAscending(5), 12345);
});
