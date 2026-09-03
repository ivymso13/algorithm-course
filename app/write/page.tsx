"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { StudentLoginCard } from "@/components/StudentLoginCard";
import {
  WARMUP_VOTE_ICONS,
  WARMUP_VOTE_LABELS,
  WARMUP_VOTE_TYPES,
  type WarmupVoteType,
} from "@/lib/warmupMeta";

type RoundInfo = {
  id: number;
  title: string;
  prompt: string;
  status: "draft" | "open" | "closed";
};

type MySubmission = {
  id: number;
  algorithmText: string;
  createdAt: string;
  updatedAt: string;
};

type BoardEntry = {
  id: number;
  anonLabel: string;
  algorithmText: string;
  voteCounts: Record<WarmupVoteType, number>;
  myVotes: WarmupVoteType[];
  experienced: boolean;
};

export default function WritePage() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [studentLabel, setStudentLabel] = useState<string | null>(null);
  const [round, setRound] = useState<RoundInfo | null>(null);
  const [mySubmission, setMySubmission] = useState<MySubmission | null>(null);
  const [sessionRestoredNotice, setSessionRestoredNotice] = useState(false);

  const [algorithmText, setAlgorithmText] = useState("");
  const [draftRestoredNotice, setDraftRestoredNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const [board, setBoard] = useState<BoardEntry[] | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [pendingVotes, setPendingVotes] = useState<Set<string>>(new Set());

  const loadRound = useCallback(async (): Promise<{ ok: boolean; hadSubmission: boolean }> => {
    const res = await fetch("/api/warmup/round");
    if (res.status === 401) {
      setLoggedIn(false);
      return { ok: false, hadSubmission: false };
    }
    const data = (await res.json()) as {
      studentKey?: string;
      round: RoundInfo | null;
      mySubmission: MySubmission | null;
    };
    setLoggedIn(true);
    if (data.studentKey) setStudentLabel(data.studentKey);
    setRound(data.round);
    setMySubmission(data.mySubmission);
    if (data.mySubmission && !algorithmText) {
      setAlgorithmText(data.mySubmission.algorithmText);
    }
    return { ok: true, hadSubmission: Boolean(data.mySubmission) };
  }, [algorithmText]);

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

  // On mount, check session
  useEffect(() => {
    let ignore = false;
    const timer = window.setTimeout(() => {
      loadRound()
        .then(({ ok, hadSubmission }) => {
          if (ignore) return;
          if (ok && hadSubmission) {
            setSessionRestoredNotice(true);
            window.setTimeout(() => setSessionRestoredNotice(false), 4000);
          }
        })
        .catch(() => {
          // treat as logged out
        })
        .finally(() => {
          if (!ignore) setCheckingSession(false);
        });
    }, 0);
    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once submitted, load anonymous board
  useEffect(() => {
    if (!mySubmission) return;
    const timer = window.setTimeout(() => loadBoard(), 0);
    return () => window.clearTimeout(timer);
  }, [mySubmission, loadBoard]);

  // Poll while waiting for teacher to publish round
  useEffect(() => {
    if (checkingSession || !loggedIn || round) return;
    const interval = window.setInterval(() => {
      loadRound().catch(() => {});
    }, 3500);
    return () => window.clearInterval(interval);
  }, [checkingSession, loggedIn, round, loadRound]);

  // Restore draft if not yet submitted
  useEffect(() => {
    if (!round || mySubmission) return;
    const draftKey = `algo_warmup_draft_${round.id}`;
    const timer = window.setTimeout(() => {
      try {
        const saved = sessionStorage.getItem(draftKey);
        if (saved && !algorithmText) {
          setAlgorithmText(saved);
          setDraftRestoredNotice(true);
          window.setTimeout(() => setDraftRestoredNotice(false), 4000);
        }
      } catch {
        // ignore
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.id, mySubmission]);

  function handleAlgorithmChange(text: string) {
    setAlgorithmText(text);
    if (round) {
      const draftKey = `algo_warmup_draft_${round.id}`;
      try {
        if (text.trim()) sessionStorage.setItem(draftKey, text);
        else sessionStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
    }
  }

  async function handleLogin(courseCode: string, school: string, studentId: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseCode, school, studentId, consent: true }),
      });
      const data = (await res.json()) as { studentKey?: string; error?: string };
      if (!res.ok || !data.studentKey) throw new Error(data.error ?? "로그인에 실패했습니다.");
      setStudentLabel(data.studentKey);
      await loadRound();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoggedIn(false);
    setRound(null);
    setMySubmission(null);
    setBoard(null);
    setAlgorithmText("");
    try {
      await fetch("/api/student/logout", { method: "POST" });
    } catch {
      // ignore
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!round) return;
    setError(null);

    const trimmed = algorithmText.trim();
    if (trimmed.length < 10) {
      setError("알고리즘을 10자 이상 단계별로 적어주세요.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/warmup/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ algorithmText: trimmed }),
      });
      const data = (await res.json()) as { mySubmission?: MySubmission; error?: string };
      if (res.status === 401) {
        setLoggedIn(false);
        setError("세션이 만료되었습니다. 다시 로그인해주세요.");
        return;
      }
      if (!res.ok || !data.mySubmission) throw new Error(data.error ?? "제출에 실패했습니다.");

      try {
        sessionStorage.removeItem(`algo_warmup_draft_${round.id}`);
      } catch {
        // ignore
      }
      setMySubmission(data.mySubmission);
      setSubmitSuccess("알고리즘이 성공적으로 제출되었습니다.");
      window.setTimeout(() => setSubmitSuccess(null), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
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
            subtitle="수업 코드와 학교, 학번을 입력해 시작하세요."
            stepNumber="1단계"
            onLogin={handleLogin}
            loading={loading}
            error={error}
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
        {/* 5-Stage Visual Workflow Tracker */}
        <nav
          aria-label="워밍업 진행 순서"
          className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs"
        >
          <div className="flex items-center justify-between gap-1 overflow-x-auto text-[11px] font-medium text-slate-500">
            <div className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg ${round ? "bg-blue-50 text-blue-800 font-bold" : "text-slate-400"}`}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">1</span>
              <span>현재 문제</span>
            </div>
            <span className="text-slate-300">➔</span>

            <div className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg ${hasSubmitted ? "bg-emerald-50 text-emerald-800 font-bold" : round ? "bg-blue-50 text-blue-800 font-bold ring-1 ring-blue-300" : "text-slate-400"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${hasSubmitted ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"}`}>
                {hasSubmitted ? "✓" : "2"}
              </span>
              <span>알고리즘 작성</span>
            </div>
            <span className="text-slate-300">➔</span>

            <div className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg ${hasSubmitted ? "bg-blue-50 text-blue-800 font-bold" : "text-slate-400 opacity-60"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${hasSubmitted ? "bg-blue-600 text-white" : "bg-slate-300 text-slate-700"}`}>3</span>
              <span>익명 아이디어</span>
            </div>
            <span className="text-slate-300">➔</span>

            <div className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg ${hasSubmitted ? "bg-blue-50 text-blue-800 font-bold" : "text-slate-400 opacity-60"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${hasSubmitted ? "bg-blue-600 text-white" : "bg-slate-300 text-slate-700"}`}>4</span>
              <span>추천</span>
            </div>
            <span className="text-slate-300">➔</span>

            <div className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg ${hasSubmitted ? "bg-emerald-50 text-emerald-800 font-bold" : "text-slate-400 opacity-60"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${hasSubmitted ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-700"}`}>5</span>
              <span>단계별 체험</span>
            </div>
          </div>
        </nav>

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
        ) : (
          <>
            {/* 1. 현재 문제 (Current Problem) */}
            <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 sm:p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">1. 현재 문제</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isOpen
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {isOpen ? "진행 중" : "종료됨"}
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900">{round.title}</h1>
              <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {round.prompt}
              </p>
            </section>

            {submitSuccess && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 shadow-xs flex items-center gap-2"
              >
                <span aria-hidden="true">✓</span>
                <span>{submitSuccess}</span>
              </div>
            )}

            {/* 2. 알고리즘 작성 (Algorithm Writing) */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">2. 알고리즘 작성</h2>
                  {hasSubmitted && (
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      제출 완료 (수정 가능)
                    </span>
                  )}
                </div>
                <span className={`text-xs font-mono ${algorithmText.trim().length >= 10 ? "text-slate-500" : "text-amber-600"}`}>
                  {algorithmText.length} / 4,000자
                </span>
              </div>

              {draftRestoredNotice && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs text-blue-900 flex items-center justify-between gap-2">
                  <span>💾 작성 중이던 초안이 복구되었습니다.</span>
                  <button
                    type="button"
                    onClick={() => setDraftRestoredNotice(false)}
                    className="text-blue-700 hover:text-blue-900 font-bold p-1 cursor-pointer"
                    aria-label="초안 알림 닫기"
                  >
                    ✕
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                  required
                  rows={6}
                  disabled={!isOpen}
                  aria-label="알고리즘 내용"
                  className="w-full min-h-[140px] rounded-xl border border-slate-300 bg-slate-50/50 p-3 font-mono text-base sm:text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 focus:outline-hidden disabled:opacity-60"
                  placeholder={`1. 시작 조건 확인\n2. 단계별 구체적 조작\n3. 종료 및 결과 출력`}
                  value={algorithmText}
                  onChange={(e) => handleAlgorithmChange(e.target.value)}
                />

                {error && (
                  <div role="alert" aria-live="assertive" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                    ⚠️ {error}
                  </div>
                )}

                {isOpen ? (
                  <button
                    type="submit"
                    disabled={loading || !algorithmText.trim()}
                    className="w-full rounded-xl bg-blue-600 py-2.5 px-4 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    {loading ? "저장 중..." : hasSubmitted ? "수정 내용 저장" : "알고리즘 제출 ➔"}
                  </button>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-1">이 라운드는 종료되어 제출할 수 없습니다.</p>
                )}
              </form>
            </section>

            {/* 3 & 4. 익명 아이디어 & 추천 (Anonymous Ideas & Recommendations) */}
            {!hasSubmitted ? (
              <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-xs space-y-1">
                <p className="text-xs font-bold text-slate-700">🔒 3·4·5단계 (익명 아이디어 · 추천 · 체험)</p>
                <p className="text-[11px] text-slate-500">
                  내 알고리즘을 제출하면 다른 학생들의 아이디어를 확인하고 추천·체험할 수 있습니다.
                </p>
              </section>
            ) : (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">3. 익명 아이디어 & 4. 추천</h2>
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
                  <div role="alert" aria-live="assertive" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                    ⚠️ {boardError}
                  </div>
                )}

                {board === null ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
                    아이디어 불러오는 중...
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

                        {/* Recommendation Tags (추천) + Direct Experience Link (단계별 체험) */}
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
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition shrink-0"
                          >
                            5. 체험하기 ➔
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
