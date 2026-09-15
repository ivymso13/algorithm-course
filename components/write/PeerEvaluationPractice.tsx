"use client";

import { useState } from "react";

const executionOptions = [
  ["success", "실행 성공"],
  ["partial", "일부 수행 가능"],
  ["impossible", "실행 불가능"],
  ["wrong", "잘못된 결과"],
] as const;

const solvedOptions = [
  ["solved", "해결함"],
  ["not_solved", "해결하지 못함"],
  ["uncertain", "판단하기 어려움"],
] as const;

export function PeerEvaluationPractice() {
  const [open, setOpen] = useState(true);
  const [execution, setExecution] = useState("");
  const [solved, setSolved] = useState("");
  const [location, setLocation] = useState("");
  const [checked, setChecked] = useState(false);
  const correct = execution === "wrong" && solved === "not_solved";

  return (
    <section className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-xs">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 bg-indigo-50/70 px-4 py-3 text-left sm:px-5"
        aria-expanded={open}
      >
        <div>
          <span className="text-[11px] font-bold text-indigo-700">평가 연습</span>
          <h2 className="text-sm font-black text-slate-900">예시 알고리즘을 먼저 평가해보세요</h2>
        </div>
        <span className="shrink-0 text-xs font-bold text-indigo-700">{open ? "접기 ▲" : "열기 ▼"}</span>
      </button>

      {open && (
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-bold text-slate-500">연습 문제</p>
              <p className="mt-1 text-sm font-bold text-slate-900">숫자 카드 [4, 1, 7, 3]에서 가장 큰 수를 찾으세요.</p>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-bold text-slate-500">평가할 알고리즘</p>
              <ol className="space-y-2">
                {["첫 번째 숫자를 답으로 정한다.", "다음 숫자가 현재 답보다 작으면 답을 그 숫자로 바꾼다.", "모든 숫자를 확인할 때까지 2단계를 반복하고 답을 말한다."].map((step, index) => (
                  <li key={step} className="flex gap-2 rounded-xl border border-slate-200 p-3 text-xs text-slate-800">
                    <span className="font-black text-indigo-700">{index + 1}</span><span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-bold text-slate-800">1. 실행 결과는 어떤가요?</p>
              <div className="grid grid-cols-2 gap-2">
                {executionOptions.map(([value, label]) => <button key={value} type="button" onClick={() => { setExecution(value); setChecked(false); }} className={`rounded-xl border px-2 py-2.5 text-xs font-bold ${execution === value ? "border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-200" : "border-slate-200 text-slate-600"}`}>{label}</button>)}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold text-slate-800">2. 문제를 해결했나요?</p>
              <div className="grid grid-cols-3 gap-2">
                {solvedOptions.map(([value, label]) => <button key={value} type="button" onClick={() => { setSolved(value); setChecked(false); }} className={`rounded-xl border px-2 py-2.5 text-xs font-bold ${solved === value ? "border-indigo-500 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-200" : "border-slate-200 text-slate-600"}`}>{label}</button>)}
              </div>
            </div>
            <label className="block text-xs font-bold text-slate-800">3. 문제가 있는 단계와 이유
              <textarea value={location} onChange={(event) => setLocation(event.target.value)} rows={2} placeholder="예: 2단계에서 비교 방향이…" className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-base sm:text-xs" />
            </label>
            <button type="button" disabled={!execution || !solved || !location.trim()} onClick={() => setChecked(true)} className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white disabled:opacity-40">내 평가 확인하기</button>
            {checked && <div role="status" className={`rounded-xl border p-3 text-xs leading-relaxed ${correct ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}><p className="font-black">{correct ? "핵심 판단이 맞았습니다." : "다시 실행 과정을 살펴보세요."}</p><p className="mt-1">이 알고리즘은 문장대로 끝까지 실행할 수 있지만, 2단계의 비교 방향이 반대여서 가장 작은 수인 1을 답으로 냅니다. 따라서 <b>‘잘못된 결과’</b>이면서 <b>‘해결하지 못함’</b>으로 평가하는 것이 적절합니다.</p></div>}
          </div>
        </div>
      )}
    </section>
  );
}
