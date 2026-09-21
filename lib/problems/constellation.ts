import type { ActionOutcome, GeneratedInstance, ProblemModule } from "./types";
import { randInt } from "./types";

/**
 * Star count and coordinate range are plain constants, same as MAX_HEIGHT in
 * woodcut.ts — bump these later to retune difficulty without touching the
 * generation/scoring logic below.
 */
export const MIN_STARS = 6;
export const MAX_STARS = 8;
export const COORD_MAX = 100;
/** Minimum allowed distance between any two generated stars, so no pair of
 * points sits so close their line is trivially "obviously shortest". */
const MIN_STAR_SPACING = 15;

export type ConstellationPoint = { id: number; x: number; y: number };

export type ConstellationInput = {
  n: number;
  points: ConstellationPoint[];
};

export type ConstellationEdge = { a: number; b: number; dist: number };

export type ConstellationAttempt = ConstellationEdge & { accepted: boolean };

export type ConstellationState = {
  /** Accepted (non-cycle-forming) connections only — the tree built so far. */
  edges: ConstellationEdge[];
  /** Every attempt, accepted or rejected, in order. */
  attempts: ConstellationAttempt[];
  attemptCount: number;
};

export function starDistance(p: ConstellationPoint, q: ConstellationPoint): number {
  return Math.round(Math.hypot(p.x - q.x, p.y - q.y));
}

export function totalEdgeWeight(edges: ConstellationEdge[]): number {
  return edges.reduce((sum, e) => sum + e.dist, 0);
}

function findRoot(parent: Map<number, number>, x: number): number {
  let cur = x;
  while (parent.get(cur) !== cur) {
    const grandparent = parent.get(parent.get(cur)!)!;
    parent.set(cur, grandparent);
    cur = grandparent;
  }
  return cur;
}

/** Kruskal's algorithm, used only to compute the true minimum spanning tree —
 * students never see this order, they discover their own. Exported so the
 * sandbox can reveal the answer's edges (not just its total) once checked. */
export function computeMst(points: ConstellationPoint[]): { edges: ConstellationEdge[]; weight: number } {
  const candidateEdges: ConstellationEdge[] = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      candidateEdges.push({ a: points[i].id, b: points[j].id, dist: starDistance(points[i], points[j]) });
    }
  }
  candidateEdges.sort((e1, e2) => e1.dist - e2.dist);

  const parent = new Map(points.map((p) => [p.id, p.id]));
  const mstEdges: ConstellationEdge[] = [];
  let total = 0;
  for (const e of candidateEdges) {
    const ra = findRoot(parent, e.a);
    const rb = findRoot(parent, e.b);
    if (ra !== rb) {
      parent.set(ra, rb);
      total += e.dist;
      mstEdges.push(e);
      if (mstEdges.length === points.length - 1) break;
    }
  }
  return { edges: mstEdges, weight: total };
}

function generatePoints(n: number): ConstellationPoint[] {
  const points: ConstellationPoint[] = [];
  let guard = 0;
  while (points.length < n && guard < 2000) {
    guard += 1;
    const candidate = { x: randInt(5, COORD_MAX - 5), y: randInt(5, COORD_MAX - 5) };
    const tooClose = points.some((p) => Math.hypot(p.x - candidate.x, p.y - candidate.y) < MIN_STAR_SPACING);
    if (!tooClose) points.push({ id: points.length + 1, x: candidate.x, y: candidate.y });
  }
  return points;
}

export const constellationProblem: ProblemModule<ConstellationInput> = {
  type: "constellation",
  label: "별자리 만들기 — 모든 별을 최소 비용으로 연결하기",
  actions: ["connect"],

  generate(): GeneratedInstance<ConstellationInput> {
    const n = randInt(MIN_STARS, MAX_STARS);
    const points = generatePoints(n);
    const input: ConstellationInput = { n, points };
    const state: ConstellationState = { edges: [], attempts: [], attemptCount: 0 };
    return {
      input,
      correctAnswer: computeMst(points).weight,
      // Ideal play never rejects an attempt: exactly n-1 successful
      // connections finish a spanning tree.
      referenceActionCount: n - 1,
      state,
    };
  },

  applyAction(rawState, input, action, params): ActionOutcome {
    const state = rawState as ConstellationState;
    if (action !== "connect") throw new Error(`unknown action: ${action}`);

    const a = Number(params.a);
    const b = Number(params.b);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) {
      throw new Error("a and b must be two distinct star ids");
    }
    const pa = input.points.find((p) => p.id === a);
    const pb = input.points.find((p) => p.id === b);
    if (!pa || !pb) throw new Error("unknown star id");

    if (state.edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) {
      throw new Error("this pair is already directly connected");
    }

    // Union-find over the edges accepted so far, to test whether a and b
    // already sit in the same group — accepting this edge would close a
    // cycle, which a tree can never contain.
    const parent = new Map(input.points.map((p) => [p.id, p.id]));
    for (const e of state.edges) {
      const ra = findRoot(parent, e.a);
      const rb = findRoot(parent, e.b);
      if (ra !== rb) parent.set(ra, rb);
    }

    const accepted = findRoot(parent, a) !== findRoot(parent, b);
    const dist = starDistance(pa, pb);
    const attempt: ConstellationAttempt = { a, b, dist, accepted };
    const next: ConstellationState = {
      edges: accepted ? [...state.edges, { a, b, dist }] : state.edges,
      attempts: [...state.attempts, attempt],
      attemptCount: state.attemptCount + 1,
    };
    return { state: next, result: { a, b, dist, accepted }, counted: true };
  },
};
