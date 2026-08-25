"use client";

import { useState } from "react";

interface AlgorithmReaderProps {
  algorithmText: string;
}

export function AlgorithmReader({ algorithmText }: AlgorithmReaderProps) {
  const [checkedLines, setCheckedLines] = useState<number[]>([]);
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("base");

  const lines = algorithmText.split("\n").filter((l) => l.trim().length > 0);

  function toggleLine(index: number) {
    setCheckedLines((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  }

  function resetChecklist() {
    setCheckedLines([]);
  }

  const fontSizeClass =
    fontSize === "sm"
      ? "text-xs leading-relaxed"
      : fontSize === "lg"
      ? "text-base leading-relaxed"
      : "text-sm leading-relaxed";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      {/* Reader Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">📜</span>
          <h3 className="text-sm font-bold text-slate-800">
            작성자의 알고리즘 원문
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Font zoom controls */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFontSize("sm")}
              className={`px-2 py-0.5 rounded cursor-pointer ${
                fontSize === "sm" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              작게
            </button>
            <button
              type="button"
              onClick={() => setFontSize("base")}
              className={`px-2 py-0.5 rounded cursor-pointer ${
                fontSize === "base" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              보통
            </button>
            <button
              type="button"
              onClick={() => setFontSize("lg")}
              className={`px-2 py-0.5 rounded cursor-pointer ${
                fontSize === "lg" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              크게
            </button>
          </div>

          {checkedLines.length > 0 && (
            <button
              type="button"
              onClick={resetChecklist}
              className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              체크 초기화
            </button>
          )}
        </div>
      </div>

      {/* Human Computer Notice Banner */}
      <div className="border-b border-amber-200 bg-amber-50/80 px-4 py-2 text-xs text-amber-900 flex items-center gap-2">
        <span className="font-bold text-amber-800">⚠️ 인간 컴퓨터 주의사항:</span>
        <span>
          아래 글에 적힌 명령만 <strong>한 줄씩 그대로 수행</strong>하세요. 임의로 추측하거나 생략하지 마세요.
        </span>
      </div>

      {/* Interactive Step-by-Step Checklist View */}
      <div className="max-h-80 overflow-y-auto p-4 space-y-1.5 font-mono">
        {lines.map((line, idx) => {
          const isChecked = checkedLines.includes(idx);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => toggleLine(idx)}
              aria-pressed={isChecked}
              className={`group flex w-full items-start gap-3 rounded-lg p-2 text-left transition cursor-pointer ${
                isChecked
                  ? "bg-slate-100 text-slate-400 line-through"
                  : "bg-slate-50/60 hover:bg-blue-50/50 text-slate-800"
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                  isChecked
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-300 bg-white text-transparent group-hover:border-blue-400"
                }`}
              >
                ✓
              </span>
              <span className={`whitespace-pre-wrap ${fontSizeClass}`}>
                {line}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
