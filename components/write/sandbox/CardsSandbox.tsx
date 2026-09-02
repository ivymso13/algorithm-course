"use client";

import { useState } from "react";
import { cardsProblem, type CardsInput, type CardsState } from "@/lib/problems/cards";

interface CardsSandboxProps {
  onCopyHistory?: (summary: string) => void;
  /** Larger text/buttons for projecting to a whole classroom. */
  presentationMode?: boolean;
}

export function CardsSandbox({ onCopyHistory, presentationMode = false }: CardsSandboxProps) {
  const [instance, setInstance] = useState(() => cardsProblem.generate());
  const [guessPosition, setGuessPosition] = useState<string>("");
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);
  const [showAllCards, setShowAllCards] = useState(false);

  const input = instance.input as CardsInput;
  const state = instance.state as CardsState;
  const n = input.n;
  const target = input.target;
  const revealed = state.revealed ?? [];
  const flipCount = state.flipCount ?? 0;
  const refCount = Math.ceil(Math.log2(n + 1));

  const revealedMap = new Map(revealed.map((r) => [r.position, r.value]));

  function handleNewProblem() {
    const next = cardsProblem.generate();
    setInstance(next);
    setGuessPosition("");
    setFeedback(null);
    setShowAllCards(false);
  }

  function handleReset() {
    setInstance((prev) => ({
      ...prev,
      state: { revealed: [], flipCount: 0 },
    }));
    setGuessPosition("");
    setFeedback(null);
    setShowAllCards(false);
  }

  function handleFlip(position: number) {
    if (revealedMap.has(position)) return;
    try {
      const outcome = cardsProblem.applyAction(state, input, "flip", { position });
      setInstance((prev) => ({ ...prev, state: outcome.state as CardsState }));
    } catch {
      // ignore
    }
  }

  function handleCheckAnswer() {
    const pos = Number(guessPosition.trim());
    if (!Number.isFinite(pos)) return;
    const isCorrect = pos === instance.correctAnswer;
    setShowAllCards(true);

    if (isCorrect) {
      setFeedback({
        isCorrect: true,
        message:
          pos === 0
            ? `🎉 정답입니다! 목표 숫자 ${target}은(는) 카드에 없습니다 (0번). (뒤집은 카드: ${flipCount}장)`
            : `🎉 정답입니다! ${pos}번 카드에 목표 숫자 ${target}이(가) 있습니다. (뒤집은 카드: ${flipCount}장 / 이론 기준: ⌈log₂(${n}+1)⌉ = ${refCount}회)`,
      });
    } else {
      setFeedback({
        isCorrect: false,
        message: `❌ 아쉽습니다. 실제 정답 위치는 ${instance.correctAnswer}번(${instance.correctAnswer === 0 ? "없음" : `값: ${target}`})입니다.`,
      });
    }
  }

  function handleExportSummary() {
    if (!onCopyHistory) return;
    const lines = [
      `1. 목표 숫자 [${target}]을(를) 찾기 위해 정렬된 카드의 중간 위치를 확인한다.`,
      ...revealed.map((r, i) => {
        const comp =
          r.value === target
            ? "목표 숫자를 찾았으므로 종료"
            : r.value < target
            ? "목표보다 작으므로 오른쪽 절반 탐색"
            : "목표보다 크므로 왼쪽 절반 탐색";
        return `${i + 2}. ${r.position}번 카드 확인 (값: ${r.value}) ➔ ${comp}`;
      }),
      `${revealed.length + 2}. 최종 찾은 위치 번호(또는 0)를 답으로 출력한다.`,
    ];
    onCopyHistory(lines.join("\n"));
  }

  // Classroom-projector sizing: swaps in noticeably larger text/buttons
  // without touching the compact layout the student write-page uses.
  const size = presentationMode
    ? {
        statText: "text-base",
        controlBtn: "px-4 py-2 text-sm",
        targetLabel: "text-sm",
        targetNumber: "text-4xl",
        deckHint: "text-sm",
        cardGrid: "grid-cols-4 sm:grid-cols-6 gap-3",
        card: "h-28",
        cardTag: "text-xs",
        cardValue: "text-2xl",
        cardStatus: "text-xs",
        guessLabel: "text-sm",
        guessInput: "w-40 px-4 py-2.5 text-base",
        checkBtn: "px-5 py-2.5 text-sm",
        toggleLink: "text-sm",
        feedback: "p-4 text-sm",
        exportLink: "text-sm",
      }
    : {
        statText: "text-xs",
        controlBtn: "px-2.5 py-1 text-xs",
        targetLabel: "text-xs",
        targetNumber: "text-2xl",
        deckHint: "text-xs",
        cardGrid: "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2",
        card: "h-20",
        cardTag: "text-[10px]",
        cardValue: "text-lg",
        cardStatus: "text-[9px]",
        guessLabel: "text-xs",
        guessInput: "w-32 px-3 py-1.5 text-xs",
        checkBtn: "px-3 py-1.5 text-xs",
        toggleLink: "text-xs",
        feedback: "p-2.5 text-xs",
        exportLink: "text-xs",
      };

  return (
    <div className="space-y-4">
      {/* Sandbox Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
            직접 풀이 샌드박스
          </span>
          <span className={`${size.statText} text-slate-500`}>
            뒤집은 횟수: <strong className="text-blue-700">{flipCount}회</strong> (이진 탐색 기준 {refCount}회 이내)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className={`rounded-lg border border-slate-200 bg-white ${size.controlBtn} font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs`}
          >
            처음 상태로 초기화
          </button>
          <button
            type="button"
            onClick={handleNewProblem}
            className={`rounded-lg bg-blue-600 ${size.controlBtn} font-bold text-white hover:bg-blue-700 transition cursor-pointer shadow-2xs`}
          >
            🎲 새 문제 생성
          </button>
        </div>
      </div>

      {/* Target Goal Banner */}
      <div className="rounded-xl border border-blue-200 bg-linear-to-r from-blue-50 to-indigo-50 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎯</span>
          <div>
            <span className={`${size.targetLabel} text-blue-900 font-semibold block`}>찾아야 할 목표 숫자:</span>
            <span className={`${size.targetNumber} font-black text-blue-700`}>{target}</span>
          </div>
        </div>

        <div className={`text-right ${size.deckHint} text-slate-600`}>
          <span>오름차순으로 정렬된 <strong>{n}장</strong>의 카드</span>
          <span className="block text-[11px] text-slate-400">카드를 클릭해 숫자를 확인하세요</span>
        </div>
      </div>

      {/* Interactive Card Deck Grid */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className={`grid ${size.cardGrid}`}>
          {Array.from({ length: n }, (_, i) => i + 1).map((pos) => {
            const isRevealed = revealedMap.has(pos);
            const value = isRevealed ? revealedMap.get(pos) : showAllCards ? input.array[pos - 1] : null;
            const isMatch = value === target;

            return (
              <button
                key={pos}
                type="button"
                onClick={() => handleFlip(pos)}
                disabled={isRevealed}
                className={`relative flex ${size.card} flex-col items-center justify-between rounded-xl p-2 font-bold transition duration-200 cursor-pointer ${
                  isRevealed || showAllCards
                    ? isMatch
                      ? "bg-emerald-500 text-white ring-2 ring-emerald-300 shadow-md scale-105"
                      : "bg-slate-100 text-slate-900 border-2 border-slate-300 shadow-inner"
                    : "bg-blue-600 text-white shadow-xs hover:bg-blue-500 hover:scale-102"
                }`}
              >
                <span className={`${size.cardTag} opacity-75 font-mono`}>#{pos}</span>
                {value !== null ? (
                  <span className={`${size.cardValue} font-black`}>{value}</span>
                ) : (
                  <span className={`${size.cardValue} opacity-80`}>❓</span>
                )}
                <span className={`${size.cardStatus} opacity-60`}>
                  {value !== null ? (isMatch ? "일치!" : "확인됨") : "클릭"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Guess Position & Check Answer */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
        <span className={`${size.guessLabel} font-bold text-slate-800 block`}>
          🏁 목표 숫자가 있는 위치 번호 입력 (1~{n}, 없으면 0):
        </span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            aria-label="목표 숫자 위치 번호"
            className={`rounded-lg border border-slate-300 bg-white ${size.guessInput} font-bold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden`}
            placeholder={`1~${n} 또는 0`}
            value={guessPosition}
            onChange={(e) => setGuessPosition(e.target.value)}
          />

          <button
            type="button"
            onClick={handleCheckAnswer}
            disabled={!guessPosition.trim()}
            className={`rounded-lg bg-emerald-600 ${size.checkBtn} font-bold text-white hover:bg-emerald-700 disabled:opacity-40 transition cursor-pointer`}
          >
            정답 확인
          </button>

          {feedback && (
            <button
              type="button"
              onClick={() => setShowAllCards((prev) => !prev)}
              className={`ml-auto ${size.toggleLink} text-slate-500 hover:underline cursor-pointer`}
            >
              {showAllCards ? "카드 다시 가리기" : "전체 카드 다시 보기"}
            </button>
          )}
        </div>

        {feedback && (
          <div
            className={`rounded-lg ${size.feedback} font-semibold ${
              feedback.isCorrect
                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                : "bg-rose-100 text-rose-900 border border-rose-300"
            }`}
          >
            {feedback.message}
          </div>
        )}

        {showAllCards && revealed.length > 0 && onCopyHistory && (
          <button
            type="button"
            onClick={handleExportSummary}
            className={`${size.exportLink} font-bold text-blue-600 hover:underline cursor-pointer block pt-1`}
          >
            📋 내 조작 기록을 알고리즘 작성 힌트로 에디터에 삽입하기 ➔
          </button>
        )}
      </div>
    </div>
  );
}
