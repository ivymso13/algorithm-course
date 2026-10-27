import { useId } from "react";

export interface JevExampleTrial {
  trialIndex: number;
  numbers: number[];
  inputLabel?: string;
  correct: boolean | null;
  executable: boolean;
  failedStep: number | null;
  /** Several answers per case (e.g. one count per coin), labeled by `answerLabels`. */
  finalAnswer: number | null | (number | null)[];
  correctAnswer: number | number[];
  answerLabels?: string[];
  failureReason?: string;
  trace?: {
    detail?: string;
    sum?: number | null;
    next?: number | null;
    remaining?: number | null;
    step: number;
    index: number;
    value?: number | null;
    memo: number | null;
    output: number | null;
  }[];
}

export interface JevResultCardProps {
  embedded?: boolean;
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

function formatAnswer(value: number | null | (number | null)[], labels?: string[]) {
  if (!Array.isArray(value)) return value ?? "없음";
  return value.map((v, i) => `${labels?.[i] ?? i + 1} ${v ?? "없음"}`).join(" · ");
}

/** Per-label comparison so a case with several answers shows which one differs. */
function AnswerTable({ ex }: { ex: JevExampleTrial }) {
  const expected = ex.correctAnswer as number[];
  const submitted = Array.isArray(ex.finalAnswer) ? ex.finalAnswer : null;
  return (
    <table className="w-full max-w-sm text-left text-xs">
      <caption className="sr-only">항목별 제출 값과 정답</caption>
      <thead className="text-[11px] text-slate-500">
        <tr><th scope="col" className="py-1 pr-3 font-semibold">항목</th><th scope="col" className="py-1 pr-3 font-semibold">제출</th><th scope="col" className="py-1 pr-3 font-semibold">정답</th><th scope="col" className="py-1 font-semibold">비교</th></tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {expected.map((value, i) => {
          const got = submitted?.[i] ?? null;
          const same = got === value;
          return (
            <tr key={i}>
              <th scope="row" className="py-1 pr-3 font-semibold text-slate-700">{ex.answerLabels?.[i] ?? i + 1}</th>
              <td className="py-1 pr-3">{got ?? "없음"}</td>
              <td className="py-1 pr-3 text-blue-700">{value}</td>
              <td className={`py-1 font-semibold ${same ? "text-emerald-700" : "text-rose-700"}`}>{same ? "일치" : "다름"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Show the overall result once; open only the cases that need attention. */
export function JevResultCard({
  embedded = false,
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
  const headingId = useId();
  const failures = examples?.filter((ex) => !ex.executable || ex.correct === false) ?? [];
  const allCorrect = totalTrials > 0 && correctCount === totalTrials;

  return (
    <section
      aria-labelledby={headingId}
      className={
        embedded
          ? "space-y-3"
          : "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className={embedded ? "sr-only" : "text-sm font-bold text-slate-900"}>
          JEV 실행 결과{roundTitle ? ` · ${roundTitle}` : ""}
        </h3>
        <span className="text-xs font-medium text-slate-500">
          {fixedCases ? "고정 테스트" : "테스트"} {totalTrials}개
          {submissionVersion != null ? ` · 버전 ${submissionVersion}` : ""}
        </span>
      </div>

      {/* Summary Banner */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3.5 text-sm ${
          allCorrect
            ? "border-emerald-200 bg-emerald-50/80 text-emerald-950"
            : "border-amber-200 bg-amber-50/80 text-amber-950"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">
            {allCorrect ? "✅" : "⚠️"}
          </span>
          <strong>
            {allCorrect ? "모든 테스트 통과" : `통과 ${correctCount}/${totalTrials}개`}
          </strong>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="rounded-md bg-white/80 px-2 py-0.5 text-slate-700">
            통과 {correctCount}
          </span>
          <span className="rounded-md bg-white/80 px-2 py-0.5 text-rose-800">
            오답 {incorrectCount}
          </span>
          <span className="rounded-md bg-white/80 px-2 py-0.5 text-amber-900">
            실행 중단 {errorCount}
          </span>
        </div>
      </div>

      {/* Failure Cases */}
      {failures.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            틀리거나 중단된 사례({failures.length}개)만 표시합니다. 펼쳐서 원인을 확인하세요.
          </p>
          <div className="space-y-2">
            {failures.map((ex, idx) => (
              <details
                key={ex.trialIndex}
                open={idx === 0}
                className="group rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs"
              >
                <summary className="flex flex-wrap items-center justify-between gap-2 cursor-pointer font-semibold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        ex.executable
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {ex.executable ? "오답" : "실행 중단"}
                    </span>
                    <span>사례 {ex.trialIndex + 1}</span>
                    <span className="font-mono text-slate-600">
                      {ex.inputLabel ? `${ex.inputLabel} = ${ex.numbers[0]}` : `[${ex.numbers.join(", ")}]`}
                    </span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">
                    제출: <strong className="text-slate-800">{formatAnswer(ex.finalAnswer, ex.answerLabels)}</strong> · 정답:{" "}
                    <strong className="text-blue-700">{formatAnswer(ex.correctAnswer, ex.answerLabels)}</strong>
                  </span>
                </summary>

                <div className="mt-3 space-y-2.5 border-t border-slate-200/80 pt-2.5">
                  {Array.isArray(ex.correctAnswer) && <AnswerTable ex={ex} />}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
                    {!Array.isArray(ex.correctAnswer) && (
                      <>
                        <span>
                          제출한 값: <strong>{formatAnswer(ex.finalAnswer)}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          정답: <strong className="text-blue-700">{ex.correctAnswer}</strong>
                        </span>
                      </>
                    )}
                    {ex.failedStep != null && (
                      <>
                        {!Array.isArray(ex.correctAnswer) && <span>·</span>}
                        <span className="font-semibold text-amber-900">
                          {ex.failedStep}단계에서 중단
                        </span>
                      </>
                    )}
                  </div>

                  {ex.failureReason && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-950 leading-relaxed">
                      {ex.failureReason}
                    </p>
                  )}

                  {!!ex.trace?.length && (
                    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                      <p className="mb-1.5 text-[11px] font-bold text-slate-700">
                        단계별 실행 과정 ({ex.trace.length}단계)
                      </p>
                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 font-mono text-[11px] text-slate-600">
                        {ex.trace.map((step, i) => (
                          <p key={i} className="py-1.5">
                            {step.detail ? step.detail : ex.inputLabel ? `${step.step}단계 · 친구 수 ${step.memo ?? "미설정"} · 누적 합 ${step.sum ?? "미설정"} · 다음 수 ${step.next ?? "미설정"} · 남은 사탕 ${step.remaining ?? "미설정"}` : `${step.step}단계 · 위치 ${step.index + 1} · 확인 ${step.value ?? "미확인"} · 메모 ${step.memo ?? "없음"}`}
                            {!step.detail && step.output != null ? ` · 출력 ${step.output}` : ""}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {submissionText && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-slate-600 hover:text-slate-900">
            채점한 알고리즘 원문 보기
          </summary>
          <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800">
            {submissionText}
          </pre>
        </details>
      )}

      {createdAt && (
        <time dateTime={createdAt} className="block text-[11px] text-slate-400">
          {new Date(createdAt).toLocaleString("ko-KR")}
        </time>
      )}
    </section>
  );
}
