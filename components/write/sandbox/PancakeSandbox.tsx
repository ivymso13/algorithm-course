"use client";

import { useState } from "react";
import { pancakeProblem, type PancakeInput, type PancakeState } from "@/lib/problems/pancake";

interface PancakeSandboxProps {
  onCopyHistory?: (summary: string) => void;
  /** Larger text/buttons for projecting to a whole classroom. */
  presentationMode?: boolean;
}

export function PancakeSandbox({ onCopyHistory, presentationMode = false }: PancakeSandboxProps) {
  const [instance, setInstance] = useState(() => pancakeProblem.generate());
  // `PancakeInput` only carries `n` — the randomly shuffled starting stack
  // lives in `state`, not `input`. Capture it separately so "처음 상태로
  // 초기화" can restore the original shuffle instead of crashing.
  const [initialStack, setInitialStack] = useState<number[]>(
    () => [...(instance.state as PancakeState).stack]
  );
  const [hoverK, setHoverK] = useState<number | null>(null);

  const input = instance.input as PancakeInput;
  const state = instance.state as PancakeState;
  const n = input.n;
  const stack = state.stack ?? [];
  const flipCount = state.flipCount ?? 0;
  const history = state.history ?? [];
  const maxRef = 2 * (n - 1);

  const isSorted = stack.every((val, i) => val === i + 1);

  function handleNewProblem() {
    const next = pancakeProblem.generate();
    setInstance(next);
    setInitialStack([...(next.state as PancakeState).stack]);
  }

  function handleReset() {
    setInstance((prev) => ({
      ...prev,
      state: { stack: [...initialStack], flipCount: 0, history: [] },
    }));
  }

  function handleFlip(k: number) {
    if (k < 1 || k > n) return;
    try {
      const outcome = pancakeProblem.applyAction(state, input, "flip", { k });
      setInstance((prev) => ({ ...prev, state: outcome.state as PancakeState }));
    } catch {
      // ignore
    }
  }

  function handleExportSummary() {
    if (!onCopyHistory) return;
    const lines = [
      `1. 팬케이크 ${n}장을 크기 순서대로 정렬하기 위해 가장 큰 팬케이크부터 바닥으로 보낸다.`,
      ...history.map((h, i) => `${i + 2}. 위에서 ${h.k}장을 통째로 뒤집는다.`),
      `${history.length + 2}. 맨 위 1부터 맨 아래 ${n}까지 정렬되면 12345 형식으로 답을 출력한다.`,
    ];
    onCopyHistory(lines.join("\n"));
  }

  const pancakeColors = [
    "bg-amber-100 border-amber-300 text-amber-900",
    "bg-amber-200 border-amber-400 text-amber-900",
    "bg-amber-300 border-amber-500 text-amber-950",
    "bg-amber-400 border-amber-600 text-amber-950",
    "bg-amber-500 border-amber-700 text-white",
    "bg-amber-600 border-amber-800 text-white",
  ];

  // Classroom-projector sizing: swaps in noticeably larger text/buttons
  // without touching the compact layout the student write-page uses.
  // (Named `ui`, not `size`, since `size` already names the pancake rank
  // inside the stack.map() loop below.)
  const ui = presentationMode
    ? {
        statText: "text-base",
        controlBtn: "px-4 py-2 text-sm",
        stackHeader: "text-sm",
        stackWrap: "max-w-lg gap-2.5 py-4 px-6",
        edgeTag: "text-xs",
        cake: "h-14 px-4 text-sm",
        cakeTag: "text-xs",
        cakeSize: "text-base",
        cakeIcon: "text-sm",
        flipLabel: "text-sm",
        flipGrid: "gap-2.5",
        flipBtn: "p-3 text-sm",
        bannerText: "p-4 text-sm",
        bannerSub: "text-sm",
        exportLink: "text-sm",
      }
    : {
        statText: "text-xs",
        controlBtn: "px-2.5 py-1 text-xs",
        stackHeader: "text-xs",
        stackWrap: "max-w-sm gap-1.5 py-3 px-4",
        edgeTag: "text-[9px]",
        cake: "h-8 px-3 text-xs",
        cakeTag: "text-[9px]",
        cakeSize: "text-xs",
        cakeIcon: "text-[10px]",
        flipLabel: "text-xs",
        flipGrid: "gap-1.5",
        flipBtn: "p-1.5 text-xs",
        bannerText: "p-3 text-xs",
        bannerSub: "text-[11px]",
        exportLink: "text-xs",
      };

  return (
    <div className="space-y-4">
      {/* Sandbox Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
            직접 풀이 샌드박스
          </span>
          <span className={`${ui.statText} text-slate-500`}>
            뒤집기 횟수: <strong className="text-amber-800">{flipCount}회</strong> (기준 {maxRef}회 이하)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className={`rounded-lg border border-slate-200 bg-white ${ui.controlBtn} font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs`}
          >
            처음 상태로 초기화
          </button>
          <button
            type="button"
            onClick={handleNewProblem}
            className={`rounded-lg bg-amber-600 ${ui.controlBtn} font-bold text-white hover:bg-amber-700 transition cursor-pointer shadow-2xs`}
          >
            🎲 새 문제 생성
          </button>
        </div>
      </div>

      {/* Visual Pancake Stack */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <span className={`${ui.stackHeader} font-bold text-slate-700`}>
            🥞 현재 스택 상태: [{stack.join(", ")}]
          </span>
          <span className={`${ui.stackHeader} font-mono text-slate-500`}>
            목표: 1(맨 위) ➔ {n}(맨 아래)
          </span>
        </div>

        {/* Stack Container */}
        <div
          className={`relative mx-auto flex flex-col items-center justify-center rounded-xl bg-slate-50 border border-slate-100 ${ui.stackWrap}`}
        >
          <div className={`${ui.edgeTag} font-bold text-slate-400 tracking-widest uppercase`}>
            ▲ TOP (맨 위)
          </div>

          {stack.map((size, index) => {
            const widthPct = Math.round(35 + (65 * (size - 1)) / (n > 1 ? n - 1 : 1));
            const isHoveredForFlip = hoverK !== null && index < hoverK;
            const colorClass = pancakeColors[(size - 1) % pancakeColors.length];

            return (
              <div
                key={index}
                style={{ width: `${widthPct}%` }}
                className={`relative flex ${ui.cake} items-center justify-between rounded-lg font-bold border shadow-2xs transition duration-150 ${colorClass} ${
                  isHoveredForFlip ? "ring-2 ring-blue-500 scale-102 shadow-xs" : ""
                }`}
              >
                <span className={`${ui.cakeTag} opacity-75`}>#{index + 1}</span>
                <span className={`${ui.cakeSize} font-black`}>크기 {size}</span>
                <span className={`${ui.cakeIcon} opacity-80`}>🥞</span>
              </div>
            );
          })}

          <div className="mt-1 h-2.5 w-full max-w-xs rounded-full bg-slate-300"></div>
          <div className={`${ui.edgeTag} font-bold text-slate-400 tracking-widest uppercase`}>
            ▼ BOTTOM (접시 바닥)
          </div>
        </div>

        {/* Flip Action Buttons */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <span className={`${ui.flipLabel} font-bold text-slate-700 block mb-2`}>
            🔄 위에서 k장 뒤집기:
          </span>
          <div className={`grid grid-cols-3 sm:grid-cols-5 ${ui.flipGrid}`}>
            {Array.from({ length: n }, (_, i) => i + 1).map((k) => (
              <button
                key={k}
                type="button"
                onMouseEnter={() => setHoverK(k)}
                onMouseLeave={() => setHoverK(null)}
                onClick={() => handleFlip(k)}
                className={`flex flex-col items-center justify-center rounded-lg border border-amber-300 bg-amber-50/80 ${ui.flipBtn} font-bold text-amber-900 hover:bg-amber-100 transition cursor-pointer`}
              >
                <span>{k}장 뒤집기</span>
              </button>
            ))}
          </div>
        </div>

        {/* Completion Banner */}
        {isSorted && (
          <div className={`mt-3 rounded-xl border border-emerald-300 bg-emerald-50 ${ui.bannerText} font-semibold text-emerald-950`}>
            <p className="font-bold text-emerald-800 mb-1">
              🎉 정렬 성공! 총 {flipCount}회 뒤집기를 사용해 올바른 순서로 완성했습니다.
            </p>
            <p className={`${ui.bannerSub} text-slate-600`}>
              최종 인코딩 답: <strong>{stack.join("")}</strong>
            </p>

            {onCopyHistory && (
              <button
                type="button"
                onClick={handleExportSummary}
                className={`mt-2 ${ui.exportLink} font-bold text-blue-600 hover:underline cursor-pointer block`}
              >
                📋 내 조작 기록을 알고리즘 작성 힌트로 에디터에 삽입하기 ➔
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
