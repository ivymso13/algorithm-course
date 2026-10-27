"use client";

import { useEffect, useRef, useState } from "react";
import { JevJobResults } from "./JevJobResults";
import { JevJobPanel } from "./JevJobPanel";
import type { JevJobSummary } from "@/lib/jevJobTypes";

const endpoint = "/api/teacher/warmup/jev-batch-run";
export function JevRoundJob({ roundId, password }: { roundId: number; password: string }) {
  const [job, setJob] = useState<JevJobSummary | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mutation = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { headers: { "x-teacher-password": password }, signal: controller.signal })
      .then(async (res) => {
        const data = await res.json() as {error?: string; jobs: JevJobSummary[]; job: JevJobSummary};
        if (!res.ok) throw new Error(data.error ?? "실행 상태를 불러오지 못했습니다.");
        if (!controller.signal.aborted) setJob(data.jobs.find((j: JevJobSummary) => j.roundId === roundId) ?? null);
      }).catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [password, roundId]);

  // Each request checkpoints one wave (up to 5 parallel trials). Closing the tab pauses dispatch;
  // reopening it resumes the same persisted job after any live lease expires.
  const activeId = job && ["queued", "running"].includes(job.status) ? job.id : null;
  useEffect(() => {
    if (!activeId || error) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function tick() {
      const epoch = generation.current;
      try {
        const res = await fetch(endpoint, {
          method: "POST", headers: { "x-teacher-password": password, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "advance", jobId: activeId }), signal: controller.signal,
        });
        const data = await res.json() as {error?: string; jobs: JevJobSummary[]; job: JevJobSummary};
        if (!res.ok) throw new Error(data.error ?? "AI 실행을 잠시 멈췄습니다.");
        if (stopped || epoch !== generation.current) return;
        setJob(data.job);
        if (["queued", "running"].includes(data.job.status)) timer = setTimeout(tick, 1500);
      } catch (err) {
        if (!stopped && epoch === generation.current) setError(err instanceof Error ? err.message : "연결을 확인한 뒤 이어서 실행하세요.");
      }
    }
    timer = setTimeout(tick, 300);
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [activeId, password, error]);

  async function act(action: "start" | "resume" | "cancel") {
    if (mutation.current) return;
    mutation.current = true;
    generation.current++;
    setBusy(true);
    // Stop automatic dispatch until the mutation has returned.
    setError("작업 상태를 변경하고 있습니다.");
    try {
      const res = await fetch(endpoint, {
        method: "POST", headers: { "x-teacher-password": password, "Content-Type": "application/json" },
        body: JSON.stringify({ action, roundId, jobId: job?.id }),
      });
      const data = await res.json() as {error?: string; jobs: JevJobSummary[]; job: JevJobSummary};
      if (!res.ok) throw new Error(data.error ?? "실행 요청을 처리하지 못했습니다.");
      setJob(data.job);
      setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : "다시 시도하세요."); }
    finally { mutation.current = false; setBusy(false); }
  }
  return (
    <div className="space-y-2">
      <JevJobPanel job={job} busy={busy} error={busy ? null : error}
        onStart={() => void act("start")} onResume={() => void act("resume")} onCancel={() => void act("cancel")} />
      {activeId && error && !busy && (
        <button type="button" onClick={() => void act("resume")} className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600">
          연결 확인 후 이어서 실행
        </button>
      )}
      {activeId && <p className="text-xs text-slate-500">이 화면을 열어두면 실행이 이어집니다. 화면을 닫아도 저장된 진행 상황은 유지되며, 다시 열면 이어서 실행합니다.</p>}
      {job && <p className="text-xs text-slate-500">학생당 {job.trialsPerStudent}회 실행</p>}
      {job && <JevJobResults key={job.id} job={job} password={password} />}
    </div>
  );
}
