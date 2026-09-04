"use client";

/* Native <a> links intentionally avoid a client-router navigation bug seen in
 * some classroom browsers (see components/Navbar.tsx for the original fix):
 * after a next/link soft navigation, the destination page's client
 * components did not reliably hydrate, leaving buttons unresponsive. */

import { useCallback, useEffect, useState } from "react";
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
import {
  isCarouselFullyReviewed,
  nextCarouselId,
  reconcileCarouselId,
  resolveCarouselIndex,
} from "@/lib/boardCarousel";
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

  // The entry currently being reviewed, tracked by submission id (not raw
  // array index) — see lib/boardCarousel.ts for why that's what keeps the
  // carousel stable across a board refresh instead of jumping around.
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [viewedIds, setViewedIds] = useState<Set<number>>(new Set());

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

  // Every time the board (re)loads — including the refetch after a vote —
  // keep showing the same entry if it's still there; only fall back to the
  // first entry on the very first load or if the current one disappeared.
  // Adjusted during render (React's "store info from previous renders"
  // pattern), not via a useEffect + setState — this is derived state, not a
  // side effect, and doing it in an effect would just add an extra render
  // pass for no benefit (react-hooks/set-state-in-effect).
  const [reconciledForBoard, setReconciledForBoard] = useState<BoardEntry[] | null>(null);
  if (board !== reconciledForBoard) {
    setReconciledForBoard(board);
    setCurrentId((prev) => reconcileCarouselId(board ?? [], prev));
  }

  // Mark whatever entry is on screen as viewed, for the "모두 확인" progress
  // state — same during-render derivation, keyed off currentId.
  const [viewedForId, setViewedForId] = useState<number | null | undefined>(undefined);
  if (currentId !== viewedForId) {
    setViewedForId(currentId);
    if (currentId !== null) {
      setViewedIds((prev) => (prev.has(currentId) ? prev : new Set(prev).add(currentId)));
    }
  }

  function handleNext() {
    if (!board) return;
    setCurrentId(nextCarouselId(board, currentId));
  }

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
  const currentIndex = board ? resolveCarouselIndex(board, currentId) : 0;
  const currentEntry = board && board.length > 0 ? board[currentIndex] : null;
  const allReviewed = board ? isCarouselFullyReviewed(board, viewedIds) : false;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentStudentKey={studentLabel} onLogout={handleLogout} />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        {/* 3-Step Navigation */}
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
          <div className="mx-auto w-full max-w-2xl">
            <section className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-8 text-center shadow-xs space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl" aria-hidden="true">
                🔒
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900">
                  아이디어 & 추천 (잠김)
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">
                  알고리즘을 먼저 제출해야 다른 학생들의 아이디어와 추천, 새로운 무작위 문제 실습이 열립니다.
                </p>
              </div>
              <div className="pt-2">
                <a
                  href="/write/algorithm"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-blue-700 transition"
                >
                  <span>알고리즘 작성하러 가기 ➔</span>
                </a>
              </div>
            </section>
          </div>
        ) : (
          <>
            {/* Top: My Submitted Algorithm Summary (restrained & compact) */}
            <section className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs shadow-2xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 shrink-0">
                    ✓ 내 알고리즘 제출 완료
                  </span>
                  <p className="truncate font-mono text-[11px] text-slate-500 hidden sm:inline">
                    {mySubmission.algorithmText.replace(/\s+/g, " ")}
                  </p>
                </div>
                <a
                  href="/write/algorithm"
                  className="shrink-0 text-xs font-bold text-slate-700 hover:text-blue-600 transition"
                >
                  ✏️ 수정하기
                </a>
              </div>
            </section>

            {boardError && (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700 flex items-center justify-between gap-2"
              >
                <span>⚠️ {boardError}</span>
                <button
                  type="button"
                  onClick={loadBoard}
                  className="underline hover:text-rose-900 cursor-pointer text-xs"
                >
                  다시 시도
                </button>
              </div>
            )}

            {board === null ? (
              <div
                role="status"
                aria-live="polite"
                className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2 shadow-xs"
              >
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
                  aria-hidden="true"
                />
                <span>다른 학생의 아이디어를 불러오는 중...</span>
              </div>
            ) : board.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-400 space-y-2">
                <p>아직 다른 제출이 없습니다. 잠시 후 다시 확인해보세요.</p>
                <button
                  type="button"
                  onClick={loadBoard}
                  disabled={boardLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  <span>{boardLoading ? "새로고침 중..." : "새로고침 ↻"}</span>
                </button>
              </div>
            ) : currentEntry ? (
              <>
                {/* 2-Column Responsive Workspace: Left = Current Algorithm, Right = Practice Sandbox */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch lg:h-[calc(100vh-22rem)] lg:min-h-[580px] lg:max-h-[720px]">
                  {/* Left Column: The one algorithm currently being reviewed */}
                  <section className="flex flex-col lg:h-full space-y-2">
                    <div className="min-h-[36px] flex items-center justify-between gap-2 px-1 shrink-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 shrink-0">다른 학생의 알고리즘</h2>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-800 truncate">
                          {currentEntry.anonLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-600">
                          {currentIndex + 1} / {board.length}
                        </span>
                        {allReviewed && (
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            ✓ 모두 확인
                          </span>
                        )}
                        {currentEntry.experienced && (
                          <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            체험 완료
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="lg:flex-1 lg:min-h-0 flex flex-col rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
                      <pre className="max-h-72 lg:max-h-none lg:flex-1 lg:min-h-0 whitespace-pre-wrap rounded-xl bg-slate-50 p-3.5 sm:p-4 font-mono text-xs sm:text-sm leading-relaxed text-slate-800 overflow-y-auto border border-slate-100">
                        {currentEntry.algorithmText}
                      </pre>

                      <div className="flex items-center justify-between pt-0.5 text-xs shrink-0">
                        <a
                          href={`/execute?submissionId=${currentEntry.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600 transition"
                        >
                          <span>상세 단계 체크 · 피드백 열기</span>
                          <span aria-hidden="true">➔</span>
                        </a>
                        <button
                          type="button"
                          onClick={loadBoard}
                          disabled={boardLoading}
                          className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
                        >
                          {boardLoading ? "새로고침 중..." : "새로고침 ↻"}
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Right Column: Repeatable Practice on Fresh Random Instance */}
                  <section className="flex flex-col lg:h-full space-y-2">
                    <div className="min-h-[36px] flex flex-col justify-center px-1 space-y-0.5 shrink-0">
                      <h2 className="text-sm sm:text-base font-bold text-slate-900">🧪 새로운 문제로 실습하기</h2>
                      <p className="text-[11px] text-slate-500">
                        왼쪽 알고리즘을 보면서, 같은 유형의 새 무작위 문제로 직접 검증해보세요.
                      </p>
                    </div>

                    {round.problemType ? (
                      <ProblemSandboxContainer
                        problemType={round.problemType}
                        defaultOpen={true}
                        className="lg:flex-1 lg:min-h-0 lg:flex lg:flex-col"
                      />
                    ) : (
                      <div className="lg:flex-1 lg:min-h-0 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs flex flex-col items-center justify-center space-y-1">
                        <p className="text-xs font-bold text-slate-700">이 문제는 별도 실습 도구가 준비되어 있지 않습니다</p>
                        <p className="text-[11px] text-slate-500">
                          왼쪽 알고리즘을 읽고 추천 여부를 판단해보세요.
                        </p>
                      </div>
                    )}
                  </section>
                </div>

                {/* Bottom: Recommendation tags + 다음 아이디어 (always after both
                    columns, so mobile stacks 알고리즘 → 실습 → 추천/다음). */}
                <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    {/* Left: 4 Recommendation Vote Types */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <span>💡 이 알고리즘 추천하기</span>
                        {!isOpen && (
                          <span className="text-[11px] font-normal text-slate-400">(라운드 종료)</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2" role="group" aria-label="추천 태그">
                        {WARMUP_VOTE_TYPES.map((type) => {
                          const voted = currentEntry.myVotes.includes(type);
                          const pending = pendingVotes.has(`${currentEntry.id}:${type}`);
                          return (
                            <button
                              key={type}
                              type="button"
                              disabled={pending || !isOpen}
                              onClick={() => handleVote(currentEntry.id, type)}
                              aria-pressed={voted}
                              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer disabled:opacity-50 min-h-[40px] ${
                                voted
                                  ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-300 shadow-2xs"
                                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 active:bg-slate-100"
                              }`}
                            >
                              <span aria-hidden="true">{WARMUP_VOTE_ICONS[type]}</span>
                              <span>{WARMUP_VOTE_LABELS[type]}</span>
                              <span
                                className={`font-mono text-[11px] px-1.5 py-0.5 rounded-md ${
                                  voted ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {currentEntry.voteCounts[type]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right: Next Idea Button (Primary CTA) */}
                    <div className="pt-1 sm:pt-0 shrink-0">
                      <button
                        type="button"
                        onClick={handleNext}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-slate-800 active:bg-black transition cursor-pointer min-h-[42px]"
                      >
                        <span>다음 아이디어</span>
                        <span aria-hidden="true">➔</span>
                      </button>
                    </div>
                  </div>
                </section>
              </>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
