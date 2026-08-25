"use client";

import {
  PROBLEM_DESCRIPTIONS,
  PROBLEM_LABELS,
  PROBLEM_ALLOWED_ACTIONS,
  PROBLEM_ICONS,
  type ProblemType,
} from "@/lib/problemMeta";

interface ProblemPromptProps {
  problemType: ProblemType;
  exampleInput: unknown;
  onInsertTemplate?: (template: string) => void;
}

export function ProblemPrompt({
  problemType,
  exampleInput,
}: ProblemPromptProps) {
  const label = PROBLEM_LABELS[problemType];
  const icon = PROBLEM_ICONS[problemType];
  const description = PROBLEM_DESCRIPTIONS[problemType];
  const allowedActions = PROBLEM_ALLOWED_ACTIONS[problemType] ?? [];

  return (
    <div className="space-y-4">
      {/* Problem Title & Description Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl shadow-2xs">
            {icon}
          </div>
          <div>
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              작성할 문제
            </span>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              {label}
            </h2>
          </div>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-3.5 border border-slate-100">
          {description}
        </p>

        {/* Concrete Example Visualizer */}
        {exampleInput && typeof exampleInput === "object" && (
          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-950">
            <span className="font-bold block mb-1">🔍 실행 시 주어질 입력 예시:</span>
            {renderConcreteExample(problemType, exampleInput as Record<string, unknown>)}
          </div>
        )}

        {/* Allowed Actions for Executor */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <span className="text-xs font-bold text-slate-700 block mb-1.5">
            🤖 실행자(인간 컴퓨터)가 웹에서 누를 수 있는 허용된 행동:
          </span>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600">
            {allowedActions.map((act, idx) => (
              <li key={idx} className="flex items-start gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                <span className="text-blue-500 font-bold">✔</span>
                <span>{act}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function renderConcreteExample(type: ProblemType, i: Record<string, unknown>) {
  switch (type) {
    case "12coins":
      return (
        <p className="font-mono text-slate-700">
          동전 12개 중 1개가 가짜입니다. 저울질 3회 이내로 찾는 알고리즘을 작성하세요.
        </p>
      );
    case "card":
      return (
        <div className="space-y-1 font-mono text-slate-700">
          <p>카드 개수: {i.n}장</p>
          <p>
            배열 예시: [{Array.isArray(i.array) ? (i.array as number[]).slice(0, 10).join(", ") + "..." : ""}]
          </p>
          <p>찾을 목표 숫자: {String(i.target)}</p>
        </div>
      );
    case "josephus":
      return (
        <p className="font-mono text-slate-700">
          원형 인원: {String(i.n)}명, 매 {String(i.k)}번째 사람 제거
        </p>
      );
    case "pancake":
      return (
        <p className="font-mono text-slate-700">
          팬케이크 {String(i.n)}장 (위에서 k장을 뒤집어 1~{String(i.n)} 오름차순 정렬)
        </p>
      );
    default:
      return null;
  }
}
