"use client";

import { useState } from "react";
import { coinsProblem, type CoinsInput, type CoinsState } from "@/lib/problems/coins";

interface CoinsSandboxProps {
  onCopyHistory?: (summary: string) => void;
}

export function CoinsSandbox({ onCopyHistory }: CoinsSandboxProps) {
  // Generate local instance
  const [instance, setInstance] = useState(() => coinsProblem.generate());
  const [selectedCoins, setSelectedCoins] = useState<number[]>([]);
  const [guessCoin, setGuessCoin] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);
  const [revealed, setRevealed] = useState(false);

  const input = instance.input as CoinsInput;
  const state = instance.state as CoinsState;
  const left = state.left ?? [];
  const right = state.right ?? [];
  const history = state.history ?? [];
  const weighCount = state.weighCount ?? 0;

  function handleNewProblem() {
    const next = coinsProblem.generate();
    setInstance(next);
    setSelectedCoins([]);
    setGuessCoin(null);
    setFeedback(null);
    setRevealed(false);
  }

  function handleReset() {
    setInstance((prev) => ({
      ...prev,
      state: { left: [], right: [], weighCount: 0, history: [] },
    }));
    setSelectedCoins([]);
    setGuessCoin(null);
    setFeedback(null);
    setRevealed(false);
  }

  function toggleCoin(coin: number) {
    setSelectedCoins((prev) =>
      prev.includes(coin) ? prev.filter((c) => c !== coin) : [...prev, coin]
    );
  }

  function handlePlaceLeft() {
    if (selectedCoins.length === 0) return;
    try {
      const outcome = coinsProblem.applyAction(state, input, "placeLeft", { coins: selectedCoins });
      setInstance((prev) => ({ ...prev, state: outcome.state as CoinsState }));
      setSelectedCoins([]);
    } catch {
      // ignore
    }
  }

  function handlePlaceRight() {
    if (selectedCoins.length === 0) return;
    try {
      const outcome = coinsProblem.applyAction(state, input, "placeRight", { coins: selectedCoins });
      setInstance((prev) => ({ ...prev, state: outcome.state as CoinsState }));
      setSelectedCoins([]);
    } catch {
      // ignore
    }
  }

  function handleClearPans() {
    const outcome = coinsProblem.applyAction(state, input, "clearPans", {});
    setInstance((prev) => ({ ...prev, state: outcome.state as CoinsState }));
    setSelectedCoins([]);
  }

  function handleWeigh() {
    if (left.length === 0 || right.length === 0) return;
    try {
      const outcome = coinsProblem.applyAction(state, input, "weigh", {});
      setInstance((prev) => ({ ...prev, state: outcome.state as CoinsState }));
    } catch {
      // ignore
    }
  }

  function handleCheckAnswer() {
    if (guessCoin === null) return;
    const isCorrect = guessCoin === input.fakeCoin;
    setRevealed(true);
    if (isCorrect) {
      setFeedback({
        isCorrect: true,
        message: `🎉 정답입니다! ${input.fakeCoin}번 동전이 가짜(${input.fakeHeavier ? "더 무거움" : "더 가벼움"})였습니다. (저울질 ${weighCount}회 사용)`,
      });
    } else {
      setFeedback({
        isCorrect: false,
        message: `❌ 아쉽습니다. 선택한 ${guessCoin}번은 정상 동전입니다. 실제 가짜 동전은 ${input.fakeCoin}번이었습니다.`,
      });
    }
  }

  function handleExportSummary() {
    if (!onCopyHistory) return;
    const lines = [
      "1. 동전 12개를 저울에 올릴 그룹으로 나눈다.",
      ...history.map((h, i) => {
        const resStr =
          h.result === "balanced"
            ? "평형이면"
            : h.result === "left"
            ? "왼쪽이 더 무거우면"
            : "오른쪽이 더 무거우면";
        return `${i + 2}. 왼쪽 [${h.left.join(",")}] vs 오른쪽 [${h.right.join(",")}] 저울질: ${resStr}`;
      }),
      `${history.length + 2}. 남은 후보 중 가짜 동전 번호를 최종 답으로 출력한다.`,
    ];
    onCopyHistory(lines.join("\n"));
  }

  const lastHistory = history.length > 0 ? history[history.length - 1] : null;
  const tiltDeg =
    lastHistory?.result === "left"
      ? -7
      : lastHistory?.result === "right"
      ? 7
      : 0;

  return (
    <div className="space-y-4">
      {/* Sandbox Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
            직접 풀이 샌드박스
          </span>
          <span className="text-xs text-slate-500">
            저울질 횟수: <strong className="text-blue-700">{weighCount}회</strong> (기준 3회 이내)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            처음 상태로 초기화
          </button>
          <button
            type="button"
            onClick={handleNewProblem}
            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer shadow-2xs"
          >
            🎲 새 문제 생성
          </button>
        </div>
      </div>

      {/* Visual Balance Scale */}
      <div className="rounded-xl border border-slate-200 bg-linear-to-b from-slate-50 to-white p-4">
        {/* Scale Diagram */}
        <div className="relative mx-auto my-2 flex h-40 max-w-md items-center justify-center">
          <div className="absolute bottom-2 h-16 w-2.5 rounded-t-lg bg-slate-400"></div>
          <div className="absolute bottom-0 h-2.5 w-24 rounded-md bg-slate-500"></div>
          <div className="absolute top-14 h-4 w-4 rounded-full border-2 border-slate-600 bg-slate-200 z-10"></div>

          <div
            className="absolute top-[64px] flex w-full max-w-md items-center justify-between transition-transform duration-500 ease-out"
            style={{ transform: `rotate(${tiltDeg}deg)` }}
          >
            {/* Left Pan */}
            <div className="relative flex flex-col items-center">
              <div className="h-8 w-0.5 bg-slate-400"></div>
              <div
                className={`min-h-[48px] w-32 rounded-b-xl border-t-2 p-1.5 shadow-2xs transition ${
                  left.length > 0
                    ? "bg-blue-50/90 border-blue-400"
                    : "bg-slate-100/80 border-slate-300"
                }`}
              >
                <p className="text-center text-[10px] font-bold text-blue-800 mb-1">
                  왼쪽 접시 ({left.length}개)
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {left.map((c) => (
                    <span
                      key={c}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-1.5 w-full bg-slate-600 rounded-sm"></div>

            {/* Right Pan */}
            <div className="relative flex flex-col items-center">
              <div className="h-8 w-0.5 bg-slate-400"></div>
              <div
                className={`min-h-[48px] w-32 rounded-b-xl border-t-2 p-1.5 shadow-2xs transition ${
                  right.length > 0
                    ? "bg-purple-50/90 border-purple-400"
                    : "bg-slate-100/80 border-slate-300"
                }`}
              >
                <p className="text-center text-[10px] font-bold text-purple-800 mb-1">
                  오른쪽 접시 ({right.length}개)
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {right.map((c) => (
                    <span
                      key={c}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-purple-600 text-[9px] font-bold text-white"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Result Outcome */}
        <div className="text-center mt-2">
          {lastHistory ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold ${
                lastHistory.result === "balanced"
                  ? "bg-emerald-100 text-emerald-800"
                  : lastHistory.result === "left"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-purple-100 text-purple-800"
              }`}
            >
              <span>{lastHistory.result === "balanced" ? "⚖️ 평형" : lastHistory.result === "left" ? "⬅️ 왼쪽 무거움" : "➡️ 오른쪽 무거움"}</span>
              <span>(양쪽 무게 비교 완료)</span>
            </span>
          ) : (
            <span className="text-xs text-slate-400">
              동전을 선택해 접시에 올리고 [저울질하기]를 누르세요.
            </span>
          )}
        </div>
      </div>

      {/* 12 Coins Selection Bar */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-700 block">
          🪙 동전 1~12번 선택 (클릭하여 선택):
        </span>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((coin) => {
            const isLeft = left.includes(coin);
            const isRight = right.includes(coin);
            const isSelected = selectedCoins.includes(coin);

            return (
              <button
                key={coin}
                type="button"
                onClick={() => toggleCoin(coin)}
                className={`relative flex h-10 w-full flex-col items-center justify-center rounded-lg font-bold text-xs transition cursor-pointer ${
                  isSelected
                    ? "bg-slate-900 text-white ring-2 ring-blue-500 shadow-xs"
                    : isLeft
                    ? "bg-blue-100 text-blue-900 border border-blue-400"
                    : isRight
                    ? "bg-purple-100 text-purple-900 border border-purple-400"
                    : "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span>{coin}</span>
                {isLeft && <span className="text-[8px] text-blue-700 font-bold">L</span>}
                {isRight && <span className="text-[8px] text-purple-700 font-bold">R</span>}
              </button>
            );
          })}
        </div>

        {/* Action Button Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <button
            type="button"
            onClick={handlePlaceLeft}
            disabled={selectedCoins.length === 0}
            className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-40 transition cursor-pointer"
          >
            ⬅️ 왼쪽 저울에
          </button>
          <button
            type="button"
            onClick={handlePlaceRight}
            disabled={selectedCoins.length === 0}
            className="rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1.5 text-xs font-bold text-purple-800 hover:bg-purple-100 disabled:opacity-40 transition cursor-pointer"
          >
            ➡️ 오른쪽 저울에
          </button>
          <button
            type="button"
            onClick={handleClearPans}
            disabled={left.length === 0 && right.length === 0}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
          >
            🗑️ 저울 비우기
          </button>
          <button
            type="button"
            onClick={handleWeigh}
            disabled={left.length === 0 || right.length === 0}
            className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
          >
            ⚖️ 저울질하기
          </button>
        </div>
      </div>

      {/* Guess Fake Coin & Answer Check */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
        <span className="text-xs font-bold text-slate-800 block">
          🎯 가짜 동전 번호 추론 및 정답 확인:
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((coin) => (
            <button
              key={coin}
              type="button"
              onClick={() => setGuessCoin(coin)}
              className={`h-7 w-7 rounded-md font-bold text-xs transition cursor-pointer ${
                guessCoin === coin
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
              }`}
            >
              {coin}
            </button>
          ))}

          <button
            type="button"
            onClick={handleCheckAnswer}
            disabled={guessCoin === null}
            className="ml-auto rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40 transition cursor-pointer"
          >
            정답 확인
          </button>
        </div>

        {feedback && (
          <div
            className={`rounded-lg p-2.5 text-xs font-semibold ${
              feedback.isCorrect
                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                : "bg-rose-100 text-rose-900 border border-rose-300"
            }`}
          >
            {feedback.message}
          </div>
        )}

        {revealed && history.length > 0 && onCopyHistory && (
          <button
            type="button"
            onClick={handleExportSummary}
            className="text-xs font-bold text-blue-600 hover:underline cursor-pointer block pt-1"
          >
            📋 내 조작 기록을 알고리즘 작성 힌트로 에디터에 삽입하기 ➔
          </button>
        )}
      </div>
    </div>
  );
}
