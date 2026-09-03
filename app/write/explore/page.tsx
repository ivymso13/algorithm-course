"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { StudentLoginCard } from "@/components/StudentLoginCard";
import { ProblemSandboxContainer } from "@/components/write/sandbox/ProblemSandboxContainer";
import { StudentStepNav } from "@/components/write/StudentStepNav";
import { useWarmupSession } from "@/components/write/useWarmupSession";
import {
  WARMUP_VOTE_ICONS,
  WARMUP_VOTE_LABELS,
  WARMUP_VOTE_TYPES,
  type WarmupVoteType,
} from "@/lib/warmupMeta";
import type { BoardEntry } from "@/components/write/types";

export default function WriteExplorePage() {
  const {
    checkingSession,
    loggedIn,
    studentLabel,
    round,
    mySubmission,
    sessionRestoredNotice,
    setSessionRestoredNotice,
    handleLogin,
    handleLogout,
    error: sessionError,
    loading: sessionLoading,
  } = useWarmupSession();

  const [board, setBoard] = useState<BoardEntry[] | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [pendingVotes, setPendingVotes] = useState<Set<string>>(new Set());

  const loadBoard = useCallback(async () => {
    setBoardLoading(true);
    setBoardError(null);
    try {
      const res = await fetch("/api/warmup/board");
      const data = (await res.json()) as { entries?: BoardEntry[]; error?: string };
      if (!res.ok) {
        setBoardError(data.error ?? "보드를 불러오지 못했습니다.");
        return;
      }
      setBoard(data.entries ?? []);
    } catch {
      setBoardError("보드를 불러오지 못했습니다.");
    } finally {
      setBoardLoading(false);
    }
  }, []);

  // Load board if user has submitted
  useEffect(() => {
    if (!mySubmission) return;
    const timer = window.setTimeout(() => loadBoard(), 0);
    return () => window.clearTimeout(timer);
  }, [mySubmission, loadBoard]);

  async function handleVote(submissionId: number, voteType: WarmupVoteType) {
    const key = `${submissionId}:${voteType}`;
    setPendingVotes((prev) => new Set(prev).add(key));
    try {
      const res = await fetch("/api/warmup/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, voteType }),
      });
      if (res.ok) await loadBoard();
    } finally {
      setPendingVotes((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="mx-auto flex flex-1 w-full items-center justify-center px-4 py-16 text-sm text-slate-500">
          <div role="status" aria-live="polite" className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span>세션 확인 중...</span>
          </div>
        </main>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="mx-auto flex flex-1 w-full items-center justify-center px-4 py-8 sm:py-12">
          <StudentLoginCard
            title="워밍업 참여"
            subtitle="학교와 학번을 입력해 시작하세요."
            stepNumber="3단계"
            onLogin={handleLogin}
            loading={sessionLoading}
            error={sessionError}
          />
        </main>
      </div>
    );
  }

  const hasSubmitted = Boolean(mySubmission);
  const isOpen = round?.status === "open";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentStudentKey={studentLabel} onLogout={handleLogout} />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        {/* 4-Step Navigation */}
        <StudentStepNav currentStep={3} hasSubmitted={hasSubmitted} />

        {sessionRestoredNotice && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs text-blue-900 flex items-center justify-between gap-2 shadow-2xs"
          >
            <span>👋 이전 세션이 복구되었습니다.</span>
            <button
              type="button"
              onClick={() => setSessionRestoredNotice(false)}
              className="text-blue-700 hover:text-blue-900 font-bold p-1 cursor-pointer"
              aria-label="알림 닫기"
            >
              ✕
            </button>
          </div>
        )}

        {!round ? (
          /* Empty / Waiting state */
          <section className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-xs space-y-2">
            <span className="text-3xl inline-block" aria-hidden="true">⏳</span>
            <h1 className="text-base font-bold text-slate-900">진행 중인 워밍업이 없습니다</h1>
            <p className="text-xs text-slate-500">선생님이 문제를 공개하면 화면이 자동으로 갱신됩니다.</p>
          </section>
        ) : !mySubmission ? (
          /* Locked State when not submitted */
          <section className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-8 text-center shadow-xs space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl" aria-hidden="true">
              🔒
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900">
                3단계: 아이디어 & 추천 (잠김)
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">
                알고리즘을 먼저 제출해야 다른 학생들의 아이디어와 추천, 새로운 무작위 문제 실습이 열립니다.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/write/algorithm"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-blue-700 transition"
              >
                <span>2단계: 알고리즘 작성하러 가기 ➔</span>
              </Link>
            </div>
          </section>
        ) : (
          <>
            {/* Top: My Submitted Algorithm Summary */}
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5 shadow-xs space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  ✓ 내 알고리즘 제출 완료
                </span>
                <Link
                  href="/write/algorithm"
                  className="rounded-lg border border-emerald-300 bg-white px-3 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition"
                >
                  ✏️ 알고리즘 수정하기
                </Link>
              </div>
              <pre className="whitespace-pre-wrap rounded-xl bg-white p-3 font-mono text-xs leading-relaxed text-slate-800 max-h-32 overflow-y-auto border border-emerald-100">
                {mySubmission.algorithmText}
              </pre>
            </section>

            {/* Center: Repeatable Practice on Fresh Random Instance */}
            {round.problemType ? (
              <section className="space-y-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">🧪 새로운 문제로 실습하기</h2>
                  <p className="text-[11px] text-slate-500">
                    내가 작성한 알고리즘이 다른 숫자나 조건에서도 잘 동작하는지 새 무작위 문제로 시험해보세요.
                  </p>
                </div>
                <ProblemSandboxContainer problemType={round.problemType} defaultOpen={true} />
              </section>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs space-y-1">
                <p className="text-xs font-bold text-slate-700">이 문제는 별도 실습 도구가 준비되어 있지 않습니다</p>
                <p className="text-[11px] text-slate-500">
                  아래에서 다른 학생들의 아이디어를 확인하고 추천·체험해보세요.
                </p>
              </section>
            )}

            {/* Bottom: Peer Ideas & Recommendation Board */}
            <section className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">🗳️ 다른 학생 아이디어 & 추천</h2>
                  {board && (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      {board.length}개
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={loadBoard}
                  disabled={boardLoading}
                  className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer disabled:opacity-50"
                >
                  {boardLoading ? "새로고침 중..." : "새로고침"}
                </button>
              </div>

              {boardError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                >
                  ⚠️ {boardError}
                </div>
              )}

              {board === null ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2"
                >
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
                    aria-hidden="true"
                  />
                  <span>아이디어 불러오는 중...</span>
                </div>
              ) : board.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-400">
                  아직 다른 제출이 없습니다. 잠시 후 새로고침해보세요.
                </div>
              ) : (
                <div className="space-y-3">
                  {board.map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-800">
                          {entry.anonLabel}
                        </span>
                        {entry.experienced && (
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            ✓ 체험 완료
                          </span>
                        )}
                      </div>

                      <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 max-h-40 overflow-y-auto">
                        {entry.algorithmText}
                      </pre>

                      {/* Recommendation Tags + 4. 체험하기 Link */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="추천 태그">
                          {WARMUP_VOTE_TYPES.map((type) => {
                            const voted = entry.myVotes.includes(type);
                            const pending = pendingVotes.has(`${entry.id}:${type}`);
                            return (
                              <button
                                key={type}
                                type="button"
                                disabled={pending || !isOpen}
                                onClick={() => handleVote(entry.id, type)}
                                aria-pressed={voted}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition cursor-pointer disabled:opacity-50 ${
                                  voted
                                    ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-300"
                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                <span aria-hidden="true">{WARMUP_VOTE_ICONS[type]}</span>
                                <span>{WARMUP_VOTE_LABELS[type]}</span>
                                <span className="font-mono text-[10px] text-slate-500">{entry.voteCounts[type]}</span>
                              </button>
                            );
                          })}
                        </div>

                        <Link
                          href={`/execute?submissionId=${entry.id}`}
                          className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition shrink-0"
                        >
                          4. 체험하기 ➔
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
