"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ResearchPanel } from "@/components/write/ResearchPanel";

type HistoryRow = {
  id: number;
  title: string;
  status: string;
  revision: number;
};

export default function WriteHistoryPage() {
  const [studentLabel, setStudentLabel] = useState<string | null>(null);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/student/me")
      .then(async (r) => {
        if (!r.ok) return;
        const d = (await r.json()) as { studentKey?: string };
        if (d.studentKey) setStudentLabel(d.studentKey);
      })
      .catch(() => {});

    fetch("/api/warmup/history")
      .then(async (r) => {
        if (!r.ok) throw new Error("학생으로 로그인한 뒤 기록을 볼 수 있습니다.");
        const d = (await r.json()) as { rows: HistoryRow[] };
        setRows(d.rows);
        setSelected(d.rows[0]?.id ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "기록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentStudentKey={studentLabel} />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
              활동 이력
            </span>
            <h1 className="mt-1 text-base sm:text-lg font-bold text-slate-900">
              내 알고리즘 작성·수정 기록
            </h1>
          </div>
          <a
            href="/write"
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            ← 현재 활동으로 돌아가기
          </a>
        </header>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-bold text-amber-900"
          >
            ⚠️ {error}
          </p>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
            작성 기록을 불러오는 중…
          </div>
        ) : rows.length === 0 && !error ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
            아직 제출한 활동 기록이 없습니다.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="활동 라운드 선택">
              {rows.map((r) => {
                const isSelected = r.id === selected;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelected(r.id)}
                    aria-pressed={isSelected}
                    className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? "border-blue-600 bg-blue-600 text-white shadow-xs"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {r.title} · 버전 {r.revision}
                    {r.status === "closed" ? " · 종료" : " · 진행 중"}
                  </button>
                );
              })}
            </div>

            {selected && <ResearchPanel key={selected} roundId={selected} />}
          </>
        )}
      </main>
    </div>
  );
}
