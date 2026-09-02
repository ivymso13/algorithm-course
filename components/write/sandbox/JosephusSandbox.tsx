"use client";

import { useState } from "react";
import { josephusProblem, type JosephusInput, type JosephusState } from "@/lib/problems/josephus";

interface JosephusSandboxProps {
  onCopyHistory?: (summary: string) => void;
  /** Larger text/buttons/circle for projecting to a whole classroom. */
  presentationMode?: boolean;
}

export function JosephusSandbox({ onCopyHistory, presentationMode = false }: JosephusSandboxProps) {
  const [instance, setInstance] = useState(() => josephusProblem.generate());
  const [currentCount, setCurrentCount] = useState(1);

  const input = instance.input as JosephusInput;
  const state = instance.state as JosephusState;
  const n = input.n;
  const k = input.k;
  const alive = state.alive ?? [];
  const removedOrder = state.removedOrder ?? [];
  const nextUp = state.nextUp ?? null;

  function handleNewProblem() {
    const next = josephusProblem.generate();
    setInstance(next);
    setCurrentCount(1);
  }

  function handleReset() {
    setInstance((prev) => ({
      ...prev,
      state: {
        alive: Array.from({ length: n }, (_, i) => i + 1),
        removedOrder: [],
        nextUp: 1,
      },
    }));
    setCurrentCount(1);
  }

  function handleRemove(person: number) {
    if (!alive.includes(person) || alive.length <= 1) return;
    try {
      const outcome = josephusProblem.applyAction(state, input, "remove", { person });
      setInstance((prev) => ({ ...prev, state: outcome.state as JosephusState }));
      setCurrentCount(1);
    } catch {
      // ignore
    }
  }

  function handleStepCount() {
    if (alive.length <= 1) return;
    setCurrentCount((prev) => (prev >= k ? 1 : prev + 1));
  }

  function handleExportSummary() {
    if (!onCopyHistory) return;
    const lines = [
      `1. 1번부터 ${n}번까지의 사람을 원형으로 세운다.`,
      `2. 1번 사람부터 시작하여 시계 방향으로 ${k}번째 사람을 찾는다.`,
      `3. 찾은 사람을 제거하고, 그 다음 사람부터 다시 1번째로 세기를 시작한다.`,
      `4. 생존자가 1명 남을 때까지 2~3을 반복한다.`,
      `5. 최종 남은 1명의 번호 [${alive[0] ?? instance.correctAnswer}]을(를) 답으로 출력한다.`,
    ];
    onCopyHistory(lines.join("\n"));
  }

  const radius = presentationMode ? 130 : 100;
  const centerX = presentationMode ? 155 : 125;
  const centerY = presentationMode ? 155 : 125;
  const nodeSize = presentationMode ? 56 : 36; // px, matches size.node below

  const positions = Array.from({ length: n }, (_, i) => {
    const person = i + 1;
    const angle = ((2 * Math.PI) / n) * i - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    return { person, x, y };
  });

  const removedMap = new Map(removedOrder.map((person, idx) => [person, idx + 1]));
  const isFinished = alive.length === 1;

  // Classroom-projector sizing: swaps in noticeably larger text/buttons
  // without touching the compact layout the student write-page uses.
  const size = presentationMode
    ? {
        statText: "text-base",
        controlBtn: "px-4 py-2 text-sm",
        ringBox: "h-80 w-80",
        viewBox: "0 0 310 310",
        sectionLabel: "text-sm",
        nextHint: "text-sm",
        centerBadgeLabel: "text-xs",
        centerBadgeCount: "text-3xl",
        centerBadgeResult: "px-2.5 py-1 text-xs",
        node: "h-14 w-14 text-lg",
        nodeOrderTag: "text-[10px]",
        counterLabel: "text-sm",
        counterCount: "px-3 py-1 text-sm",
        counterBtn: "px-4 py-2 text-sm",
        counterHint: "text-sm",
        bannerText: "p-4 text-sm",
        bannerSub: "text-sm",
        exportLink: "text-sm",
      }
    : {
        statText: "text-xs",
        controlBtn: "px-2.5 py-1 text-xs",
        ringBox: "h-64 w-64",
        viewBox: "0 0 250 250",
        sectionLabel: "text-xs",
        nextHint: "text-xs",
        centerBadgeLabel: "text-[10px]",
        centerBadgeCount: "text-xl",
        centerBadgeResult: "px-1.5 py-0.2 text-[9px]",
        node: "h-9 w-9 text-xs",
        nodeOrderTag: "text-[7px]",
        counterLabel: "text-xs",
        counterCount: "px-2 py-0.5 text-xs",
        counterBtn: "px-2.5 py-1 text-xs",
        counterHint: "text-[11px]",
        bannerText: "p-3 text-xs",
        bannerSub: "text-[11px]",
        exportLink: "text-xs",
      };
  // The sandbox never enforces the k-th-count rule while removing people
  // (matching the real execute page, where the human does the counting) —
  // so reaching 1 survivor does NOT guarantee they followed the rule
  // correctly. Compare against the actual answer before claiming a match.
  const isCorrectResult = isFinished && alive[0] === instance.correctAnswer;
  const displayNextUp = nextUp ?? 1;

  return (
    <div className="space-y-4">
      {/* Sandbox Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
            직접 풀이 샌드박스
          </span>
          <span className={`${size.statText} text-slate-500`}>
            총 <strong>{n}명</strong> 중 매 <strong>{k}번째</strong> 사람 제거
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
            className={`rounded-lg bg-indigo-600 ${size.controlBtn} font-bold text-white hover:bg-indigo-700 transition cursor-pointer shadow-2xs`}
          >
            🎲 새 문제 생성
          </button>
        </div>
      </div>

      {/* Circular Simulation View */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className={`${size.sectionLabel} font-bold text-slate-700`}>
            ⭕ 원형 순환 시뮬레이터 (남은 생존자: {alive.length}명)
          </span>
          {!isFinished && (
            <span className={`${size.nextHint} font-semibold text-indigo-700`}>
              👉 {displayNextUp}번부터 {k}번째 사람 카운트
            </span>
          )}
        </div>

        <div className={`relative mx-auto flex ${size.ringBox} items-center justify-center my-2`}>
          {/* Circular Track Ring */}
          <svg className="absolute inset-0 h-full w-full" viewBox={size.viewBox}>
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          </svg>

          {/* Center Info Badge */}
          <div className="z-0 flex flex-col items-center justify-center rounded-full bg-slate-50 p-3 text-center border border-slate-200 shadow-2xs">
            <span className={`${size.centerBadgeLabel} text-slate-500 font-medium`}>생존자</span>
            <span className={`${size.centerBadgeCount} font-black text-indigo-600`}>{alive.length}명</span>
            {isFinished && (
              <span
                className={`mt-0.5 rounded-full ${size.centerBadgeResult} font-bold ${
                  isCorrectResult ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                }`}
              >
                {isCorrectResult ? "🏆" : "⚠️"} 최종 생존: {alive[0]}번
              </span>
            )}
          </div>

          {/* Node for each person */}
          {positions.map(({ person, x, y }) => {
            const isAlive = alive.includes(person);
            const isNext = displayNextUp === person && isAlive;
            const order = removedMap.get(person);

            return (
              <button
                key={person}
                type="button"
                onClick={() => handleRemove(person)}
                disabled={!isAlive || isFinished}
                style={{
                  left: `${x - nodeSize / 2}px`,
                  top: `${y - nodeSize / 2}px`,
                }}
                className={`absolute z-10 flex ${size.node} flex-col items-center justify-center rounded-full font-bold transition shadow-2xs cursor-pointer ${
                  !isAlive
                    ? "bg-slate-100 text-slate-400 border border-slate-300 line-through opacity-50 cursor-not-allowed"
                    : isNext
                    ? "bg-indigo-600 text-white ring-2 ring-indigo-300 scale-110 shadow-xs"
                    : "bg-white text-slate-800 border-2 border-indigo-500 hover:bg-indigo-50 hover:scale-105"
                }`}
                title={isAlive ? `${person}번 사람 (클릭 시 제거)` : `${person}번 (탈락 #${order})`}
              >
                <span>{person}</span>
                {!isAlive && order && (
                  <span
                    className={`absolute -bottom-1.5 -right-1 ${size.nodeOrderTag} bg-rose-500 text-white px-1 rounded-full not-line-through font-bold`}
                  >
                    #{order}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Counter Helper Tool */}
        {!isFinished && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2">
              <span className={`${size.counterLabel} text-slate-600 font-semibold`}>세기 도우미:</span>
              <span className={`rounded-md bg-indigo-50 ${size.counterCount} font-bold text-indigo-700`}>
                현재 카운트: {currentCount} / {k}
              </span>
              <button
                type="button"
                onClick={handleStepCount}
                className={`rounded-md border border-indigo-300 bg-white ${size.counterBtn} font-bold text-indigo-700 hover:bg-indigo-50 cursor-pointer`}
              >
                +1 카운트 세기
              </button>
            </div>

            <span className={`${size.counterHint} text-slate-400`}>
              {currentCount === k ? `👉 지금 대상자를 클릭해 제거하세요!` : `${k}번째가 될 때까지 세어보세요`}
            </span>
          </div>
        )}

        {/* Completion Banner */}
        {isFinished && (
          <div
            className={`mt-3 rounded-xl border ${size.bannerText} font-semibold ${
              isCorrectResult
                ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                : "border-rose-300 bg-rose-50 text-rose-950"
            }`}
          >
            <p className={`font-bold mb-1 ${isCorrectResult ? "text-emerald-800" : "text-rose-800"}`}>
              {isCorrectResult
                ? `🎉 시뮬레이션 완료! 최종 생존자: ${alive[0]}번 (정답과 일치)`
                : `❌ 최종 생존자는 ${alive[0]}번이지만 정답은 ${instance.correctAnswer}번입니다. k번째 사람을 세는 순서를 다시 확인해보세요.`}
            </p>
            <p className={`${size.bannerSub} text-slate-600`}>
              탈락 순서: [{removedOrder.join(" ➔ ")}]
            </p>

            {onCopyHistory && (
              <button
                type="button"
                onClick={handleExportSummary}
                className={`mt-2 ${size.exportLink} font-bold text-blue-600 hover:underline cursor-pointer block`}
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
