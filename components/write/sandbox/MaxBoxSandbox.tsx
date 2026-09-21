"use client";

import { useEffect, useRef, useState } from "react";
import { maxBoxProblem, type MaxBoxInput, type MaxBoxState } from "@/lib/problems/maxbox";
import type { GeneratedInstance } from "@/lib/problems/types";

interface MaxBoxSandboxProps {
  onCopyHistory?: (summary: string) => void;
  /** Larger text/buttons for projecting to a whole classroom. */
  presentationMode?: boolean;
}

const PEEK_MS = 650;

/** A compact, always-visible number pad. The memo represents the one
 * variable a student is keeping track of, so it's edited directly and
 * instantly — no separate "draft → commit" step — the same way reassigning
 * a variable doesn't need confirming. Digit buttons are the primary input
 * action (white + light-blue hover); clear/backspace are visually secondary
 * so they don't compete with the digits. */
function NumberPad({
  value,
  onChange,
  maxLength = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  return (
    <div className="w-full space-y-1.5">
      <div className="rounded-md border border-slate-200 bg-slate-50 py-2 text-center font-mono text-lg font-bold text-slate-800">
        {value || <span className="text-slate-300">-</span>}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => value.length < maxLength && onChange(value + d)}
            className="aspect-square rounded-md border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-blue-50 active:scale-95 transition cursor-pointer"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange("")}
          className="aspect-square rounded-md border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-400 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
        >
          지우기
        </button>
        <button
          type="button"
          onClick={() => value.length < maxLength && onChange(value + "0")}
          className="aspect-square rounded-md border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-blue-50 active:scale-95 transition cursor-pointer"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => onChange(value.slice(0, -1))}
          className="aspect-square rounded-md border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-400 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}

