"use client";

import { useCallback, useEffect, useState } from 'react';
import type { JevJobSummary, JevJobItemSummary, JevJobItemResult } from '@/lib/jevJobTypes';
import { JevResultCard } from './JevResultCard';

const endpoint='/api/teacher/warmup/jev-batch-run';
const labels:Record<string,string>={pending:'진행 대기·실행 중',completed:'완료',failed:'서비스 오류',skipped:'검사 제외'};
export function JevJobResults({job,password}:{job:JevJobSummary;password:string}) {
  const [items,setItems]=useState<JevJobItemSummary[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<number|null>(null);
  const [detail,setDetail]=useState<JevJobItemResult|null>(null);
  const [detailError,setDetailError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const load=useCallback(async(signal:AbortSignal)=>{
    try{
      const response=await fetch(`${endpoint}?jobId=${job.id}`,{headers:{'x-teacher-password':password},cache:'no-store',signal});
      const data=await response.json() as {items?:JevJobItemSummary[];error?:string};
      if(!response.ok)throw new Error(data.error??'실행 결과를 불러오지 못했습니다.');
      if(!signal.aborted){setItems(data.items??[]);setError('');}
    }catch(e){if(!signal.aborted)setError(e instanceof Error?e.message:'실행 결과를 불러오지 못했습니다.');}
    finally{if(!signal.aborted)setLoading(false);}
  },[job.id,password]);
  // State is updated only after the external request settles.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load,job.completedTrials,job.status,refresh]);
  useEffect(()=>{
    if(selected===null)return;
    const controller=new AbortController();
    async function read(){
      try{
        const response=await fetch(`${endpoint}?jobId=${job.id}&itemId=${selected}`,{headers:{'x-teacher-password':password},cache:'no-store',signal:controller.signal});
        const data=await response.json() as {item?:JevJobItemResult;error?:string};
        if(!response.ok||!data.item)throw new Error(data.error??'상세 결과를 불러오지 못했습니다.');
        if(!controller.signal.aborted){setDetail(data.item);setDetailError('');}
      }catch(e){if(!controller.signal.aborted)setDetailError(e instanceof Error?e.message:'상세 결과 조회 실패');}
    }
    void read();return()=>controller.abort();
  },[selected,job.id,job.completedTrials,job.status,password,refresh]);
  return <section aria-label="학생별 AI 실행 결과" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-bold text-slate-900">학생별 실행 결과</h4><button type="button" onClick={()=>setRefresh(r=>r+1)} className="text-xs font-semibold text-blue-700">결과 새로고침</button></div>
    <p className="text-xs leading-6 text-slate-500">이 작업에서 검사한 제출 버전과 저장된 실행 결과입니다. 결과 조회는 AI를 다시 호출하지 않습니다.{job.mode==='mock'?' 모의 실행 결과이며 실제 JEV 평가가 아닙니다.':''}</p>
    {error&&<p role="alert" className="text-xs text-rose-700">{error}</p>}
    {loading?<p role="status" className="text-xs text-slate-500">결과를 불러오는 중…</p>:error&&items.length===0?null:items.length===0?<p className="text-xs text-slate-500">이 작업에 등록된 학생 제출이 없습니다.</p>:<div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[660px] text-left text-xs"><caption className="sr-only">학생별 AI 실행 횟수 및 결과</caption><thead className="bg-slate-50 text-slate-500"><tr>{['학생','제출 버전','상태','저장된 실행','통과','오답','실행 중단','상세'].map(t=><th key={t} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">{t}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{items.map(item=><tr key={item.id}><th scope="row" className="whitespace-nowrap px-3 py-3 font-semibold">{item.studentId} {item.studentName}</th><td className="px-3 py-3">{item.submissionVersion}</td><td className="px-3 py-3"><span className="whitespace-nowrap">{labels[item.status]??item.status}</span>{item.lastError&&<p className="mt-1 max-w-xs text-rose-700">{item.lastError}</p>}</td><td className="whitespace-nowrap px-3 py-3">{item.completedTrials} / {job.trialsPerStudent}</td><td className="px-3 py-3 text-emerald-700">{item.correctCount}</td><td className="px-3 py-3 text-rose-700">{item.incorrectCount}</td><td className="px-3 py-3 text-amber-700">{item.errorCount}</td><td className="px-3 py-3"><button type="button" aria-expanded={selected===item.id} onClick={()=>{setDetail(null);setDetailError('');setSelected(selected===item.id?null:item.id);}} className="whitespace-nowrap rounded-lg border border-slate-200 px-2 py-1.5 font-semibold text-blue-700">{selected===item.id?'닫기':'결과 보기'}</button></td></tr>)}</tbody></table></div>}
    {selected!==null&&<div className="space-y-3 rounded-xl bg-slate-50 p-3">{detailError?<p role="alert" className="text-xs text-rose-700">{detailError}</p>:!detail?<p role="status" className="text-xs text-slate-500">상세 결과를 불러오는 중…</p>:<>
      <h5 className="text-sm font-bold">{detail.studentId} {detail.studentName} · 검사한 버전 {detail.submissionVersion}</h5>
      <details><summary className="cursor-pointer text-xs font-semibold">검사한 알고리즘 원문</summary><pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-6">{detail.submissionText}</pre></details>
      {detail.status!=='completed'&&<p className="text-xs text-amber-800">{labels[detail.status]??detail.status} · 현재까지 저장된 실행만 표시합니다. 서비스 오류는 학생의 오답으로 집계하지 않습니다.</p>}
      {detail.completedTrials>0?<JevResultCard embedded roundTitle={null} submissionText={null} submissionVersion={detail.submissionVersion} totalTrials={detail.completedTrials} correctCount={detail.correctCount} incorrectCount={detail.incorrectCount} errorCount={detail.errorCount} examples={detail.trials}/>:<p className="text-xs text-slate-500">아직 저장된 실행 결과가 없습니다.{detail.lastError?` ${detail.lastError}`:''}</p>}
    </>}</div>}
  </section>;
}
