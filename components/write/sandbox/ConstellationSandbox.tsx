"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  constellationProblem,
  computeMst,
  totalEdgeWeight,
  starDistance,
  COORD_MAX,
  type ConstellationInput,
  type ConstellationState,
  type ConstellationEdge,
  type ConstellationAttempt,
  type ConstellationPoint,
} from "@/lib/problems/constellation";
import type { GeneratedInstance } from "@/lib/problems/types";

interface ConstellationSandboxProps {
  onCopyHistory?: (summary: string) => void;
  /** Larger text/buttons for projecting to a whole classroom. */
  presentationMode?: boolean;
}

const GRID_STEP = 10;

// One meaning per color, everywhere on the map:
//   slate = default (unselected) star
//   blue  = "currently selected" (a star, or the pending pair's preview line)
//   amber = a connection the student has completed
//   purple = the optimal connection, revealed only after the answer is checked
//   red    = a connection attempt that was just rejected (flashes, then clears)
const COLOR = {
  starDefaultFill: "#e2e8f0",
  starDefaultStroke: "#94a3b8",
  starSelectedFill: "#2563eb",
  starSelectedStroke: "#ffffff",
  connectedLine: "#f59e0b",
  previewLine: "#3b82f6",
  answerLine: "#a855f7",
  rejectedLine: "#ef4444",
};

function isDirectlyConnected(edges: ConstellationEdge[], a: number, b: number): boolean {
  return edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
}

type SkipNote = {
  stepIndex: number;
  chosen: ConstellationEdge;
  shorterAvailable: ConstellationEdge;
};

type KruskalAnalysis = {
  userOrder: ConstellationAttempt[];
  kruskalOrder: ConstellationEdge[];
  rejected: ConstellationAttempt[];
  skips: SkipNote[];
  userTotal: number;
  optimalTotal: number;
};

/**
 * Pure, display-only analysis of how the student's own connection order
 * compares to Kruskal's — has no bearing on scoring (that lives entirely in
 * lib/problems/constellation.ts, via correctAnswer / applyAction). At each of
 * the student's successful connections, this re-derives "the cheapest edge
 * that was still available at that moment" (any edge between two
 * not-yet-joined components) and flags it when the student picked something
 * more expensive instead.
 */
function analyzeUserSelection(points: ConstellationPoint[], attempts: ConstellationAttempt[]): KruskalAnalysis {
  const mst = computeMst(points);
  const userOrder = attempts.filter((a) => a.accepted);
  const rejected = attempts.filter((a) => !a.accepted);

  const allEdges: ConstellationEdge[] = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      allEdges.push({ a: points[i].id, b: points[j].id, dist: starDistance(points[i], points[j]) });
    }
  }
  allEdges.sort((e1, e2) => e1.dist - e2.dist);

  const parent = new Map(points.map((p) => [p.id, p.id]));
  function find(x: number): number {
    let cur = x;
    while (parent.get(cur) !== cur) {
      const gp = parent.get(parent.get(cur)!)!;
      parent.set(cur, gp);
      cur = gp;
    }
    return cur;
  }

  const skips: SkipNote[] = [];
  userOrder.forEach((chosen, idx) => {
    const cheapestAvailable = allEdges.find((e) => find(e.a) !== find(e.b));
    if (cheapestAvailable && cheapestAvailable.dist < chosen.dist) {
      skips.push({ stepIndex: idx + 1, chosen, shorterAvailable: cheapestAvailable });
    }
    const ra = find(chosen.a);
    const rb = find(chosen.b);
    if (ra !== rb) parent.set(ra, rb);
  });

  return {
    userOrder,
    kruskalOrder: mst.edges,
    rejected,
    skips,
    userTotal: totalEdgeWeight(userOrder),
    optimalTotal: mst.weight,
  };
}

