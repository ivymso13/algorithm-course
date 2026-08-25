"use client";

type JosephusState = {
  alive: number[];
  removedOrder: number[];
  nextUp: number | null;
};

interface JosephusViewerProps {
  input: Record<string, unknown>;
  state: Record<string, unknown>;
  runAction: (action: string, params: Record<string, unknown>) => Promise<void>;
  loading: boolean;
}

export function JosephusViewer({ input, state: rawState, runAction, loading }: JosephusViewerProps) {
  const n = Number(input.n ?? 0);
  const k = Number(input.k ?? 0);
  const state = rawState as JosephusState;
  const alive = state.alive ?? [];
  const removedOrder = state.removedOrder ?? [];
  const nextUp = state.nextUp ?? null;

  async function handleRemove(person: number) {
    if (!alive.includes(person)) return;
    if (alive.length <= 1) return;
    await runAction("remove", { person });
  }

  // Calculate circular layout positions for SVG/HTML view
  const radius = 110;
  const centerX = 140;
  const centerY = 140;

  const positions = Array.from({ length: n }, (_, i) => {
    const person = i + 1;
    // 1 starts at top (-90 deg) and goes clockwise
    const angle = ((2 * Math.PI) / n) * i - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    return { person, x, y };
  });

  const removedMap = new Map(removedOrder.map((person, idx) => [person, idx + 1]));

  return (
    <div className="space-y-5">
      {/* Problem Param Banner */}
      <div className="rounded-2xl border border-indigo-200 bg-linear-to-r from-indigo-50 to-purple-50 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-2xl text-white shadow-xs">
              🔄
            </div>
            <div>
              <p className="text-xs font-semibold text-indigo-700">조세퍼스 규칙</p>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-slate-900">
                  총 <span className="text-indigo-600 font-black">{n}명</span>, 매{" "}
                  <span className="text-indigo-600 font-black">{k}번째</span> 사람 제거
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-white/80 px-3.5 py-2 border border-indigo-100 shadow-xs">
            <span className="text-xs text-slate-600">남은 인원:</span>
            <span className="text-base font-bold text-indigo-700">{alive.length}명</span>
            <span className="text-[11px] text-slate-400">
              (제거 {removedOrder.length}회)
            </span>
          </div>
        </div>

        {nextUp !== null && (
          <div className="mt-3 rounded-lg bg-indigo-100/70 px-3 py-1.5 text-xs text-indigo-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <span>👉</span>
              <span>
                다음 세기 시작 기준: <strong>{nextUp}번</strong>부터 세기 시작
              </span>
            </span>
            <span className="text-[11px] text-indigo-600">
              (몇 번째로 셀지는 알고리즘을 따라 직접 카운트하세요)
            </span>
          </div>
        )}
      </div>

      {/* Circular Arrangement Visualizer */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-700">
            ⭕ 원형 배치 시각화 (시계 방향 순서)
          </h4>
          <span className="text-xs text-slate-500">
            생존자 클릭 시 제거
          </span>
        </div>

        <div className="relative mx-auto flex h-72 w-72 items-center justify-center">
          {/* Circular Track Ring */}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 280 280">
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            {/* Clockwise Direction Arrows */}
            <path
              d={`M ${centerX} ${centerY - radius - 8} L ${centerX + 8} ${centerY - radius} L ${centerX} ${centerY - radius + 8}`}
              fill="#94a3b8"
            />
          </svg>

          {/* Center Info Badge */}
          <div className="z-0 flex flex-col items-center justify-center rounded-full bg-slate-50 p-4 text-center border border-slate-200 shadow-xs">
            <span className="text-[11px] text-slate-500 font-medium">생존자</span>
            <span className="text-2xl font-black text-indigo-600">{alive.length}명</span>
            {alive.length === 1 && (
              <span className="mt-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                🏆 최종 생존: {alive[0]}번
              </span>
            )}
          </div>

          {/* Node for each person */}
          {positions.map(({ person, x, y }) => {
            const isAlive = alive.includes(person);
            const isNext = nextUp === person && isAlive;
            const order = removedMap.get(person);

            return (
              <button
                key={person}
                type="button"
                onClick={() => handleRemove(person)}
                disabled={loading || !isAlive || alive.length <= 1}
                style={{
                  left: `${x - 20}px`,
                  top: `${y - 20}px`,
                }}
                className={`absolute z-10 flex h-10 w-10 flex-col items-center justify-center rounded-full font-bold text-sm transition shadow-xs cursor-pointer ${
                  !isAlive
                    ? "bg-slate-100 text-slate-400 border border-slate-300 line-through opacity-60 cursor-not-allowed"
                    : isNext
                    ? "bg-indigo-600 text-white ring-4 ring-indigo-200 scale-110 shadow-md animate-pulse"
                    : "bg-white text-slate-800 border-2 border-indigo-500 hover:bg-indigo-50 hover:scale-105"
                }`}
                title={
                  isAlive
                    ? `${person}번 사람 (클릭 시 제거)`
                    : `${person}번 (탈락 #${order})`
                }
              >
                <span>{person}</span>
                {!isAlive && order && (
                  <span className="absolute -bottom-2 -right-1 text-[8px] bg-rose-500 text-white px-1 rounded-full not-line-through font-bold">
                    #{order}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Action Controls List */}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <span className="text-xs font-bold text-slate-700 block mb-2">
            ✂️ 특정 번호의 사람 제거하기 (버튼 클릭):
          </span>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: n }, (_, i) => i + 1).map((person) => {
              const isAlive = alive.includes(person);
              return (
                <button
                  key={person}
                  type="button"
                  onClick={() => handleRemove(person)}
                  disabled={loading || !isAlive || alive.length <= 1}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    isAlive
                      ? "border border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 shadow-xs"
                      : "border border-slate-200 bg-slate-100 text-slate-400 line-through cursor-not-allowed opacity-50"
                  }`}
                >
                  {person}번 제거
                </button>
              );
            })}
          </div>
        </div>

        {/* Elimination Order Timeline */}
        {removedOrder.length > 0 && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-200">
            <span className="text-xs font-bold text-slate-700 block mb-1">
              📜 제거 순서:
            </span>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {removedOrder.map((person, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  <span className="rounded-md bg-rose-100 px-2 py-0.5 font-bold text-rose-800">
                    {person}번
                  </span>
                  {idx < removedOrder.length - 1 && (
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
