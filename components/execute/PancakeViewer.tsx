"use client";

import { useState } from "react";

type PancakeState = {
  stack: number[];
  flipCount: number;
  history?: { k: number }[];
};

interface PancakeViewerProps {
  input: Record<string, unknown>;
  state: Record<string, unknown>;
  runAction: (action: string, params: Record<string, unknown>) => Promise<void>;
  loading: boolean;
}

export function PancakeViewer({ input, state: rawState, runAction, loading }: PancakeViewerProps) {
  const n = Number(input.n ?? 0);
  const state = rawState as PancakeState;
  const stack = state.stack ?? [];
  const flipCount = state.flipCount ?? 0;
  const history = state.history ?? [];
  const maxRef = 2 * (n - 1);

  const [hoverK, setHoverK] = useState<number | null>(null);

  const isSorted = stack.every((val, i) => val === i + 1);
  const encodedValue = stack.join("");

  async function handleFlip(k: number) {
    if (k < 1 || k > n) return;
    await runAction("flip", { k });
  }

  // Color generator for pancake layers (warm golden/amber tones)
  const pancakeColors = [
    "bg-amber-100 border-amber-300 text-amber-900",
    "bg-amber-200 border-amber-400 text-amber-900",
    "bg-amber-300 border-amber-500 text-amber-950",
    "bg-amber-400 border-amber-600 text-amber-950",
    "bg-amber-500 border-amber-700 text-white",
    "bg-amber-600 border-amber-800 text-white",
  ];

  return (
    <div className="space-y-5">
      {/* Problem Param Banner */}
      <div className="rounded-2xl border border-amber-200 bg-linear-to-r from-amber-50 to-orange-50 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-600 text-2xl text-white shadow-xs">
              🥞
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-800">팬케이크 정렬 목표</p>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-slate-900">
                  맨 위가 1(가장 작음) ➔ 맨 아래가 {n}(가장 큼)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-white/80 px-3.5 py-2 border border-amber-200 shadow-xs">
            <span className="text-xs text-slate-600">뒤집기 횟수:</span>
            <span className="text-base font-bold text-amber-700">{flipCount}회</span>
            <span className="text-[11px] text-slate-400">
              (기준 {maxRef}회 이하)
            </span>
          </div>
        </div>

        <div className="mt-3 rounded-lg bg-amber-100/70 px-3 py-1.5 text-xs text-amber-950 flex items-center justify-between">
          <span>💡 &ldquo;위에서 k장을 통째로 뒤집는다&rdquo;는 행동만 사용해 정렬합니다.</span>
          {isSorted && (
            <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
              ✨ 정렬 완료! (제출 답: {encodedValue})
            </span>
          )}
        </div>
      </div>

      {/* Visual Pancake Stack */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-700">
            🥞 현재 쌓인 상태 (위 ➔ 아래 순서: [{stack.join(", ")}])
          </h4>
          <span className="text-xs font-mono text-slate-500">
            순서 인코딩: <strong className="text-slate-800">{encodedValue}</strong>
          </span>
        </div>

        {/* Stack Box */}
        <div className="relative mx-auto flex flex-col items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-linear-to-b from-slate-50 to-amber-50/40 border border-slate-100 max-w-md">
          {/* Top Indicator */}
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            ▲ TOP (맨 위)
          </div>

          {stack.map((size, index) => {
            // Width: size 1 is ~35% min, size n is 100%
            const widthPct = Math.round(35 + (65 * (size - 1)) / (n > 1 ? n - 1 : 1));
            const isHoveredForFlip = hoverK !== null && index < hoverK;
            const colorClass = pancakeColors[(size - 1) % pancakeColors.length];

            return (
              <div
                key={index}
                style={{ width: `${widthPct}%` }}
                className={`relative flex h-10 items-center justify-between rounded-xl px-4 font-bold text-xs border shadow-xs transition duration-200 ${colorClass} ${
                  isHoveredForFlip
                    ? "ring-2 ring-blue-500 scale-[1.02] shadow-md"
                    : ""
                }`}
              >
                <span className="text-[10px] font-medium opacity-75">
                  위 #{index + 1}
                </span>
                <span className="text-sm font-black tracking-wide">
                  크기 {size}
                </span>
                <span className="text-[11px] opacity-80">🥞</span>
              </div>
            );
          })}

          {/* Bottom Plate Indicator */}
          <div className="mt-1 h-3 w-full max-w-sm rounded-full bg-slate-300 shadow-xs"></div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            ▼ BOTTOM (접시 바닥)
          </div>
        </div>

        {/* Flip Buttons Control Bar */}
        <div className="mt-6 border-t border-slate-100 pt-4">
          <span className="text-xs font-bold text-slate-700 block mb-2">
            🔄 뒤집기 조작 (k장 선택):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {Array.from({ length: n }, (_, i) => i + 1).map((k) => (
              <button
                key={k}
                type="button"
                onMouseEnter={() => setHoverK(k)}
                onMouseLeave={() => setHoverK(null)}
                onClick={() => handleFlip(k)}
                disabled={loading}
                className="flex flex-col items-center justify-center rounded-xl border border-amber-300 bg-amber-50/80 p-2 text-xs font-bold text-amber-900 shadow-xs hover:bg-amber-100 hover:border-amber-400 transition cursor-pointer disabled:opacity-50"
              >
                <span className="text-sm">위에서 {k}장</span>
                <span className="text-[10px] font-normal text-amber-700">통째로 뒤집기</span>
              </button>
            ))}
          </div>
        </div>

        {/* History of Flips */}
        {history.length > 0 && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-200">
            <span className="text-xs font-bold text-slate-700 block mb-1">
              📜 뒤집기 조작 기록 ({history.length}회):
            </span>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {history.map((h, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 font-bold text-amber-900">
                    {h.k}장 뒤집음
                  </span>
                  {idx < history.length - 1 && (
                    <span className="text-slate-400 font-bold">➔</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
