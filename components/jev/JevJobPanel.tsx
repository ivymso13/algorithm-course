"use client";

import { useId } from "react";

export interface JevJobSummaryProp {
  id: number;
  status: string;
  totalStudents: number;
  completedStudents: number;
  failedStudents: number;
  skippedStudents: number;
  mode: string;
  lastError?: string | null;
}

export interface JevJobPanelProps {
  job: JevJobSummaryProp | null;
  busy: boolean;
  error?: string | null;
  onStart: () => void;
  onResume: () => void;
  onCancel: () => void;
}

/**
 * Reusable panel for teachers to trigger, monitor, and resume batch evaluation of student algorithms.
 *
 * Distinction note:
 * - `completedStudents`: Includes all students whose batch trials were evaluated, even if their algorithm
 *   was unexecutable (which is counted as `errorCount` on the student's result card).
 * - `failedStudents`: Represents infrastructure / API / system failures where the evaluation could not complete
 *   and needs a retry.
 */
export function JevJobPanel({
  job,
  busy,
  error,
  onStart,
  onResume,
  onCancel,
}: JevJobPanelProps) {
  const panelId = useId();
  const titleId = `${panelId}-title`;
  const progressId = `${panelId}-progress`;

  const status = (job?.status ?? "idle").toLowerCase();
  const isActive = status === "queued" || status === "running";
  const canResume = status === "failed" || status === "cancelled";
  // Allow starting a fresh run for any non-active state (including failed/cancelled, e.g. when changing mode from mock to live)
  const canStart = !isActive;

  const total = job?.totalStudents ?? 0;
  const completed = job?.completedStudents ?? 0;
  const failed = job?.failedStudents ?? 0;
  const skipped = job?.skippedStudents ?? 0;
  const processed = completed + failed + skipped;

  // Guard against division by zero
  const progressPct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  // Infrastructure / system error indicator (network transport, API rate limit, auth, timeout)
  const apiError = error || job?.lastError;
  const isMockMode = job?.mode === "mock";

  const getStatusBadge = () => {
    switch (status) {
      case "queued":
        return {
          label: "대기 중",
          badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
          dotClass: "bg-amber-500",
          icon: "⏳",
          description: "실행 대기열에 등록되었습니다. 순서대로 학생 알고리즘을 평가합니다.",
        };
      case "running":
        return {
          label: "실행 중",
          badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
          dotClass: "bg-indigo-500 animate-ping",
          icon: "⚡",
          description: "학생들의 알고리즘을 순차적으로 테스트하고 있습니다.",
        };
      case "completed":
        return {
          label: "실행 완료",
          badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
          dotClass: "bg-emerald-500",
          icon: "✅",
          description: "모든 학생 알고리즘의 평가 및 저장이 완료되었습니다.",
        };
      case "failed":
        return {
          label: "실행 실패 / 중단",
          badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
          dotClass: "bg-rose-500",
          icon: "⚠️",
          description: "작업 진행 중 서비스 오류가 발생하여 일시 정지되었습니다. 이어서 재개할 수 있습니다.",
        };
      case "cancelled":
        return {
          label: "작업 취소됨",
          badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
          dotClass: "bg-slate-400",
          icon: "⏹️",
          description: "실행이 취소되었습니다. 저장된 위치부터 다시 이어서 실행할 수 있습니다.",
        };
      default:
        return {
          label: "미실행",
          badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
          dotClass: "bg-slate-400",
          icon: "💤",
          description: "종료된 라운드의 모든 학생 제출 알고리즘을 AI로 일괄 실행 및 검증합니다.",
        };
    }
  };

  const statusInfo = getStatusBadge();

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4"
    >
      {/* Header with Title, Mode, and Status Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">
            🤖
          </span>
          <div>
            <h3 id={titleId} className="text-sm font-bold text-slate-900">
              AI 알고리즘 일괄 실행 관리
            </h3>
            <p className="text-[11px] text-slate-500">
              학생들이 제출한 알고리즘을 AI가 다양한 무작위 배치에서 시뮬레이션합니다.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {/* Mock Mode Indicator */}
          {job && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                isMockMode
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
            >
              {isMockMode ? "🧪 Mock 모드 (로컬 시뮬레이션)" : "🌐 Live AI 모드"}
            </span>
          )}

          {/* Job ID Pill */}
          {job && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-600">
              Job #{job.id}
            </span>
          )}

          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusInfo.badgeClass}`}
            role="status"
          >
            <span className="relative flex h-2 w-2">
              {isActive && (
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${statusInfo.dotClass}`} />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${statusInfo.dotClass.replace("animate-ping", "")}`} />
            </span>
            <span>
              {statusInfo.icon} {statusInfo.label}
            </span>
          </span>
        </div>
      </div>

      {/* Status Description Banner */}
      <p className="text-xs text-slate-600 leading-relaxed">{statusInfo.description}</p>

      {/* Progress Section */}
      {job && (
        <div className="space-y-2 rounded-xl bg-slate-50/70 p-3.5 border border-slate-100">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span id={progressId}>
              전체 진행률 ({processed} / {total}명 처리)
            </span>
            <span className="font-mono text-indigo-700 font-bold">{progressPct}%</span>
          </div>

          {/* Semantic Accessible Progress Element */}
          <progress
            id={`${panelId}-progress-bar`}
            aria-labelledby={progressId}
            className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:bg-indigo-600 [&::-moz-progress-bar]:bg-indigo-600 transition-all"
            value={processed}
            max={total > 0 ? total : 100}
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {progressPct}%
          </progress>

          {/* Student Breakdown Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="rounded-lg bg-emerald-50/80 border border-emerald-100 px-3 py-2 text-center">
              <span className="text-[10px] font-semibold text-emerald-800 block">완료 (평가 완료)</span>
              <span className="text-sm font-bold text-emerald-900">{completed}명</span>
            </div>
            <div className="rounded-lg bg-rose-50/80 border border-rose-100 px-3 py-2 text-center">
              <span className="text-[10px] font-semibold text-rose-800 block">서비스 오류 / 재시도 필요</span>
              <span className="text-sm font-bold text-rose-900">{failed}명</span>
            </div>
            <div className="rounded-lg bg-slate-100/80 border border-slate-200 px-3 py-2 text-center">
              <span className="text-[10px] font-semibold text-slate-600 block">제외 (미제출 등)</span>
              <span className="text-sm font-bold text-slate-800">{skipped}명</span>
            </div>
            <div className="rounded-lg bg-indigo-50/80 border border-indigo-100 px-3 py-2 text-center">
              <span className="text-[10px] font-semibold text-indigo-800 block">전체 대상</span>
              <span className="text-sm font-bold text-indigo-900">{total}명</span>
            </div>
          </div>
        </div>
      )}

      {/* Clarification for Failed Students: Infrastructure / System Failure */}
      {job && failed > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-950 flex items-start gap-2.5">
          <span className="text-base shrink-0 leading-none" aria-hidden="true">
            ⚠️
          </span>
          <div className="space-y-0.5">
            <p className="font-bold text-rose-900">
              서비스 오류 / 재시도 필요: {failed}명
            </p>
            <p className="text-[11px] text-rose-800 leading-relaxed">
              외부 AI 서비스 통신 장애 또는 시스템 중단으로 평가를 마치지 못한 학생입니다. 학생의 알고리즘 오류가 아니며, [이어서 실행]을 눌러 재시도할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* Infrastructure / API Problem Alert */}
      {apiError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-950 space-y-1"
        >
          <div className="flex items-center gap-1.5 font-bold text-rose-900">
            <span aria-hidden="true">⚠️</span>
            <span>AI 실행을 진행하지 못했습니다</span>
          </div>
          <p className="leading-relaxed font-mono text-[11px] bg-rose-100/60 p-2 rounded border border-rose-200">
            {apiError}
          </p>
          <p className="text-[11px] text-rose-700">
            안내 내용을 확인한 뒤 다시 시도하세요. 완료한 실행 결과는 그대로 보존됩니다.
          </p>
        </div>
      )}

      {/* Resumable Persisted Work Note (No Scheduled Daemon Promise) */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 text-[11px] text-slate-600 flex items-start gap-2">
        <span className="shrink-0 text-sm" aria-hidden="true">
          ℹ️
        </span>
        <p className="leading-relaxed">
          <strong>실행 방식 안내:</strong> 백그라운드 자동 스케줄러가 아닌 <strong>재개 가능한 영속 작업(Resumable Persisted Work)</strong>으로 구동됩니다. 화면이 열려 있는 동안 순차적으로 실행을 갱신하며, 창을 닫아도 지금까지의 결과는 데이터베이스에 안전하게 보존되어 언제든 이어서 실행할 수 있습니다.
        </p>
      </div>

      {/* Interactive Action Controls */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-100">
        {/* Cancel active job */}
        {isActive && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-busy={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span aria-hidden="true">⏹️</span>
            <span>{busy ? "취소 요청 중..." : "실행 일시 정지 (취소)"}</span>
          </button>
        )}

        {/* Retry / Resume failed or cancelled job */}
        {canResume && (
          <button
            type="button"
            onClick={onResume}
            disabled={busy}
            aria-busy={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span aria-hidden="true">▶️</span>
            <span>{busy ? "재개 요청 중..." : "이어서 실행 (재시도)"}</span>
          </button>
        )}

        {/* Start new run (allowed whenever not actively running, e.g. idle, completed, or mode-switch after failure) */}
        {canStart && (
          <button
            type="button"
            onClick={onStart}
            disabled={busy}
            aria-busy={busy}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-xs focus-visible:outline-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              canResume
                ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-slate-600"
                : "bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:outline-indigo-600"
            }`}
          >
            <span aria-hidden="true">🚀</span>
            <span>
              {busy
                ? "시작 요청 중..."
                : job?.status === "completed"
                ? "AI 일괄 실행 다시 시작"
                : canResume
                ? "새로 시작"
                : "AI 일괄 실행 시작"}
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
