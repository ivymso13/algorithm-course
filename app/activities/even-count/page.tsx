"use client";

import { useEffect, useState } from "react";
import type { EvenInterpretation, runEven } from "@/lib/evenActivity";

type Trial = ReturnType<typeof runEven>;
type Result = { mode: string; interpretations: EvenInterpretation[]; trials: Trial[]; correctCount: number };
const example = "1. 현재 상자의 숫자를 확인한다.\n2. 확인한 숫자가 짝수이면 메모지에 1을 더한다.\n3. 오른쪽에 상자가 남아 있으면 오른쪽으로 한 칸 이동하고 1단계부터 다시 한다.\n4. 메모지의 수를 정답으로 제출한다.";
const labels: Record<string, string> = { CHECK: "상자 숫자 확인", ADD_EVEN: "짝수일 때만 1 더하기", ADD: "항상 1 더하기", MOVE: "오른쪽으로 이동", LOOP_MOVE: "상자가 남으면 이동하고 반복", LOOP: "상자가 남으면 이전 단계 반복", OUTPUT: "메모지의 수 제출", NONE: "해석 확인 필요" };

export default function EvenCountPage() {
  const [text, setText] = useState(""); const [password, setPassword] = useState("");
  const [result, setResult] = useState<Result | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);
  useEffect(() => { setText(localStorage.getItem("even-count-draft") ?? ""); }, []);
  async function grade() {
    setBusy(true); setError(""); setResult(null);
    try {
      const steps = text.split("\n").map(s => s.trim().replace(/^\d+[.)]\s*/, "")).filter(Boolean);
      if (!steps.length) throw new Error("먼저 알고리즘을 작성해 주세요.");
      const response = await fetch("/api/even-activity", { method: "POST", headers: { "Content-Type": "application/json", "x-teacher-password": password }, body: JSON.stringify({ steps }) });
      const data = await response.json() as Result & { error?: string }; if (!response.ok) throw new Error(data.error ?? "채점 요청을 완료하지 못했습니다.");
      setResult(data); setSelected(0);
    } catch (e) { setError(e instanceof Error ? e.message : "채점 요청을 완료하지 못했습니다."); }
    finally { setBusy(false); }
  }
  const trial = result?.trials[selected];
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <div className="mx-auto max-w-6xl px-5 py-10">
      <a href="/" className="text-sm text-blue-700">← 활동 홈</a>
      <div className="mt-6 flex flex-wrap items-center gap-3"><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">자연어 프로그래밍 · 체험 활동</span><span className="text-sm text-slate-500">조건과 반복</span></div>
      <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">상자 속 짝수 세기</h1>
      <p className="mt-3 max-w-3xl leading-7 text-slate-600">로봇에게 말로 지시해 보세요. JEV가 읽은 명령을 실행해서, 서로 다른 상자에서도 짝수를 정확히 세는지 확인합니다.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold">미션</h2><p className="mt-3 leading-7">한 줄로 놓인 상자 <strong>5개</strong>에 0~10 사이의 숫자가 하나씩 들어 있습니다. <strong>짝수가 들어 있는 상자의 개수</strong>를 정답으로 제출하세요.</p>
          <div className="my-5 flex gap-2" aria-label="예시 상자: 3, 8, 2, 7, 4">{[3,8,2,7,4].map((n,i) => <div key={i} className={`flex h-14 flex-1 items-center justify-center rounded-xl border-2 text-xl font-bold ${n % 2 === 0 ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-200 bg-slate-50"}`}>{n}</div>)}</div>
          <p className="text-sm text-slate-500">이 예시의 정답은 3입니다. 0도 짝수입니다.</p>
          <ul className="mt-5 space-y-2 text-sm leading-6"><li>• 로봇은 첫 상자 앞에서 시작합니다.</li><li>• 메모지는 0으로 시작합니다.</li><li>• 상자를 열거나 확인하면 현재 숫자를 읽습니다.</li><li>• 이동하면 새 상자의 숫자를 다시 확인해야 합니다.</li><li>• 조건이 거짓이면 다음 단계로 진행합니다.</li></ul>
          <h3 className="mt-6 font-bold">사용할 수 있는 행동</h3><div className="mt-3 flex flex-wrap gap-2">{["상자 확인", "메모지에 1 더하기", "짝수 조건", "오른쪽 이동", "이전 단계 반복", "정답 제출"].map(s => <span key={s} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">{s}</span>)}</div>
          <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">조건에는 <strong>언제 무엇을 할지</strong>, 반복에는 <strong>어떤 조건에서 몇 단계로 돌아갈지</strong> 적어 주세요. 반복과 이동을 한 문장에 쓸 수 있습니다.</div>
          <details className="mt-5 text-sm"><summary className="cursor-pointer font-semibold text-blue-700">예시 알고리즘 보기</summary><pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans leading-6">{example}</pre><button className="mt-2 rounded-lg border border-blue-200 px-3 py-2 text-blue-700" disabled={busy} onClick={() => { setText(example); localStorage.setItem("even-count-draft", example); setResult(null); }}>예시로 체험하기</button></details>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold">내 알고리즘</h2><label htmlFor="algorithm" className="mt-3 block text-sm text-slate-600">한 줄에 한 단계씩 작성하세요. 표현은 직접 정해도 됩니다.</label>
          <textarea id="algorithm" className="mt-3 min-h-72 w-full resize-y rounded-xl border border-slate-300 p-4 text-base leading-8 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="1. 현재 상자의 숫자를 확인한다.&#10;2. …" maxLength={2000} value={text} disabled={busy} onChange={e => { setText(e.target.value); localStorage.setItem("even-count-draft", e.target.value); setResult(null); }}/>
          <p className="mt-1 text-right text-xs text-slate-400">{text.length} / 2,000자 · 최대 12단계</p>
          <label htmlFor="password" className="mt-4 block text-sm font-semibold">체험용 교사 비밀번호</label><input id="password" type="password" autoComplete="current-password" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" value={password} onChange={e => setPassword(e.target.value)} placeholder="기존 교사 비밀번호"/>
          <button onClick={grade} disabled={busy || !text.trim()} className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-4 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "JEV가 문장을 읽고 있습니다…" : "JEV로 해석하고 채점하기"}</button>
          <p className="mt-3 text-xs leading-5 text-slate-500">이 활동은 개인 체험용입니다. 학생 성적에는 저장되지 않습니다. 해석한 명령은 6가지 상자 배열에서 실행합니다.</p>
          {error && <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}
        </section>
      </div>
      {result && <section aria-live="polite" className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold">{result.trials.length ? `${result.correctCount} / ${result.trials.length}개 사례 정답` : "문장을 수정한 뒤 다시 실행해 주세요"}</h2>
        <h3 className="mt-5 font-semibold">JEV가 이해한 명령</h3><div className="mt-3 space-y-2">{result.interpretations.map((p,i) => <div key={i} className={`rounded-xl p-4 ${p.accepted ? "bg-slate-50" : "bg-amber-50"}`}><p className="text-sm text-slate-500">{p.step}단계 · {p.text}</p><p className="mt-1 font-semibold">{labels[p.action] ?? p.action}</p>{p.reason && <p className="mt-2 text-sm text-amber-900">{p.reason}</p>}</div>)}</div>
        {result.trials.length > 0 && <><h3 className="mt-6 font-semibold">실행 결과</h3><div className="mt-3 flex flex-wrap gap-2">{result.trials.map((t,i) => <button key={i} onClick={() => setSelected(i)} className={`rounded-xl border px-3 py-2 text-sm ${selected === i ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}>사례 {i+1} · {t.correct ? "정답" : t.executable ? "오답" : "실행 불가"}</button>)}</div>
          {trial && <><p className="mt-4">상자: {trial.numbers.join(" → ")} · 정답: {trial.expected} · 제출: {trial.output ?? "없음"}</p>{trial.failure && <p className="mt-2 text-amber-800">{trial.failure}</p>}<details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-blue-700">한 단계씩 실행한 과정 보기</summary><div className="mt-3 max-h-96 overflow-auto">{trial.trace.map((t,i) => <p key={i} className="border-b border-slate-100 py-2 text-sm">{t.step}단계 · 상자 {t.index+1} · 확인한 숫자 {t.value ?? "없음"} · 메모 {t.memo}{t.output !== null ? ` · 제출 ${t.output}` : ""}</p>)}</div></details></>}
        </>}
      </section>}
    </div>
  </main>;
}
