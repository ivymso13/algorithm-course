import type { ProblemModule } from "./types";
export type CardFlipInput={n:number;cards:boolean[]};
export type CardFlipState={cards:boolean[];index:number;checked:boolean|null;finished:boolean};
/** One turn: flip trailing face-up cards down, then the first face-down card up. */
export function cardFlipExpected(cards:readonly boolean[]) {
 const result=[...cards];
 for(let i=result.length-1;i>=0;i--){const before=result[i];result[i]=!before;if(!before)break;}
 return result;
}
export function initialCardFlipState(cards:readonly boolean[]):CardFlipState{return {cards:[...cards],index:cards.length-1,checked:null,finished:false};}
export const cardFlipProblem:ProblemModule<CardFlipInput>={
 type:"cardflip",label:"카드 뒤집기",actions:["check","flip","left","finish"],
 generate(){const cards=Array.from({length:6},()=>Math.random()<0.5);return {input:{n:6,cards},correctAnswer:cardFlipExpected(cards).filter(Boolean).length,referenceActionCount:6,state:initialCardFlipState(cards)};},
 applyAction(raw,input,action){
  const state=raw as CardFlipState;if(state.finished)throw new Error("이미 이번 차례를 끝냈습니다. 처음부터 다시 시작하세요.");
  if(!this.actions.includes(action))throw new Error("허용되지 않은 행동입니다.");
  const next={...state,cards:[...state.cards]};
  if(action==='finish'){next.finished=true;return {state:next,result:{faceUp:next.cards.filter(Boolean).length,cards:next.cards},counted:true};}
  if(state.index<0||state.index>=input.n)throw new Error("왼쪽에 카드가 더 없습니다. 이번 차례를 끝내세요.");
  if(action==='check')next.checked=state.cards[state.index];
  if(action==='flip')next.cards[state.index]=!state.cards[state.index];
  if(action==='left'){next.index--;next.checked=null;}
  return {state:next,result:{position:next.index+1,face:next.checked,cards:next.cards},counted:true};
 }
};
