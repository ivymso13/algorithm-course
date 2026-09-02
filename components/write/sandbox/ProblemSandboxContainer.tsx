"use client";

import { useState } from "react";
import type { ProblemType } from "@/lib/assignments";
import { PROBLEM_LABELS, PROBLEM_ICONS } from "@/lib/problemMeta";
import { CoinsSandbox } from "./CoinsSandbox";
import { CardsSandbox } from "./CardsSandbox";
import { JosephusSandbox } from "./JosephusSandbox";
import { PancakeSandbox } from "./PancakeSandbox";

interface ProblemSandboxContainerProps {
  problemType: ProblemType;
  onCopyHistory?: (summary: string) => void;
  /** Larger text/buttons for projecting to a whole classroom, and skips the
   * write-page-oriented header chrome (the caller supplies its own). */
  presentationMode?: boolean;
}

export function ProblemSandboxContainer({
  problemType,
  onCopyHistory,
  presentationMode = false,
}: ProblemSandboxContainerProps) {
  const [isOpen, setIsOpen] = useState(true);

  const label = PROBLEM_LABELS[problemType];
  const icon = PROBLEM_ICONS[problemType];

  const body = (
    <div className={presentationMode ? "p-2 sm:p-3" : "p-4 sm:p-5"}>
      {problemType === "12coins" && (
        <CoinsSandbox key={problemType} onCopyHistory={onCopyHistory} presentationMode={presentationMode} />
      )}

      {problemType === "card" && (
        <CardsSandbox key={problemType} onCopyHistory={onCopyHistory} presentationMode={presentationMode} />
      )}

      {problemType === "josephus" && (
        <JosephusSandbox key={problemType} onCopyHistory={onCopyHistory} presentationMode={presentationMode} />
      )}

      {problemType === "pancake" && (
        <PancakeSandbox key={problemType} onCopyHistory={onCopyHistory} presentationMode={presentationMode} />
      )}
    </div>
  );

  if (presentationMode) {
    // No collapsible/write-page header here — the teacher page already
    // renders its own heading and description above this component.
    return <section className="rounded-2xl border border-blue-200 bg-white shadow-xs">{body}</section>;
  }

  return (
    <section className="rounded-2xl border border-blue-200 bg-white shadow-xs overflow-hidden">
      {/* Container Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-blue-100 bg-linear-to-r from-blue-50/70 via-indigo-50/50 to-white px-4 py-3 gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-sm text-white shadow-2xs">
            {icon}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                {label} 직접 풀어보기 & 알고리즘 규칙 탐색 (인터랙티브 샌드박스)
              </h3>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                실습 모드
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              글로 작성하기 전에 실제 문제를 직접 조작해보며 문제 해결 규칙과 단계를 찾아보세요.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-900 hover:bg-blue-50 transition cursor-pointer shadow-2xs"
        >
          {isOpen ? "접어두기 ▲" : "펼치기 ▼"}
        </button>
      </div>

      {isOpen && body}
    </section>
  );
}
