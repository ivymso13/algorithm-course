"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { StudentLoginCard } from "@/components/StudentLoginCard";
import { StudentStepNav } from "@/components/write/StudentStepNav";
import { useWarmupSession } from "@/components/write/useWarmupSession";
import { parseAlgorithmSteps, serializeAlgorithmSteps } from "@/lib/algorithmSteps";

function ensureAtLeastOneStep(steps: string[]): string[] {
  return steps.length > 0 ? steps : [""];
}

export default function AlgorithmWritePage() {
  const router = useRouter();
  const {
    checkingSession,
    loggedIn,
    studentLabel,
    round,
    mySubmission,
    setMySubmission,
    sessionRestoredNotice,
    setSessionRestoredNotice,
    handleLogin,
    handleLogout,
    error: sessionError,
    loading: sessionLoading,
  } = useWarmupSession();

  const [steps, setSteps] = useState<string[]>([""]);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [draftRestoredNotice, setDraftRestoredNotice] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  // Initialize steps from a pending draft, falling back to the last saved
  // submission. A non-empty draft always wins: submitting always clears the
  // draft key immediately, so a draft can only be non-empty here because the
  // student typed further edits or copied sandbox practice notes in from
  // /write after already submitting — both represent newer intent than the
  // saved copy and would otherwise be silently discarded.
  useEffect(() => {
    if (!round) return;

    let ignore = false;
    const timer = window.setTimeout(() => {
      if (ignore) return;

      const draftKey = `algo_warmup_draft_${round.id}`;
      try {
        const saved = sessionStorage.getItem(draftKey);
        if (saved && saved.trim()) {
          setSteps(ensureAtLeastOneStep(parseAlgorithmSteps(saved)));
          setDraftRestoredNotice(true);
          window.setTimeout(() => setDraftRestoredNotice(false), 4000);
          return;
        }
      } catch {
        // ignore storage errors
      }

      if (mySubmission) {
        setSteps(ensureAtLeastOneStep(parseAlgorithmSteps(mySubmission.algorithmText)));
      }
    }, 0);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [round, mySubmission]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!round) return;
    setSubmitError(null);
    setSubmitAttempted(true);

    const emptyStepNumbers = steps
      .map((step, index) => (step.trim() ? null : index + 1))
      .filter((n): n is number => n !== null);
    if (emptyStepNumbers.length > 0) {
      setSubmitError(`단계 ${emptyStepNumbers.join(", ")}의 내용을 입력해주세요.`);
      return;
    }

    const serialized = serializeAlgorithmSteps(steps);
    if (serialized.trim().length < 10) {
      setSubmitError("알고리즘을 10자 이상 단계별로 적어주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/warmup/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ algorithmText: serialized }),
      });
      const data = (await res.json()) as { mySubmission?: typeof mySubmission; error?: string };
      if (!res.ok || !data.mySubmission) {
        throw new Error(data.error ?? "제출에 실패했습니다.");
      }

      try {
        sessionStorage.removeItem(`algo_warmup_draft_${round.id}`);
      } catch {
        // ignore
      }

      setMySubmission(data.mySubmission);

      // Navigate to explore page
      router.push("/write/explore");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
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
            stepNumber="2단계"
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
  const serializedText = serializeAlgorithmSteps(steps);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentStudentKey={studentLabel} onLogout={handleLogout} />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        {/* 4-Step Navigation */}
        <StudentStepNav currentStep={2} hasSubmitted={hasSubmitted} />

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
            {/* Problem Summary Card (Focused on writing) */}
            <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                    문제 요약
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isOpen ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {isOpen ? "진행 중" : "종료됨"}
                  </span>
                </div>
                <Link
                  href="/write"
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  ← 1단계 실습 다시 보기
                </Link>
              </div>

              <h1 className="text-base font-bold text-slate-900">{round.title}</h1>

              {showFullPrompt ? (
                <div className="space-y-2 pt-1 border-t border-blue-100">
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {round.prompt}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowFullPrompt(false)}
                    className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
                  >
                    문제 지시문 접기 ▲
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                  <p className="truncate max-w-[85%]">{round.prompt}</p>
                  <button
                    type="button"
                    onClick={() => setShowFullPrompt(true)}
                    className="text-[11px] text-blue-600 hover:underline font-semibold shrink-0 cursor-pointer"
                  >
                    더 보기 ▼
                  </button>
                </div>
              )}
            </section>

            {/* Main: Step-by-Step Algorithm Editor */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">
                      2. 단계별 알고리즘 작성
                    </h2>
                    {hasSubmitted && (
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        수정 모드
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    다른 사람이 그대로 따라 할 수 있도록 한 단계씩 명확하게 작성하세요.
                  </p>
                </div>
                <span
                  className={`text-xs font-mono font-bold ${
                    serializedText.trim().length >= 10 ? "text-slate-500" : "text-amber-600"
                  }`}
                >
                  {serializedText.length} / 4,000자
                </span>
              </div>

              {draftRestoredNotice && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 text-xs text-blue-900 flex items-center justify-between gap-2">
                  <span>💾 이전 작성 초안이 복구되었습니다.</span>
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

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3">
                  {steps.map((step, index) => {
                    const stepInvalid = submitAttempted && !step.trim();
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <label
                            htmlFor={`step-${index}`}
                            className="text-xs font-bold text-slate-700 flex items-center gap-1.5"
                          >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white text-[10px] font-black">
                              {index + 1}
                            </span>
                            <span>단계 {index + 1}</span>
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
                          className={`w-full min-h-[68px] rounded-xl border bg-slate-50/50 p-2.5 font-mono text-base sm:text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:outline-hidden disabled:opacity-60 ${
                            stepInvalid
                              ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
                              : "border-slate-300 focus:border-blue-500 focus:ring-blue-200"
                          }`}
                          placeholder="이 단계에서 수행할 구체적인 행동을 적어주세요 (예: 저울 양쪽에 동전을 4개씩 올린다)"
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
                    className="w-full rounded-xl border border-dashed border-blue-300 bg-blue-50/50 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>+ 다음 단계 추가</span>
                  </button>
                </div>

                {submitError && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700"
                  >
                    ⚠️ {submitError}
                  </div>
                )}

                {isOpen ? (
                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={submitting || !serializedText.trim()}
                      className="w-full sm:flex-1 rounded-xl bg-blue-600 py-3 px-5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      {submitting
                        ? "제출 중..."
                        : hasSubmitted
                        ? "수정 내용 저장하고 3단계로 이동 ➔"
                        : "알고리즘 제출하고 3단계로 이동 ➔"}
                    </button>

                    {hasSubmitted && (
                      <Link
                        href="/write/explore"
                        className="w-full sm:w-auto rounded-xl border border-slate-300 bg-white py-3 px-4 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition text-center"
                      >
                        3단계로 건너뛰기 ➔
                      </Link>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-2">
                    이 라운드는 종료되어 제출하거나 수정할 수 없습니다.
                  </p>
                )}
              </form>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
