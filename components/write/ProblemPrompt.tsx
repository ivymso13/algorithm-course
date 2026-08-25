"use client";

import { useState } from "react";
import {
  PROBLEM_DESCRIPTIONS,
  PROBLEM_LABELS,
  PROBLEM_ALLOWED_ACTIONS,
  PROBLEM_WRITING_TIPS,
  PROBLEM_ICONS,
  type ProblemType,
} from "@/lib/problemMeta";

interface ProblemPromptProps {
  problemType: ProblemType;
  exampleInput: unknown;
  onInsertTemplate: (template: string) => void;
}

export function ProblemPrompt({
  problemType,
  exampleInput,
  onInsertTemplate,
}: ProblemPromptProps) {
  const [tipsOpen, setTipsOpen] = useState(true);

  const label = PROBLEM_LABELS[problemType];
  const icon = PROBLEM_ICONS[problemType];
  const description = PROBLEM_DESCRIPTIONS[problemType];
  const allowedActions = PROBLEM_ALLOWED_ACTIONS[problemType] ?? [];
  const writingTips = PROBLEM_WRITING_TIPS[problemType] ?? [];

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

      {/* Writing Tips & Checklist Accordion */}
      <div className="rounded-2xl border border-amber-200 bg-linear-to-b from-amber-50/70 to-white p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">💡</span>
            <h3 className="text-xs font-bold text-amber-900">
              알고리즘 작성 요령 및 템플릿
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setTipsOpen((prev) => !prev)}
            className="text-xs font-medium text-amber-800 hover:underline cursor-pointer"
          >
            {tipsOpen ? "접기 ▲" : "도움말 펼치기 ▼"}
          </button>
        </div>

        {tipsOpen && (
          <div className="mt-3 space-y-3 text-xs text-slate-700">
            {/* Checklist */}
            <div className="space-y-1 rounded-xl bg-amber-100/50 p-3 text-[11px] text-amber-950 border border-amber-200/60">
              <span className="font-bold block text-xs text-amber-900 mb-1">
                ✍️ 반드시 지켜야 할 작성 체크리스트:
              </span>
              <p>• 실행자는 원래 문제 설명이나 숫자를 보지 못합니다.</p>
              <p>• 모든 판단 기준(크면/작으면/같으면)과 종료 조건(언제 끝나는지)을 빠짐없이 적으세요.</p>
              <p>• 1단계, 2단계, 3단계 순서대로 번호를 매겨 적으세요.</p>
            </div>

            {/* Problem Specific Tips */}
            {writingTips.length > 0 && (
              <div className="space-y-1 pl-1">
                <span className="font-bold text-slate-800 text-xs">📌 이 문제 주의점:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                  {writingTips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick Template Buttons */}
            <div className="border-t border-amber-100 pt-2.5">
              <span className="font-bold text-slate-800 text-[11px] block mb-1.5">
                클릭하여 서술 문구 추가:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onInsertTemplate(
                      "1. \n2. 만약 ~라면:\n   - \n3. 그렇지 않다면:\n   - \n4. ~할 때까지 반복한다.\n5. 최종 답으로 ~를 출력한다."
                    )
                  }
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                >
                  + 기본 단계 템플릿
                </button>
                <button
                  type="button"
                  onClick={() => onInsertTemplate("\n만약 (조건) 이라면:\n   - (행동 1)\n그렇지 않으면:\n   - (행동 2)")}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                >
                  + 조건 분기(만약 ~라면)
                </button>
                <button
                  type="button"
                  onClick={() => onInsertTemplate("\n(조건)을 만족할 때까지 1~3단계를 반복한다.")}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                >
                  + 반복 조건문
                </button>
                <button
                  type="button"
                  onClick={() => onInsertTemplate("\n최종 답으로 (결과 숫자)를 제출한다.")}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                >
                  + 최종 답 제출
                </button>
              </div>
            </div>
          </div>
        )}
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
