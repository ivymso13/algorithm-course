"use client";

import { useState } from "react";
import {
  woodcutProblem,
  totalWood,
  MAX_HEIGHT,
  type WoodcutInput,
  type WoodcutState,
} from "@/lib/problems/woodcut";

interface WoodcutSandboxProps {
  onCopyHistory?: (summary: string) => void;
  /** Larger text/buttons for projecting to a whole classroom. */
  presentationMode?: boolean;
}

const SCENE_PX = 220;
const BAR_PX = 40;
const MID_HEIGHT = Math.floor(MAX_HEIGHT / 2);

/** "+N 여유" / "-N 부족" instead of a plain 참/거짓 label — a quantity a
 * student can reason with, without the phrasing itself naming a decision
 * procedure (feasible/infeasible). */
function diffLabel(collected: number, target: number): string {
  const diff = collected - target;
  return diff >= 0 ? `+${diff} 여유` : `${diff} 부족`;
}

export function WoodcutSandbox({ onCopyHistory, presentationMode = false }: WoodcutSandboxProps) {
  const [instance, setInstance] = useState(() => woodcutProblem.generate());
  const [queryHeight, setQueryHeight] = useState(MID_HEIGHT);
  const [guessHeight, setGuessHeight] = useState<string>("");
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);
  const [justCut, setJustCut] = useState(false);
  const [copied, setCopied] = useState(false);

  const input = instance.input as WoodcutInput;
  const state = instance.state as WoodcutState;
  const n = input.n;
  const target = input.target;
  const history = state.history ?? [];
  const queryCount = state.queryCount ?? 0;
  const latest = history[history.length - 1] ?? null;
  const linePct = (queryHeight / MAX_HEIGHT) * 100;
  const answerPct = feedback ? (instance.correctAnswer / MAX_HEIGHT) * 100 : null;
  const solved = feedback?.isCorrect === true;

  // Live preview of what the current slider position would collect — heights
  // are already fully visible, so this doesn't leak anything a student
  // couldn't already work out by eye; only the confirmed "자르기" result
  // counts as a query action.
  const previewCollected = totalWood(input.heights, queryHeight);

  function handleNewProblem() {
    const next = woodcutProblem.generate();
    setInstance(next);
    setQueryHeight(MID_HEIGHT);
    setGuessHeight("");
    setFeedback(null);
  }

  function handleReset() {
    setInstance((prev) => (prev ? { ...prev, state: { history: [], queryCount: 0 } } : prev));
    setGuessHeight("");
    setFeedback(null);
  }

  function handleCut() {
    try {
      const outcome = woodcutProblem.applyAction(state, input, "cut", { height: queryHeight });
      setInstance((prev) => (prev ? { ...prev, state: outcome.state as WoodcutState } : prev));
      setJustCut(true);
      window.setTimeout(() => setJustCut(false), 400);
    } catch {
      // ignore — the slider is already clamped to a valid range
    }
  }

  function handleCheckAnswer() {
    const h = Number(guessHeight.trim());
    if (!Number.isFinite(h)) return;
    const isCorrect = h === instance.correctAnswer;

    if (isCorrect) {
      setFeedback({ isCorrect: true, message: "" });
    } else {
      setFeedback({
        isCorrect: false,
        message: `❌ 아쉽습니다. 실제 정답 절단 높이는 ${instance.correctAnswer}입니다 (그 높이에서 목재량 ${target} 확보, ${instance.correctAnswer + 1}에서는 목표 미달). 보라 실선이 정답 위치예요.`,
      });
    }
  }

  function handleExportSummary() {
    if (!onCopyHistory) return;
    // A plain action log — no lo/hi bookkeeping or "next try" logic baked
    // in, since that would hand the student a ready-made algorithm instead
    // of letting them write down their own.
    const lines = [
      ...history.map((h, i) => `${i + 1}. 높이 ${h.height}로 잘라본다 → 목재 ${h.collected}개 (${diffLabel(h.collected, target)})`),
      `${history.length + 1}. (여기에 자신만의 판단 기준과 종료 조건을 정리해서 적어보세요)`,
    ];
    onCopyHistory(lines.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const size = presentationMode
    ? {
        statText: "text-base",
        controlBtn: "px-4 py-2 text-sm",
        targetLabel: "text-sm",
        targetNumber: "text-4xl",
        hint: "text-sm",
        sliderLabel: "text-sm",
        heightNumber: "text-3xl",
        cutBtn: "px-5 py-2.5 text-sm",
        historyRow: "text-sm px-3 py-2",
        guessLabel: "text-sm",
        guessInput: "w-40 px-4 py-2.5 text-base",
        checkBtn: "px-5 py-2.5 text-sm",
        feedback: "p-4 text-sm",
        exportLink: "text-sm",
      }
    : {
        statText: "text-xs",
        controlBtn: "px-2.5 py-1 text-xs",
        targetLabel: "text-xs",
        targetNumber: "text-2xl",
        hint: "text-xs",
        sliderLabel: "text-xs",
        heightNumber: "text-xl",
        cutBtn: "px-3 py-1.5 text-xs",
        historyRow: "text-xs px-2.5 py-1.5",
        guessLabel: "text-xs",
        guessInput: "w-32 px-3 py-1.5 text-xs",
        checkBtn: "px-3 py-1.5 text-xs",
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
            시도 횟수: <strong className="text-blue-700">{queryCount}회</strong>
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

      {/* Rule explainer — what "자르기" actually does */}
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 space-y-2">
        <span className="flex items-center gap-1.5 text-sm sm:text-base font-black text-amber-900">📏 문제 상황</span>
        <ul className="space-y-1 text-sm sm:text-base leading-relaxed text-amber-950">
          <li>
            나무 <strong>{n}그루</strong>를 <strong className="underline decoration-amber-500">전부 동시에</strong> 같은
            높이 H로 자릅니다.
          </li>
          <li>
            나무 높이가 H보다 <strong className="text-emerald-700">높으면</strong> → 초과분(높이 − H)이 목재로
            쌓입니다.
          </li>
          <li>
            나무 높이가 H <strong className="text-rose-700">이하</strong>면 → 그 나무에서는 목재가 나오지 않습니다.
          </li>
          <li>
            모든 나무의 목재를 합한 값이 <strong>&quot;총 목재량&quot;</strong>입니다.
          </li>
        </ul>
        <p className="border-t border-amber-200 pt-2 text-sm sm:text-base font-bold text-amber-900">
          🎯 목표: 총 목재량이 목표치 이상이 되는 <strong>가장 높은 H</strong>를 찾으세요.
        </p>
      </div>

      {/* Target Goal Banner */}
      <div className="rounded-xl border border-blue-200 bg-linear-to-r from-blue-50 to-indigo-50 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎯</span>
          <div>
            <span className={`${size.targetLabel} text-blue-900 font-semibold block`}>확보해야 할 목표 목재량:</span>
            <span className={`${size.targetNumber} font-black text-blue-700`}>{target}</span>
          </div>
        </div>

        <div className={`text-right ${size.hint} text-slate-600`}>
          <span>
            나무 <strong>{n}그루</strong> (절단 높이 후보는 0~{MAX_HEIGHT}까지 {MAX_HEIGHT + 1}가지)
          </span>
          <span className="block text-[11px] font-mono text-slate-500">
            지금 절단선({queryHeight}) 기준 예상 목재량 {previewCollected} ({diffLabel(previewCollected, target)})
          </span>
        </div>
      </div>

      {/* Forest scene */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {/* Forest with a live cutting line, drawn to each tree's real height */}
        <div>
          {/* a single corner label instead of "100 ... 0" laid out
              left-to-right — that read as if the trees themselves were
              sorted descending, when height is really the vertical axis */}
          <div className="text-right text-[10px] text-slate-400 font-mono mb-0.5">높이 기준: 0 ~ {MAX_HEIGHT}</div>
          <div className="overflow-x-auto">
            <div style={{ minWidth: n * (BAR_PX + 10) }}>
              {/* SCENE box: only the trees + the two guide lines live here, so
                  every "bottom: X%" below is measured against this exact box's
                  own bottom edge — nothing else (like the height labels) may
                  share this flex row, or `items-end` would align to ITS bottom
                  instead and throw the lines off by that much. */}
              <div
                className="relative rounded-lg bg-linear-to-b from-sky-50 to-emerald-50 border border-slate-100 overflow-hidden"
                style={{ height: SCENE_PX }}
              >
                <div className="h-full flex items-end justify-center gap-2.5 px-3">
                  {input.heights.map((h, i) => {
                    // Same 0..MAX_HEIGHT -> 0..SCENE_PX scale as the cutting-line
                    // and answer-line `bottom: X%` below — otherwise the lines
                    // wouldn't actually pass through the matching point on each tree.
                    const trunkPx = Math.max(8, Math.round((h / MAX_HEIGHT) * SCENE_PX));
                    const cutPx = Math.round((queryHeight / MAX_HEIGHT) * SCENE_PX);
                    const woodPx = Math.max(0, Math.min(trunkPx, trunkPx - cutPx));
                    const trunkW = BAR_PX - 8;
                    // The +N badge only appears when the slider is sitting
                    // exactly on the height that was actually cut — move the
                    // slider afterward and it disappears immediately, so a
                    // per-tree amount is never shown before (or after
                    // second-guessing) an actual "자르기" action.
                    const isJustCutHeight = latest !== null && latest.height === queryHeight;
                    const individualWood = Math.max(0, h - queryHeight);
                    return (
                      <div key={i} className="relative flex flex-col items-center shrink-0" style={{ width: BAR_PX }}>
                        {isJustCutHeight && individualWood > 0 && (
                          <span className="absolute -top-6 rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-mono font-black text-white shadow-xs z-20">
                            +{individualWood}
                          </span>
                        )}
                        {/* Uniform-width trunk — a triangle's cut-off sliver at
                            the pointed top made large harvests look small; a
                            constant-width bar keeps the amber area honestly
                            proportional to the amount actually collected. */}
                        <svg width={trunkW} height={trunkPx} style={{ overflow: "visible" }} aria-hidden="true">
                          <rect x={0} y={0} width={trunkW} height={trunkPx} rx={6} className="fill-emerald-800" />
                          <line x1={trunkW * 0.3} y1={4} x2={trunkW * 0.3} y2={trunkPx - 2} stroke="#064e3b" strokeWidth={1.5} opacity={0.4} />
                          <line x1={trunkW * 0.7} y1={8} x2={trunkW * 0.7} y2={trunkPx - 4} stroke="#064e3b" strokeWidth={1.5} opacity={0.4} />
                          {woodPx > 0 && (
                            <g>
                              <rect x={0} y={0} width={trunkW} height={woodPx} rx={6} className={justCut ? "fill-amber-300" : "fill-amber-400"} />
                              {/* square off the rounded bottom corners of the wood
                                  block where it meets the trunk, so the cut line
                                  reads as a clean edge instead of a notch */}
                              <rect x={0} y={Math.max(0, woodPx - 6)} width={trunkW} height={6} className={justCut ? "fill-amber-300" : "fill-amber-400"} />
                              <line x1={trunkW * 0.3} y1={4} x2={trunkW * 0.3} y2={Math.max(4, woodPx - 2)} stroke="#b45309" strokeWidth={1.5} opacity={0.3} />
                              <line x1={trunkW * 0.7} y1={6} x2={trunkW * 0.7} y2={Math.max(6, woodPx - 2)} stroke="#b45309" strokeWidth={1.5} opacity={0.3} />
                            </g>
                          )}
                        </svg>
                      </div>
                    );
                  })}
                </div>

                {/* live cutting line, follows the slider — blue (not red/green) so it
                    stays distinguishable from the answer line for red-green color-blind viewers */}
                <div
                  className={`absolute inset-x-0 border-t-2 border-dashed transition-[bottom] duration-150 z-10 ${
                    justCut ? "border-amber-500" : "border-blue-600"
                  }`}
                  style={{ bottom: `${linePct}%` }}
                >
                  <span className="absolute -top-4 right-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    🪚 {queryHeight}
                  </span>
                </div>

                {/* correct-answer line, shown once the final answer has been checked */}
                {answerPct !== null && (
                  <div
                    className="absolute inset-x-0 border-t-[3px] border-solid border-purple-600 z-10"
                    style={{ bottom: `${answerPct}%` }}
                  >
                    <span className="absolute -top-4 left-1 rounded bg-purple-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      🏁 정답 {instance.correctAnswer}
                    </span>
                  </div>
                )}
              </div>

              {/* height labels — a separate row below the scene box (same gap/padding
                  so columns still line up), kept out of the scene so it can't shift
                  the trees' ground baseline away from where the guide lines sit */}
              <div className="flex justify-center gap-2.5 px-3 mt-1">
                {input.heights.map((h, i) => (
                  <span key={i} className="text-[11px] font-bold text-emerald-900 font-mono text-center" style={{ width: BAR_PX }}>
                    {h}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            🟧 주황색 = 절단선 위로 잘린 목재 &nbsp;·&nbsp; <span className="text-blue-600 font-bold">┄</span> 파란 점선 = 지금 고른 절단
            높이 &nbsp;·&nbsp; <span className="text-purple-600 font-bold">—</span> 보라 실선 = 정답 (숫자 = 나무 높이)
          </p>
        </div>
      </div>

      {/* Lab layout: control station (left) + attempt log (right) on wide
          screens, stacked on narrow ones */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Control station */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className={`${size.sliderLabel} font-bold text-slate-600`}>🪚 현재 설정된 절단 높이</span>
            <span className={`${size.heightNumber} font-mono font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200`}>
              H = {queryHeight}
            </span>
          </div>

          {/* coarse control — dragging anywhere on the slider */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>0</span>
              <span>절단 높이 선택 (0~{MAX_HEIGHT})</span>
              <span>{MAX_HEIGHT}</span>
            </div>
            <input
              type="range"
              min={0}
              max={MAX_HEIGHT}
              value={queryHeight}
              onChange={(e) => setQueryHeight(Number(e.target.value))}
              aria-label="절단 높이"
              aria-valuenow={queryHeight}
              aria-valuemin={0}
              aria-valuemax={MAX_HEIGHT}
              className="w-full py-1 accent-blue-600 cursor-pointer"
            />
          </div>

          {/* bottom action bar — a compact ‹ / › 1-step nudger right next to
              the number, immediately followed by the one action that
              actually executes a try, so "fine-tune" visually leads straight
              into "run it" instead of leaving the button stranded below */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-inner w-full sm:w-auto">
              <button
                type="button"
                aria-label="절단 높이 1 감소"
                disabled={queryHeight <= 0}
                onClick={() => setQueryHeight((v) => Math.max(0, v - 1))}
                className="min-h-[42px] min-w-[42px] rounded-lg border border-slate-200/80 bg-white text-base font-black text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95 active:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                ‹
              </button>
              <input
                type="number"
                aria-label="절단 높이 직접 입력"
                min={0}
                max={MAX_HEIGHT}
                value={queryHeight}
                onChange={(e) => {
                  const v = Math.min(MAX_HEIGHT, Math.max(0, Number(e.target.value) || 0));
                  setQueryHeight(v);
                }}
                className="min-h-[42px] flex-1 sm:w-16 sm:flex-none rounded-lg border border-slate-300 bg-white text-center font-mono text-base font-black text-slate-900 shadow-inner cursor-text hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden transition [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                aria-label="절단 높이 1 증가"
                disabled={queryHeight >= MAX_HEIGHT}
                onClick={() => setQueryHeight((v) => Math.min(MAX_HEIGHT, v + 1))}
                className="min-h-[42px] min-w-[42px] rounded-lg border border-slate-200/80 bg-white text-base font-black text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95 active:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                ›
              </button>
            </div>
            <button
              type="button"
              onClick={handleCut}
              className="w-full sm:w-auto min-h-[48px] rounded-xl bg-amber-500 px-8 text-sm font-bold text-white shadow-xs transition hover:bg-amber-600 active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              <span className="text-sm">🪚</span>
              <span>자르기</span>
            </button>
          </div>

          {latest && (
            <div
              role="status"
              aria-live="polite"
              className={`flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 font-mono ${size.historyRow} font-bold ${
                latest.collected >= target
                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                  : "bg-rose-50 text-rose-900 border-rose-200"
              }`}
            >
              <span>{latest.collected >= target ? "🟢" : "🟠"}</span>
              <span>
                방금 결과: 목재 {latest.collected}개 ({diffLabel(latest.collected, target)})
              </span>
            </div>
          )}
        </div>

        {/* Attempt log — always visible (not gated on history.length), so
            reaching for it never shifts the control station beside it */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <span className={`${size.sliderLabel} font-bold text-slate-700 block mb-2`}>📜 시도 기록</span>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">아직 시도한 기록이 없어요. 절단 높이를 골라 잘라보세요.</p>
          ) : (
            <div className="max-h-64 lg:max-h-none overflow-y-auto space-y-1.5">
              {history.map((h, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-lg ${size.historyRow} font-mono ${
                    h.collected >= target
                      ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                      : "bg-rose-50 text-rose-900 border border-rose-200"
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/80 text-[10px] font-bold">
                    {i + 1}
                  </span>
                  <span className="shrink-0">높이 {h.height}</span>
                  <span className="flex-1 text-right font-bold">
                    목재 {h.collected}개 ({diffLabel(h.collected, target)})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Final Answer */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
        {!solved && (
          <>
            <span className={`${size.guessLabel} font-bold text-slate-800 block`}>
              🏁 목표 목재량을 채우는 최대 절단 높이 입력 (0~{MAX_HEIGHT}):
            </span>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="number"
                aria-label="최종 절단 높이"
                className={`min-h-[42px] rounded-lg border border-slate-300 bg-white ${size.guessInput} font-bold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden`}
                placeholder={`0~${MAX_HEIGHT}`}
                value={guessHeight}
                onChange={(e) => setGuessHeight(e.target.value)}
              />

              <button
                type="button"
                onClick={handleCheckAnswer}
                disabled={!guessHeight.trim()}
                className={`w-full sm:w-auto min-h-[46px] rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 px-6 ${size.checkBtn} font-black text-white shadow-md shadow-emerald-600/20 transition-all hover:from-emerald-700 hover:to-teal-700 hover:shadow-lg active:scale-98 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2 shrink-0`}
              >
                <span>🏁</span>
                <span>정답 확인</span>
              </button>
            </div>
          </>
        )}

        {feedback && !solved && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-lg ${size.feedback} font-semibold bg-rose-100 text-rose-900 border border-rose-300`}
          >
            {feedback.message}
          </div>
        )}

        {solved && (
          <div role="status" aria-live="polite" className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 space-y-3">
            <p className="text-base sm:text-lg font-black text-emerald-900">
              🎉 정답을 찾았습니다! (정답 절단 높이: {instance.correctAnswer})
            </p>
            <p className="text-sm font-bold text-emerald-800">📊 총 시도 횟수: {queryCount}회</p>
            <div className="rounded-lg bg-white/70 border border-emerald-200 p-3 space-y-1.5">
              <p className="text-sm font-bold text-emerald-900">💭 생각해보기</p>
              <ul className="text-sm text-emerald-800 space-y-1 list-disc list-inside">
                <li>어떤 순서로 높이를 시도하셨나요? 나만의 규칙이 있었나요?</li>
                <li>이후 더 적은 횟수로 해결할 수 있을까요? 나무가 훨씬 많아진다면 어떤 전략을 쓸 건가요?</li>
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleNewProblem}
                className="min-h-[46px] flex-1 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-blue-500/20 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🎲</span>
                <span>새로운 숲에서 다시 도전하기</span>
              </button>
              {onCopyHistory && (
                <button
                  type="button"
                  onClick={handleExportSummary}
                  className="min-h-[46px] flex-1 rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-sm font-bold text-blue-700 shadow-2xs transition-all hover:bg-blue-50/80 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{copied ? "✔" : "📋"}</span>
                  <span>{copied ? "에디터에 추가했어요!" : "내 시도 기록 에디터에 추가하기"}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
