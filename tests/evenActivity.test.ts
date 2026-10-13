import test from "node:test";
import assert from "node:assert/strict";
import { interpretEven, runEven, repeatStart, evenActionCandidates, EVEN_CASES, type EvenInstruction } from "../lib/evenActivity";

const plan: EvenInstruction[] = [
  { step: 1, text: "확인", action: "CHECK" },
  { step: 2, text: "짝수이면 증가", action: "ADD_EVEN" },
  { step: 3, text: "이동하고 반복", action: "LOOP_MOVE", start: 1 },
  { step: 4, text: "출력", action: "OUTPUT" },
];
test("instruction jumps never offer physical movement unless movement is written separately", () => {
  for (const text of ["마지막 상자가 아니라면 단계 1로 이동", "오른쪽에 상자가 남으면 1단계로 돌아간다"]) {
    const candidates = evenActionCandidates(text);
    assert.equal(Object.hasOwn(candidates, "LOOP"), true);
    assert.equal(Object.hasOwn(candidates, "LOOP_MOVE"), false);
    assert.equal(Object.hasOwn(candidates, "MOVE"), false);
  }
  assert.equal(Object.hasOwn(evenActionCandidates("오른쪽에 상자가 남으면 오른쪽으로 이동하고 단계 1로 돌아간다"), "LOOP_MOVE"), true);
});
test("reported last-box instruction is a position-preserving jump, with no invented move", async () => {
  const answers = ["CHECK", "ADD_EVEN", "MOVE", "LOOP", "OUTPUT"];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (answers.length === 2) assert.equal(Object.hasOwn(body.questions.action.criteria, "LOOP_MOVE"), false);
    return Response.json({ answers: { action: { choice: answers.shift(), confidence: 0.95 } } });
  };
  const result = await interpretEven(["상자 확인하기", "만약 상자의 값이 짝수라면 메모지에 1 더하기", "오른쪽으로 이동하기", "마지막 상자가 아니라면 단계 1로 이동", "메모지의 수를 제출한다"], "test-only", fetchImpl);
  assert.equal(result.plan[3].action, "LOOP");
  assert.equal(result.plan[3].start, 1);
  const trial = runEven(result.plan, [1,3,5,7,2]);
  assert.equal(trial.output, 0); assert.equal(trial.correct, false);
});
test("repeat references accept both natural numbering orders and reject ambiguous targets", () => {
  for (const text of ["오른쪽에 상자가 남아있다면 단계 1로 돌아간다.", "상자가 남으면 1단계로 돌아간다", "1번째 단계부터 다시 한다"]) assert.equal(repeatStart(text, 4), 1);
  for (const text of ["단계 0으로 돌아간다", "단계 4로 돌아간다", "단계 1 또는 2단계로 돌아간다", "1.5단계로 돌아간다"]) assert.equal(repeatStart(text, 4), undefined);
});
test("reported instruction is interpreted; moving before testing remaining boxes skips the last box", async () => {
  const answers = ["CHECK", "ADD_EVEN", "MOVE", "LOOP", "OUTPUT"];
  const fetchImpl: typeof fetch = async () => Response.json({ answers: { action: { choice: answers.shift(), confidence: 0.95 } } });
  const result = await interpretEven(["상자 확인하기", "만약 상자의 값이 짝수라면 메모지에 1 더하기", "오른쪽으로 이동하기", "오른쪽에 상자가 남아있다면 단계 1로 돌아간다.", "메모지의 수를 제출한다"], "test-only", fetchImpl);
  assert.equal(result.interpretations.every(p => p.accepted), true);
  assert.equal(result.plan[3].start, 1);
  const trial = runEven(result.plan, [1,3,5,7,2]);
  assert.equal(trial.executable, true); assert.equal(trial.output, 0); assert.equal(trial.expected, 1); assert.equal(trial.correct, false);
});
test("move and return phrasing preserves the combined conditional loop", async () => {
  const answers = ["CHECK", "ADD_EVEN", "LOOP_MOVE", "OUTPUT"];
  const fetchImpl: typeof fetch = async () => Response.json({ answers: { action: { choice: answers.shift(), confidence: 0.95 } } });
  const result = await interpretEven(["상자 확인하기", "짝수라면 메모지에 1 더하기", "오른쪽에 상자가 남아있다면 이동하고 단계 1로 돌아간다.", "메모지의 수를 제출한다"], "test-only", fetchImpl);
  assert.equal(result.plan.length, 4);
  for (const numbers of EVEN_CASES) assert.equal(runEven(result.plan, numbers).correct, true);
});
test("even activity handles all odd, all even, edge-only even and zero", () => {
  for (const numbers of EVEN_CASES) assert.equal(runEven(plan, numbers).correct, true);
});
test("missing condition does not silently become even counting", () => {
  const result = runEven(plan.map(p => p.action === "ADD_EVEN" ? { ...p, action: "ADD" as const } : p), EVEN_CASES[0]);
  assert.equal(result.output, 5); assert.equal(result.correct, false); assert.equal(result.executable, true);
});
test("loop without movement stops, output absence and unopened checks fail", () => {
  assert.match(runEven(plan.map(p => p.action === "LOOP_MOVE" ? { ...p, action: "LOOP" as const } : p), [1,2,3]).failure!, /반복/);
  assert.match(runEven(plan.slice(0,3), [2]).failure!, /제출/);
  assert.match(runEven(plan.slice(1), [2]).failure!, /확인하기 전에/);
});
test("compound loop stays one clause, preserves step reference and real API mode", async () => {
  const answers = ["CHECK", "ADD_EVEN", "LOOP_MOVE", "OUTPUT"]; const requests: unknown[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => { requests.push(JSON.parse(String(init?.body))); return Response.json({ answers: { action: { choice: answers.shift(), confidence: 0.95 } } }); };
  const result = await interpretEven(["상자를 연다", "짝수이면 메모지에 1을 더한다", "오른쪽에 상자가 남아 있으면 이동하고 1단계부터 다시 한다", "메모지를 제출한다"], "test-only", fetchImpl);
  assert.equal(requests.length, 4); assert.equal(result.plan[2].start, 1);
  assert.equal(runEven(result.plan, [3,8,2,7,4]).correct, true);
});
test("unrecognized text and unsupported repeat references never execute", async () => {
  const fetchImpl: typeof fetch = async () => Response.json({ answers: { action: { choice: "LOOP_MOVE", confidence: 0.99 } } });
  const result = await interpretEven(["마지막 상자까지 이동하며 반복한다"], "test-only", fetchImpl);
  assert.equal(result.plan.length, 0); assert.equal(result.interpretations[0].accepted, false);
  await assert.rejects(interpretEven(["확인"], "test-only", async () => Response.json({})), /JEV_INVALID_RESPONSE/);
});
