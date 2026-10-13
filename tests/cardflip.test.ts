import test from "node:test";
import assert from "node:assert/strict";
import {cardFlipExpected,cardFlipProblem,initialCardFlipState,type CardFlipState} from "../lib/problems/cardflip.ts";

test("one turn matches binary increment for all 64 arrangements and does not mutate input",()=>{
 for(let value=0;value<64;value++){
  const cards=Array.from({length:6},(_,i)=>!!(value & (1<<(5-i))));
  const before=[...cards],expected=cardFlipExpected(cards);
  assert.deepEqual(cards,before);
  const encoded=expected.reduce((acc,face)=>acc*2+Number(face),0);
  assert.equal(encoded,(value+1)%64);
  let state=initialCardFlipState(cards);
  while(state.index>=0){
   state=cardFlipProblem.applyAction(state,{n:6,cards},'check',{}).state as CardFlipState;
   const faceBefore=state.checked;
   state=cardFlipProblem.applyAction(state,{n:6,cards},'flip',{}).state as CardFlipState;
   assert.equal(state.checked,faceBefore,'condition retains the pre-flip observation');
   if(!faceBefore)break;
   state=cardFlipProblem.applyAction(state,{n:6,cards},'left',{}).state as CardFlipState;
  }
  state=cardFlipProblem.applyAction(state,{n:6,cards},'finish',{}).state as CardFlipState;
  assert.deepEqual(state.cards,expected);assert.equal(state.finished,true);
  assert.throws(()=>cardFlipProblem.applyAction(state,{n:6,cards},'flip',{}),/이미/);
 }
});

test("card practice rejects a missing position and a disallowed action",()=>{
 const cards=[false,true],input={n:2,cards};
 assert.throws(()=>cardFlipProblem.applyAction({...initialCardFlipState(cards),index:-1},input,'flip',{}),/카드가 더 없습니다/);
 assert.throws(()=>cardFlipProblem.applyAction(initialCardFlipState(cards),input,'unknown',{}),/허용되지/);
 for(let i=0;i<10;i++){const generated=cardFlipProblem.generate();assert.equal(generated.input.cards.length,6);assert.equal(generated.correctAnswer,cardFlipExpected(generated.input.cards).filter(Boolean).length);}
});