export function MaxBoxSandbox({ onCopyHistory, presentationMode = false }: MaxBoxSandboxProps) {
  // Generated lazily on mount (not in the useState initializer) — the
  // instance is random, and computing it during the initial render would run
  // once on the server and once again on the client, so the two would never
  // agree and React would flag a hydration mismatch.
  const [instance, setInstance] = useState<GeneratedInstance<MaxBoxInput> | null>(null);
  const [peekPosition, setPeekPosition] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [guessInput, setGuessInput] = useState("");
  const [guessResult, setGuessResult] = useState<{ isCorrect: boolean } | null>(null);
  const [clickCountAtGuess, setClickCountAtGuess] = useState(0);
  const [copied, setCopied] = useState(false);

  const peekTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setInstance(maxBoxProblem.generate());
    return () => {
      if (peekTimerRef.current !== null) window.clearTimeout(peekTimerRef.current);
    };
  }, []);

  if (!instance) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-slate-400">
        📦 상자를 준비하는 중...
      </div>
    );
  }

  const input = instance.input as MaxBoxInput;
  const state = instance.state as MaxBoxState;
  const n = input.n;
  const clickCount = state.log.length;
  const checkedPositions = new Set(state.log.map((e) => e.position));

  function resetProgress() {
    setPeekPosition(null);
    setNote("");
    setGuessInput("");
    setGuessResult(null);
    setClickCountAtGuess(0);
  }

  function handleReset() {
    resetProgress();
    setInstance((prev) => (prev ? { ...prev, state: { log: [] } } : prev));
  }

  function handleNewGame() {
    resetProgress();
    setInstance(maxBoxProblem.generate());
  }

  const solved = guessResult?.isCorrect === true;

  // A box peeks open, then closes itself a moment later — like actually
  // lifting a box lid and setting it back down. Peeking the same box again
  // (any number of times) is always allowed; every peek is logged, which is
  // what the "확인 횟수" stat below reflects.
  function handlePeekBox(position: number) {
    if (solved) return;
    if (peekTimerRef.current !== null) window.clearTimeout(peekTimerRef.current);
    try {
      const outcome = maxBoxProblem.applyAction(state, input, "open", { position });
      setInstance((prev) => (prev ? { ...prev, state: outcome.state as MaxBoxState } : prev));
      setPeekPosition(position);
      peekTimerRef.current = window.setTimeout(() => setPeekPosition(null), PEEK_MS);
    } catch {
      // ignore — position is always in range here, this just guards the shape
    }
  }

  function handleSubmitGuess() {
    const val = Number(guessInput.trim());
    if (!Number.isFinite(val)) return;
    setGuessResult({ isCorrect: val === instance.correctAnswer });
    setClickCountAtGuess(clickCount);
  }

  function handleExportSummary() {
    if (!onCopyHistory) return;
    const lines = [
      `1. 상자 속 사과 개수: ${input.counts.join(", ")} (확인 횟수 ${clickCountAtGuess}회, 최소 ${instance.referenceActionCount}회) → 최댓값: ${instance.correctAnswer}`,
      `2. 마지막까지 메모지에 남아있던 숫자: ${note || "(없음)"}`,
      `3. (여기에 상자를 확인하며 가장 큰 값을 어떻게 계속 기억해뒀는지, 나만의 규칙을 정리해서 적어보세요)`,
    ];
    onCopyHistory(lines.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const size = presentationMode ? { box: "h-24 w-24 text-lg" } : { box: "h-20 w-20 text-base" };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header — identity + progress stat + de-emphasized controls */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-bold text-slate-900 shrink-0">상자 속 사과</span>
          <span className="text-xs text-slate-400 truncate">
            확인 {clickCount}회
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={handleNewGame}
            className="rounded-md px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition cursor-pointer"
          >
            새 문제
          </button>
        </div>
      </div>

      {/* Instruction — one line, no banner */}
      <p className="px-4 pt-3 text-center text-sm text-slate-600">
        가장 많은 사과가 들어있는 상자를 찾아보세요
      </p>

      {/* Box grid (hero) + memo, side by side — stacks on narrow screens.
          items-start keeps each column at its own natural height instead of
          the default flex stretch, which used to pad the (usually shorter)
          box column with dead space to match the memo panel's height. */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-5 px-4 py-5">
        <div className="flex-1 flex flex-wrap content-start justify-center gap-3 rounded-xl bg-slate-50/60 p-4">
          {Array.from({ length: n }, (_, idx) => {
            const position = idx + 1;
            const isOpen = peekPosition === position;
            const everChecked = checkedPositions.has(position);
            const value = input.counts[idx];
            return (
              <button
                key={position}
                type="button"
                onClick={() => handlePeekBox(position)}
                disabled={solved}
                aria-pressed={isOpen}
                aria-label={`${position}번째 상자`}
                className={`relative flex ${size.box} items-center justify-center rounded-xl font-bold transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                  isOpen
                    ? "scale-110 bg-blue-50 ring-2 ring-blue-500 shadow-md"
                    : everChecked
                    ? "bg-slate-50 ring-1 ring-blue-200 hover:ring-blue-300"
                    : "bg-slate-100 ring-1 ring-slate-200 hover:ring-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="absolute top-1.5 left-2 text-[11px] font-mono text-slate-400">{position}</span>
                {isOpen ? (
                  <span className="flex flex-col items-center">
                    <span className="text-2xl leading-none">🍎</span>
                    <span className="mt-1 font-mono text-base font-black leading-tight text-blue-700">{value}</span>
                  </span>
                ) : (
                  <span className="text-3xl opacity-70">📦</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Memo — compact side panel, number pad always visible */}
        <div className="sm:w-[236px] shrink-0 sm:border-l sm:border-slate-100 sm:pl-5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs font-medium text-slate-400">메모</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              숫자 1개만
            </span>
          </div>
          <NumberPad value={note} onChange={setNote} />
        </div>
      </div>

      <div className="border-t border-slate-100" />

      {/* Final answer — last step of the same flow, not a separate card.
          Submittable anytime (checking every box first isn't required); a
          wrong guess just asks the student to try again, without giving the
          answer away. */}
      <div className="px-4 py-3">
        {!solved && (
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-slate-600">가장 많았던 사과는? (</span>
            <input
              type="number"
              aria-label="가장 많았던 사과 개수"
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value)}
              placeholder=" "
              className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-sm font-bold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden"
            />
            <span className="text-sm font-medium text-slate-600">)개</span>
            <button
              type="button"
              onClick={handleSubmitGuess}
              disabled={!guessInput.trim()}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            >
              확인
            </button>
          </div>
        )}

        {guessResult && (
          <div className="text-center space-y-1">
            <p className={`text-sm font-semibold ${solved ? "text-blue-700" : "text-rose-600"}`}>
              {solved ? `정답입니다 · 가장 많은 사과는 ${instance.correctAnswer}개였어요` : "아쉬워요 · 다시 한번 확인해서 풀어보세요"}
            </p>
            {solved && onCopyHistory && (
              <button
                type="button"
                onClick={handleExportSummary}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                {copied ? "✔ 에디터에 추가했어요" : "내 활동 기록 추가하기 ➔"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
