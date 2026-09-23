import assert from "node:assert/strict";
import test from "node:test";
import { coinsProblem } from "../lib/problems/coins.ts";
import { cardsProblem } from "../lib/problems/cards.ts";
import { josephusProblem, type JosephusState } from "../lib/problems/josephus.ts";
import { pancakeProblem, encodeAscending } from "../lib/problems/pancake.ts";
import { woodcutProblem, totalWood, MAX_HEIGHT, type WoodcutState } from "../lib/problems/woodcut.ts";
import {
  constellationProblem,
  computeMst,
  starDistance,
  totalEdgeWeight,
  MIN_STARS,
  MAX_STARS,
  COORD_MAX,
  type ConstellationInput,
  type ConstellationState,
} from "../lib/problems/constellation.ts";
import {
  maxBoxProblem,
  MIN_BOXES,
  MAX_BOXES,
  MAX_APPLES,
  type MaxBoxInput,
  type MaxBoxState,
} from "../lib/problems/maxbox.ts";

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

test("woodcut: generated correctAnswer is the max height with totalWood >= target, and heights are distinct within [1, MAX_HEIGHT]", () => {
  for (let i = 0; i < 100; i += 1) {
    const { input, correctAnswer } = woodcutProblem.generate();

    assert.equal(new Set(input.heights).size, input.heights.length, "heights must be distinct");
    for (const h of input.heights) {
      assert.ok(h >= 1 && h <= MAX_HEIGHT, "every height must be within [1, MAX_HEIGHT]");
    }

    assert.ok(totalWood(input.heights, correctAnswer) >= input.target, "answer height must still meet the target");
    assert.ok(
      totalWood(input.heights, correctAnswer + 1) < input.target,
      "one height higher must fall below the target (answer must be the max feasible height)"
    );
  }
});

test("woodcut: cut reports the total wood collected at a given height and counts the action", () => {
  const input = { n: 3, heights: [30, 50, 70], target: 40 };
  const state: WoodcutState = { history: [], queryCount: 0 };

  const outcome = woodcutProblem.applyAction(state, input, "cut", { height: 40 });
  assert.equal((outcome.result as { collected: number }).collected, 40); // (50-40) + (70-40) = 40
  assert.equal(outcome.counted, true);
  assert.equal((outcome.state as WoodcutState).queryCount, 1);
});

test("woodcut: rejects a height outside [0, MAX_HEIGHT]", () => {
  const input = { n: 1, heights: [500], target: 100 };
  const state: WoodcutState = { history: [], queryCount: 0 };
  assert.throws(() => woodcutProblem.applyAction(state, input, "cut", { height: -1 }));
  assert.throws(() => woodcutProblem.applyAction(state, input, "cut", { height: MAX_HEIGHT + 1 }));
  assert.throws(() => woodcutProblem.applyAction(state, input, "cut", { height: 1.5 }));
});

function independentPrimMstWeight(points: { id: number; x: number; y: number }[]): number {
  const inTree = new Set<number>([points[0].id]);
  let total = 0;
  while (inTree.size < points.length) {
    let best: { id: number; dist: number } | null = null;
    for (const p of points) {
      if (inTree.has(p.id)) continue;
      let minDist = Infinity;
      for (const q of points) {
        if (!inTree.has(q.id)) continue;
        const d = Math.round(Math.hypot(p.x - q.x, p.y - q.y));
        if (d < minDist) minDist = d;
      }
      if (best === null || minDist < best.dist) best = { id: p.id, dist: minDist };
    }
    inTree.add(best!.id);
    total += best!.dist;
  }
  return total;
}

test("constellation: generated instance has stars within range, and correctAnswer matches an independently re-computed MST (Prim)", () => {
  for (let i = 0; i < 50; i += 1) {
    const { input, correctAnswer } = constellationProblem.generate();

    assert.ok(input.n >= MIN_STARS && input.n <= MAX_STARS, "star count must be within [MIN_STARS, MAX_STARS]");
    assert.equal(new Set(input.points.map((p) => p.id)).size, input.points.length, "star ids must be distinct");
    for (const p of input.points) {
      assert.ok(p.x >= 0 && p.x <= COORD_MAX && p.y >= 0 && p.y <= COORD_MAX, "every star must be within the grid");
    }

    assert.equal(correctAnswer, independentPrimMstWeight(input.points));

    const mst = computeMst(input.points);
    assert.equal(mst.weight, correctAnswer);
    assert.equal(mst.edges.length, input.n - 1, "a spanning tree over n stars always has n-1 edges");
    assert.equal(totalEdgeWeight(mst.edges), correctAnswer);
  }
});

