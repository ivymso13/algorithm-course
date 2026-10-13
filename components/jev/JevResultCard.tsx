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
  trace?: {step:number;index:number;value?:number|null;memo:number|null;output:number|null}[];
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

/** Show the overall result once; open only the cases that need attention. */
export function JevResultCard({
  embedded=false, fixedCases=false, roundTitle, submissionText, totalTrials, correctCount,
  incorrectCount, errorCount, createdAt, submissionVersion, examples,
}: JevResultCardProps) {
  const headingId=useId();
  const failures=examples?.filter(ex=>!ex.executable||ex.correct===false)??[];
  const allCorrect=totalTrials>0&&correctCount===totalTrials;
  return <section aria-labelledby={headingId} className={embedded ? "space-y-3" : "rounded-xl border border-slate-200 bg-white p-4 space-y-3"}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id={headingId} className={embedded ? "sr-only" : "text-sm font-bold"}>JEV 실행 결과{roundTitle? ` · ${roundTitle}` : ""}</h3>
      <span className="text-xs text-slate-500">{fixedCases?"고정 테스트":"테스트"} {totalTrials}개{submissionVersion!=null?` · 버전 ${submissionVersion}`:""}</span>
    </div>
    <div className={`rounded-lg p-3 text-sm ${allCorrect?"bg-emerald-50 text-emerald-900":"bg-amber-50 text-amber-900"}`}>
      <strong>{allCorrect?"모든 테스트 통과":`통과 ${correctCount}/${totalTrials}개`}</strong>
      <span className="ml-3 text-xs">오답 {incorrectCount} · 실행 중단 {errorCount}</span>
    </div>
    {failures.length>0&&<div className="space-y-2">
      <p className="text-xs text-slate-500">틀리거나 중단된 사례만 표시합니다. 펼쳐서 원인을 확인하세요.</p>
      {failures.map(ex=><details key={ex.trialIndex} className="rounded-lg border border-slate-200 p-3 text-xs">
        <summary className="cursor-pointer font-semibold">사례 {ex.trialIndex+1} · {ex.executable?"오답":"실행 중단"} · [{ex.numbers.join(", ")}]</summary>
        <div className="mt-3 space-y-2">
          <p>제출한 값: <strong>{ex.finalAnswer??"없음"}</strong> · 정답: <strong>{ex.correctAnswer}</strong></p>
          {ex.failedStep!=null&&<p>{ex.failedStep}단계에서 중단</p>}
          {ex.failureReason&&<p className="rounded-lg bg-amber-50 p-2 text-amber-900">{ex.failureReason}</p>}
          {!!ex.trace?.length&&<div className="max-h-60 overflow-y-auto border-t pt-2">
            <p className="mb-1 font-bold">실행 과정</p>
            {ex.trace.map((step,i)=><p key={i} className="border-b py-1.5">{step.step}단계 · 위치 {step.index+1} · 확인 {step.value??"미확인"} · 메모 {step.memo??"없음"}{step.output!=null?` · 출력 ${step.output}`:""}</p>)}
          </div>}
        </div>
      </details>)}
    </div>}
    {submissionText&&<details className="text-xs"><summary className="cursor-pointer text-slate-600">채점한 알고리즘 보기</summary><pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans leading-6">{submissionText}</pre></details>}
    {createdAt&&<time dateTime={createdAt} className="block text-[11px] text-slate-400">{new Date(createdAt).toLocaleString("ko-KR")}</time>}
  </section>;
}
