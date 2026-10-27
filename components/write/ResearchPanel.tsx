"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { JevResultCard } from "@/components/jev/JevResultCard";

type Version = {
  id: number;
  revision: number;
  algorithm_text: string;
  reason: string;
  origin: string;
  ai_status: string | null;
  ai_result: string | null;
  ai_error: string | null;
  ai_lease_until: number | null;
  note: string | null;
  agrees: number | null;
};

type Review = {
  id: number;
  version_id: number;
  revision: number;
  status: string;
  feedback: string | null;
  executable: number | null;
};

type Assignment = {
  id: number;
  version_id: number;
  submission_id: number;
  anon_label: string;
  status: string;
};

type View = {
  versions: Version[];
  incoming: Review[];
  outgoing: Assignment[];
  canRevise: boolean;
  roundStatus: string;
  overrideReason: string | null;
};

type AI = {
  kind: string;
  notice?: string;
  interpretations: {
    step: number;
    text: string;
    action: string;
    confidence: number;
    accepted: boolean;
    reason?: string;
  }[];
  trials: {
    numbers: number[];
    inputLabel?: string;
    answerLabels?: string[];
    expected: number | number[];
    output: number | null | (number | null)[];
    correct: boolean;
    executable: boolean;
    failure?: string;
    trace?: {
      step: number;
      detail?: string;
      sum?: number | null;
      next?: number | null;
      remaining?: number | null;
      index: number;
      value: number | null;
      memo: number | null;
      output: number | null;
    }[];
  }[];
};

function SavedAIRecord({ version }: { version: Version }) {
  let result: AI | null = null;
  try {
    if (version.ai_result) result = JSON.parse(version.ai_result) as AI;
  } catch {
    /* Invalid saved results are shown as unavailable. */
  }

  if (!result) {
    return (
      <p className="mt-2 text-xs text-slate-600">
        {version.ai_status === "failed"
          ? version.ai_error
          : version.ai_status === "running"
          ? "해석 진행 중"
          : "아직 JEV 결과가 저장되지 않았습니다."}
      </p>
    );
  }

  return (
    <div className="mt-2.5 space-y-3">
      {result.kind === "execution" && result.trials.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          고정 테스트 10개 검사 보류 · 해석을 확정하지 못한 단계가 있어 실행하지 않았습니다. 오답으로 채점하지 않습니다.
        </p>
      )}
      <details className="rounded-lg border border-slate-200 bg-white p-2.5">
        <summary className="cursor-pointer text-xs font-semibold text-slate-700">
          문장별 해석 보기 ({result.interpretations.length}단계)
        </summary>
        <div className="mt-2 space-y-1.5">
          {result.interpretations.map((p, i) => (
            <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <strong>{p.step}단계</strong>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                    p.accepted ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {p.accepted ? "해석 완료" : "해석 확인 필요"}
                </span>
              </div>
              <p className="mt-1 text-slate-700">{p.text}</p>
              <p className="mt-0.5 font-mono text-[11px] text-indigo-900">JEV: {p.action}</p>
              {p.reason && <p className="mt-1 text-amber-800">{p.reason}</p>}
            </div>
          ))}
        </div>
      </details>
      {result.notice && <p className="text-xs text-slate-600">{result.notice}</p>}
      {result.trials.length > 0 && (
        <JevResultCard
          embedded
          fixedCases
          roundTitle={null}
          submissionText={version.algorithm_text}
          totalTrials={result.trials.length}
          correctCount={result.trials.filter((t) => t.correct).length}
          incorrectCount={result.trials.filter((t) => t.executable && !t.correct).length}
          errorCount={result.trials.filter((t) => !t.executable).length}
          examples={result.trials.map((t, i) => ({
            trialIndex: i,
            numbers: t.numbers,
            inputLabel: t.inputLabel,
            answerLabels: t.answerLabels,
            correct: t.executable ? t.correct : null,
            executable: t.executable,
            failedStep: null,
            finalAnswer: t.output,
            correctAnswer: t.expected,
            failureReason: t.failure,
            trace: t.trace,
          }))}
        />
      )}
    </div>
  );
}

