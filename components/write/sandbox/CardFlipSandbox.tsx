"use client";
import {useEffect,useState} from "react";
import {cardFlipProblem,cardFlipExpected,initialCardFlipState,type CardFlipState} from "@/lib/problems/cardflip";
const button="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 disabled:opacity-40";
export function CardFlipSandbox({onCopyHistory,peerMode=false}:{onCopyHistory?:(text:string)=>void;peerMode?:boolean}){
 const [initial,setInitial]=useState<boolean[]|null>(null),[state,setState]=useState<CardFlipState|null>(null),[log,setLog]=useState<string[]>([]),[error,setError]=useState("");
 // Generate random cards after hydration so server and client initial markup agree.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{const instance=cardFlipProblem.generate();setInitial(instance.input.cards);setState(instance.state as CardFlipState);},[]);
 function reset(fresh=false){const cards=fresh?cardFlipProblem.generate().input.cards:initial;if(!cards)return;setInitial(cards);setState(initialCardFlipState(cards));setLog([]);setError("");}
 function act(action:string){if(!initial||!state)return;try{const outcome=cardFlipProblem.applyAction(state,{n:initial.length,cards:initial},action,{});setState(outcome.state as CardFlipState);const text=action==='check'? `${state.index+1}번 카드 확인: ${state.cards[state.index]?'앞면':'뒷면'}`:action==='flip'?`${state.index+1}번 카드 뒤집기: ${state.cards[state.index]?'앞면 → 뒷면':'뒷면 → 앞면'}`:action==='left'?'왼쪽으로 한 칸 이동':'이번 차례 끝내기';setLog(prev=>[...prev,text]);setError("");}catch(e){setError(e instanceof Error?e.message:"행동을 실행하지 못했습니다.");}}
 if(!initial||!state)return <p className="p-4 text-xs text-slate-500">카드를 준비하는 중…</p>;
 const expected=cardFlipExpected(initial),correct=state.cards.every((face,i)=>face===expected[i]);
 return <div className="space-y-4">
  <p className="text-xs leading-6 text-slate-600">{peerMode?'친구가 작성한 문장만 따라 버튼을 누르세요. 판단 기준이 빠졌다면 임의로 보충하지 말고 피드백에 적어 주세요.':'앞면은 ●, 뒷면은 ▧입니다. 오른쪽 끝에서 시작해 한 차례의 카드 뒤집기를 직접 진행해 보세요.'}</p>
  <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-semibold">{state.finished?'이번 차례 종료':state.index<0?'카드가 더 없음':`현재 위치: ${state.index+1}번`}</span><span>처음 상태: {initial.map(face=>face?'●':'▧').join(' ')}</span></div>
  <div className="grid grid-cols-6 gap-1.5">{state.cards.map((face,i)=><div key={i} className={`rounded-xl border-2 p-2 text-center ${state.index===i&&!state.finished?'border-blue-600 ring-2 ring-blue-100':'border-slate-200'} ${face?'bg-white text-violet-700':'bg-slate-100 text-slate-600'}`}><p className="text-[10px] text-slate-500">{i+1}번</p><p className="py-2 text-2xl font-bold" aria-label={`${i+1}번 카드 ${face?'앞면':'뒷면'}`}>{face?'●':'▧'}</p><p className="text-[10px]">{face?'앞면':'뒷면'}</p><p className="h-5 text-xs">{state.index===i&&!state.finished?'▲':''}</p></div>)}</div>
  <p className="text-xs text-slate-600">마지막으로 확인한 면: <strong>{state.checked===null?'미확인':state.checked?'앞면':'뒷면'}</strong> · 확인 뒤 뒤집어도 이 기록은 유지됩니다.</p>
  <div className="flex flex-wrap gap-2">{[{action:'check',label:'카드 앞·뒷면 확인'},{action:'flip',label:'현재 카드 뒤집기'},{action:'left',label:'◀ 왼쪽으로 이동'},{action:'finish',label:'이번 차례 끝내기'}].map(item=><button key={item.action} type="button" className={button} disabled={state.finished||(state.index<0&&item.action!=='finish')} onClick={()=>act(item.action)}>{item.label}</button>)}</div>
  {error&&<p role="alert" className="text-xs text-rose-700">{error}</p>}
  {state.finished&&<div role="status" className={`rounded-xl p-3 text-xs leading-6 ${correct?'bg-emerald-50 text-emerald-900':'bg-amber-50 text-amber-900'}`}><strong>{correct?'정확하게 한 차례를 진행했습니다.':'규칙에 따른 결과와 다릅니다.'}</strong><p>현재 앞면 {state.cards.filter(Boolean).length}장 · 정답 앞면 {expected.filter(Boolean).length}장</p>{!correct&&<p>정답 배열: {expected.map(face=>face?'●':'▧').join(' ')} · 뒤집기 전에 확인한 면과 멈출 조건을 점검하세요.</p>}</div>}
  <details className="text-xs"><summary className="cursor-pointer font-semibold">실습 기록 ({log.length}회)</summary><div className="mt-2 max-h-40 overflow-auto space-y-1 text-slate-600">{log.map((line,i)=><p key={i}>{i+1}. {line}</p>)}</div>{onCopyHistory&&log.length>0&&<button className={button+" mt-2"} onClick={()=>onCopyHistory(log.join('\n'))}>기록 복사</button>}</details>
  <div className="flex gap-2 border-t border-slate-100 pt-3"><button type="button" className={button} onClick={()=>reset()}>처음부터 다시</button><button type="button" className={button} onClick={()=>reset(true)}>새 카드 배치</button></div>
 </div>;
}
