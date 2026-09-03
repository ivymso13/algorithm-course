"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { StudentLoginCard } from "@/components/StudentLoginCard";
import { ProblemSandboxContainer } from "@/components/write/sandbox/ProblemSandboxContainer";
import type { ProblemType } from "@/lib/assignments";
import { parseAlgorithmSteps, serializeAlgorithmSteps } from "@/lib/algorithmSteps";
import {
  WARMUP_VOTE_ICONS,
  WARMUP_VOTE_LABELS,
  WARMUP_VOTE_TYPES,
  type WarmupVoteType,
} from "@/lib/warmupMeta";

/** The step editor always shows at least one row, even when restored/parsed content is empty. */
function ensureAtLeastOneStep(steps: string[]): string[] {
  return steps.length > 0 ? steps : [""];
}

type RoundInfo = {
  id: number;
  title: string;
  prompt: string;
  status: "draft" | "open" | "closed";
  problemType: ProblemType | null;
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

  const [steps, setSteps] = useState<string[]>([""]);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [draftRestoredNotice, setDraftRestoredNotice] = useState(false);
  const [sandboxCopyNotice, setSandboxCopyNotice] = useState(false);
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
    if (data.mySubmission && steps.every((s) => !s.trim())) {
      setSteps(ensureAtLeastOneStep(parseAlgorithmSteps(data.mySubmission.algorithmText)));
    }
    return { ok: true, hadSubmission: Boolean(data.mySubmission) };
  }, [steps]);

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
        const hasContent = steps.some((s) => s.trim().length > 0);
        if (saved && !hasContent) {
          setSteps(ensureAtLeastOneStep(parseAlgorithmSteps(saved)));
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

  /** Every step mutation (edit/add/remove/move) routes through here so the
   * sessionStorage draft — still the same "1. ...\n2. ..." string as before —
   * always stays in sync with the current step array. */
  function applyStepsChange(nextSteps: string[]) {
    setSteps(nextSteps);
    if (round) {
      const draftKey = `algo_warmup_draft_${round.id}`;
      const serialized = serializeAlgorithmSteps(nextSteps);
      try {
        if (serialized.trim()) sessionStorage.setItem(draftKey, serialized);
        else sessionStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
    }
  }

  function handleStepTextChange(index: number, value: string) {
    const next = [...steps];
    next[index] = value;
    applyStepsChange(next);
  }

  function handleAddStep() {
    applyStepsChange([...steps, ""]);
  }

  function handleRemoveStep(index: number) {
    if (steps.length <= 1) return;
    applyStepsChange(steps.filter((_, i) => i !== index));
  }

  function handleMoveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    applyStepsChange(next);
  }

  /**
   * Only ever runs when the student clicks the sandbox's own "기록 복사"
   * button (passed in as `onCopyHistory`) — never automatically. An empty
   * draft is simply filled in; existing content is preserved unless the
   * student explicitly confirms appending, so a practice run can never
   * silently overwrite algorithm text already written. The sandbox's own
   * numbered summary is parsed into individual steps before appending.
   */
  function handleCopySandboxHistory(summary: string) {
    const parsedFromSandbox = parseAlgorithmSteps(summary);
    const hasContent = steps.some((s) => s.trim().length > 0);
    if (!hasContent) {
      applyStepsChange(ensureAtLeastOneStep(parsedFromSandbox));
    } else {
      const confirmed = window.confirm(
        "이미 작성한 알고리즘 내용이 있습니다. 실습 기록을 뒤에 추가할까요?"
      );
      if (!confirmed) return;
      applyStepsChange([...steps, ...parsedFromSandbox]);
    }
    setSandboxCopyNotice(true);
    window.setTimeout(() => setSandboxCopyNotice(false), 3500);
  }

  async function handleLogin(school: string, studentId: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school, studentId, consent: true }),
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
    setSteps([""]);
    setSubmitAttempted(false);
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
    setSubmitAttempted(true);

    const emptyStepNumbers = steps
      .map((step, index) => (step.trim() ? null : index + 1))
      .filter((n): n is number => n !== null);
    if (emptyStepNumbers.length > 0) {
      setError(`단계 ${emptyStepNumbers.join(", ")}의 내용을 입력해주세요.`);
      return;
    }

    const serialized = serializeAlgorithmSteps(steps);
    if (serialized.trim().length < 10) {
      setError("알고리즘을 10자 이상 단계별로 적어주세요.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/warmup/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ algorithmText: serialized }),
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
            subtitle="학교와 학번을 입력해 시작하세요."
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
  const serializedText = serializeAlgorithmSteps(steps);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentStudentKey={studentLabel} onLogout={handleLogout} />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        {/* 6-Stage Visual Workflow Tracker */}
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

            <div className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg ${round ? "bg-blue-50 text-blue-800 font-bold" : "text-slate-400"}`}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">2</span>
              <span>직접 실습</span>
            </div>
            <span className="text-slate-300">➔</span>

            <div className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg ${hasSubmitted ? "bg-emerald-50 text-emerald-800 font-bold" : round ? "bg-blue-50 text-blue-800 font-bold ring-1 ring-blue-300" : "text-slate-400"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${hasSubmitted ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"}`}>
                {hasSubmitted ? "✓" : "3"}
              </span>
              <span>알고리즘 작성</span>
            </div>
            <span className="text-slate-300">➔</span>

            <div className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg ${hasSubmitted ? "bg-blue-50 text-blue-800 font-bold" : "text-slate-400 opacity-60"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${hasSubmitted ? "bg-blue-600 text-white" : "bg-slate-300 text-slate-700"}`}>4</span>
              <span>익명 아이디어</span>
            </div>
            <span className="text-slate-300">➔</span>

            <div className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg ${hasSubmitted ? "bg-blue-50 text-blue-800 font-bold" : "text-slate-400 opacity-60"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${hasSubmitted ? "bg-blue-600 text-white" : "bg-slate-300 text-slate-700"}`}>5</span>
              <span>추천</span>
            </div>
            <span className="text-slate-300">➔</span>

            <div className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg ${hasSubmitted ? "bg-emerald-50 text-emerald-800 font-bold" : "text-slate-400 opacity-60"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${hasSubmitted ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-700"}`}>6</span>
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

            {/* 2. 직접 실습해보기 (Interactive Sandbox) — hidden when the round can't be
                mapped to a sandbox (legacy round with no matching problem); writing is
                unaffected either way. */}
            {round.problemType && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider px-1">
                  2. 직접 실습해보기
                </span>
                <ProblemSandboxContainer
                  problemType={round.problemType}
                  onCopyHistory={handleCopySandboxHistory}
                  defaultOpen={false}
                />
              </div>
            )}

            {sandboxCopyNotice && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-900 shadow-2xs flex items-center gap-2"
              >
                <span aria-hidden="true">🧪</span>
                <span>실습 기록이 알고리즘 초안에 반영되었습니다.</span>
              </div>
            )}

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

            {/* 3. 알고리즘 작성 (Algorithm Writing) */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">3. 알고리즘 작성</h2>
                  {hasSubmitted && (
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      제출 완료 (수정 가능)
                    </span>
                  )}
                </div>
                <span className={`text-xs font-mono ${serializedText.trim().length >= 10 ? "text-slate-500" : "text-amber-600"}`}>
                  {serializedText.length} / 4,000자
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
                <div className="space-y-2.5">
                  {steps.map((step, index) => {
                    const stepInvalid = submitAttempted && !step.trim();
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <label htmlFor={`step-${index}`} className="text-xs font-semibold text-slate-700">
                            단계 {index + 1}
                          </label>
                          {steps.length > 1 && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveStep(index, -1)}
                                disabled={!isOpen || index === 0}
                                aria-label={`단계 ${index + 1} 위로 이동`}
                                className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-[11px] text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveStep(index, 1)}
                                disabled={!isOpen || index === steps.length - 1}
                                aria-label={`단계 ${index + 1} 아래로 이동`}
                                className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-[11px] text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              >
                                ▼
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveStep(index)}
                                disabled={!isOpen}
                                aria-label={`단계 ${index + 1} 삭제`}
                                className="flex h-6 w-6 items-center justify-center rounded-md border border-rose-200 text-rose-500 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                        <textarea
                          id={`step-${index}`}
                          rows={2}
                          disabled={!isOpen}
                          aria-label={`단계 ${index + 1} 내용`}
                          aria-invalid={stepInvalid}
                          aria-describedby={stepInvalid ? `step-${index}-error` : undefined}
                          className={`w-full min-h-[64px] rounded-xl border bg-slate-50/50 p-2.5 font-mono text-base sm:text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:outline-hidden disabled:opacity-60 ${
                            stepInvalid
                              ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
                              : "border-slate-300 focus:border-blue-500 focus:ring-blue-200"
                          }`}
                          placeholder="이 단계에서 할 일을 적어주세요"
                          value={step}
                          onChange={(e) => handleStepTextChange(index, e.target.value)}
                        />
                        {stepInvalid && (
                          <p
                            id={`step-${index}-error`}
                            role="alert"
                            className="text-[11px] font-semibold text-rose-600 flex items-center gap-1"
                          >
                            <span aria-hidden="true">⚠️</span>
                            <span>단계 {index + 1} 내용을 입력해주세요.</span>
                          </p>
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleAddStep}
                    disabled={!isOpen}
                    className="w-full rounded-xl border border-dashed border-blue-300 bg-blue-50/50 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    + 단계 추가
                  </button>
                </div>

                {error && (
                  <div role="alert" aria-live="assertive" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                    ⚠️ {error}
                  </div>
                )}

                {isOpen ? (
                  <button
                    type="submit"
                    disabled={loading || !serializedText.trim()}
                    className="w-full rounded-xl bg-blue-600 py-2.5 px-4 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    {loading ? "저장 중..." : hasSubmitted ? "수정 내용 저장" : "알고리즘 제출 ➔"}
                  </button>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-1">이 라운드는 종료되어 제출할 수 없습니다.</p>
                )}
              </form>
            </section>

            {/* 4 & 5. 익명 아이디어 & 추천 (Anonymous Ideas & Recommendations) */}
            {!hasSubmitted ? (
              <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-xs space-y-1">
                <p className="text-xs font-bold text-slate-700">🔒 4·5·6단계 (익명 아이디어 · 추천 · 체험)</p>
                <p className="text-[11px] text-slate-500">
                  내 알고리즘을 제출하면 다른 학생들의 아이디어를 확인하고 추천·체험할 수 있습니다.
                </p>
              </section>
            ) : (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">4. 익명 아이디어 & 5. 추천</h2>
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
                            6. 체험하기 ➔
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
