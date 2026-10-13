"use client";
import {useEffect,useState} from "react";
export function StudentPreviewBanner(){
 const [preview,setPreview]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{fetch("/api/warmup/student-preview").then(async r=>await r.json() as {preview:boolean}).then(d=>setPreview(d.preview)).catch(()=>{});},[]);
 async function receive(){setBusy(true);try{const r=await fetch("/api/warmup/student-preview",{method:"POST"});const d=await r.json() as {error?:string};if(!r.ok)throw new Error(d.error);location.reload();}catch(e){setMessage(e instanceof Error?e.message:"다시 시도해 주세요.");setBusy(false);}}
 if(!preview)return null;
 return <aside className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm"><div className="mx-auto max-w-6xl"><strong>학생 체험 · 연구 자료 제외</strong><p className="mt-1">실습 → 알고리즘 작성·제출 → JEV 해석 확인 → 예시 동료평가 받기 → 수정 순서로 진행하세요. 다른 두 예시 알고리즘도 평가할 수 있습니다.</p><button disabled={busy} onClick={()=>void receive()} className="mt-2 rounded-lg bg-amber-800 px-3 py-2 font-bold text-white disabled:opacity-50">{busy?"준비 중…":"예시 동료평가 받기"}</button><span className="ml-3">실제 학생의 평가가 아닌 체험용 예시입니다.</span>{message&&<p role="alert" className="mt-2 text-rose-700">{message}</p>}</div></aside>;
}
