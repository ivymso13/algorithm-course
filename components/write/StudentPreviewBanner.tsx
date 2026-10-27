"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { StudentPreviewStatus } from "@/lib/studentPreview";

export function StudentPreviewBanner() {
  const pathname = usePathname();
  const [status, setStatus] = useState<StudentPreviewStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadStatus = useCallback(async () => {
    const r = await fetch("/api/warmup/student-preview", { cache: "no-store" });
    if (!r.ok) return;
    const d = (await r.json()) as StudentPreviewStatus;
    setStatus(d);
  }, []);

  useEffect(() => {
    const read = () => {
      loadStatus().catch(() => {});
    };
    read();
    const timer = window.setInterval(read, 5000);
    return () => window.clearInterval(timer);
  }, [loadStatus]);

  async function receive() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/warmup/student-preview", { method: "POST" });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error);
      window.location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "다시 시도해 주세요.");
      setBusy(false);
    }
  }

  if (!status?.preview) return null;

  const hasSubmitted = Boolean(status.hasSubmitted);
  const revision = status.revision ?? 0;
  const incomingCompleted = status.incomingCompleted ?? 0;
  const incomingTotal = status.incomingTotal ?? 2;
  const outgoingCompleted = status.outgoingCompleted ?? 0;
  const outgoingTotal = status.outgoingTotal ?? 2;
  const feedbackReceived = hasSubmitted && incomingTotal > 0 && incomingCompleted >= incomingTotal;
  const aiDone = status.aiStatus === "completed" || status.aiStatus === "failed";
  const revised = revision >= 2;
  const cleanTitle = status.roundTitle?.replace(/^\[학생 체험\]\s*/, "") ?? "학생 체험 활동";

  const isPracticeStep = pathname === "/write";

  const flowSteps = [
    { num: 1, label: "실습·규칙 파악", done: hasSubmitted || !isPracticeStep, active: !hasSubmitted && isPracticeStep },
    { num: 2, label: "1차 작성·제출", done: hasSubmitted, active: !hasSubmitted && !isPracticeStep },
    { num: 3, label: "JEV 해석 확인", done: hasSubmitted && aiDone, active: hasSubmitted && !aiDone },
    {
      num: 4,
      label: hasSubmitted ? `동료평가 (${incomingCompleted}/${incomingTotal || 2})` : "동료평가",
      done: feedbackReceived,
      active: hasSubmitted && !feedbackReceived,
    },
    {
      num: 5,
      label: revised ? `수정 완료 (v${revision})` : "피드백 반영 수정",
      done: revised,
      active: feedbackReceived && !revised,
    },
  ];

  return (
    <aside
      aria-label="학생 체험 진행 안내"
      className="border-b border-amber-200/90 bg-amber-50/90 px-4 py-2.5 text-xs text-slate-800 sm:px-6"
    >
      <div className="mx-auto max-w-6xl space-y-2">
        {/* Top Row: Identity, Current Activity, and Return Links */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-900 px-2 py-0.5 text-[11px] font-bold text-white">
              🧪 학생 체험 · 연구 자료 제외
            </span>
            <span className="rounded-md border border-amber-300/80 bg-white px-2 py-0.5 text-[11px] font-bold text-amber-950">
              {cleanTitle}
            </span>
            <span className="rounded-md bg-amber-100/80 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
              {hasSubmitted ? `현재 버전 ${revision}` : "제출 전"}
              {hasSubmitted && outgoingTotal > 0 ? ` · 내 동료평가 ${outgoingCompleted}/${outgoingTotal}` : ""}
            </span>
            <span className="hidden text-[11px] text-amber-800/90 sm:inline">
              · 실제 학생의 평가가 아닌 체험용 예시입니다.
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-semibold">
            <a
              href="/teacher/student-preview"
              className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-amber-900 transition hover:bg-amber-100/60"
            >
              다른 활동 체험
            </a>
            <a
              href="/teacher"
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-700 transition hover:bg-slate-100"
            >
              ← 교사 콘솔
            </a>
          </div>
        </div>

        {/* Bottom Row: 5-Step Flow Strip + Primary Contextual Action */}
        <div className="flex flex-col justify-between gap-2.5 border-t border-amber-200/60 pt-2 lg:flex-row lg:items-center">
          <ol aria-label="체험 진행 단계" className="flex flex-wrap items-center gap-1.5">
            {flowSteps.map((step, idx) => (
              <li key={step.num} className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    step.done
                      ? "bg-emerald-100 text-emerald-900"
                      : step.active
                      ? "bg-amber-200/90 font-bold text-amber-950 ring-1 ring-amber-400"
                      : "bg-white/70 text-slate-500"
                  }`}
                >
                  <span className="font-mono text-[10px] font-bold">
                    {step.done ? "✓" : step.num}
                  </span>
                  <span>{step.label}</span>
                </span>
                {idx < flowSteps.length - 1 && (
                  <span className="text-[10px] text-amber-700/60" aria-hidden="true">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center gap-2">
            {!hasSubmitted ? (
              <span className="text-[11px] text-amber-900">
                1차 제출 후 예시 동료평가 가능
              </span>
            ) : feedbackReceived && !revised ? (
              <a
                href="/write/algorithm"
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-700"
              >
                ✏️ 받은 피드백으로 알고리즘 수정하기 →
              </a>
            ) : null}

            <button
              type="button"
              disabled={busy}
              onClick={() => void receive()}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer disabled:opacity-50 ${
                hasSubmitted && !feedbackReceived
                  ? "bg-amber-900 text-white shadow-2xs hover:bg-amber-950"
                  : feedbackReceived
                  ? "border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                  : "border border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
              }`}
            >
              {busy
                ? "준비 중…"
                : feedbackReceived
                ? "✓ 예시 동료평가 받기 완료"
                : "예시 동료평가 받기"}
            </button>
          </div>
        </div>

        {message && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
            ⚠️ {message}
          </p>
        )}
      </div>
    </aside>
  );
}