test("constellation: connecting two stars adds an edge and counts the attempt", () => {
  const input: ConstellationInput = {
    n: 3,
    points: [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 0, y: 10 },
      { id: 3, x: 10, y: 0 },
    ],
  };
  const state: ConstellationState = { edges: [], attempts: [], attemptCount: 0 };

  const outcome = constellationProblem.applyAction(state, input, "connect", { a: 1, b: 2 });
  assert.equal(starDistance(input.points[0], input.points[1]), 10);
  assert.deepEqual(outcome.result, { a: 1, b: 2, dist: 10, accepted: true });
  assert.equal(outcome.counted, true);
  assert.equal((outcome.state as ConstellationState).edges.length, 1);
});

test("constellation: connecting a pair that would close a cycle is rejected but still counted", () => {
  const input: ConstellationInput = {
    n: 3,
    points: [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 0, y: 10 },
      { id: 3, x: 10, y: 0 },
    ],
  };
  let state: ConstellationState = { edges: [], attempts: [], attemptCount: 0 };
  state = constellationProblem.applyAction(state, input, "connect", { a: 1, b: 2 }).state as ConstellationState;
  state = constellationProblem.applyAction(state, input, "connect", { a: 1, b: 3 }).state as ConstellationState;
  assert.equal(state.edges.length, 2, "spanning tree over 3 stars needs exactly 2 edges");

  const outcome = constellationProblem.applyAction(state, input, "connect", { a: 2, b: 3 });
  assert.equal((outcome.result as { accepted: boolean }).accepted, false, "star 2 and 3 are already connected via star 1");
  assert.equal(outcome.counted, true, "a rejected attempt is still a counted attempt");
  assert.equal((outcome.state as ConstellationState).edges.length, 2, "the rejected edge must not be added");
});

test("constellation: rejects connecting a star to itself, an unknown star, or an already-connected direct pair", () => {
  const input: ConstellationInput = {
    n: 2,
    points: [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 3, y: 4 },
    ],
  };
  const state: ConstellationState = { edges: [], attempts: [], attemptCount: 0 };
  assert.throws(() => constellationProblem.applyAction(state, input, "connect", { a: 1, b: 1 }));
  assert.throws(() => constellationProblem.applyAction(state, input, "connect", { a: 1, b: 99 }));

  const next = constellationProblem.applyAction(state, input, "connect", { a: 1, b: 2 }).state as ConstellationState;
  assert.throws(() => constellationProblem.applyAction(next, input, "connect", { a: 1, b: 2 }));
});

test("maxbox: generated instance has distinct counts within range, and correctAnswer is the true max", () => {
  for (let i = 0; i < 100; i += 1) {
    const { input, correctAnswer } = maxBoxProblem.generate();

    assert.ok(input.n >= MIN_BOXES && input.n <= MAX_BOXES, "box count must be within [MIN_BOXES, MAX_BOXES]");
    assert.equal(new Set(input.counts).size, input.counts.length, "apple counts must be distinct");
    for (const c of input.counts) {
      assert.ok(c >= 1 && c <= MAX_APPLES, "every count must be within [1, MAX_APPLES]");
    }
    assert.equal(correctAnswer, Math.max(...input.counts));
  }
});

test("maxbox: any box can be opened in any order, and reports the right count", () => {
  const input: MaxBoxInput = { n: 4, counts: [5, 8, 3, 11] };
  let state: MaxBoxState = { log: [] };

  let outcome = maxBoxProblem.applyAction(state, input, "open", { position: 3 });
  assert.deepEqual(outcome.result, { position: 3, value: 3 });
  assert.equal(outcome.counted, true);
  state = outcome.state as MaxBoxState;

  outcome = maxBoxProblem.applyAction(state, input, "open", { position: 1 });
  assert.deepEqual(outcome.result, { position: 1, value: 5 });
  state = outcome.state as MaxBoxState;

  assert.deepEqual(state.log, [
    { position: 3, value: 3 },
    { position: 1, value: 5 },
  ]);
});

test("maxbox: the same box can be reopened any number of times", () => {
  const input: MaxBoxInput = { n: 2, counts: [7, 9] };
  let state: MaxBoxState = { log: [] };
  state = maxBoxProblem.applyAction(state, input, "open", { position: 1 }).state as MaxBoxState;
  state = maxBoxProblem.applyAction(state, input, "open", { position: 1 }).state as MaxBoxState;
  state = maxBoxProblem.applyAction(state, input, "open", { position: 1 }).state as MaxBoxState;
  assert.equal(state.log.length, 3, "reopening the same box must not be rejected");
  assert.ok(state.log.every((e) => e.position === 1 && e.value === 7));
});

test("maxbox: rejects a position outside [1, n]", () => {
  const input: MaxBoxInput = { n: 3, counts: [7, 9, 2] };
  const state: MaxBoxState = { log: [] };
  assert.throws(() => maxBoxProblem.applyAction(state, input, "open", { position: 0 }));
  assert.throws(() => maxBoxProblem.applyAction(state, input, "open", { position: 4 }));
  assert.throws(() => maxBoxProblem.applyAction(state, input, "open", { position: 1.5 }));
});
