import type { ProblemModule } from "./types";
import { TRUCK_CAPACITY, trucksNeeded } from "../truckActivity";
export const truckLoadProblem:ProblemModule<{n:number;weights:number[];capacity:number}>= {
  type:"truckload",label:"택배 트럭 — 필요한 트럭 수 구하기",actions:["open"],
  generate(){const n=5+Math.floor(Math.random()*4);const weights=Array.from({length:n},()=>1+Math.floor(Math.random()*TRUCK_CAPACITY));return {input:{n,weights,capacity:TRUCK_CAPACITY},correctAnswer:trucksNeeded(weights),referenceActionCount:n,state:{log:[]}};},
  applyAction(state,input,action,params){const position=Number(params.position);if(action!=="open"||!Number.isInteger(position)||position<1||position>input.n)throw new Error("올바른 상자를 선택하세요.");const entry={position,value:input.weights[position-1]};return {state:{log:[...(state as {log:unknown[]}).log,entry]},result:entry,counted:true};},
};
