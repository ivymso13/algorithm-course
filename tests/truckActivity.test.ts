import test from "node:test";
import assert from "node:assert/strict";
import { interpretTruck, runTruck, trucksNeeded, TRUCK_CASES, type TruckInstruction } from "../lib/truckActivity";

const plan: TruckInstruction[] = [
  { step: 1, text: "트럭 1대로 시작", action: "ADD_TRUCK" },
  { step: 2, text: "확인", action: "CHECK" },
  { step: 3, text: "넘치면 출발", action: "DEPART_IF_OVER" },
  { step: 4, text: "싣기", action: "LOAD" },
  { step: 5, text: "이동하고 반복", action: "LOOP_MOVE", start: 2 },
  { step: 6, text: "출력", action: "OUTPUT" },
];
const answerWith = (answers: string[]): typeof fetch => async () => Response.json({ answers: { action: { choice: answers.shift(), confidence: 0.95 } } });

test("fixed cases have the documented answers", () => {
  assert.deepEqual(TRUCK_CASES.map(n => trucksNeeded(n)), [3, 5, 1, 3, 3, 5, 3, 4, 3, 2]);
  for (const numbers of TRUCK_CASES) assert.ok(numbers.length >= 5 && numbers.length <= 8 && numbers.every(w => w >= 1 && w <= 10));
});
test("a correct plan passes every fixed case", () => {
  for (const numbers of TRUCK_CASES) assert.equal(runTruck(plan, numbers).correct, true, numbers.join(","));
});
test("counting departures and adding the last truck at the end is also correct", () => {
  const atEnd: TruckInstruction[] = [...plan.slice(1, 5), { step: 6, text: "마지막 트럭도 센다", action: "ADD_TRUCK" }, { step: 7, text: "출력", action: "OUTPUT" }];
  for (const numbers of TRUCK_CASES) assert.equal(runTruck(atEnd, numbers).correct, true);
});
test("forgetting the last truck is wrong on every case", () => {
  const noLast = plan.slice(1);
  for (const numbers of TRUCK_CASES) assert.equal(runTruck(noLast, numbers).correct, false);
});
test("loading without checking the limit fails with a reason instead of overfilling", () => {
  const result = runTruck(plan.filter(p => p.action !== "DEPART_IF_OVER"), TRUCK_CASES[0]);
  assert.equal(result.executable, false); assert.match(result.failure!, /10kg을 넘습니다/);
});
test("trying to load first and departing afterwards leaves a box behind", () => {
  const swapped = plan.map(p => p.action === "DEPART_IF_OVER" ? { ...p, action: "LOAD_IF_FITS" as const } : p.action === "LOAD" ? { ...p, action: "DEPART_IF_OVER" as const } : p);
  assert.equal(runTruck(swapped, [3, 8, 3, 8, 3]).correct, false);
});
test("moving before testing remaining boxes skips the last box", () => {
  const moveFirst: TruckInstruction[] = [plan[0], plan[1], plan[2], plan[3], { step: 5, text: "이동", action: "MOVE" }, { step: 6, text: "남으면 2단계로", action: "LOOP", start: 2 }, { step: 7, text: "출력", action: "OUTPUT" }];
  assert.equal(runTruck(moveFirst, [2, 2, 2, 2, 9]).output, 1);
});
test("JEV reads each instruction once and the loop keeps its step reference", async () => {
  const result = await interpretTruck(["트럭 수에 1을 더한다", "상자 무게를 확인한다", "실으면 10kg을 넘으면 트럭을 출발시키고 새 트럭을 부른다", "상자를 싣는다", "오른쪽에 상자가 남아 있으면 이동하고 2단계부터 다시 한다", "트럭 수를 제출한다"], "test-only", answerWith(["ADD_TRUCK", "CHECK", "DEPART_IF_OVER", "LOAD", "LOOP_MOVE", "OUTPUT"]));
  assert.equal(result.interpretations.every(p => p.accepted), true);
  assert.equal(result.plan[4].start, 2);
  for (const numbers of TRUCK_CASES) assert.equal(runTruck(result.plan, numbers).correct, true);
});
test("a conditional step with two actions is read as one conditional action", async () => {
  const requests: string[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => { requests.push(JSON.parse(String(init?.body)).state); return Response.json({ answers: { action: { choice: "DEPART_IF_OVER", confidence: 0.95 } } }); };
  const result = await interpretTruck(["실으면 10kg을 넘으면 트럭을 출발시키고 새 트럭을 부른다"], "test-only", fetchImpl);
  assert.equal(requests.length, 1); assert.equal(result.plan.length, 1);
});
test("a loop without a condition or a step number never executes", async () => {
  const result = await interpretTruck(["상자 무게를 확인한다", "계속 반복한다"], "test-only", answerWith(["CHECK", "LOOP"]));
  assert.equal(result.plan.length, 0); assert.equal(result.interpretations[1].accepted, false);
  await assert.rejects(interpretTruck(["확인"], "test-only", async () => Response.json({})), /JEV_INVALID_RESPONSE/);
});

test('conditional depart-and-load is atomic and never invents the false branch',async()=>{
 const text='만약 현재 상자 무게와 현재 적재 무게의 합이 10kg보다 크다면 트럭을 출발시키고 새 트럭에 싣는다.';
 let calls=0;
 const interpreted=await interpretTruck([text],'test',async()=>{calls++;return Response.json({answers:{action:{choice:'DEPART_LOAD_IF_OVER',confidence:0.95}}});});
 assert.equal(calls,1);assert.equal(interpreted.plan.length,1);assert.equal(interpreted.interpretations[0].text,text);
 const conditional:TruckInstruction[]=[{step:1,text:'확인',action:'CHECK'},...interpreted.plan.map(p=>({...p,step:2})),{step:3,text:'확인',action:'CHECK_TRUCK_COUNT'},{step:4,text:'출력',action:'OUTPUT'}];
 const notOver=runTruck(conditional,[4]);assert.equal(notOver.executable,false);assert.equal(notOver.output,0);assert.match(notOver.failure!,/실리지/);
 const trueBranch:TruckInstruction[]=[{step:1,text:'확인',action:'CHECK'},{step:2,text:'싣기',action:'LOAD'},{step:3,text:'이동',action:'MOVE'},{step:4,text:'확인',action:'CHECK'},{step:5,text,action:'DEPART_LOAD_IF_OVER'},{step:6,text:'트럭 수 확인',action:'CHECK_TRUCK_COUNT'},{step:7,text:'출력',action:'OUTPUT'}];
 const over=runTruck(trueBranch,[8,3]);assert.equal(over.correct,true);assert.equal(over.trace[4].load,3);assert.equal(over.output,2);
});

test('the reported truck program is interpreted but fails for omitted loading',async()=>{
 const steps=['상자의 무게를 확인한다.','만약 현재 상자 무게와 현재 적재 무게의 합이 10kg보다 크다면 트럭을 출발시키고 새 트럭에 싣는다.','남은 상자가 있다면 오른쪽으로 이동하고 단계 1로 이동한다.','트럭 수 확인하고 정답 출력한다.'];
 const result=await interpretTruck(steps,'test',answerWith(['CHECK','DEPART_LOAD_IF_OVER','LOOP_MOVE','CHECK_TRUCK_COUNT','OUTPUT']));
 assert.ok(result.interpretations.every(p=>p.accepted));assert.equal(result.interpretations.length,5);
 for(const numbers of TRUCK_CASES){const t=runTruck(result.plan,numbers);assert.equal(t.executable,false);assert.match(t.failure!,/실리지/);}
});

test('an explicitly written else branch and observed truck count pass every fixed case',()=>{
 const plan:TruckInstruction[]=[{step:1,text:'확인',action:'CHECK'},{step:2,text:'초과하면 출발하고 새 트럭에 싣고 아니면 현재 트럭에 싣기',action:'LOAD_OR_DEPART_LOAD'},{step:3,text:'이동 반복',action:'LOOP_MOVE',start:1},{step:4,text:'트럭 수 확인',action:'CHECK_TRUCK_COUNT'},{step:5,text:'정답 출력',action:'OUTPUT'}];
 for(const numbers of TRUCK_CASES)assert.equal(runTruck(plan,numbers).correct,true,numbers.join(','));
 const duplicate=runTruck([{step:1,text:'확인',action:'CHECK'},{step:2,text:'싣기',action:'LOAD'},{step:3,text:'또 싣기',action:'LOAD'},{step:4,text:'출력',action:'OUTPUT'}],[1]);
 assert.equal(duplicate.executable,false);assert.match(duplicate.failure!,/다시 실/);
});
