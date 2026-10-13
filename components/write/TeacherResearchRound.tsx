"use client";
import { useCallback,useEffect,useState } from "react";
type Row={id:number;student_id:string;student_name:string;revision:number;required:number;completed:number;override_reason:string|null};
export function TeacherResearchRound({roundId,password}:{roundId:number;password:string}){
  const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(""),[reason,setReason]=useState("");
  const load=useCallback(async()=>{const r=await fetch(`/api/teacher/warmup/research?roundId=${roundId}`,{headers:{'x-teacher-password':password}});if(r.ok)setRows((await r.json() as {rows:Row[]}).rows);},[roundId,password]);
  useEffect(()=>{void load();const timer=setInterval(load,10000);return()=>clearInterval(timer);},[load]);
  async function open(id:number){const r=await fetch('/api/teacher/warmup/revision-open',{method:'POST',headers:{'Content-Type':'application/json','x-teacher-password':password},body:JSON.stringify({submissionId:id,reason})});const d=await r.json() as {error?:string};if(!r.ok)setError(d.error??'개방 실패');else{setError("");await load();}}
  return <section className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/30 p-3 text-xs"><h3 className="font-bold">동료 피드백과 수정 진행</h3><p>평가를 열 때 학생마다 최대 2명의 평가자가 배정됩니다. 모두 받은 학생부터 수정이 가능합니다.</p><label className="block">결석 등으로 수정 예외 개방이 필요한 경우 사유<input value={reason} maxLength={2000} onChange={e=>setReason(e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="사유를 5자 이상 입력"/></label>{rows.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2"><span>{r.student_id} {r.student_name} · 버전 {r.revision} · 받은 평가 {r.completed}/{r.required}{r.override_reason?' · 예외 개방':''}</span><button disabled={reason.trim().length<5} onClick={()=>open(r.id)} className="rounded border px-2 py-1 disabled:opacity-40">수정 예외 개방</button></div>)}{error&&<p role="alert" className="text-red-700">{error}</p>}</section>;
}
