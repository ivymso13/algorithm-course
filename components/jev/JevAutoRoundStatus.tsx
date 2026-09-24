"use client";

import { useEffect, useRef, useState } from "react";
import type { AutoRoundSummary } from "@/lib/jevAuto";

const endpoint = "/api/teacher/warmup/jev-batch-run";

/**
 * Teacher view of the automatic per-submission AI grading of one maxbox
 * round. While runs are unfinished this panel also drives them (one bounded
 * wave per request), so grading continues while it stays open.
 */
export function JevAutoRoundStatus({ roundId, password }: { roundId: number; password: string }) {
  const [auto, setAuto] = useState<AutoRoundSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);

  const pending = auto ? auto.queued + auto.running + auto.retrying : 0;
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const epoch = generation.current;
    async function tick(action: "auto-status" | "auto-advance") {
      try {
        const res = await fetch(endpoint, {
          method: "POST", headers: { "x-teacher-password": password, "Content-Type": "application/json" },
          body: JSON.stringify({ action, roundId }), signal: controller.signal,
        });
        const data = await res.json() as { auto?: AutoRoundSummary; error?: string };
        if (!res.ok || !data.auto) throw new Error(data.error ?? "자동 실행 상태를 불러오지 못했습니다.");
        if (stopped || epoch !== generation.current) return;
        setAuto(data.auto);
        setError(null);
        const next = data.auto.queued + data.auto.running + data.auto.retrying > 0;
        timer = setTimeout(() => void tick(next ? "auto-advance" : "auto-status"), next ? 1500 : 15000);
      } catch (err) {
        if (stopped || epoch !== generation.current) return;
        setError(err instanceof Error ? err.message : "연결을 확인하고 있습니다.");
        timer = setTimeout(() => void tick("auto-status"), 10000);
      }
    }
    void tick("auto-status");
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [password, roundId, busy]);

  async function act(action: "auto-cancel" | "auto-resume") {
    generation.current++;
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST", headers: { "x-teacher-password": password, "Content-Type": "application/json" },
        body: JSON.stringify({ action, roundId }),
      });
      const data = await res.json() as { auto?: AutoRoundSummary; error?: string };
      if (!res.ok || !data.auto) throw new Error(data.error ?? "요청을 처리하지 못했습니다.");
      setAuto(data.auto);
      setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : "다시 시도하세요."); }
    finally { setBusy(false); }
  }

  if (!auto || auto.total === 0) return error ? <p className="text-xs text-rose-700">{error}</p> : null;
  const canResume = auto.failed + auto.cancelled > 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-700 space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-slate-900">🤖 제출 즉시 AI 자동 실행 (학생당 10회)</span>
        <span className="font-mono text-[11px]">{auto.doneTrials} / {auto.totalTrials}회</span>
      </div>
      <p>
        완료 {auto.completed}명 · 진행 {auto.running + auto.queued}명
        {auto.retrying > 0 && <> · 재시도 대기 {auto.retrying}명</>}
        {auto.failed > 0 && <> · 실패 {auto.failed}명</>}
        {auto.cancelled > 0 && <> · 중단 {auto.cancelled}명</>}
        {auto.skipped > 0 && <> · 건너뜀 {auto.skipped}명</>}
      </p>
      {pending > 0 && <p className="text-slate-500">학생이나 이 화면이 열려 있는 동안 실행이 이어집니다. 모든 화면이 닫히면 멈췄다가 다시 열면 이어서 실행합니다.</p>}
      {error && <p className="text-rose-700">{error}</p>}
      <div className="flex gap-2">
        {pending > 0 && (
          <button type="button" disabled={busy} onClick={() => void act("auto-cancel")}
            className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 cursor-pointer">
            자동 실행 중단
          </button>
        )}
        {canResume && (
          <button type="button" disabled={busy} onClick={() => void act("auto-resume")}
            className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 cursor-pointer">
            남은 실행 이어서 하기
          </button>
        )}
      </div>
    </div>
  );
}
