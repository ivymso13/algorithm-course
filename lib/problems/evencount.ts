import type { ProblemModule } from "./types";
export const evenCountProblem:ProblemModule<{n:number;counts:number[]}>= {
  type:"evencount",label:"상자 속 짝수 세기",actions:["open"],
  generate(){const counts=Array.from({length:5},()=>Math.floor(Math.random()*11));return {input:{n:5,counts},correctAnswer:counts.filter(n=>n%2===0).length,referenceActionCount:5,state:{log:[]}};},
  applyAction(state,input,action,params){const position=Number(params.position);if(action!=="open"||!Number.isInteger(position)||position<1||position>input.n)throw new Error("올바른 상자를 선택하세요.");const entry={position,value:input.counts[position-1]};return {state:{log:[...(state as {log:unknown[]}).log,entry]},result:entry,counted:true};},
};
