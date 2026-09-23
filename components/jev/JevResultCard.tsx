interface JevResultCardProps {
  roundTitle: string | null;
  submissionText: string | null;
  totalTrials: number;
  correctCount: number;
  incorrectCount: number;
  errorCount: number;
}

/**
 * Read-only — a teacher's batch run (app/api/teacher/warmup/jev-batch-run)
 * is the only thing that produces this data. Students never trigger a run
 * themselves; this just shows what already happened.
 */
export function JevResultCard({
  roundTitle,
  submissionText,
  totalTrials,
  correctCount,
  incorrectCount,
  errorCount,
}: JevResultCardProps) {
  const pct = (n: number) => (totalTrials > 0 ? Math.round((n / totalTrials) * 100) : 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900">AI 실행 결과{roundTitle ? ` · ${roundTitle}` : ""}</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          제출한 알고리즘을 AI(Jev)가 매번 새로 생성한 상자 배치 {totalTrials}개에 그대로 실행해본 결과입니다.
        </p>
      </div>

      {submissionText && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
          {submissionText}
        </div>
      )}

      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="bg-emerald-500" style={{ width: `${pct(correctCount)}%` }} />
        <div className="bg-amber-400" style={{ width: `${pct(incorrectCount)}%` }} />
        <div className="bg-rose-500" style={{ width: `${pct(errorCount)}%` }} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 py-2">
          <div className="text-lg font-black text-emerald-700">{correctCount}</div>
          <div className="text-[10px] font-bold text-emerald-700">정답 ({pct(correctCount)}%)</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 py-2">
          <div className="text-lg font-black text-amber-700">{incorrectCount}</div>
          <div className="text-[10px] font-bold text-amber-700">오답 ({pct(incorrectCount)}%)</div>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50/60 py-2">
          <div className="text-lg font-black text-rose-700">{errorCount}</div>
          <div className="text-[10px] font-bold text-rose-700">실행 실패 ({pct(errorCount)}%)</div>
        </div>
      </div>

      {correctCount === totalTrials && totalTrials > 0 && (
        <p className="text-xs font-semibold text-emerald-700 text-center">
          ✅ {totalTrials}번 모두 정답 — 다양한 상자 배치에서 일관되게 맞았습니다.
        </p>
      )}
    </section>
  );
}