export function ConstellationSandbox({ onCopyHistory, presentationMode = false }: ConstellationSandboxProps) {
  // Generated lazily on mount (not in the useState initializer) — the
  // instance is random, and computing it during the initial render would run
  // once on the server and once again on the client, so the two would never
  // agree and React would flag a hydration mismatch.
  const [instance, setInstance] = useState<GeneratedInstance<ConstellationInput> | null>(null);
  const [selectedFirst, setSelectedFirst] = useState<number | null>(null);
  const [selectedSecond, setSelectedSecond] = useState<number | null>(null);
  const [hoveredStarId, setHoveredStarId] = useState<number | null>(null);
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null);
  const [lastAccepted, setLastAccepted] = useState<{ a: number; b: number; dist: number } | null>(null);
  const [rejectedFlash, setRejectedFlash] = useState<{ a: number; b: number } | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [totalPulse, setTotalPulse] = useState(false);
  const [guessTotal, setGuessTotal] = useState("");
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);
  const [showAnswerOverlay, setShowAnswerOverlay] = useState(false);
  const [copied, setCopied] = useState(false);

  const toastTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const connectingTimerRef = useRef<number | null>(null);
  const pulseTimerRef = useRef<number | null>(null);

  function clearTimer(ref: MutableRefObject<number | null>) {
    if (ref.current !== null) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  }

  useEffect(() => {
    setInstance(constellationProblem.generate());
    return () => {
      clearTimer(toastTimerRef);
      clearTimer(flashTimerRef);
      clearTimer(connectingTimerRef);
      clearTimer(pulseTimerRef);
    };
  }, []);

  if (!instance) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-slate-400">
        ✨ 밤하늘을 준비하는 중...
      </div>
    );
  }

  const input = instance.input as ConstellationInput;
  const state = instance.state as ConstellationState;
  const n = input.n;
  const points = input.points;
  const edges = state.edges ?? [];
  const attempts = state.attempts ?? [];
  const attemptCount = state.attemptCount ?? 0;
  const currentTotal = totalEdgeWeight(edges);
  const spanningTreeDone = edges.length === n - 1;
  const solved = feedback?.isCorrect === true;
  const answerEdges = showAnswerOverlay ? computeMst(points).edges : [];
  const gridTicks = Array.from({ length: COORD_MAX / GRID_STEP + 1 }, (_, i) => i * GRID_STEP);
  const analysis = showAnswerOverlay ? analyzeUserSelection(points, attempts) : null;

  const pointById = new Map(points.map((p) => [p.id, p]));
  const bothSelected = selectedFirst !== null && selectedSecond !== null;
  const previewDist =
    bothSelected && pointById.get(selectedFirst!) && pointById.get(selectedSecond!)
      ? starDistance(pointById.get(selectedFirst!)!, pointById.get(selectedSecond!)!)
      : null;
  const canConnect = bothSelected && !isDirectlyConnected(edges, selectedFirst!, selectedSecond!);
  const selectionStage: "none" | "first" | "both" =
    selectedFirst === null ? "none" : selectedSecond === null ? "first" : "both";

  function resetTransientUi() {
    clearTimer(toastTimerRef);
    clearTimer(flashTimerRef);
    clearTimer(connectingTimerRef);
    clearTimer(pulseTimerRef);
    setSelectedFirst(null);
    setSelectedSecond(null);
    setHoveredStarId(null);
    setHoveredEdgeKey(null);
    setLastAccepted(null);
    setRejectedFlash(null);
    setToast(null);
    setIsConnecting(false);
    setTotalPulse(false);
    setGuessTotal("");
    setFeedback(null);
    setShowAnswerOverlay(false);
  }

  function handleNewProblem() {
    const next = constellationProblem.generate();
    resetTransientUi();
    setInstance(next);
  }

  function handleReset() {
    resetTransientUi();
    setInstance((prev) => (prev ? { ...prev, state: { edges: [], attempts: [], attemptCount: 0 } } : prev));
  }

  function handleStarClick(id: number) {
    if (solved) return;
    if (selectedFirst === null) {
      setSelectedFirst(id);
      setSelectedSecond(null);
      return;
    }
    if (selectedSecond === null) {
      if (id === selectedFirst) {
        setSelectedFirst(null);
      } else {
        setSelectedSecond(id);
      }
      return;
    }
    // Both already chosen — clicking any star restarts the selection.
    if (id === selectedFirst || id === selectedSecond) {
      setSelectedFirst(null);
    } else {
      setSelectedFirst(id);
    }
    setSelectedSecond(null);
  }

  function handleConnect() {
    if (selectedFirst === null || selectedSecond === null || isConnecting) return;
    const a = selectedFirst;
    const b = selectedSecond;

    setIsConnecting(true);
    clearTimer(connectingTimerRef);
    connectingTimerRef.current = window.setTimeout(() => setIsConnecting(false), 220);

    try {
      const outcome = constellationProblem.applyAction(state, input, "connect", { a, b });
      const result = outcome.result as { a: number; b: number; dist: number; accepted: boolean };
      setInstance((prev) => (prev ? { ...prev, state: outcome.state as ConstellationState } : prev));

      clearTimer(toastTimerRef);
      if (result.accepted) {
        setLastAccepted({ a: result.a, b: result.b, dist: result.dist });
        setToast({ kind: "success", message: `연결 완료: 별 ${result.a} ↔ 별 ${result.b} · 거리 ${result.dist}` });
        setTotalPulse(true);
        clearTimer(pulseTimerRef);
        pulseTimerRef.current = window.setTimeout(() => setTotalPulse(false), 400);
        toastTimerRef.current = window.setTimeout(() => setToast(null), 2400);
      } else {
        setRejectedFlash({ a: result.a, b: result.b });
        clearTimer(flashTimerRef);
        flashTimerRef.current = window.setTimeout(() => setRejectedFlash(null), 700);
        setToast({
          kind: "error",
          message: "이미 같은 연결 요소에 포함된 별입니다. 사이클이 생기므로 연결할 수 없습니다.",
        });
        toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
      }
    } catch {
      // ignore — the button is disabled once a pair is already directly connected
    }
    setSelectedFirst(null);
    setSelectedSecond(null);
  }

  function handleCheckAnswer() {
    if (!spanningTreeDone) return;
    const val = Number(guessTotal.trim());
    if (!Number.isFinite(val)) return;
    const isCorrect = val === instance.correctAnswer;
    setShowAnswerOverlay(true);

    if (isCorrect) {
      setFeedback({ isCorrect: true, message: "" });
    } else {
      setFeedback({
        isCorrect: false,
        message: `아쉽습니다. 모든 별을 연결하는 실제 최소 총 길이는 ${instance.correctAnswer}입니다. 보라색 선이 정답 연결이에요.`,
      });
    }
  }

  function handleExportSummary() {
    if (!onCopyHistory) return;
    const lines = [
      ...attempts.map(
        (a, i) =>
          `${i + 1}. 별 ${a.a}과(와) 별 ${a.b}을(를) 잇는다 (거리 ${a.dist}) → ${
            a.accepted ? "연결됨" : "이미 연결된 그룹이라 거부됨"
          }`
      ),
      `${attempts.length + 1}. (여기에 어떤 순서로 별을 골랐는지, 언제 멈췄는지 자신만의 기준을 적어보세요)`,
    ];
    onCopyHistory(lines.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const mapPx = presentationMode ? 620 : 540;

  return (
    <div className="space-y-2.5">
      {/* Compact header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
          직접 풀이 샌드박스 · 별자리 만들기
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            처음 상태로 초기화
          </button>
          <button
            type="button"
            onClick={handleNewProblem}
            className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer"
          >
            🎲 새 문제 생성
          </button>
        </div>
      </div>

      {/* Problem description — 상황 / 규칙 / 목표, muted card, 목표만 강조 */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 space-y-1 text-sm text-slate-600">
        <p>
          <span className="font-bold text-slate-500">상황</span> · 별 두 개를 연결하면 두 별 사이의 거리(좌표 차의
          유클리드 거리, 소수점 반올림)만큼 비용이 듭니다.
        </p>
        <p>
          <span className="font-bold text-slate-500">규칙</span> · 이미 (다른 별을 거쳐서라도) 연결된 두 별을 다시
          이으면 연결이 거부됩니다.
        </p>
        <p className="rounded-md bg-blue-50 border border-blue-100 px-2.5 py-1.5 font-bold text-blue-800">
          🎯 목표 · 모든 별이 하나로 연결되도록, 사용한 선의 총 길이를 최소화하세요.
        </p>
      </div>

      {/* Status bar — one compact line above the graph */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2">
        <span className="flex items-baseline gap-1.5">
          <span className="text-[11px] text-slate-400">총 연결 길이</span>
          <span
            className={`font-mono font-black text-blue-700 transition-transform duration-200 ${
              presentationMode ? "text-2xl" : "text-xl"
            } ${totalPulse ? "scale-125" : "scale-100"}`}
          >
            {currentTotal}
          </span>
        </span>
        <span className="text-slate-200">|</span>
        <span className="text-xs text-slate-500">
          연결한 선 <strong className="text-slate-800">{edges.length}/{n - 1}</strong>
        </span>
        <span className="text-slate-200">|</span>
        <span className="text-xs text-slate-500">
          시도 횟수 <strong className="text-slate-800">{attemptCount}회</strong>
        </span>
        {spanningTreeDone && (
          <span className="ml-auto text-xs font-bold text-emerald-700">🌟 모든 별 연결 완료</span>
        )}
      </div>

      {/* Night sky map — the main activity, given the most space */}
      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">1단계 · 별 연결하기</span>
          <span className="text-xs text-slate-400">별 두 개를 차례로 선택하세요.</span>
        </div>

        <div className="flex justify-center">
          {/* Extra margin (left/bottom) outside the 0..COORD_MAX sky square holds the
              axis tick numbers. Sized off `style` (not width/height attrs) so it
              shrinks to fit narrow screens instead of forcing horizontal scroll. */}
          <svg
            viewBox={`-14 -4 ${COORD_MAX + 18} ${COORD_MAX + 14}`}
            style={{ width: "100%", maxWidth: mapPx, height: "auto" }}
          >
            <defs>
              <radialGradient id="constellation-sky" cx="50%" cy="30%" r="75%">
                <stop offset="0%" stopColor="#1e1b4b" />
                <stop offset="100%" stopColor="#0f172a" />
              </radialGradient>
            </defs>

            {/* sky background */}
            <rect x={0} y={0} width={COORD_MAX} height={COORD_MAX} rx={6} fill="url(#constellation-sky)" />

            {/* coordinate grid — faint, so it stays out of the way of stars/lines */}
            {gridTicks.map((t) => (
              <line
                key={`grid-v-${t}`}
                x1={t}
                y1={0}
                x2={t}
                y2={COORD_MAX}
                stroke="#94a3b8"
                strokeOpacity={0.18}
                strokeWidth={0.25}
                strokeDasharray="1,1.8"
              />
            ))}
            {gridTicks.map((t) => (
              <line
                key={`grid-h-${t}`}
                x1={0}
                y1={t}
                x2={COORD_MAX}
                y2={t}
                stroke="#94a3b8"
                strokeOpacity={0.18}
                strokeWidth={0.25}
                strokeDasharray="1,1.8"
              />
            ))}

            {/* axis tick labels, faint, drawn outside the sky rect */}
            {gridTicks.map((t) => (
              <text key={`x-label-${t}`} x={t} y={COORD_MAX + 8} textAnchor="middle" fontSize={3} fill="#94a3b8">
                {t}
              </text>
            ))}
            {gridTicks.map((t) => (
              <text key={`y-label-${t}`} x={-4} y={t} textAnchor="end" dominantBaseline="middle" fontSize={3} fill="#94a3b8">
                {t}
              </text>
            ))}

            {/* connections the student has completed */}
            {edges.map((e) => {
              const key = `${e.a}-${e.b}`;
              const pa = pointById.get(e.a)!;
              const pb = pointById.get(e.b)!;
              const midX = (pa.x + pb.x) / 2;
              const midY = (pa.y + pb.y) / 2;
              const isHovered = hoveredEdgeKey === key;
              return (
                <g key={key}>
                  <line
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke={COLOR.connectedLine}
                    strokeWidth={isHovered ? 1.1 : 0.8}
                    strokeLinecap="round"
                  />
                  {/* wide invisible hit-area so a thin line is still easy to hover */}
                  <line
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke="transparent"
                    strokeWidth={3}
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onMouseEnter={() => setHoveredEdgeKey(key)}
                    onMouseLeave={() => setHoveredEdgeKey((k) => (k === key ? null : k))}
                  >
                    <title>{`별 ${e.a} ↔ 별 ${e.b} · 거리 ${e.dist}`}</title>
                  </line>
                  {isHovered && (
                    <text
                      x={midX}
                      y={midY - 1.8}
                      textAnchor="middle"
                      fontSize={3.6}
                      fontWeight={800}
                      fill="#fef3c7"
                      stroke="#78350f"
                      strokeWidth={0.3}
                      paintOrder="stroke"
                    >
                      {e.dist}
                    </text>
                  )}
                </g>
              );
            })}

            {/* correct-answer overlay, revealed only once the final answer has been checked */}
            {answerEdges.map((e, i) => {
              const pa = pointById.get(e.a)!;
              const pb = pointById.get(e.b)!;
              return (
                <g key={`answer-${i}`}>
                  <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#ffffff" strokeOpacity={0.45} strokeWidth={2.1} strokeLinecap="round" />
                  <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={COLOR.answerLine} strokeWidth={1.3} strokeLinecap="round" />
                </g>
              );
            })}

            {/* a rejected attempt flashes red, then clears itself */}
            {rejectedFlash && pointById.get(rejectedFlash.a) && pointById.get(rejectedFlash.b) && (
              <line
                x1={pointById.get(rejectedFlash.a)!.x}
                y1={pointById.get(rejectedFlash.a)!.y}
                x2={pointById.get(rejectedFlash.b)!.x}
                y2={pointById.get(rejectedFlash.b)!.y}
                stroke={COLOR.rejectedLine}
                strokeWidth={1.3}
                strokeLinecap="round"
              />
            )}

            {/* preview line + live distance for the currently selected pair */}
            {bothSelected && pointById.get(selectedFirst!) && pointById.get(selectedSecond!) && (
              <>
                <line
                  x1={pointById.get(selectedFirst!)!.x}
                  y1={pointById.get(selectedFirst!)!.y}
                  x2={pointById.get(selectedSecond!)!.x}
                  y2={pointById.get(selectedSecond!)!.y}
                  stroke={COLOR.previewLine}
                  strokeWidth={0.7}
                  strokeDasharray="1.6,1.6"
                  strokeLinecap="round"
                />
                <text
                  x={(pointById.get(selectedFirst!)!.x + pointById.get(selectedSecond!)!.x) / 2}
                  y={(pointById.get(selectedFirst!)!.y + pointById.get(selectedSecond!)!.y) / 2 - 1.8}
                  textAnchor="middle"
                  fontSize={3.8}
                  fontWeight={800}
                  fill="#dbeafe"
                  stroke="#1e3a8a"
                  strokeWidth={0.35}
                  paintOrder="stroke"
                >
                  {previewDist}
                </text>
              </>
            )}

            {/* stars — always drawn last, so a line can never cover a star's number */}
            {points.map((p) => {
              const isSelected = p.id === selectedFirst || p.id === selectedSecond;
              const isHovered = hoveredStarId === p.id;
              const r = isSelected ? 4.8 : isHovered ? 4.6 : 4.2;
              // Numbers stay faint by default (constellations don't wear
              // labels) and only sharpen on hover/selection, when a student
              // actually needs to read off which star is which.
              const labelActive = isSelected || isHovered;
              // Dark digits on the light default fill, white digits once the
              // circle itself turns blue on selection — either way the
              // number sits on a solid, single-color disc instead of the
              // busy sky, so it stays readable without an outline.
              const labelColor = isSelected ? "#ffffff" : "#1e293b";
              return (
                <g
                  key={p.id}
                  onClick={() => handleStarClick(p.id)}
                  onMouseEnter={() => setHoveredStarId(p.id)}
                  onMouseLeave={() => setHoveredStarId((id) => (id === p.id ? null : id))}
                  className="cursor-pointer"
                >
                  <title>{`별 ${p.id} · (${p.x}, ${p.y})`}</title>
                  {/* invisible, generously-sized hit target centered exactly on the
                      star — the <g>'s own bounding box also includes the number
                      label, so a click at the group's center can miss both; this
                      keeps the actual click/tap target anchored on the star. */}
                  <circle cx={p.x} cy={p.y} r={7} fill="transparent" style={{ pointerEvents: "all" }} />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill={isSelected ? COLOR.starSelectedFill : COLOR.starDefaultFill}
                    stroke={isSelected ? COLOR.starSelectedStroke : COLOR.starDefaultStroke}
                    strokeWidth={isSelected ? 0.7 : 0.4}
                  />
                  <text
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={4.2}
                    fontWeight={800}
                    fill={labelColor}
                    fillOpacity={labelActive ? 1 : 0.55}
                    className="select-none transition-opacity duration-150"
                  >
                    {p.id}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* legend — line styles only; coordinate help moves to a tooltip */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-1 pt-1.5 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: COLOR.connectedLine }} />
            연결 완료
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-4 border-t-2 border-dashed"
              style={{ borderColor: COLOR.previewLine }}
            />
            선택 중
          </span>
          {showAnswerOverlay && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-[3px] w-4 rounded-full" style={{ backgroundColor: COLOR.answerLine }} />
              정답 연결
            </span>
          )}
          <span
            className="cursor-help underline decoration-dotted"
            title="바깥 눈금은 각 별의 (x, y) 좌표입니다. 격자 한 칸 = 10. 거리는 소수점을 반올림한 정수입니다."
          >
            ⓘ 좌표 안내
          </span>
        </div>
      </div>

      {/* Control station — current selection, live distance, and the connect action in one flow */}
      <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide shrink-0">현재 선택</span>
          <span className="flex-1 min-w-0 text-sm text-slate-700">
            {selectionStage === "none" && "연결할 첫 번째 별을 선택하세요."}
            {selectionStage === "first" && `별 ${selectedFirst}번 선택됨 · 연결할 두 번째 별을 선택하세요.`}
            {selectionStage === "both" && (
              <>
                선택한 별{" "}
                <strong className="text-blue-700">
                  {selectedFirst} ↔ {selectedSecond}
                </strong>
                {previewDist !== null && (
                  <span className="ml-2 font-mono font-black text-blue-700">거리 {previewDist}</span>
                )}
                {!canConnect && <span className="ml-2 text-rose-500 text-xs">이미 직접 연결된 별입니다.</span>}
              </>
            )}
          </span>
          <button
            type="button"
            onClick={handleConnect}
            disabled={!canConnect || isConnecting}
            className={`min-h-[42px] shrink-0 rounded-lg px-6 text-sm font-bold shadow-xs transition active:scale-98 flex items-center justify-center gap-1.5 ${
              canConnect && !isConnecting
                ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            <span>🔗</span>
            <span>{isConnecting ? "연결 중…" : "연결하기"}</span>
          </button>
        </div>

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-md border px-3 py-1.5 text-xs font-bold ${
              toast.kind === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {toast.kind === "success" ? "🟢" : "🚫"} {toast.message}
          </div>
        )}

        {!toast && lastAccepted && (
          <p className="text-xs text-slate-400">
            <span className="font-bold text-slate-500">최근 연결</span> · 별 {lastAccepted.a} ↔ 별{" "}
            {lastAccepted.b} · 거리 {lastAccepted.dist}
          </p>
        )}
      </div>

      {/* Step 2 — submit the guessed minimum total */}
      <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 space-y-1.5">
        <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wide block">
          2단계 · 예상하는 최소 총 길이 제출
        </span>

        {!spanningTreeDone && (
          <p className="text-xs text-slate-400">
            먼저 모든 별을 연결해야 제출할 수 있어요 ({edges.length}/{n - 1}).
          </p>
        )}

        {!solved && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="number"
              aria-label="예상하는 최소 총 길이"
              disabled={!spanningTreeDone}
              className="min-h-[42px] rounded-lg border border-slate-300 bg-white w-full sm:w-36 px-3 py-1.5 text-sm font-bold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden disabled:bg-slate-50 disabled:text-slate-300"
              placeholder="숫자 입력"
              value={guessTotal}
              onChange={(e) => setGuessTotal(e.target.value)}
            />
            <button
              type="button"
              onClick={handleCheckAnswer}
              disabled={!spanningTreeDone || !guessTotal.trim()}
              className={`w-full sm:w-auto min-h-[42px] rounded-lg px-6 text-sm font-bold shadow-xs transition active:scale-98 flex items-center justify-center gap-2 shrink-0 ${
                spanningTreeDone && guessTotal.trim()
                  ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              <span>🏁</span>
              <span>정답 확인</span>
            </button>
          </div>
        )}

        {feedback && !solved && (
          <div role="status" aria-live="polite" className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-800">
            {feedback.message}
          </div>
        )}

        {solved && (
          <div role="status" aria-live="polite" className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-800">
            🎉 정답입니다! 최소 총 길이는 {instance.correctAnswer}입니다.
          </div>
        )}
      </div>

      {/* Kruskal learning feedback — only after the answer has been checked, never during solving */}
      {showAnswerOverlay && analysis && (
        <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3 space-y-3">
          <p className="text-sm font-black text-slate-800">📚 크루스칼 알고리즘 관점에서 살펴보기</p>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span className="text-slate-600">
              내 총 길이{" "}
              <strong className={analysis.userTotal > analysis.optimalTotal ? "text-rose-600" : "text-emerald-600"}>
                {analysis.userTotal}
              </strong>
            </span>
            <span className="text-slate-600">
              최적 총 길이 <strong className="text-purple-600">{analysis.optimalTotal}</strong>
            </span>
          </div>

          {analysis.skips.length === 0 ? (
            <p className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
              ✅ 모든 단계에서 그 순간 가장 짧은 간선을 선택했어요 — 크루스칼 알고리즘과 같은 순서입니다!
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-500">⏭️ 더 짧은 간선을 건너뛴 지점</p>
              {analysis.skips.map((s, i) => (
                <p key={i} className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
                  {s.stepIndex}번째 선택에서 거리 {s.shorterAvailable.dist}인 간선(별 {s.shorterAvailable.a}↔별{" "}
                  {s.shorterAvailable.b})을 아직 선택할 수 있었지만, 거리 {s.chosen.dist}인 간선(별 {s.chosen.a}↔별{" "}
                  {s.chosen.b})을 먼저 선택했습니다. 크루스칼 알고리즘은 아직 선택할 수 있는 간선 중 가장 짧은
                  간선부터 확인합니다.
                </p>
              ))}
            </div>
          )}

          {analysis.rejected.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500">🚫 사이클 때문에 거부된 간선</p>
              <ul className="text-sm text-slate-600 space-y-0.5 list-disc list-inside">
                {analysis.rejected.map((r, i) => (
                  <li key={i}>
                    별 {r.a} ↔ 별 {r.b} · 거리 {r.dist}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-100">
            <div className="pt-2">
              <p className="font-bold text-slate-500 mb-1">내가 선택한 순서</p>
              <ol className="space-y-0.5 text-slate-700 list-decimal list-inside">
                {analysis.userOrder.map((e, i) => (
                  <li key={i}>
                    별 {e.a}↔별 {e.b} (거리 {e.dist})
                  </li>
                ))}
              </ol>
            </div>
            <div className="pt-2">
              <p className="font-bold text-slate-500 mb-1">크루스칼 알고리즘의 선택 순서</p>
              <ol className="space-y-0.5 text-slate-700 list-decimal list-inside">
                {analysis.kruskalOrder.map((e, i) => (
                  <li key={i}>
                    별 {e.a}↔별 {e.b} (거리 {e.dist})
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={handleNewProblem}
              className="min-h-[42px] flex-1 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🎲</span>
              <span>새로운 밤하늘에서 다시 도전하기</span>
            </button>
            {onCopyHistory && (
              <button
                type="button"
                onClick={handleExportSummary}
                className="min-h-[42px] flex-1 rounded-lg border border-blue-200 bg-white px-5 py-2 text-sm font-bold text-blue-700 shadow-2xs transition hover:bg-blue-50/80 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{copied ? "✔" : "📋"}</span>
                <span>{copied ? "에디터에 추가했어요!" : "내 시도 기록 에디터에 추가하기"}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
