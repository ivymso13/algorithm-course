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
import { clampPageIndex, entriesForPage, pageCount } from "@/lib/boardPagination";
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

  // 0-indexed page into the board, BOARD_PAGE_SIZE entries at a time. See
  // lib/boardPagination.ts for why a plain page number stays stable across a
  // board refresh (entries only ever append in id order, they never reshuffle).
  const [page, setPage] = useState(0);

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

  // Load the board once submitted AND the teacher has opened the review
  // phase — before that, /write/explore shows a "waiting for everyone"
  // screen instead (see round.reviewOpenedAt). Keyed off the primitive
  // reviewOpenedAt value, not `round` itself, so this doesn't refire on
  // every background poll tick while still waiting.
  useEffect(() => {
    if (!mySubmission || !round?.reviewOpenedAt) return;
    const timer = window.setTimeout(() => loadBoard(), 0);
    return () => window.clearTimeout(timer);
  }, [mySubmission, round?.reviewOpenedAt, loadBoard]);

  // Every time the board (re)loads — including the refetch after a vote —
  // keep the same page number, just clamped to however many pages the board
  // now has. Adjusted during render (React's "store info from previous
  // renders" pattern), not via a useEffect + setState — this is derived
  // state, not a side effect, and doing it in an effect would just add an
  // extra render pass for no benefit (react-hooks/set-state-in-effect).
  const [reconciledForBoard, setReconciledForBoard] = useState<BoardEntry[] | null>(null);
  if (board !== reconciledForBoard) {
    setReconciledForBoard(board);
    setPage((prev) => clampPageIndex(prev, pageCount(board?.length ?? 0)));
  }

  const currentPageEntries = board ? entriesForPage(board, page) : [];

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
  const totalPages = board ? pageCount(board.length) : 0;
  // "평가 완료" — every other submission on the board has at least one
  // recommendation tag from this viewer. Derived straight from vote data on
  // each entry, so it survives a refresh instead of relying on client-only
  // view tracking, and it's the same definition the teacher's roster/round
  // views use server-side (see lib/warmupEvaluation.ts).
  const evaluatedCount = board ? board.filter((e) => e.myVotes.length > 0).length : 0;
  const allEvaluated = board !== null && board.length > 0 && evaluatedCount === board.length;
  // The practice sandbox is the "다음 기능" gated behind full evaluation —
  // only while the round is actually open for review; a closed round must
  // never leave a student stuck behind an unfinishable requirement.
  const practiceUnlocked = allEvaluated || !isOpen;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentStudentKey={studentLabel} onLogout={handleLogout} />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 sm:gap-5 px-4 py-4 sm:py-5 sm:px-6">
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

            {!round.reviewOpenedAt ? (
              /* Submitted, but the teacher hasn't opened the review phase
                 yet — poll silently in the background (useWarmupSession)
                 and this screen swaps out on its own once it does. */
              <div className="mx-auto w-full max-w-2xl">
                <section className="rounded-2xl border border-dashed border-blue-300 bg-blue-50/50 p-8 text-center shadow-xs space-y-3">
                  <div
                    className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl"
                    aria-hidden="true"
                  >
                    ⏳
                  </div>
                  <div>
                    <h1 className="text-base sm:text-lg font-bold text-slate-900">다른 학생들을 기다리는 중</h1>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">
                      모든 학생이 알고리즘을 제출하면 선생님이 확인 후 평가 단계를 엽니다.
                      <br />이 화면은 자동으로 갱신됩니다.
                    </p>
                  </div>
                </section>
              </div>
            ) : (
              <>
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
                ) : currentPageEntries.length > 0 ? (
                  <>
                {/* Header: title + page progress + refresh */}
                <div className="min-h-[32px] sm:min-h-[36px] flex items-center justify-between gap-2 px-1">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">다른 학생의 알고리즘</h2>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-600">
                      {page + 1} / {totalPages} 페이지
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        allEvaluated
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-amber-50 border-amber-200 text-amber-700"
                      }`}
                    >
                      {allEvaluated ? "✓ 평가 완료" : `평가 ${evaluatedCount}/${board.length}`}
                    </span>
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

                {/* Grid: up to BOARD_PAGE_SIZE peer algorithms per page */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {currentPageEntries.map((entry) => {
                    const isEvaluated = entry.myVotes.length > 0;
                    return (
                    <section
                      key={entry.id}
                      className={`flex flex-col rounded-2xl border bg-white p-3.5 shadow-xs space-y-2.5 ${
                        !isEvaluated && isOpen ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-800 truncate">
                          {entry.anonLabel}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {!isEvaluated && isOpen && (
                            <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              미평가
                            </span>
                          )}
                          {entry.experienced && (
                            <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                              체험 완료
                            </span>
                          )}
                        </div>
                      </div>

                      <pre className="max-h-56 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 overflow-y-auto border border-slate-100">
                        {entry.algorithmText}
                      </pre>

                      <a
                        href={`/execute?submissionId=${entry.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600 transition"
                      >
                        <span>상세 단계 체크 · 피드백 열기</span>
                        <span aria-hidden="true">➔</span>
                      </a>

                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                          <span>💡 추천하기</span>
                          {!isOpen && (
                            <span className="text-[10px] font-normal text-slate-400">(라운드 종료)</span>
                          )}
                        </div>
                        <div
                          className="flex flex-wrap gap-1.5"
                          role="group"
                          aria-label={`${entry.anonLabel} 추천 태그`}
                        >
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
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition cursor-pointer disabled:opacity-50 min-h-[32px] ${
                                  voted
                                    ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-300 shadow-2xs"
                                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 active:bg-slate-100"
                                }`}
                              >
                                <span aria-hidden="true">{WARMUP_VOTE_ICONS[type]}</span>
                                <span>{WARMUP_VOTE_LABELS[type]}</span>
                                <span
                                  className={`font-mono text-[10px] px-1 py-0.5 rounded-md ${
                                    voted ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {entry.voteCounts[type]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                    );
                  })}
                </div>

                {/* Pagination: jump between pages of BOARD_PAGE_SIZE entries */}
                {totalPages > 1 && (
                  <div
                    className="flex items-center justify-center gap-1.5 flex-wrap pt-1"
                    role="navigation"
                    aria-label="아이디어 페이지 이동"
                  >
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40 min-h-[32px]"
                    >
                      ‹ 이전
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPage(i)}
                        aria-current={i === page ? "page" : undefined}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold cursor-pointer min-h-[32px] min-w-[32px] ${
                          i === page
                            ? "bg-slate-900 text-white"
                            : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40 min-h-[32px]"
                    >
                      다음 ›
                    </button>
                  </div>
                )}

                {/* Practice sandbox: same random problem regardless of which
                    peer algorithms are currently on screen, so it's its own
                    section rather than paired 1:1 with a single entry.
                    Locked until every peer algorithm has been evaluated. */}
                <section className="flex flex-col space-y-1.5 sm:space-y-2">
                  <div className="px-1 space-y-0.5">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">🧪 새로운 문제로 실습하기</h2>
                    <p className="text-[11px] text-slate-500">
                      {practiceUnlocked
                        ? "위 알고리즘들을 보면서, 같은 유형의 새 무작위 문제로 직접 검증해보세요."
                        : "모든 알고리즘을 평가하면 실습이 열립니다."}
                    </p>
                  </div>

                  {!practiceUnlocked ? (
                    <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-6 text-center shadow-xs flex flex-col items-center justify-center space-y-1">
                      <span className="text-2xl" aria-hidden="true">🔒</span>
                      <p className="text-xs font-bold text-slate-700">
                        {evaluatedCount} / {board.length}개 알고리즘 평가 완료
                      </p>
                      <p className="text-[11px] text-slate-500">
                        위 목록에서 아직 추천 태그를 누르지 않은 알고리즘을 모두 평가해주세요.
                      </p>
                    </div>
                  ) : round.problemType ? (
                    <ProblemSandboxContainer problemType={round.problemType} defaultOpen={true} />
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs flex flex-col items-center justify-center space-y-1">
                      <p className="text-xs font-bold text-slate-700">이 문제는 별도 실습 도구가 준비되어 있지 않습니다</p>
                      <p className="text-[11px] text-slate-500">위 알고리즘을 읽고 추천 여부를 판단해보세요.</p>
                    </div>
                  )}
                </section>
              </>
            ) : null}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
