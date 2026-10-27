"use client";
import {useState} from "react";
import {truckLoadProblem} from "@/lib/problems/truckload";
import {TRUCK_CAPACITY,trucksNeeded} from "@/lib/truckActivity";
const button="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 disabled:opacity-40";
/** `trucks` counts departed trucks; the one being loaded is truck number trucks+1. */
type State={index:number;value:number|null;load:number;trucks:number;loaded:number[];seen:number[]};
const initialState=():State=>({index:0,value:null,load:0,trucks:0,loaded:[],seen:[]});
export function TruckLoadSandbox({onCopyHistory,peerMode=false}:{onCopyHistory?:(text:string)=>void;peerMode?:boolean}){
 const [weights,setWeights]=useState<number[]>([4,5,3,6,2,8]),[state,setState]=useState<State>(initialState),[log,setLog]=useState<string[]>([]),[error,setError]=useState(""),[answer,setAnswer]=useState("");
 function reset(fresh=false){if(fresh)setWeights(truckLoadProblem.generate().input.weights);setState(initialState());setLog([]);setError("");setAnswer("");}
 function act(action:"check"|"load"|"depart"|"right"){const s=state;let next=s,text="";
  if(action==="check"){next={...s,value:weights[s.index],seen:s.seen.includes(s.index)?s.seen:[...s.seen,s.index]};text=`${s.index+1}번째 상자 무게 확인: ${weights[s.index]}kg`;}
  else if(action==="load"){if(s.value===null){setError("상자 무게를 먼저 확인하세요.");return;}if(s.loaded.includes(s.index)){setError("이 상자는 이미 실었습니다.");return;}if(s.load+s.value>TRUCK_CAPACITY){setError(`이 상자를 실으면 ${s.load+s.value}kg이 되어 ${TRUCK_CAPACITY}kg을 넘습니다.`);return;}next={...s,load:s.load+s.value,loaded:[...s.loaded,s.index]};text=`트럭에 싣기: 실린 무게 ${s.load+s.value}kg`;}
  else if(action==="depart"){if(s.load===0){setError("빈 트럭은 출발시킬 수 없습니다.");return;}next={...s,load:0,trucks:s.trucks+1};text=`${s.trucks+1}번 트럭 출발 → ${s.trucks+2}번 트럭에 이어서 싣기`;}
  else{if(s.index>=weights.length-1){setError("마지막 상자입니다.");return;}next={...s,index:s.index+1,value:null};text="오른쪽으로 한 칸 이동";}
  setState(next);setLog(prev=>[...prev,text]);setError("");setAnswer("");}
 const expected=trucksNeeded(weights),done=state.loaded.length===weights.length;
 return <div className="space-y-4">
  <p className="text-xs leading-6 text-slate-600">{peerMode?"친구가 작성한 문장만 따라 버튼을 누르세요. 판단 기준이 빠졌다면 임의로 보충하지 말고 피드백에 적어 주세요.":"허용된 행동으로 규칙을 확인해 보세요. 알고리즘을 작성한 뒤에는 적은 문장만 따라 실행하며 조건과 반복이 빠지지 않았는지 확인하세요."}</p>
  <dl className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-4"><div><dt className="text-slate-500">현재 상자</dt><dd className="mt-1 font-semibold">{state.index+1} / {weights.length}</dd></div><div><dt className="text-slate-500">확인한 무게</dt><dd className="mt-1 font-semibold">{state.value===null?"미확인":`${state.value}kg`}</dd></div><div><dt className="text-slate-500">현재 적재 무게</dt><dd className="mt-1 font-semibold">{state.load} / {TRUCK_CAPACITY}kg</dd></div><div><dt className="text-slate-500">출발한 트럭</dt><dd className="mt-1 font-semibold">{state.trucks}대</dd></div></dl>
  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">{weights.map((w,i)=><div key={i} className={`rounded-xl border-2 p-2 text-center ${i===state.index?"border-blue-500 bg-blue-50":state.loaded.includes(i)?"border-emerald-200 bg-emerald-50":"border-slate-200 bg-slate-50"}`}><p className="text-[10px] text-slate-500">상자 {i+1}</p><p className="py-1.5 text-lg font-bold">{state.seen.includes(i)?`${w}kg`:"?"}</p><p className="h-5 text-xs">{i===state.index?"🤖":state.loaded.includes(i)?"실음":""}</p></div>)}</div>
  <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={()=>act("check")}>🔍 상자 무게 확인</button><button type="button" className={button} onClick={()=>act("load")}>📦 트럭에 싣기</button><button type="button" className={button} onClick={()=>act("depart")}>🚚 트럭 출발 · 새 트럭</button><button type="button" className={button} disabled={state.index>=weights.length-1} onClick={()=>act("right")}>오른쪽으로 이동 ▶</button><button type="button" className={button} onClick={()=>{const used=state.trucks+(state.load>0?1:0);setAnswer(!done?"아직 싣지 않은 상자가 있습니다.":used===expected?`정답입니다! 트럭 ${expected}대가 필요합니다.`:`사용한 트럭 ${used}대 · 정답 ${expected}대. 작성한 조건과 트럭 수를 세는 방법을 확인하세요.`);}}>✅ 트럭 수 확인</button></div>
  {error&&<p role="alert" className="text-xs text-rose-700">{error}</p>}
  {answer&&<p role="status" className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900">{answer}</p>}
  <details className="text-xs"><summary className="cursor-pointer font-semibold">실습 기록 ({log.length}회)</summary><div className="mt-2 max-h-40 overflow-auto space-y-1 text-slate-600">{log.map((line,i)=><p key={i}>{i+1}. {line}</p>)}</div>{onCopyHistory&&log.length>0&&<button type="button" className={button+" mt-2"} onClick={()=>onCopyHistory(log.join("\n"))}>기록 복사</button>}</details>
  <div className="flex gap-2 border-t border-slate-100 pt-3"><button type="button" className={button} onClick={()=>reset()}>처음부터 다시</button><button type="button" className={button} onClick={()=>reset(true)}>새 상자로 다시</button></div>
 </div>;
}
