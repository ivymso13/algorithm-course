"use client";
import { useEffect,useState,useCallback,useRef } from "react";
import { JevResultCard } from "@/components/jev/JevResultCard";
type Version={id:number;revision:number;algorithm_text:string;reason:string;origin:string;ai_status:string|null;ai_result:string|null;ai_error:string|null;ai_lease_until:number|null;note:string|null;agrees:number|null};
type Review={id:number;version_id:number;revision:number;status:string;feedback:string|null;executable:number|null};
type Assignment={id:number;version_id:number;submission_id:number;anon_label:string;status:string};
type View={versions:Version[];incoming:Review[];outgoing:Assignment[];canRevise:boolean;roundStatus:string;overrideReason:string|null};
type AI={kind:string;notice?:string;interpretations:{step:number;text:string;action:string;confidence:number;accepted:boolean;reason?:string}[];trials:{numbers:number[];expected:number;output:number|null;correct:boolean;executable:boolean;failure?:string;trace?:{step:number;index:number;value:number|null;memo:number|null;output:number|null}[]}[]};
function SavedAIRecord({version}:{version:Version}) {
 let result:AI|null=null;try{if(version.ai_result)result=JSON.parse(version.ai_result);}catch{}
 if(!result)return <p className="mt-2 text-slate-600">{version.ai_status==='failed'?version.ai_error:version.ai_status==='running'?'해석 진행 중':'아직 JEV 결과가 저장되지 않았습니다.'}</p>;
 return <div className="mt-2 space-y-3">
  {result.kind==='execution' && result.trials.length===0 && <p className="rounded-lg bg-amber-50 p-3 text-amber-900">고정 테스트 10개 검사 보류 · 해석을 확정하지 못한 단계가 있어 실행하지 않았습니다. 오답으로 채점하지 않습니다.</p>}
  {result.interpretations.map((p,i)=><div key={i} className="rounded-lg border p-2"><strong>{p.step}단계 · {p.accepted?'해석 완료':'해석 확인 필요'}</strong><p className="mt-1">{p.text}</p><p className="mt-1">JEV: {p.action}</p>{p.reason&&<p className="mt-1 text-amber-800">{p.reason}</p>}</div>)}
  {result.notice&&<p>{result.notice}</p>}
  {result.trials.length>0&&<JevResultCard fixedCases roundTitle={null} submissionText={version.algorithm_text} totalTrials={result.trials.length} correctCount={result.trials.filter(t=>t.correct).length} incorrectCount={result.trials.filter(t=>t.executable&&!t.correct).length} errorCount={result.trials.filter(t=>!t.executable).length} examples={result.trials.map((t,i)=>({trialIndex:i,numbers:t.numbers,correct:t.executable?t.correct:null,executable:t.executable,failedStep:null,finalAnswer:t.output,correctAnswer:t.expected,failureReason:t.failure}))}/>}
  {result.trials.map((t,i)=><details key={i}><summary>사례 {i+1} · [{t.numbers.join(', ')}] · 실행 기록</summary>{t.trace?.map((p,j)=><p key={j}>{p.step}단계 · 위치 {p.index+1} · 메모 {p.memo??'없음'} · 출력 {p.output??'없음'}</p>)}{t.failure&&<p>{t.failure}</p>}</details>)}
 </div>;
}
export function ResearchPanel({roundId}:{roundId:number}) {
  const [view,setView]=useState<View|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[note,setNote]=useState(""),[agrees,setAgrees]=useState(true);
  const load=useCallback(async()=>{const r=await fetch('/api/warmup/research?roundId='+roundId,{cache:'no-store'});if(!r.ok)throw new Error('활동 기록을 불러오지 못했습니다.');setView(await r.json() as View);},[roundId]);
  useEffect(()=>{let active=true;const read=()=>load().catch(e=>{if(active)setError(e.message);});void read();const timer=setInterval(read,5000);return()=>{active=false;clearInterval(timer);};},[roundId,load]);
  const latest=view?.versions.at(-1);
  const lastAttempt=useRef(0);
  useEffect(()=>{setNote(latest?.note??"");setAgrees(latest?.agrees!==0);},[latest?.id]);
  const execute=useCallback(async(id:number)=>{setBusy(true);setError("");try{const r=await fetch('/api/warmup/research-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({versionId:id})});if(!r.ok)throw new Error('JEV 요청을 시작하지 못했습니다.');await load();}catch(e){setError(e instanceof Error?e.message:'연결 오류');}finally{setBusy(false);}},[load]);
  const needsRun=view?.roundStatus==='open'&&!!latest&&(latest.ai_status==='queued'||latest.ai_status===null||latest.ai_status==='running'&&!!latest.ai_lease_until&&latest.ai_lease_until<Date.now());
  useEffect(()=>{if(latest&&needsRun&&Date.now()-lastAttempt.current>=4500){lastAttempt.current=Date.now();void execute(latest.id);}},[latest,needsRun,execute]);
  async function saveNote(){if(!latest)return;setError("");const r=await fetch('/api/warmup/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({versionId:latest.id,agrees,note})});const d=await r.json() as {error?:string};if(!r.ok)setError(d.error??'의견을 저장하지 못했습니다.');else await load();}
  if(!view)return <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900">{error||'제출·피드백 기록을 불러오는 중…'}</p>;
  if(!latest)return null;
  let ai:AI|null=null;try{if(latest.ai_result)ai=JSON.parse(latest.ai_result);}catch{/* invalid saved payload */}
  const complete=view.incoming.filter(r=>r.status==='completed').length;
  return <section className="space-y-4 rounded-2xl border border-indigo-200 bg-white p-4 shadow-xs">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-bold">내 문장 → 실행자의 이해 → 수정</h2><a href="/write/history" className="text-xs font-bold text-blue-700">이전 활동 기록 →</a></div>
    <p className="rounded-xl bg-blue-50 p-3 text-xs leading-6 text-blue-900">{view.roundStatus==='closed'?'종료된 활동입니다. 원문과 해석·피드백·수정 이력을 확인할 수 있습니다.':view.canRevise?'동료 피드백을 참고해 알고리즘을 수정할 수 있습니다.':`첫 제출은 고정되어 있습니다. 받은 동료 평가 ${complete}/${view.incoming.length||'배정 대기'} · 모든 평가가 도착하면 수정이 열립니다.`}</p>
    {view.overrideReason&&<p className="text-xs text-amber-800">교사 예외 개방: {view.overrideReason}</p>}
    <details><summary className="cursor-pointer text-sm font-bold">원문과 수정 이력 ({view.versions.length}개)</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{view.versions.map(v=><article key={v.id} className="rounded-xl bg-slate-50 p-3 text-xs"><h3 className="font-bold">버전 {v.revision}{v.origin==='legacy'?' · 기존 자료 기준본':''}</h3><pre className="mt-2 whitespace-pre-wrap font-sans leading-6">{v.algorithm_text}</pre>{v.reason&&<p className="mt-2 text-blue-900">수정 이유: {v.reason}</p>}{v.ai_result&&<details className="mt-2"><summary>이 버전의 JEV 기록</summary><SavedAIRecord version={v}/></details>}</article>)}</div></details>
    <h3 className="text-sm font-bold">JEV 채점·해석 기록 · 버전 {latest.revision}</h3>
    {(busy||latest.ai_status==='running'||latest.ai_status==='queued')&&<p role="status" className="text-xs text-slate-500">JEV가 명령을 읽고 있습니다. 원문은 이미 저장되어 있으며 평가 참여는 가능합니다.</p>}
    {latest.ai_status==='failed'&&<div className="text-xs text-amber-900"><p>{latest.ai_error}</p><button disabled={busy||view.roundStatus!=="open"} onClick={()=>execute(latest.id)} className="mt-2 rounded-lg border px-3 py-2">다시 읽기</button></div>}
    {ai&&<>{ai.kind==='execution'&&ai.trials.length===0&&<div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900"><strong>고정 테스트 10개 · 검사 보류</strong><p>JEV가 해석을 확정하지 못한 단계가 있어 테스트를 실행하지 않았습니다. 오답으로 채점하지 않습니다. 아래 해석 확인이 필요한 단계와 동료 피드백을 참고해 수정해 주세요.</p></div>}<p className="text-xs text-slate-500">AI 해석은 학생 능력의 판정이 아닙니다. 의도와 다른 부분을 표시해 주세요.</p>{ai.notice&&<p className="rounded-xl bg-amber-50 p-3 text-xs">{ai.notice}</p>}
      {ai.interpretations.map((p,i)=><div key={i} className="grid gap-2 rounded-xl border border-slate-100 p-3 text-xs sm:grid-cols-2"><div><strong>{p.step}단계 · 내 문장</strong><p className="mt-1 leading-6">{p.text}</p></div><div><strong>{p.accepted?'JEV의 해석':'해석 후보 · 확인 필요'}</strong><p className="mt-1 leading-6">{p.action}</p>{p.reason&&<p className="text-amber-800">{p.reason}</p>}</div></div>)}
      <div className="space-y-2 rounded-xl bg-blue-50 p-3 text-xs"><label className="flex gap-2"><input type="checkbox" disabled={view.roundStatus!=="open"} checked={agrees} onChange={e=>setAgrees(e.target.checked)}/>JEV의 해석이 내 의도와 같습니다</label><textarea disabled={view.roundStatus!=="open"} value={note} onChange={e=>setNote(e.target.value)} maxLength={2000} placeholder="어느 단계에서 의도와 다르게 읽었나요? 같은 경우에도 관찰한 점을 남길 수 있습니다." className="w-full rounded-lg border p-2"/><button disabled={view.roundStatus!=="open"} onClick={saveNote} className="rounded-lg bg-blue-600 px-3 py-2 font-bold text-white">해석 확인 기록하기</button>{latest.note!==null&&<p>저장된 의견: {latest.agrees?'의도와 일치':'의도와 불일치'} · {latest.note}</p>}</div>
      {ai.trials.map((t,i)=><details key={i} className="rounded-xl border border-slate-200 p-3 text-xs"><summary className="cursor-pointer font-bold">사례 {i+1} · [{t.numbers.join(', ')}] · 실행 과정 보기</summary><div className="mt-2 max-h-60 overflow-auto">{t.trace?.map((p,j)=><p key={j} className="border-b py-2">{p.step}단계 · 위치 {p.index+1} · 확인 {p.value??'미확인'} · 메모 {p.memo??'없음'}{p.output!==null?` · 출력 ${p.output}`:''}</p>)}{t.failure&&<p className="text-amber-900">{t.failure}</p>}</div></details>)}
      {ai.trials.length>0&&<JevResultCard fixedCases roundTitle={null} submissionText={latest.algorithm_text} totalTrials={ai.trials.length} correctCount={ai.trials.filter(t=>t.correct).length} incorrectCount={ai.trials.filter(t=>t.executable&&!t.correct).length} errorCount={ai.trials.filter(t=>!t.executable).length} examples={ai.trials.map((t,i)=>({trialIndex:i,numbers:t.numbers,correct:t.executable?t.correct:null,executable:t.executable,failedStep:null,finalAnswer:t.output,correctAnswer:t.expected,failureReason:t.failure}))}/>}
    </>}
    <h3 className="text-sm font-bold">받은 동료 피드백</h3>{view.incoming.length===0?<p className="text-xs text-slate-500">교사가 평가를 열면 평가자가 배정됩니다.</p>:view.incoming.map((r,i)=><article key={r.id} className="rounded-xl bg-slate-50 p-3 text-xs"><strong>평가자 {i+1} · 버전 {r.revision}</strong><p className="mt-1 leading-6">{r.status==='completed'?r.feedback:'평가 대기 중'}</p></article>)}
    <h3 className="text-sm font-bold">내가 평가할 알고리즘</h3><p className="text-xs text-slate-500">친구의 첫 원문을 직접 따라 실행하고, 이해가 갈린 단계를 구체적으로 적어 주세요. 친구의 JEV 결과는 제공되지 않습니다.</p>{view.outgoing.map(a=><a key={a.id} href={`/execute?submissionId=${a.submission_id}`} className="block rounded-xl border border-slate-200 p-3 text-xs font-bold text-blue-700">{a.anon_label} · {a.status==='completed'?'평가 제출 완료':'실행하고 평가하기 →'}</a>)}
    {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
  </section>;
}
