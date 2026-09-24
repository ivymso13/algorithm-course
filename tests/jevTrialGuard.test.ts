import test from "node:test";
import assert from "node:assert/strict";
import { JevService, JevTrialAbortedError, createJevService, createTrialGuard, DEFAULT_INITIAL_STATE } from "../lib/jev";

const params = {
  stepIndex: 1,
  stepText: "왼쪽 상자로 이동한다",
  allSteps: ["왼쪽 상자로 이동한다"],
  currentState: DEFAULT_INITIAL_STATE,
};
const answer = (answers: unknown) => new Response(JSON.stringify({ answers }), { headers: { "content-type": "application/json" } });

test("beforeRequest runs before every upstream call, including the NONE_OF_THESE follow-up", async () => {
  const order: string[] = [];
  const replies = [
    { executable: { noul: 0.48 }, action_id: { choice: "NONE_OF_THESE", confidence: 0.9 } },
    { action_id: { choice: "MOVE_LEFT_BOX", confidence: 0.97 } },
  ];
  const service = new JevService("k", {
    beforeRequest: async () => { order.push("guard"); },
    fetchImpl: async () => { order.push("fetch"); return answer(replies[order.filter((o) => o === "fetch").length - 1]); },
  });
  const result = await service.evaluateStep(params);
  assert.equal(result.actionId, "MOVE_LEFT_BOX");
  assert.deepEqual(order, ["guard", "fetch", "guard", "fetch"]);
});

test("a guard abort stops the next call and propagates unchanged, never as a JevApiError", async () => {
  let fetches = 0;
  let guards = 0;
  const service = new JevService("k", {
    beforeRequest: async () => { if (++guards === 2) throw new JevTrialAbortedError("stale"); },
    fetchImpl: async () => { fetches++; return answer({ executable: { noul: 0.48 }, action_id: { choice: "NONE_OF_THESE", confidence: 0.9 } }); },
  });
  await assert.rejects(service.evaluateStep(params), (error: unknown) => error instanceof JevTrialAbortedError && error.reason === "stale");
  assert.equal(fetches, 1, "the follow-up call was never made");
});

test("the mock service honours the guard too, outside production only", async () => {
  let guards = 0;
  const env = { USE_JEV_MOCK: "true", NODE_ENV: "test" };
  const mock = createJevService(env, { beforeRequest: async () => { guards++; throw new JevTrialAbortedError("deadline"); } });
  assert.equal(mock.mode, "mock");
  await assert.rejects(mock.evaluateStep(params), JevTrialAbortedError);
  assert.equal(guards, 1);
});

test("a fence that returns after the deadline still prevents the call", async () => {
  let clock = 1_000;
  let fetches = 0;
  const guard = createTrialGuard(5_000, async () => { clock = 5_001; return true; }, () => clock);
  const service = new JevService("k", { beforeRequest: guard, fetchImpl: async () => { fetches++; return answer({}); } });
  await assert.rejects(service.evaluateStep(params), (error: unknown) => error instanceof JevTrialAbortedError && error.reason === "deadline");
  assert.equal(fetches, 0);
});

test("the guard refuses past the deadline without touching the fence, and reports a stale fence as stale", async () => {
  let fenced = 0;
  const late = createTrialGuard(10, async () => { fenced++; return true; }, () => 11);
  await assert.rejects(late(), (error: unknown) => error instanceof JevTrialAbortedError && error.reason === "deadline");
  assert.equal(fenced, 0);
  const stale = createTrialGuard(10, async () => false, () => 5);
  await assert.rejects(stale(), (error: unknown) => error instanceof JevTrialAbortedError && error.reason === "stale");
  await createTrialGuard(10, async () => true, () => 5)();
});
