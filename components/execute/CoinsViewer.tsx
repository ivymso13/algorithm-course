"use client";

import { useState } from "react";

type CoinsState = {
  left: number[];
  right: number[];
  weighCount: number;
  history?: { left: number[]; right: number[]; result: "left" | "right" | "balanced" }[];
};

interface CoinsViewerProps {
  input: Record<string, unknown>;
  state: Record<string, unknown>;
  runAction: (action: string, params: Record<string, unknown>) => Promise<void>;
  loading: boolean;
}

export function CoinsViewer({ input, state: rawState, runAction, loading }: CoinsViewerProps) {
  const n = Number(input.n ?? 12);
  const state = rawState as CoinsState;
  const left = state.left ?? [];
  const right = state.right ?? [];
  const history = state.history ?? [];
  const weighCount = state.weighCount ?? 0;

  const [selectedCoins, setSelectedCoins] = useState<number[]>([]);

  function toggleCoin(coin: number) {
    setSelectedCoins((prev) =>
      prev.includes(coin) ? prev.filter((c) => c !== coin) : [...prev, coin]
    );
  }

  function selectAll() {
    setSelectedCoins(Array.from({ length: n }, (_, i) => i + 1));
  }

  function clearSelection() {
    setSelectedCoins([]);
  }

  async function handlePlaceLeft() {
    if (selectedCoins.length === 0) return;
    await runAction("placeLeft", { coins: selectedCoins });
    setSelectedCoins([]);
  }

  async function handlePlaceRight() {
    if (selectedCoins.length === 0) return;
    await runAction("placeRight", { coins: selectedCoins });
    setSelectedCoins([]);
  }

  async function handleClearPans() {
    await runAction("clearPans", {});
    setSelectedCoins([]);
  }

  async function handleWeigh() {
    await runAction("weigh", {});
  }

  const lastHistory = history.length > 0 ? history[history.length - 1] : null;
  const tiltDeg =
    lastHistory?.result === "left"
      ? -7
      : lastHistory?.result === "right"
      ? 7
      : 0;

  return (
    <div className="space-y-6">
      {/* Visual Balance Scale */}
      <div className="rounded-2xl border border-slate-200 bg-linear-to-b from-slate-50 to-white p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚖️</span>
            <h3 className="text-sm font-bold text-slate-800">양팔저울 시뮬레이터</h3>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <span>저울질 횟수:</span>
            <span className="text-sm font-bold text-blue-900">{weighCount}</span>
            <span className="text-slate-400 font-normal">(기준 3회)</span>
          </div>
        </div>

        {/* Balance Scale SVG & CSS Diagram */}
        <div className="relative mx-auto my-2 flex h-44 max-w-lg items-center justify-center">
          {/* Fulcrum / Center Stand */}
          <div className="absolute bottom-2 h-20 w-3 rounded-t-lg bg-slate-400"></div>
          <div className="absolute bottom-0 h-3 w-28 rounded-md bg-slate-500 shadow-xs"></div>
          <div className="absolute top-16 h-5 w-5 rounded-full border-2 border-slate-600 bg-slate-200 z-10"></div>

          {/* Tilting Beam */}
          <div
            className="absolute top-[72px] flex w-full max-w-md items-center justify-between transition-transform duration-500 ease-out"
            style={{ transform: `rotate(${tiltDeg}deg)` }}
          >
            {/* Left Pan Attachment */}
            <div className="relative flex flex-col items-center">
              {/* String / Chain */}
              <div className="h-10 w-0.5 bg-slate-400"></div>
              {/* Pan Plate */}
              <div
                className={`min-h-[52px] w-36 rounded-b-2xl border-t-2 border-slate-400 p-2 shadow-xs transition ${
                  left.length > 0
                    ? "bg-blue-50/90 border-blue-400"
                    : "bg-slate-100/80"
                }`}
              >
                <p className="text-center text-[10px] font-bold text-blue-800 mb-1">
                  왼쪽 접시 ({left.length}개)
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {left.length === 0 ? (
                    <span className="text-[10px] text-slate-400">비어 있음</span>
                  ) : (
                    left.map((c) => (
                      <span
                        key={c}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-xs"
                      >
                        {c}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Beam Bar */}
            <div className="h-2 w-full bg-slate-600 rounded-sm"></div>

            {/* Right Pan Attachment */}
            <div className="relative flex flex-col items-center">
              {/* String / Chain */}
              <div className="h-10 w-0.5 bg-slate-400"></div>
              {/* Pan Plate */}
              <div
                className={`min-h-[52px] w-36 rounded-b-2xl border-t-2 border-slate-400 p-2 shadow-xs transition ${
                  right.length > 0
                    ? "bg-purple-50/90 border-purple-400"
                    : "bg-slate-100/80"
                }`}
              >
                <p className="text-center text-[10px] font-bold text-purple-800 mb-1">
                  오른쪽 접시 ({right.length}개)
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {right.length === 0 ? (
                    <span className="text-[10px] text-slate-400">비어 있음</span>
                  ) : (
                    right.map((c) => (
                      <span
                        key={c}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white shadow-xs"
                      >
                        {c}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scale Status Outcome Display */}
        <div className="mt-3 text-center">
          {lastHistory ? (
            <div
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-semibold shadow-xs ${
                lastHistory.result === "balanced"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : lastHistory.result === "left"
                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                  : "bg-purple-100 text-purple-800 border border-purple-300"
              }`}
            >
              <span className="text-sm">
                {lastHistory.result === "balanced"
                  ? "⚖️"
                  : lastHistory.result === "left"
                  ? "⬅️"
                  : "➡️"}
              </span>
              <span>
                최근 저울질 결과:{" "}
                <strong>
                  {lastHistory.result === "balanced"
                    ? "양쪽 평형 (무게 같음)"
                    : lastHistory.result === "left"
                    ? "왼쪽 접시가 무거움"
                    : "오른쪽 접시가 무거움"}
                </strong>
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-500">
              동전을 양쪽 접시에 올리고 [저울질하기]를 누르면 결과가 표시됩니다.
            </span>
          )}
        </div>
      </div>

      {/* Coin Selector Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-700">
            🪙 1~12번 동전 선택 (클릭하여 선택/해제)
          </span>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              type="button"
              className="text-[11px] font-medium text-blue-600 hover:underline cursor-pointer"
            >
              전체 선택
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={clearSelection}
              type="button"
              className="text-[11px] font-medium text-slate-500 hover:underline cursor-pointer"
            >
              선택 해제
            </button>
          </div>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
          {Array.from({ length: n }, (_, i) => i + 1).map((coin) => {
            const isLeft = left.includes(coin);
            const isRight = right.includes(coin);
            const isSelected = selectedCoins.includes(coin);

            return (
              <button
                key={coin}
                type="button"
                onClick={() => toggleCoin(coin)}
                className={`relative flex h-11 w-full flex-col items-center justify-center rounded-xl font-bold text-sm transition cursor-pointer ${
                  isSelected
                    ? "bg-slate-900 text-white ring-2 ring-blue-500 shadow-md scale-105"
                    : isLeft
                    ? "bg-blue-100 text-blue-900 border-2 border-blue-400"
                    : isRight
                    ? "bg-purple-100 text-purple-900 border-2 border-purple-400"
                    : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>{coin}</span>
                {isLeft && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-blue-600 text-[9px] font-bold text-white flex items-center justify-center">
                    L
                  </span>
                )}
                {isRight && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-purple-600 text-[9px] font-bold text-white flex items-center justify-center">
                    R
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Coins Summary */}
        <div className="mt-3 flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded-lg p-2">
          <span>
            선택된 동전:{" "}
            <strong>
              {selectedCoins.length > 0
                ? `[${selectedCoins.sort((a, b) => a - b).join(", ")}]`
                : "(없음)"}
            </strong>
          </span>
          <span className="text-[11px] text-slate-400">
            {selectedCoins.length}개 선택됨
          </span>
        </div>

        {/* Actions Button Bar */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={handlePlaceLeft}
            disabled={loading || selectedCoins.length === 0}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 shadow-xs hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <span>⬅️</span>
            <span>왼쪽 저울에 올리기</span>
          </button>

          <button
            type="button"
            onClick={handlePlaceRight}
            disabled={loading || selectedCoins.length === 0}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-800 shadow-xs hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <span>➡️</span>
            <span>오른쪽 저울에 올리기</span>
          </button>

          <button
            type="button"
            onClick={handleClearPans}
            disabled={loading || (left.length === 0 && right.length === 0)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <span>🗑️</span>
            <span>저울 비우기</span>
          </button>

          <button
            type="button"
            onClick={handleWeigh}
            disabled={loading || left.length === 0 || right.length === 0}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <span>⚖️</span>
            <span>저울질하기</span>
          </button>
        </div>
      </div>

      {/* History Log */}
      {history.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <h4 className="text-xs font-bold text-slate-700 mb-2">
            📜 저울질 기록 ({history.length}회)
          </h4>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {history.map((h, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-700 border border-slate-100"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-500">#{idx + 1}</span>
                  <span>
                    왼쪽: <span className="font-mono text-blue-700">[{h.left.join(",")}]</span>
                  </span>
                  <span className="text-slate-300">vs</span>
                  <span>
                    오른쪽: <span className="font-mono text-purple-700">[{h.right.join(",")}]</span>
                  </span>
                </div>
                <span
                  className={`font-semibold px-2 py-0.5 rounded-sm text-[11px] ${
                    h.result === "balanced"
                      ? "bg-emerald-100 text-emerald-800"
                      : h.result === "left"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-purple-100 text-purple-800"
                  }`}
                >
                  {h.result === "balanced"
                    ? "평형"
                    : h.result === "left"
                    ? "왼쪽 무거움"
                    : "오른쪽 무거움"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
