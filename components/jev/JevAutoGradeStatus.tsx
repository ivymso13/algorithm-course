"use client";

import { useEffect, useState } from "react";
import { JevResultCard } from "./JevResultCard";
import type { AutoRunView } from "@/lib/jevAuto";

const endpoint = "/api/warmup/jev-auto";
const ACTIVE = ["queued", "running", "retrying"];
const IDLE_POLL_MS = 20000;

type Step = "get" | "advance" | "retry";

/**
 * The student's automatic AI result for their latest submitted revision.
 * Status is read first (fast GET) so the queued state shows at once; while
 * the run is unfinished this page then drives it: each POST runs one bounded
 * wave of the student's own trials on the server, so progress continues
 * only while some student or teacher page is open. A failed, cancelled or
 * handed-over run is re-read every 20s, so a teacher resume shows up without
 * a reload.
 */
export function JevAutoGradeStatus({ roundId, revisionKey }: { roundId: number; revisionKey: string }) {
  const [state, setState] = useState<{ key: string; run: AutoRunView | null; unavailable: boolean; error: string | null } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const key = `${roundId}:${revisionKey}:${retryCount}`;

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const schedule = (step: Step, ms: number) => { timer = setTimeout(() => void run(step), ms); };
    async function run(step: Step) {
      try {
        const res = step === "get"
          ? await fetch(`${endpoint}?roundId=${roundId}`, { signal: controller.signal, cache: "no-store" })
          : await fetch(endpoint, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roundId, action: step }), signal: controller.signal,
          });
        const data = await res.json() as { run?: AutoRunView | null; serviceUnavailable?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error ?? "AI 실행 상태를 불러오지 못했습니다.");
        if (stopped) return;
        const view = data.run ?? null;
        const unavailable = Boolean(data.serviceUnavailable);
        setState({ key, run: view, unavailable, error: null });
        if (!view || view.status === "completed" || view.status === "skipped" || view.status === "superseded") return;
        if (!ACTIVE.includes(view.status)) schedule("get", IDLE_POLL_MS);
        else if (unavailable) schedule("advance", IDLE_POLL_MS);
        else schedule("advance", step === "get" ? 0 : view.status === "retrying" ? 5000 : 1500);
      } catch (err) {
        if (stopped) return;
        setState((prev) => ({ key, run: prev?.key === key ? prev.run : null, unavailable: false,
          error: err instanceof Error ? err.message : "연결을 확인하고 있습니다." }));
        schedule("get", 10000);
      }
    }
    void run(retryCount > 0 ? "retry" : "get");
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [roundId, key, retryCount]);

  const current = state?.key === key ? state : null;
  const run = current?.run ?? null;
  if (!run) {
    return current?.error ? (
      <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700">
        ⚠️ AI 실행 상태를 확인하지 못했습니다: {current.error} (잠시 후 다시 확인합니다)
      </p>
    ) : null;
  }

  if (run.status === "completed" && run.result) {
    return (
      <JevResultCard
        roundTitle={null}
        submissionText={run.result.submissionText}
        totalTrials={run.result.totalTrials}
        correctCount={run.result.correctCount}
        incorrectCount={run.result.incorrectCount}
        errorCount={run.result.errorCount}
        createdAt={run.result.createdAt}
        submissionVersion={run.submissionVersion}
        examples={run.result.examples}
      />
    );
  }

  const percent = run.totalTrials > 0 ? Math.floor((run.doneTrials / run.totalTrials) * 100) : 0;
  const active = ACTIVE.includes(run.status);
  return (
    <section role="status" aria-live="polite" className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-xs text-indigo-950 shadow-2xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold">🤖 AI 자동 실행 {run.status === "queued" ? "대기 중" : active ? "진행 중" : ""}</span>
        <span className="font-mono text-[11px] text-indigo-800">{run.doneTrials} / {run.totalTrials}회</span>
      </div>
      {active && (
        <progress value={run.doneTrials} max={run.totalTrials} aria-label={`AI 실행 ${percent}% 완료`}
          className="h-2 w-full overflow-hidden rounded-full bg-slate-200 [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:bg-indigo-600 [&::-moz-progress-bar]:bg-indigo-600" />
      )}
      {run.resultHidden ? (
        <p>모의(테스트) 실행이라 결과를 표시하지 않습니다.</p>
      ) : current?.unavailable ? (
        <p>AI 실행 서비스를 지금 사용할 수 없습니다. 제출은 저장되었고, 서비스가 준비되면 이어서 실행합니다.</p>
      ) : run.status === "retrying" ? (
        <p>AI 서비스 응답을 받지 못해 잠시 후 다시 시도합니다. 오답으로 처리하지 않으며 완료한 실행은 보존됩니다.</p>
      ) : run.status === "failed" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>AI 서비스 문제로 실행을 마치지 못했습니다. 오답으로 처리하지 않았고, 완료한 {run.doneTrials}회는 보존됩니다.</p>
          <button type="button" onClick={() => setRetryCount((n) => n + 1)}
            className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-600 cursor-pointer">
            남은 실행 다시 시도
          </button>
        </div>
      ) : run.status === "skipped" ? (
        <p>{run.message ?? "AI가 실행할 수 없는 형식이라 자동 실행을 건너뛰었습니다."}</p>
      ) : run.status === "cancelled" ? (
        <p>선생님이 AI 실행을 멈췄습니다. 완료한 실행은 보존되며, 선생님이 다시 시작하면 이어서 실행합니다.</p>
      ) : run.status === "transferred" ? (
        <p>선생님의 AI 실행에서 남은 회차를 이어서 채점합니다. 결과는 선생님 실행이 끝나면 표시됩니다.</p>
      ) : (
        <p>새로 만든 무작위 상자 배치 {run.totalTrials}개로 내 알고리즘을 실행하고 있습니다. 이 화면을 열어두면 실행이 이어지고, 닫으면 다시 열었을 때 이어서 실행합니다.</p>
      )}
      {current?.error && <p className="text-rose-700">{current.error}</p>}
    </section>
  );
}
