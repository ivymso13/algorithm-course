import { useId } from "react";

export interface JevExampleTrial {
  trialIndex: number;
  numbers: number[];
  correct: boolean | null;
  executable: boolean;
  failedStep: number | null;
  finalAnswer: number | null;
  correctAnswer: number;
  failureReason?: string;
}

export interface JevResultCardProps {
  fixedCases?: boolean;
  roundTitle: string | null;
  submissionText: string | null;
  totalTrials: number;
  correctCount: number;
  incorrectCount: number;
  errorCount: number;
  createdAt?: string;
  submissionVersion?: number | null;
  examples?: JevExampleTrial[];
}

/**
 * Student-facing result card for AI (Jev) simulation trials.
 *
 * Pedagogical note:
 * Labeled clearly as learning feedback rather than a score/grade so students
 * focus on algorithmic reasoning, edge-case debugging, and iterative refinement.
 */
export function JevResultCard({
  fixedCases = false,
  roundTitle,
  submissionText,
  totalTrials,
  correctCount,
  incorrectCount,
  errorCount,
  createdAt,
  submissionVersion,
  examples,
}: JevResultCardProps) {
  const cardId = useId();
  const headingId = `${cardId}-heading`;

  // Percentage with guard against division by zero
  const pct = (n: number) => (totalTrials > 0 ? Math.round((n / totalTrials) * 100) : 0);
  const correctPct = pct(correctCount);
  const incorrectPct = pct(incorrectCount);
  const errorPct = pct(errorCount);

  const allCorrect = totalTrials > 0 && correctCount === totalTrials;
  // "Mostly couldn't even run" implies severe ambiguity or missing loop guard/termination
  const mostlyFailedToRun = errorCount > correctCount + incorrectCount;

  const theme = allCorrect
    ? {
        text: "text-emerald-900",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        icon: "🎉",
        headline: "모든 테스트 케이스 통과!",
        subtext: "제출한 알고리즘이 이번에 생성한 모든 무작위 상자 배치에서 정확한 최댓값을 찾아냈습니다.",
      }
    : mostlyFailedToRun
    ? {
        text: "text-rose-900",
        bg: "bg-rose-50",
        border: "border-rose-200",
        icon: "⚠️",
        headline: "실행 중단 다수 발생",
        subtext: "알고리즘의 지시문이 모호하거나 종료 조건이 부족하여, AI가 컴퓨터 역할을 수행하는 도중 실행을 멈추었습니다.",
      }
    : {
        text: "text-amber-900",
        bg: "bg-amber-50",
        border: "border-amber-200",
        icon: "🔎",
        headline: "일부 오답 및 예외 발생",
        subtext: "특정 상자 배치에서 알고리즘이 최댓값과 다른 답을 내거나 중단되었습니다. 아래 반례를 확인해보세요.",
      };

  // Extract representative wrong or unexecutable failure examples
  const failureExamples = examples?.filter((ex) => !ex.executable || ex.correct === false) ?? [];
  // Show up to 4 representative examples to keep layout compact and readable
  const representativeExamples = failureExamples.slice(0, 4);

  const formattedDate = createdAt
    ? (() => {
        try {
          return new Date(createdAt).toLocaleString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch {
          return createdAt;
        }
      })()
    : null;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden"
    >
      {/* Header with Title, Version, Timestamp, and Feedback Notice */}
      <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3.5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={headingId} className="text-sm font-bold text-slate-900">
              AI 알고리즘 실행 결과
            </h3>
            {/* Pedagogical label: learning feedback, not a grade */}
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
              💡 학습 분석 피드백 (평가 성적이 아닙니다)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {roundTitle && <span className="font-medium text-slate-700">{roundTitle}</span>}
            {submissionVersion != null && (
              <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-600">
                v{submissionVersion} 판
              </span>
            )}
          </div>
        </div>

        {formattedDate && (
          <time dateTime={createdAt} className="shrink-0 text-[10px] text-slate-400 font-mono">
            {formattedDate}
          </time>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        {/* Outcome Summary Banner */}
        <div className={`rounded-xl border ${theme.border} ${theme.bg} p-4 flex items-start gap-3.5`}>
          <span className="text-2xl shrink-0 leading-none" aria-hidden="true">
            {theme.icon}
          </span>
          <div className="space-y-1">
            <p className={`text-base font-black leading-tight ${theme.text}`}>
              {theme.headline} ({totalTrials}회 중 {correctCount}회 정답 · {correctPct}%)
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">{theme.subtext}</p>
          </div>
        </div>

        {/* Stacked Segmented Progress Bar & Metric Pills */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>실행 통계 비율</span>
            <span className="text-slate-500 font-mono text-[11px]">{fixedCases ? `고정 테스트 ${totalTrials}개` : `총 ${totalTrials}회 무작위 시뮬레이션`}</span>
          </div>

          {/* Tri-color Segmented Progress Bar */}
          <div
            role="progressbar"
            aria-label="알고리즘 실행 결과 비율"
            aria-valuenow={correctPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100"
          >
            {correctPct > 0 && (
              <div
                className="bg-emerald-500 transition-all"
                style={{ width: `${correctPct}%` }}
                title={`정답 ${correctCount}회 (${correctPct}%)`}
              />
            )}
            {incorrectPct > 0 && (
              <div
                className="bg-amber-400 transition-all"
                style={{ width: `${incorrectPct}%` }}
                title={`오답 ${incorrectCount}회 (${incorrectPct}%)`}
              />
            )}
            {errorPct > 0 && (
              <div
                className="bg-rose-500 transition-all"
                style={{ width: `${errorPct}%` }}
                title={`실행 실패 ${errorCount}회 (${errorPct}%)`}
              />
            )}
          </div>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800">정답</span>
                <span className="text-xs font-black text-emerald-900 font-mono">
                  {correctCount}회 ({correctPct}%)
                </span>
              </div>
              <p className="text-[10px] text-emerald-700 mt-0.5">최댓값을 정확히 찾아냄</p>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800">오답</span>
                <span className="text-xs font-black text-amber-900 font-mono">
                  {incorrectCount}회 ({incorrectPct}%)
                </span>
              </div>
              <p className="text-[10px] text-amber-700 mt-0.5">실행되었으나 다른 답 도출</p>
            </div>

            <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-800">실행 실패</span>
                <span className="text-xs font-black text-rose-900 font-mono">
                  {errorCount}회 ({errorPct}%)
                </span>
              </div>
              <p className="text-[10px] text-rose-700 mt-0.5">지시문 모호성/중단 오류</p>
            </div>
          </div>
        </div>

        {/* Submitted Algorithm Snapshot */}
        {submissionText && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                채점한 알고리즘
              </span>
              {submissionVersion != null && (
                <span className="text-[11px] text-slate-500 font-mono">버전 {submissionVersion}</span>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
              {submissionText}
            </div>
          </div>
        )}

        {/* Representative Wrong / Failure Examples Section */}
        {examples && examples.length > 0 && (
          <div className="space-y-2.5 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm" aria-hidden="true">
                  🔍
                </span>
                <h4 className="text-xs font-bold text-slate-900">
                  {failureExamples.length > 0
                    ? `대표 반례 및 실행 실패 사례 (${failureExamples.length}건)`
                    : "테스트 사례 검증 결과"}
                </h4>
              </div>
              {failureExamples.length > 4 && (
                <span className="text-[11px] text-slate-400">
                  대표 4건 표시 중 (전체 {failureExamples.length}건)
                </span>
              )}
            </div>

            {representativeExamples.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-[11px] text-slate-500">
                  아래 상자 배치에서 알고리즘이 왜 멈추었거나 다른 답을 냈는지 확인하고 규칙을 개선해보세요.
                </p>

                <div className="grid grid-cols-1 gap-2.5">
                  {representativeExamples.map((ex) => {
                    const isUnexecutable = !ex.executable;
                    return (
                      <article
                        key={ex.trialIndex}
                        className={`rounded-xl border p-3 text-xs space-y-2 ${
                          isUnexecutable
                            ? "border-rose-200 bg-rose-50/40"
                            : "border-amber-200 bg-amber-50/40"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-100 pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-700 text-[11px]">
                              테스트 #{ex.trialIndex + 1}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                isUnexecutable
                                  ? "bg-rose-100 text-rose-800 border-rose-300"
                                  : "bg-amber-100 text-amber-800 border-amber-300"
                              }`}
                            >
                              {isUnexecutable ? "실행 불가 (중단)" : "오답 도출"}
                            </span>
                          </div>

                          <div className="text-[11px] font-mono">
                            {isUnexecutable ? (
                              <span className="text-rose-700 font-semibold">
                                {ex.failedStep !== null ? `${ex.failedStep}단계에서 중단` : "실행 중단"}
                              </span>
                            ) : (
                              <span className="text-slate-600">
                                도출된 값:{" "}
                                <strong className="text-amber-800">{ex.finalAnswer ?? "없음"}</strong> · 정답:{" "}
                                <strong className="text-emerald-700">{ex.correctAnswer}</strong>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Numbers arrangement */}
                        <div>
                          <span className="text-[10px] font-semibold text-slate-500 block mb-1">
                            상자 속 숫자 배치:
                          </span>
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {ex.numbers.map((num, idx) => {
                              const isCorrectAnswer = num === ex.correctAnswer;
                              const isChosenWrong = !isUnexecutable && num === ex.finalAnswer && !isCorrectAnswer;
                              return (
                                <span
                                  key={idx}
                                  className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-mono font-semibold border ${
                                    isCorrectAnswer
                                      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                      : isChosenWrong
                                      ? "bg-rose-100 text-rose-900 border-rose-300 line-through"
                                      : "bg-white text-slate-700 border-slate-200"
                                  }`}
                                  title={
                                    isCorrectAnswer
                                      ? "실제 최댓값 (정답)"
                                      : isChosenWrong
                                      ? "알고리즘이 잘못 선택한 값"
                                      : undefined
                                  }
                                >
                                  {num}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Reason message */}
                        {ex.failureReason && (
                          <div className="rounded-lg bg-white/90 border border-slate-200/80 p-2 text-[11px] text-slate-700 leading-relaxed">
                            <span className="font-semibold text-slate-900">원인 분석: </span>
                            {ex.failureReason}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900 flex items-start gap-2.5">
                <span className="text-base" aria-hidden="true">
                  ✨
                </span>
                <div>
                  <p className="font-bold text-emerald-950">
                    모든 테스트 케이스 통과! (반례가 발견되지 않았습니다)
                  </p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    제공된 {examples.length}번의 무작위 배치 검증에서 알고리즘이 어떤 오류나 오답 없이 완벽하게 동작했습니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
