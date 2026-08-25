"use client";

import { PROBLEM_LABELS, type ProblemType } from "@/lib/problemMeta";

type ReviewCard = {
  attempt: {
    id: number;
    problemType: ProblemType;
    executorName: string;
    finalAnswer: number | null;
    correctAnswer: number;
    isCorrect: boolean | null;
    actionCount: number;
    referenceActionCount: number;
    unexecutableFlag: boolean;
    unexecutableReason: string | null;
    actionLog: unknown[];
    evaluationResponses: {
      couldFollowFully: boolean;
      unexecutablePoint: string;
      hadAmbiguity: boolean;
      ambiguityNote: string;
      consideredCorrect: boolean;
      correctnessReason: string;
    } | null;
  };
  submission: { algorithmText: string; problemType: ProblemType } | null;
};

interface ReviewCardListProps {
  cards: ReviewCard[];
}

export function ReviewCardList({ cards }: ReviewCardListProps) {
  if (cards.length === 0) return null;

  return (
    <section className="space-y-4 rounded-2xl border border-indigo-200 bg-linear-to-b from-indigo-50/50 to-white p-5 shadow-xs">
      <div className="flex items-center gap-2">
        <span className="text-xl">📬</span>
        <div>
          <h2 className="text-base font-bold text-slate-900">
            내가 쓴 알고리즘의 실행 결과 피드백 ({cards.length}건)
          </h2>
          <p className="text-xs text-slate-600">
            다른 학생(인간 컴퓨터)이 여러분이 작성한 알고리즘을 그대로 실행한 결과입니다.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {cards.map((card) => {
          const { attempt, submission } = card;
          const label = PROBLEM_LABELS[attempt.problemType];
          const isCorrect = attempt.isCorrect;
          const ev = attempt.evaluationResponses;

          return (
            <article
              key={attempt.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                    {label}
                  </span>
                  <span className="text-xs text-slate-600">
                    실행자: <strong>{attempt.executorName}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      isCorrect
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-rose-100 text-rose-800 border border-rose-300"
                    }`}
                  >
                    {isCorrect ? "🎯 정답 일치 (O)" : "❌ 정답 불일치 (X)"}
                  </span>
                  {attempt.unexecutableFlag && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 border border-amber-300">
                      ⚠️ 실행 불가 신고됨
                    </span>
                  )}
                </div>
              </div>

              {/* Execution Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px]">제출 답 / 정답</span>
                  <span className="font-bold text-slate-800">
                    {attempt.finalAnswer ?? "-"} / {attempt.correctAnswer}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">사용한 행동 횟수</span>
                  <span className="font-bold text-blue-700">
                    {attempt.actionCount}회{" "}
                    <span className="text-slate-400 font-normal">
                      (기준 {attempt.referenceActionCount}회)
                    </span>
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block text-[10px]">재현 성공 여부</span>
                  <span
                    className={`font-bold ${
                      isCorrect ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {isCorrect ? "성공적으로 재현됨" : "결과 불일치 발생"}
                  </span>
                </div>
              </div>

              {/* Unexecutable Notice */}
              {attempt.unexecutableFlag && attempt.unexecutableReason && (
                <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 border border-amber-200">
                  <span className="font-bold block mb-0.5">⚠️ 실행 불가 신고 사유:</span>
                  <p className="whitespace-pre-wrap font-mono text-[11px]">
                    {attempt.unexecutableReason}
                  </p>
                </div>
              )}

              {/* Evaluation Answers by Executor */}
              {ev && (
                <div className="space-y-1.5 border-t border-slate-100 pt-2 text-xs text-slate-700">
                  <span className="font-bold text-slate-900 block text-[11px]">
                    💬 실행자의 평가 응답:
                  </span>
                  <ul className="space-y-1 pl-1">
                    <li className="flex items-start gap-1.5">
                      <span className="text-slate-400 font-mono">•</span>
                      <span>
                        <strong>끝까지 그대로 실행 가능:</strong>{" "}
                        {ev.couldFollowFully ? "예" : "아니오"}
                        {ev.unexecutablePoint && (
                          <span className="text-amber-800 font-mono">
                            {" "}
                            (지점: {ev.unexecutablePoint})
                          </span>
                        )}
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-slate-400 font-mono">•</span>
                      <span>
                        <strong>임의 해석 필요 여부:</strong>{" "}
                        {ev.hadAmbiguity ? "있음 (애매한 부분 존재)" : "없음"}
                        {ev.ambiguityNote && (
                          <span className="text-slate-600"> — {ev.ambiguityNote}</span>
                        )}
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-slate-400 font-mono">•</span>
                      <span>
                        <strong>정확한 알고리즘으로 판단:</strong>{" "}
                        {ev.consideredCorrect ? "예" : "아니오"}
                        {ev.correctnessReason && (
                          <span className="text-slate-600">
                            {" "}
                            — {ev.correctnessReason}
                          </span>
                        )}
                      </span>
                    </li>
                  </ul>
                </div>
              )}

              {/* Original Executed Algorithm Accordion */}
              {submission?.algorithmText && (
                <details className="group border-t border-slate-100 pt-2 text-xs">
                  <summary className="cursor-pointer font-semibold text-slate-600 hover:text-slate-900 flex items-center justify-between">
                    <span>📜 실행된 원본 알고리즘 텍스트 확인</span>
                    <span className="text-[10px] text-slate-400 group-open:rotate-180 transition">
                      ▼
                    </span>
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-800 border border-slate-100 max-h-40 overflow-y-auto">
                    {submission.algorithmText}
                  </pre>
                </details>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