export function ResearchPanel({
  roundId,
  compact = false,
}: {
  roundId: number;
  compact?: boolean;
}) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [draft, setDraft] = useState<{
    versionId: number;
    note: string;
    agrees: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/warmup/research?roundId=" + roundId, { cache: "no-store" });
    if (!r.ok) throw new Error("활동 기록을 불러오지 못했습니다.");
    setView((await r.json()) as View);
  }, [roundId]);

  useEffect(() => {
    let active = true;
    const read = () =>
      load().catch((e) => {
        if (active) setError(e.message);
      });
    void read();
    const timer = setInterval(read, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [roundId, load]);

  const latest = view?.versions.at(-1);
  const lastAttempt = useRef(0);
  const note = draft?.versionId === latest?.id ? draft?.note ?? "" : latest?.note ?? "";
  const agrees = draft?.versionId === latest?.id ? draft?.agrees ?? true : latest?.agrees !== 0;

  const execute = useCallback(
    async (id: number) => {
      setBusy(true);
      setError("");
      try {
        const r = await fetch("/api/warmup/research-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versionId: id }),
        });
        if (!r.ok) throw new Error("JEV 요청을 시작하지 못했습니다.");
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "연결 오류");
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  useEffect(() => {
    const now = Date.now();
    const needsRun =
      view?.roundStatus === "open" &&
      latest &&
      (latest.ai_status === "queued" ||
        latest.ai_status === null ||
        (latest.ai_status === "running" && !!latest.ai_lease_until && latest.ai_lease_until < now));
    if (latest && needsRun && now - lastAttempt.current >= 4500) {
      lastAttempt.current = now;
      void execute(latest.id);
    }
  }, [latest, view?.roundStatus, execute]);

  async function saveNote() {
    if (!latest) return;
    setError("");
    setNoteSaved(false);
    const r = await fetch("/api/warmup/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId: latest.id, agrees, note }),
    });
    const d = (await r.json()) as { error?: string };
    if (!r.ok) {
      setError(d.error ?? "의견을 저장하지 못했습니다.");
    } else {
      setNoteSaved(true);
      window.setTimeout(() => setNoteSaved(false), 3000);
      await load();
    }
  }

  if (!view) {
    return (
      <p className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-xs text-blue-900">
        {error || "제출·피드백 기록을 불러오는 중…"}
      </p>
    );
  }
  if (!latest) return null;

  let ai: AI | null = null;
  try {
    if (latest.ai_result) ai = JSON.parse(latest.ai_result) as AI;
  } catch {
    /* invalid saved payload */
  }

  const complete = view.incoming.filter((r) => r.status === "completed").length;
  const outgoingComplete = view.outgoing.filter((a) => a.status === "completed").length;
  const unacceptedCount = ai ? ai.interpretations.filter((p) => !p.accepted).length : 0;
  const isRunningAi = busy || latest.ai_status === "running" || latest.ai_status === "queued";

  const statusTitle =
    view.roundStatus === "closed"
      ? "활동 종료 · 기록 확인"
      : latest.revision >= 2
      ? `수정 제출 완료 (버전 ${latest.revision})`
      : view.canRevise
      ? "동료평가 완료 · 수정 가능"
      : view.incoming.length
      ? "동료평가 진행 중 · 수정 대기"
      : "첫 제출 완료 · 평가 배정 대기";

  const statusDescription =
    view.roundStatus === "closed"
      ? "종료된 활동입니다. 제출 원문과 JEV 해석·동료 피드백·수정 이력을 확인할 수 있습니다."
      : latest.revision >= 2
      ? "피드백을 반영한 수정본이 새 버전으로 저장되었습니다. 아래에서 버전별 원문과 JEV 실행 결과를 비교해 보세요."
      : view.canRevise
      ? "배정된 동료 피드백이 모두 도착했습니다. 받은 피드백과 JEV 해석을 참고하여 알고리즘을 수정하세요."
      : `첫 제출 원문은 보존됩니다. 받은 동료 평가 ${complete}/${
          view.incoming.length || "배정 대기"
        } · 모든 평가가 도착하면 수정이 열립니다.`;

  const jevSection = (
    <section
      aria-label="JEV 실행 결과"
      className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 bg-indigo-50/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-base">
            🤖
          </span>
          <h3 className="text-sm sm:text-base font-bold text-indigo-950">JEV 실행 결과</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {isRunningAi ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800">
              <span className="h-2 w-2 animate-ping rounded-full bg-indigo-600" aria-hidden="true" />
              <span>해석 진행 중</span>
            </span>
          ) : ai ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                unacceptedCount > 0
                  ? "bg-amber-100 text-amber-900"
                  : "bg-emerald-100 text-emerald-900"
              }`}
            >
              {unacceptedCount > 0 ? `${unacceptedCount}단계 확인 필요` : "✓ 문장 해석 완료"}
            </span>
          ) : null}
          <span className="rounded-full border border-indigo-200 bg-white px-2.5 py-0.5 text-xs font-bold text-indigo-700">
            버전 {latest.revision}
          </span>
        </div>
      </div>

      <div className="space-y-3.5 p-4">
        {isRunningAi && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-indigo-950"
          >
            <span
              className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
              aria-hidden="true"
            />
            <span>
              JEV가 명령을 읽고 있습니다. 원문은 이미 저장되어 있으며 동료평가 참여는 바로 가능합니다.
            </span>
          </div>
        )}

        {latest.ai_status === "failed" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 space-y-2">
            <p className="font-semibold">⚠️ {latest.ai_error}</p>
            <button
              type="button"
              disabled={busy || view.roundStatus !== "open"}
              onClick={() => void execute(latest.id)}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
            >
              다시 읽기
            </button>
          </div>
        )}

        {ai && (
          <>
            {ai.kind === "execution" && ai.trials.length === 0 && (
              <div
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-950 space-y-1"
              >
                <strong className="block text-sm">⏸️ 고정 테스트 10개 · 검사 보류</strong>
                <p>
                  JEV가 해석을 확정하지 못한 단계가 있어 테스트를 실행하지 않았습니다. 오답으로 채점하지 않습니다. 아래 해석 확인이 필요한 단계와 동료 피드백을 참고해 수정해 주세요.
                </p>
              </div>
            )}

            {ai.notice && (
              <p className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                {ai.notice}
              </p>
            )}

            {ai.trials.length > 0 && (
              <JevResultCard
                embedded
                fixedCases
                roundTitle={null}
                submissionText={latest.algorithm_text}
                totalTrials={ai.trials.length}
                correctCount={ai.trials.filter((t) => t.correct).length}
                incorrectCount={ai.trials.filter((t) => t.executable && !t.correct).length}
                errorCount={ai.trials.filter((t) => !t.executable).length}
                examples={ai.trials.map((t, i) => ({
                  trialIndex: i,
                  numbers: t.numbers,
            inputLabel: t.inputLabel,
                  answerLabels: t.answerLabels,
                  correct: t.executable ? t.correct : null,
                  executable: t.executable,
                  failedStep: null,
                  finalAnswer: t.output,
                  correctAnswer: t.expected,
                  failureReason: t.failure,
                  trace: t.trace,
                }))}
              />
            )}

            <details
              open={unacceptedCount > 0 || ai.trials.length === 0}
              className="rounded-xl border border-slate-200 bg-slate-50/40 p-3.5"
            >
              <summary className="flex flex-wrap items-center justify-between gap-2 cursor-pointer text-xs font-bold text-slate-800">
                <span>
                  문장별 해석 확인 ({ai.interpretations.length}단계) ·{" "}
                  {unacceptedCount > 0 ? (
                    <span className="text-amber-800">{unacceptedCount}단계 확인 필요</span>
                  ) : (
                    <span className="text-emerald-700">모든 단계 해석 완료</span>
                  )}
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  AI 해석은 학생 능력의 판정이 아닙니다. 의도와 다른 부분을 표시해 주세요.
                </span>
              </summary>

              <div className="mt-3 space-y-2.5 border-t border-slate-200/80 pt-3">
                {ai.interpretations.map((p, i) => (
                  <div
                    key={i}
                    className={`grid gap-2.5 rounded-xl border p-3 text-xs sm:grid-cols-2 ${
                      p.accepted
                        ? "border-slate-200 bg-white"
                        : "border-amber-300 bg-amber-50/50"
                    }`}
                  >
                    <div>
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {p.step}단계 · 내 문장
                      </span>
                      <p className="mt-1.5 font-mono leading-relaxed text-slate-900">{p.text}</p>
                    </div>
                    <div className="sm:border-l sm:border-slate-100 sm:pl-3">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          p.accepted
                            ? "bg-indigo-50 text-indigo-800"
                            : "bg-amber-200/80 text-amber-950"
                        }`}
                      >
                        {p.accepted ? "✓ JEV의 해석" : "⚠️ 해석 후보 · 확인 필요"}
                      </span>
                      <p className="mt-1.5 font-semibold leading-relaxed text-slate-800">
                        {p.action}
                      </p>
                      {p.reason && (
                        <p className="mt-1 text-[11px] text-amber-900 leading-snug">{p.reason}</p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Learner Agreement & Observation Form */}
                <div className="space-y-2.5 rounded-xl border border-blue-200/80 bg-blue-50/60 p-3.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={view.roundStatus !== "open"}
                        checked={agrees}
                        onChange={(e) =>
                          setDraft({ versionId: latest.id, note, agrees: e.target.checked })
                        }
                        className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>JEV의 해석이 내 의도와 같습니다</span>
                    </label>
                    {latest.note !== null && (
                      <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-800 border border-blue-200">
                        저장됨: {latest.agrees ? "의도와 일치" : "의도와 불일치"}
                      </span>
                    )}
                  </div>

                  <textarea
                    disabled={view.roundStatus !== "open"}
                    value={note}
                    onChange={(e) =>
                      setDraft({ versionId: latest.id, note: e.target.value, agrees })
                    }
                    maxLength={2000}
                    rows={2}
                    placeholder="어느 단계에서 의도와 다르게 읽었나요? 같은 경우에도 관찰한 점을 남길 수 있습니다."
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden disabled:opacity-60"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-600">
                      {noteSaved ? (
                        <span className="font-bold text-emerald-700">✓ 해석 확인 의견이 저장되었습니다.</span>
                      ) : latest.note ? (
                        <span>저장된 의견: {latest.note}</span>
                      ) : (
                        <span>의견을 기록하면 연구 자료 및 교사 화면에 반영됩니다.</span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={view.roundStatus !== "open"}
                      onClick={() => void saveNote()}
                      className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                    >
                      해석 확인 기록하기
                    </button>
                  </div>
                </div>
              </div>
            </details>
          </>
        )}
      </div>
    </section>
  );

  const incomingSection = (
    <section
      aria-label="받은 동료 피드백"
      className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xs"
    >
      <div className="flex items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/80 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm sm:text-base font-bold text-emerald-950">
          <span aria-hidden="true">💬</span>
          <span>받은 동료 피드백</span>
        </h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
            complete > 0 && complete === view.incoming.length
              ? "bg-emerald-600 text-white"
              : "border border-emerald-200 bg-white text-emerald-800"
          }`}
        >
          {complete}/{view.incoming.length} 완료
        </span>
      </div>

      <div className="space-y-2.5 p-4">
        {view.incoming.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
            교사가 평가를 열면 평가자가 배정됩니다.
          </p>
        ) : (
          view.incoming.map((r, i) => {
            const isDone = r.status === "completed";
            return (
              <article
                key={r.id}
                className={`rounded-xl border p-3 text-xs ${
                  isDone
                    ? "border-emerald-200 bg-emerald-50/30 text-slate-800"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="font-bold text-slate-900">
                    평가자 {i + 1} · 버전 {r.revision}
                  </strong>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      isDone
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200/70 text-slate-600"
                    }`}
                  >
                    {isDone ? "✓ 피드백 도착" : "평가 대기 중"}
                  </span>
                </div>
                <p className="mt-1.5 leading-relaxed">
                  {isDone ? r.feedback : "아직 동료가 평가를 작성하고 있습니다."}
                </p>
              </article>
            );
          })
        )}

        {view.canRevise && !compact && (
          <div className="pt-1">
            <a
              href="/write/algorithm"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700"
            >
              <span>✏️ 받은 피드백을 반영해 알고리즘 수정하기</span>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        )}
      </div>
    </section>
  );

  const outgoingSection = (
    <section
      aria-label="내가 할 동료평가"
      className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-xs"
    >
      <div className="flex items-center justify-between gap-3 border-b border-amber-100 bg-amber-50/80 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm sm:text-base font-bold text-amber-950">
          <span aria-hidden="true">✍️</span>
          <span>내가 할 동료평가</span>
        </h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
            view.outgoing.length > 0 && outgoingComplete === view.outgoing.length
              ? "bg-emerald-600 text-white"
              : "border border-amber-200 bg-white text-amber-900"
          }`}
        >
          {outgoingComplete}/{view.outgoing.length} 완료
        </span>
      </div>

      <div className="space-y-2.5 p-4">
        <p className="text-xs leading-relaxed text-slate-600">
          친구의 첫 원문을 직접 따라 실행하고, 이해가 갈린 단계를 구체적으로 적어 주세요. 친구의 JEV 결과는 제공되지 않습니다.
        </p>

        {view.outgoing.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
            교사가 평가를 열면 친구의 알고리즘이 배정됩니다.
          </p>
        ) : (
          <div className="space-y-2">
            {view.outgoing.map((a) => {
              const isDone = a.status === "completed";
              return (
                <a
                  key={a.id}
                  href={`/execute?submissionId=${a.submission_id}`}
                  className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-xs font-bold transition ${
                    isDone
                      ? "border-emerald-200 bg-emerald-50/40 text-emerald-900 hover:bg-emerald-50"
                      : "border-amber-300 bg-amber-50/40 text-slate-900 hover:border-blue-400 hover:bg-blue-50/40"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                        isDone ? "bg-emerald-600 text-white" : "bg-amber-200 text-amber-950"
                      }`}
                    >
                      {isDone ? "✓" : "→"}
                    </span>
                    <span>{a.anon_label}</span>
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                      isDone
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-600 text-white shadow-2xs"
                    }`}
                  >
                    {isDone ? "평가 제출 완료 · 다시 보기" : "실행하고 평가하기 →"}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );

  const historySection = (
    <section
      aria-label="원문과 수정 이력"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
    >
      <details open={view.versions.length > 1}>
        <summary className="flex flex-wrap items-center justify-between gap-2 cursor-pointer text-xs sm:text-sm font-bold text-slate-900">
          <span>📜 원문과 수정 이력 ({view.versions.length}개 버전)</span>
          <span className="text-[11px] font-normal text-slate-500">
            첫 제출 원문과 피드백 반영 수정본이 각각 보존됩니다
          </span>
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {view.versions.map((v) => (
            <article
              key={v.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-2.5"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-slate-900">
                    버전 {v.revision}
                    {v.revision === 1 ? " · 첫 제출 원문" : " · 피드백 반영 수정본"}
                    {v.origin === "legacy" ? " (기존 자료 기준본)" : ""}
                  </h3>
                  <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                    v{v.revision}
                  </span>
                </div>
                <pre className="whitespace-pre-wrap rounded-lg border border-slate-200/80 bg-white p-3 font-mono text-xs leading-relaxed text-slate-800">
                  {v.algorithm_text}
                </pre>
                {v.reason && (
                  <p className="rounded-lg border border-blue-200 bg-blue-50/70 p-2.5 text-xs text-blue-950">
                    <strong className="font-bold">수정 이유:</strong> {v.reason}
                  </p>
                )}
              </div>

              {v.ai_result && (
                <details className="border-t border-slate-200/80 pt-2">
                  <summary className="cursor-pointer font-semibold text-indigo-700 hover:underline">
                    이 버전의 JEV 기록 보기
                  </summary>
                  <SavedAIRecord version={v} />
                </details>
              )}
            </article>
          ))}
        </div>
      </details>
    </section>
  );

  // On /write/algorithm (compact mode), keep the progress status + received peer feedback
  // immediately visible above the editor, and group the full JEV/peer/history panels in a
  // single collapsible drawer so the step editor stays near the top of the screen.
  if (compact) {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  view.canRevise
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-900"
                }`}
              >
                {view.canRevise ? "✓ 수정 가능" : "🔒 수정 대기"}
              </span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">{statusTitle}</h2>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                현재 버전 {latest.revision}
              </span>
              <a href="/write/history" className="font-bold text-blue-700 hover:underline">
                이전 활동 기록 →
              </a>
            </div>
          </div>

          <p className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs leading-relaxed text-blue-950">
            {statusDescription}
          </p>

          {view.overrideReason && (
            <p className="text-xs font-semibold text-amber-800">
              교사 예외 개방: {view.overrideReason}
            </p>
          )}

          {/* Received feedback summary right above the editor */}
          {view.incoming.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between text-xs">
                <strong className="font-bold text-emerald-950">
                  💬 참고할 동료 피드백 ({complete}/{view.incoming.length} 도착)
                </strong>
                <a href="/write/explore" className="font-semibold text-blue-600 hover:underline">
                  아이디어·평가 보드에서 전체 보기 →
                </a>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {view.incoming.map((r, i) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-2.5 text-xs text-slate-800"
                  >
                    <strong className="font-bold text-emerald-950">
                      평가자 {i + 1} (버전 {r.revision}):
                    </strong>{" "}
                    <span>{r.status === "completed" ? r.feedback : "평가 대기 중"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <details className="border-t border-slate-100 pt-2.5">
            <summary className="cursor-pointer text-xs font-bold text-indigo-700 hover:text-indigo-900">
              🤖 JEV 실행 결과 · 동료평가 배정 · 버전 이력 펼쳐보기 ({view.versions.length}개 버전) ▼
            </summary>
            <div className="mt-3 space-y-4">
              {jevSection}
              <div className="grid items-start gap-4 lg:grid-cols-2">
                {incomingSection}
                {outgoingSection}
              </div>
              {historySection}
            </div>
          </details>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
            ⚠️ {error}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* Status & Progress Overview Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                view.roundStatus === "closed"
                  ? "bg-slate-200 text-slate-800"
                  : latest.revision >= 2
                  ? "bg-blue-100 text-blue-900"
                  : view.canRevise
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-amber-100 text-amber-900"
              }`}
            >
              {view.roundStatus === "closed"
                ? "종료됨"
                : latest.revision >= 2
                ? "2차 수정 완료"
                : view.canRevise
                ? "수정 가능"
                : "1차 제출 완료"}
            </span>
            <h2 className="text-base font-bold text-slate-900">{statusTitle}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
              버전 {latest.revision}
            </span>
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">
              받은 피드백 {complete}/{view.incoming.length}
            </span>
            <span className="rounded-md bg-amber-50 px-2.5 py-1 font-semibold text-amber-900">
              내 동료평가 {outgoingComplete}/{view.outgoing.length}
            </span>
            <a href="/write/history" className="font-bold text-blue-700 hover:underline ml-1">
              이전 활동 기록 →
            </a>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs leading-relaxed text-blue-950 sm:flex-row sm:items-center">
          <p>{statusDescription}</p>
          {view.canRevise && (
            <a
              href="/write/algorithm"
              className="shrink-0 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-700 text-center"
            >
              ✏️ 알고리즘 수정하기 →
            </a>
          )}
        </div>

        {view.overrideReason && (
          <p className="text-xs font-semibold text-amber-800">
            교사 예외 개방: {view.overrideReason}
          </p>
        )}
      </div>

      {jevSection}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {incomingSection}
        {outgoingSection}
      </div>

      {historySection}

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
          ⚠️ {error}
        </p>
      )}
    </section>
  );
}
