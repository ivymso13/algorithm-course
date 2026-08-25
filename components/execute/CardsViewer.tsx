"use client";

type CardsState = {
  revealed: { position: number; value: number }[];
  flipCount?: number;
};

interface CardsViewerProps {
  input: Record<string, unknown>;
  state: Record<string, unknown>;
  runAction: (action: string, params: Record<string, unknown>) => Promise<void>;
  loading: boolean;
}

export function CardsViewer({ input, state: rawState, runAction, loading }: CardsViewerProps) {
  const n = Number(input.n ?? 0);
  const target = Number(input.target ?? 0);
  const state = rawState as CardsState;
  const revealed = state.revealed ?? [];
  const revealedMap = new Map(revealed.map((r) => [r.position, r.value]));
  const flipCount = state.flipCount ?? revealed.length;
  const theoreticalMin = Math.ceil(Math.log2(n + 1));

  async function handleFlip(position: number) {
    if (revealedMap.has(position)) return; // already revealed
    await runAction("flip", { position });
  }

  return (
    <div className="space-y-5">
      {/* Target Number & Benchmark Banner */}
      <div className="rounded-2xl border border-blue-200 bg-linear-to-r from-blue-50 to-indigo-50 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-2xl text-white shadow-xs">
              🎯
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-700">찾을 목표 숫자</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{target}</span>
                <span className="text-xs text-slate-500">
                  (오름차순 정렬 상태)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-white/80 px-3.5 py-2 border border-blue-100 shadow-xs">
            <span className="text-xs text-slate-600">뒤집은 카드:</span>
            <span className="text-base font-bold text-blue-700">{flipCount}장</span>
            <span className="text-[11px] text-slate-400">
              (이론 최소 {theoreticalMin}회)
            </span>
          </div>
        </div>

        <div className="mt-3 rounded-lg bg-blue-100/60 px-3 py-1.5 text-xs text-blue-900 flex items-center gap-1.5">
          <span>💡</span>
          <span>
            카드를 클릭해 숫자를 확인하세요. 목표 숫자가 아예 없다고 판단되면 최종 답에 <strong>0</strong>을 입력합니다.
          </span>
        </div>
      </div>

      {/* Interactive Card Deck Grid */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-700">
            🎴 카드 덱 (총 {n}장 — 왼쪽부터 1번 ~ {n}번)
          </h4>
          <span className="text-xs text-slate-500">
            확인된 카드: {revealedMap.size} / {n}
          </span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5 sm:gap-3">
          {Array.from({ length: n }, (_, i) => i + 1).map((position) => {
            const isFlipped = revealedMap.has(position);
            const value = revealedMap.get(position);
            const isMatch = isFlipped && value === target;

            return (
              <button
                key={position}
                type="button"
                onClick={() => handleFlip(position)}
                disabled={loading || isFlipped}
                className={`group relative flex flex-col items-center justify-between rounded-xl p-2 h-20 transition shadow-xs cursor-pointer ${
                  isMatch
                    ? "border-2 border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-300"
                    : isFlipped
                    ? "border border-blue-300 bg-blue-50 text-slate-900"
                    : "border-2 border-slate-300 bg-linear-to-b from-slate-100 to-slate-200 hover:border-blue-400 hover:from-blue-50 hover:to-blue-100"
                }`}
              >
                {/* Position Index Chip */}
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                    isFlipped ? "bg-slate-200 text-slate-700" : "bg-slate-300 text-slate-700"
                  }`}
                >
                  #{position}
                </span>

                {/* Card Face Value */}
                <div className="my-auto text-center">
                  {isFlipped ? (
                    <span className="text-lg font-black tracking-tight">{value}</span>
                  ) : (
                    <span className="text-sm text-slate-400 group-hover:text-blue-600 font-bold">
                      ?
                    </span>
                  )}
                </div>

                {/* Status Dot / Match indicator */}
                <span className="text-[9px] font-medium text-slate-400">
                  {isMatch ? "🎯 일치!" : isFlipped ? "확인됨" : "클릭"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
