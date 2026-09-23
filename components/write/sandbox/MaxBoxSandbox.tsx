"use client";

import { useEffect, useRef, useState } from "react";
import { maxBoxProblem, type MaxBoxInput, type MaxBoxState } from "@/lib/problems/maxbox";
import type { GeneratedInstance } from "@/lib/problems/types";
import type { AlgorithmExecutionState } from "@/lib/jev/types";
import { applyProblemAction, playableCandidateActions, type ProblemAction } from "@/lib/jev/problemSchema";

interface MaxBoxSandboxProps {
  onCopyHistory?: (summary: string) => void;
  /** Larger text/buttons for projecting to a whole classroom. */
  presentationMode?: boolean;
  /** true when a parent (e.g. ProblemSandboxContainer) already renders the
   * outer card frame + title — omits the duplicate border/shadow/heading so
   * the two don't nest into a double card. */
  embedded?: boolean;
}

export function MaxBoxSandbox({ onCopyHistory, presentationMode = false, embedded = false }: MaxBoxSandboxProps) {
  // Generated lazily on mount (not in the useState initializer) — the
  // instance is random, and computing it during the initial render would run
  // once on the server and once again on the client, so the two would never
  // agree and React would flag a hydration mismatch.
  const [instance, setInstance] = useState<GeneratedInstance<MaxBoxInput> | null>(null);
  // Mirrors the box/peek state into the same AlgorithmExecutionState shape
  // the natural-language Jev executor uses, so "메모지에 기록하기" / "정답
  // 출력" here run through the exact same lib/jev/problemSchema.ts actions
  // that judge the student's written algorithm — one action definition,
  // not two parallel implementations that could drift apart.
  const [algState, setAlgState] = useState<AlgorithmExecutionState | null>(null);
  const [copied, setCopied] = useState(false);

  const boxRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const fresh = maxBoxProblem.generate();
    setInstance(fresh);
    setAlgState({
      numbers: (fresh.input as MaxBoxInput).counts,
      currentIndex: 0,
      currentValue: null,
      maxVal: null,
      output: null,
      isTerminated: false,
    });
  }, []);

  // Keep the robot in view as it moves, instead of showing every box at
  // once shrunk down or leaving the student to scroll manually — the box
  // row only ever shows ~5-6 boxes' width (see the container's max-width
  // below) and pans smoothly to follow currentIndex.
  useEffect(() => {
    if (!algState || algState.currentIndex < 0) return;
    boxRefs.current[algState.currentIndex]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [algState?.currentIndex]);

  if (!instance || !algState) {
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

  function freshAlgState(): AlgorithmExecutionState {
    return {
      numbers: input.counts,
      currentIndex: 0,
      currentValue: null,
      maxVal: null,
      output: null,
      isTerminated: false,
    };
  }

  function handleReset() {
    setCopied(false);
    setInstance((prev) => (prev ? { ...prev, state: { log: [] } } : prev));
    setAlgState(freshAlgState());
  }

  function handleNewGame() {
    setCopied(false);
    const fresh = maxBoxProblem.generate();
    setInstance(fresh);
    setAlgState({ ...freshAlgState(), numbers: (fresh.input as MaxBoxInput).counts });
  }

  const solved = algState.output !== null && algState.output === instance.correctAnswer;
  const candidates = playableCandidateActions(algState);
  const moveActions = candidates.filter((a) => a.category === "MOVE" && a.id !== "CHECK_SELECTED_BOX");
  const checkAction = candidates.find((a) => a.id === "CHECK_SELECTED_BOX");
  const otherActions = candidates.filter((a) => a.category !== "MOVE");
  const selectedPosition = algState.currentIndex >= 0 ? algState.currentIndex + 1 : null;

  // A checked box stays open as long as the robot is standing on it — no
  // auto-close timer. It's covered again the moment the robot moves off
  // (MOVE_LEFT/MOVE_RIGHT resets currentValue to null), like actually
  // walking away and the lid falling shut. Every check is logged, which is
  // what the "확인 횟수" stat below reflects.
  function handlePress(action: ProblemAction) {
    if (!algState) return;

    if (action.id === "CHECK_SELECTED_BOX") {
      const position = algState.currentIndex + 1;
      try {
        const outcome = maxBoxProblem.applyAction(state, input, "open", { position });
        setInstance((prev) => (prev ? { ...prev, state: outcome.state as MaxBoxState } : prev));
      } catch {
        // ignore — position is always in range here, this just guards the shape
      }
    }

    const { state: nextState } = applyProblemAction(action, algState);
    setAlgState(nextState);
  }

  function handleExportSummary() {
    if (!onCopyHistory) return;
    const lines = [
      `1. 상자 속 사과 개수: ${input.counts.join(", ")} (확인 횟수 ${clickCount}회, 최소 ${instance!.referenceActionCount}회) → 최댓값: ${instance!.correctAnswer}`,
      `2. 마지막까지 메모지에 남아있던 숫자: ${algState!.maxVal ?? "(없음)"}`,
      `3. (여기에 상자를 확인하며 가장 큰 값을 어떻게 계속 기억해뒀는지, 나만의 규칙을 정리해서 적어보세요)`,
    ];
    onCopyHistory(lines.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const size = presentationMode ? { box: "h-24 w-24 text-lg" } : { box: "h-20 w-20 text-base" };

  return (
    <div className={embedded ? "" : "rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"}>
      {/* Header — identity + progress stat + de-emphasized controls. When
          embedded, the parent wrapper already shows the problem title, so
          this row is just the click-count stat + reset/new-game controls. */}
      <div className={`flex items-center justify-between gap-2 px-4 py-2.5 ${embedded ? "" : "border-b border-slate-100"}`}>
        <div className="flex items-baseline gap-2 min-w-0">
          {!embedded && <span className="text-sm font-bold text-slate-900 shrink-0">상자 속 사과</span>}
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

      {/* Box row (hero) + memo, side by side — stacks on narrow screens. A
          single line, not a wrapping grid: MOVE_LEFT/MOVE_RIGHT only stay
          honest as words if "right" always means visually right, which a
          wrapping grid breaks at the row edges. The container caps at
          ~5-6 boxes' width regardless of how many boxes exist (8-12) —
          the effect above pans it to follow the robot instead. */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-5 px-4 py-5">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex overflow-x-auto scroll-smooth gap-3 rounded-xl bg-slate-50/60 p-4 max-w-full sm:max-w-[540px]">
            {Array.from({ length: n }, (_, idx) => {
              const position = idx + 1;
              const isSelected = selectedPosition === position;
              // Open exactly when the robot is standing here AND has
              // checked it — moving away resets currentValue to null,
              // which covers it again automatically.
              const isOpen = isSelected && algState.currentValue !== null;
              const everChecked = checkedPositions.has(position);
              const value = input.counts[idx];
              return (
                <div key={position} className="flex shrink-0 flex-col items-center gap-1">
                  <div className="h-5 text-base leading-none">{isSelected ? "🤖" : ""}</div>
                  <div
                    ref={(el) => {
                      boxRefs.current[idx] = el;
                    }}
                    aria-label={`${position}번째 상자`}
                    className={`relative flex ${size.box} items-center justify-center rounded-xl font-bold transition-all duration-150 ${
                      isOpen
                        ? "scale-110 bg-blue-50 ring-2 ring-blue-500 shadow-md"
                        : isSelected
                        ? "bg-blue-50/60 ring-2 ring-blue-400"
                        : everChecked
                        ? "bg-slate-50 ring-1 ring-blue-200"
                        : "bg-slate-100 ring-1 ring-slate-200"
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
                  </div>
                </div>
              );
            })}
          </div>

          {/* Movement + check — the robot's only way to interact with the
              row. No clicking a box directly. */}
          <div className="flex flex-wrap gap-1.5">
            {moveActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => handlePress(action)}
                disabled={solved}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {action.buttonLabel ?? action.description}
              </button>
            ))}
            {checkAction && (
              <button
                type="button"
                onClick={() => handlePress(checkAction)}
                disabled={solved}
                className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {checkAction.buttonLabel ?? checkAction.description}
              </button>
            )}
          </div>
        </div>

        {/* Memo — read-only display; the value only ever changes through the
            schema-driven buttons below, same actions Jev judges in the
            written algorithm. */}
        <div className="sm:w-[236px] shrink-0 sm:border-l sm:border-slate-100 sm:pl-5 space-y-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-xs font-medium text-slate-400">메모지</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                숫자 1개만
              </span>
            </div>
            <div className="rounded-md border border-dashed border-amber-400 bg-amber-50 py-2 text-center font-mono text-lg font-bold text-amber-900">
              {algState.maxVal ?? <span className="text-slate-300">-</span>}
            </div>
          </div>

          {/* Buttons: exactly the schema's playable actions (excluding
              movement/check, shown above) — WRITE_MEMO always overwrites;
              the student decides when to press it (no automatic compare). */}
          <div className="flex flex-col gap-1.5">
            {otherActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => handlePress(action)}
                disabled={solved}
                className="rounded-md border border-blue-300 bg-white py-2 text-xs font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {action.buttonLabel ?? action.description}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100" />

      {/* Final answer — submitting is itself a schema button (SUBMIT_ANSWER,
          rendered above once the memo has a value), not a free-text guess;
          this just shows the result once it's been submitted. */}
      <div className="px-4 py-3">
        {algState.output === null && (
          <p className="text-center text-sm text-slate-400">
            메모지에 기록한 뒤 위의 &lsquo;정답 제출&rsquo; 버튼을 눌러보세요.
          </p>
        )}

        {algState.output !== null && (
          <div className="text-center space-y-1">
            <p className={`text-sm font-semibold ${solved ? "text-emerald-700" : "text-amber-700"}`}>
              {solved
                ? `✅ 정답입니다 · 가장 많은 사과는 ${instance.correctAnswer}개였어요`
                : `❌ 오답입니다 · ${algState.output}개는 정답이 아니에요. 다시 확인해서 제출해보세요`}
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
