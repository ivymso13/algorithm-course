import test from "node:test";
import assert from "node:assert/strict";
import { restoreEvenSteps, saveEvenSteps } from "../lib/evenDraft";
const storage = () => { const values = new Map<string,string>(); return { getItem: (key:string) => values.get(key) ?? null, setItem: (key:string,value:string) => { values.set(key,value); } }; };
test("edit recovers the submitted algorithm when local draft is missing", () => {
  const session=storage(), local=storage(); session.setItem("even-count-result",JSON.stringify({submissionText:"1. 상자 확인하기\n2. 단계 1로 이동"}));
  assert.deepEqual(restoreEvenSteps(session,local),["상자 확인하기","단계 1로 이동"]);
});
test("local storage failure does not prevent recovering submission or session draft", () => {
  const session=storage(), local={getItem:()=>{throw new Error();},setItem:()=>{throw new Error();}};
  session.setItem("even-count-submission","1. 상자 확인하기");assert.deepEqual(restoreEvenSteps(session,local),["상자 확인하기"]);
  saveEvenSteps(["수정한 문장",""],session,local);assert.deepEqual(restoreEvenSteps(session,local),["수정한 문장",""]);
});
test("new draft wins over old submission and preserves intentionally empty steps", () => {
  const session=storage(),local=storage();session.setItem("even-count-submission","1. 예전 문장");saveEvenSteps(["새 문장",""],session,local);
  assert.deepEqual(restoreEvenSteps(session,local),["새 문장",""]);
});
