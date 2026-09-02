"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { StudentLoginCard } from "@/components/StudentLoginCard";
import { AlgorithmReader } from "@/components/execute/AlgorithmReader";
import { CoinsViewer } from "@/components/execute/CoinsViewer";
import { CardsViewer } from "@/components/execute/CardsViewer";
import { JosephusViewer } from "@/components/execute/JosephusViewer";
import { PancakeViewer } from "@/components/execute/PancakeViewer";
import { ActionLogViewer } from "@/components/execute/ActionLogViewer";
import { PROBLEM_LABELS, PROBLEM_ICONS, type ProblemType } from "@/lib/problemMeta";

type Attempt = {
  id: number;
  problemType: ProblemType;
  algorithmText: string;
  input: Record<string, unknown>;
  state: Record<string, unknown>;
  actionLog: { at: string; type: string; action?: string; params?: Record<string, unknown>; result?: unknown; reason?: string }[];
  actionCount: number;
  unexecutableFlag: boolean;
  unexecutableReason?: string | null;
  status: "in_progress" | "submitted" | "evaluated";
  finalAnswer: number | null;
  correctAnswer?: number;
  referenceActionCount?: number;
  isCorrect?: boolean | null;
};

type AssignResponse =
  | { status: "waiting" }
  | { status: "finished" }
  | { status: "noneAvailable" }
  | { status: "ready"; resumed: boolean; attempt: Attempt };

export default function ExecutePage() {
  const [studentKey, setStudentKey] = useState<string | null>(null);

  const [phase, setPhase] = useState<
    "checking" | "login" | "waiting" | "finished" | "noneAvailable" | "running" | "result"
  >("checking");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionResumed, setSessionResumed] = useState(false);

  const requestAssignment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/execute/assign", { method: "POST" });
      const data = (await res.json()) as AssignResponse & { error?: string };
      if (res.status === 401) {
        setStudentKey(null);
        setPhase("login");
        setError("로그인 세션이 만료되었습니다. 안전한 수업 진행을 위해 다시 로그인해주세요.");
        return;
      }
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "요청에 실패했습니다.");

      if (data.status === "ready") {
        setAttempt(data.attempt);
        setPhase(data.attempt.status === "in_progress" ? "running" : "result");
        if (data.resumed) {
          setSessionResumed(true);
        }
      } else {
        setPhase(data.status);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount, ask the server (via the session cookie) who we are — no
  // client-held studentKey is trusted for this anymore.
  useEffect(() => {
    let ignore = false;
    fetch("/api/student/me")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }: { ok: boolean; data: { studentKey?: string } }) => {
        if (ignore) return;
        if (ok && data.studentKey) {
          setStudentKey(data.studentKey);
          requestAssignment();
        } else {
          setPhase("login");
        }
      })
      .catch(() => {
        if (!ignore) setPhase("login");
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-polling for "waiting" and "noneAvailable" states
  useEffect(() => {
    if ((phase === "waiting" || phase === "noneAvailable") && studentKey) {
      const interval = setInterval(() => {
        requestAssignment();
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [phase, studentKey, requestAssignment]);

  async function handleLogin(courseCode: string, studentId: string, name: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseCode, studentId, name, consent: true }),
      });
      const data = (await res.json()) as { studentKey?: string; error?: string };
      if (!res.ok || !data.studentKey) {
        throw new Error(data.error ?? "로그인에 실패했습니다.");
      }
      setStudentKey(data.studentKey);
      await requestAssignment();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setLoading(false);
    }
  }

  function handleLogout() {
    setStudentKey(null);
    setPhase("login");
    setAttempt(null);
    fetch("/api/student/logout", { method: "POST" }).catch(() => {
      // ignore network error on logout
    });
  }

  async function handleAction(action: string, params: Record<string, unknown>) {
    if (!attempt) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/execute/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: attempt.id, action, params }),
      });
      if (res.status === 401) {
        setStudentKey(null);
        setPhase("login");
        setError("로그인 세션이 만료되었습니다. 안전한 수업 진행을 위해 다시 로그인해주세요.");
        return;
      }
      const data = (await res.json()) as { attempt?: Attempt; error?: string };
      if (!res.ok || !data.attempt) {
        throw new Error(data.error ?? "행동을 적용할 수 없습니다.");
      }
      setAttempt(data.attempt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitFinalAnswer(finalAnswer: number) {
    if (!attempt) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/execute/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: attempt.id, finalAnswer }),
      });
      if (res.status === 401) {
        setStudentKey(null);
        setPhase("login");
        setError("로그인 세션이 만료되었습니다. 안전한 수업 진행을 위해 다시 로그인해주세요.");
        return;
      }
      const data = (await res.json()) as { attempt?: Attempt; error?: string };
      if (!res.ok || !data.attempt) {
        throw new Error(data.error ?? "제출에 실패했습니다.");
      }
      setAttempt(data.attempt);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (phase === "checking") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="mx-auto flex flex-1 w-full items-center justify-center px-4 py-16">
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs"
          >
            <div
              className="h-9 w-9 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-bold text-slate-800">
                로그인 세션 및 배정 과제를 확인하고 있습니다...
              </p>
              <p className="text-xs text-slate-400 mt-1">
                잠시만 기다리시면 실행 화면으로 연결됩니다.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "login" || !studentKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="mx-auto flex flex-1 w-full items-center justify-center px-4 py-12">
          <StudentLoginCard
            title="2단계 · 인간 컴퓨터 실행"
            subtitle="수업 코드와 학번, 이름을 입력해 다른 학생의 알고리즘을 실행하세요."
            stepNumber="2단계"
            onLogin={handleLogin}
            loading={loading}
            error={error}
          />
        </main>
      </div>
    );
  }

  if (phase === "waiting") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar currentStudentKey={studentKey} onLogout={handleLogout} />
        <main className="mx-auto flex flex-1 w-full items-center justify-center px-4 py-16">
          <div className="max-w-md w-full rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-xs space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-3xl text-amber-600 animate-pulse">
              ⏳
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              아직 2단계 시작 전입니다
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              교사가 학급 전체에 <strong>2단계를 활성화</strong>하면 자동으로 실행 화면이 열립니다. 잠시 대기해주세요.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => requestAssignment()}
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 py-2.5 px-4 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? "확인 중..." : "지금 바로 확인 (자동 새로고침 중)"}
              </button>
              <Link
                href="/write"
                className="text-xs text-blue-600 hover:underline pt-1"
              >
                ← 1단계 작성 화면으로 돌아가기
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "noneAvailable") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar currentStudentKey={studentKey} onLogout={handleLogout} />
        <main className="mx-auto flex flex-1 w-full items-center justify-center px-4 py-16">
          <div className="max-w-md w-full rounded-2xl border border-blue-200 bg-white p-8 text-center shadow-xs space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl text-blue-600 animate-bounce">
              🔍
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              준비된 알고리즘을 기다리는 중입니다
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              배정된 문제 유형의 알고리즘을 다른 학생이 아직 제출하는 중입니다. 제출되는 즉시 자동으로 연결됩니다.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => requestAssignment()}
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 py-2.5 px-4 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? "확인 중..." : "다시 확인 (자동 새로고침 중)"}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar currentStudentKey={studentKey} onLogout={handleLogout} />
        <main className="mx-auto flex flex-1 w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center space-y-6">
          <div className="overflow-hidden w-full rounded-3xl border border-emerald-200 bg-linear-to-b from-emerald-50 to-white p-8 shadow-sm space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-3xl text-white shadow-xs">
              🎓
            </div>
            <h2 className="text-2xl font-black text-slate-900">
              오늘의 알고리즘 실행을 모두 마쳤습니다!
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              배정된 2회의 인간 컴퓨터 실행과 평가를 훌륭하게 완수했습니다. 여러분의 실행 결과는 작성자에게 전달되며, 교사의 마무리 토론에서 다루어집니다.
            </p>

            <div className="pt-4 border-t border-emerald-100/80 grid gap-3 sm:grid-cols-2 text-left text-xs bg-emerald-50/50 p-4 rounded-2xl">
              <div className="space-y-1">
                <span className="font-bold text-emerald-950 block">💡 마무리 생각거리:</span>
                <p className="text-slate-600 leading-relaxed">
                  내가 쓸 때는 당연하다고 생각했던 것과, 실행자가 실제로 막혔던 부분에 어떤 차이가 있었나요?
                </p>
              </div>
              <div className="space-y-1">
                <span className="font-bold text-emerald-950 block">⚖️ 재현성의 핵심:</span>
                <p className="text-slate-600 leading-relaxed">
                  결과가 맞았다고 해서 항상 완벽한 알고리즘일까요? 우연히 맞았을 가능성은 없었을까요?
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <Link
                href="/write"
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-50 transition"
              >
                ← 내 알고리즘 작성 화면 확인하기
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!attempt) return null;

  const label = PROBLEM_LABELS[attempt.problemType];
  const icon = PROBLEM_ICONS[attempt.problemType];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentStudentKey={studentKey} onLogout={handleLogout} />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        {/* Top Problem Header */}
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xl shadow-2xs">
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  2단계 · 인간 컴퓨터 실행 중
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900">
                {label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500">
              실행자: <strong className="text-slate-800">{studentKey}</strong>
            </span>
          </div>
        </header>

        {/* Resumed Session Alert Banner */}
        {sessionResumed && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-blue-200 bg-blue-50/95 p-3.5 sm:p-4 shadow-xs flex items-center justify-between gap-3 text-xs text-blue-900"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl" aria-hidden="true">⚡</span>
              <div>
                <span className="font-bold block text-xs sm:text-sm">진행 중이던 실행 세션이 복구되었습니다</span>
                <span className="text-[11px] sm:text-xs text-blue-700">
                  이전에 중단되었던 위치와 누적 행동 기록({attempt.actionCount}회)이 유지되어 있습니다. 이어서 실행하세요.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSessionResumed(false)}
              className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
              aria-label="세션 복구 알림 닫기"
            >
              확인 ✕
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 shadow-xs flex items-center gap-2"
          >
            <span aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {phase === "running" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (5 cols): Algorithm Text & Checklist */}
            <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
              <AlgorithmReader algorithmText={attempt.algorithmText} />
            </div>

            {/* Right Column (7 cols): Interactive Simulation Canvas, Action Log & Submit */}
            <div className="lg:col-span-7 space-y-6">
              {/* Problem-Specific Interactive Visualizer */}
              {attempt.problemType === "12coins" && (
                <CoinsViewer
                  input={attempt.input}
                  state={attempt.state}
                  runAction={handleAction}
                  loading={loading}
                />
              )}

              {attempt.problemType === "card" && (
                <CardsViewer
                  input={attempt.input}
                  state={attempt.state}
                  runAction={handleAction}
                  loading={loading}
                />
              )}

              {attempt.problemType === "josephus" && (
                <JosephusViewer
                  input={attempt.input}
                  state={attempt.state}
                  runAction={handleAction}
                  loading={loading}
                />
              )}

              {attempt.problemType === "pancake" && (
                <PancakeViewer
                  input={attempt.input}
                  state={attempt.state}
                  runAction={handleAction}
                  loading={loading}
                />
              )}

              {/* Action Log Viewer */}
              <ActionLogViewer
                log={attempt.actionLog}
                count={attempt.actionCount}
                referenceCount={attempt.referenceActionCount}
              />

              {/* Final Answer Submission Form Card */}
              <FinalAnswerForm
                problemType={attempt.problemType}
                onSubmit={handleSubmitFinalAnswer}
                loading={loading}
              />
            </div>
          </div>
        )}

        {phase === "result" && (
          <ResultAndEvaluationPanel
            attempt={attempt}
            onNextRound={() => requestAssignment()}
            loading={loading}
          />
        )}
      </main>
    </div>
  );
}

function FinalAnswerForm({
  problemType,
  onSubmit,
  loading,
}: {
  problemType: ProblemType;
  onSubmit: (ans: number) => Promise<void>;
  loading: boolean;
}) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function getHelperInfo(type: ProblemType) {
    switch (type) {
      case "12coins":
        return {
          placeholder: "가짜 동전 번호 (1~12)",
          hint: "무게가 다른 동전의 번호 하나를 숫자로 입력하세요.",
        };
      case "card":
        return {
          placeholder: "카드 위치 번호 (1~N) 또는 0",
          hint: "목표 숫자가 있는 카드의 번호(1~N)를 입력하세요. 배열에 없으면 0을 입력하세요.",
        };
      case "josephus":
        return {
          placeholder: "최후 생존자 번호",
          hint: "마지막까지 살아남은 한 사람의 번호를 숫자로 입력하세요.",
        };
      case "pancake":
        return {
          placeholder: "정렬된 순서 (예: 12345)",
          hint: "정렬 완료 후 맨 위부터 맨 아래까지의 순서를 이어붙인 숫자로 입력하세요. (예: 12345)",
        };
    }
  }

  const { placeholder, hint } = getHelperInfo(problemType);

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(val.trim());
    if (!Number.isFinite(num)) {
      setErr("숫자를 올바르게 입력해주세요.");
      return;
    }
    setErr(null);
    await onSubmit(num);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">🏁</span>
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            최종 답 제출 및 자동 채점
          </h3>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-2 pt-1">
        <input
          type="number"
          required
          aria-label="최종 답안 입력"
          className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden"
          placeholder={placeholder}
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading || !val.trim()}
          className="rounded-xl bg-slate-900 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer whitespace-nowrap"
        >
          {loading ? "채점 중..." : "최종 답 제출 및 채점하기 ➔"}
        </button>
      </form>

      {err && <p className="text-xs text-rose-600 font-bold">{err}</p>}
    </div>
  );
}

function ResultAndEvaluationPanel({
  attempt,
  onNextRound,
  loading,
}: {
  attempt: Attempt;
  onNextRound: () => void;
  loading: boolean;
}) {
  const [clarityRating, setClarityRating] = useState<number | null>(null);
  const [accuracyRating, setAccuracyRating] = useState<number | null>(null);
  const [efficiencyRating, setEfficiencyRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  const [submitted, setSubmitted] = useState(attempt.status === "evaluated");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCorrect = attempt.isCorrect;
  const trimmed = feedbackText.trim();
  const isValid =
    clarityRating !== null &&
    accuracyRating !== null &&
    efficiencyRating !== null &&
    trimmed.length >= 2 &&
    trimmed.length <= 200;

  async function handleEvaluationSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clarityRating || !accuracyRating || !efficiencyRating) {
      setError("명확성, 정확성, 효율성 평점을 모두 선택해주세요.");
      return;
    }
    if (trimmed.length < 2) {
      setError("피드백을 최소 2자 이상 적어주세요.");
      return;
    }
    if (trimmed.length > 200) {
      setError("피드백은 200자 이하로 적어주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const couldFollowFully = clarityRating >= 3;
    const hadAmbiguity = clarityRating <= 2;
    const consideredCorrect = accuracyRating >= 3;

    try {
      const res = await fetch("/api/execute/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: attempt.id,
          clarityRating,
          accuracyRating,
          efficiencyRating,
          subjectiveFeedback: trimmed,
          couldFollowFully,
          unexecutablePoint: attempt.unexecutableReason ?? "",
          hadAmbiguity,
          ambiguityNote: trimmed,
          consideredCorrect,
          correctnessReason: trimmed,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "평가 제출에 실패했습니다.");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      {/* Result Card */}
      <section
        className={`overflow-hidden rounded-2xl border p-6 shadow-sm space-y-4 ${
          isCorrect
            ? "border-emerald-200 bg-linear-to-b from-emerald-50 to-white"
            : "border-rose-200 bg-linear-to-b from-rose-50 to-white"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{isCorrect ? "🎯" : "❌"}</span>
            <div>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  isCorrect
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {isCorrect ? "정답 일치 (O)" : "정답 불일치 (X)"}
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">
                {isCorrect
                  ? "알고리즘이 성공적으로 재현되었습니다!"
                  : "알고리즘 실행 결과가 실제 정답과 다릅니다."}
              </h2>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div>
            <span className="text-slate-400 block text-[10px]">내가 제출한 답</span>
            <span className="text-lg font-black text-slate-900">
              {attempt.finalAnswer}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">실제 문제의 정답</span>
            <span className="text-lg font-black text-blue-600">
              {attempt.correctAnswer}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-slate-400 block text-[10px]">사용한 행동 횟수</span>
            <span className="text-sm font-bold text-slate-800">
              {attempt.actionCount}회{" "}
              <span className="text-slate-400 text-xs font-normal">
                (기준 {attempt.referenceActionCount}회)
              </span>
            </span>
          </div>
        </div>

        {attempt.unexecutableFlag && (
          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200">
            <strong>⚠️ 실행 중 신고된 실행 불가 사유:</strong> {attempt.unexecutableReason}
          </div>
        )}
      </section>

      {/* 3-Dimension Star Ratings & Subjective Feedback Form */}
      {!submitted ? (
        <form
          onSubmit={handleEvaluationSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5"
        >
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              ⭐ 알고리즘 다면 평가 (전부 필수)
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              실행한 알고리즘의 명확성, 정확성, 효율성을 1~5점으로 평가하고 한 줄 소감을 남겨주세요.
            </p>
          </div>

          {/* 1. Clarity Rating */}
          <RatingField
            idPrefix="clarity"
            label="1. 명확성 (Clarity)"
            description="지시가 모호하지 않고 한 단계씩 그대로 따라 할 수 있었나요?"
            value={clarityRating}
            onChange={setClarityRating}
          />

          {/* 2. Accuracy Rating */}
          <RatingField
            idPrefix="accuracy"
            label="2. 정확성 (Accuracy)"
            description="논리적 결함이나 예외 없이 올바른 결과를 도출했나요?"
            value={accuracyRating}
            onChange={setAccuracyRating}
          />

          {/* 3. Efficiency Rating */}
          <RatingField
            idPrefix="efficiency"
            label="3. 효율성 (Efficiency)"
            description="불필요한 반복이나 비효율적 조작 없이 문제를 해결했나요?"
            value={efficiencyRating}
            onChange={setEfficiencyRating}
          />

          {/* 4. Subjective Feedback */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <label htmlFor="subjective-feedback" className="text-xs font-bold text-slate-800 block">
                4. 주관식 한 줄 피드백 <span className="text-rose-500" aria-hidden="true">*</span>
              </label>
              <span
                id="feedback-char-count"
                className={`font-mono text-[11px] font-semibold ${
                  trimmed.length >= 2 && trimmed.length <= 200
                    ? "text-emerald-600"
                    : trimmed.length > 200
                    ? "text-rose-600 font-bold"
                    : "text-slate-400"
                }`}
              >
                {trimmed.length} / 200자 (2~200자 필수)
                {trimmed.length > 0 && trimmed.length < 2 && " (최소 2자 이상 필요)"}
              </span>
            </div>
            <p id="subjective-feedback-desc" className="text-[11px] text-slate-500">
              실행하면서 어려웠거나 고치면 좋을 점을 구체적으로 한 문장으로 적어주세요.
            </p>

            <textarea
              id="subjective-feedback"
              required
              rows={3}
              maxLength={200}
              aria-describedby="subjective-feedback-desc feedback-char-count"
              aria-invalid={trimmed.length > 0 && (trimmed.length < 2 || trimmed.length > 200)}
              className="w-full min-h-[80px] rounded-xl border border-slate-300 bg-white p-3 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 focus:outline-hidden"
              placeholder="예: 3단계에서 조건 분기가 명확해서 따라 하기 쉬웠어요 / 2단계에서 크기를 비교한 후 어디로 갈지 설명이 부족해서 헷갈렸어요"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" aria-live="assertive" className="text-xs text-rose-600 font-bold flex items-center gap-1">
              <span aria-hidden="true">⚠️</span>
              <span>{error}</span>
            </p>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={submitting || !isValid}
              className="w-full rounded-xl bg-slate-900 py-3 px-4 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-hidden"
            >
              <span>{submitting ? "제출 중..." : "⭐ 평가 및 피드백 제출 완료하기 ➔"}</span>
            </button>
          </div>
        </form>
      ) : (
        /* Evaluation Submitted -> Next Action Button */
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-xs text-center space-y-4">
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 text-emerald-600 font-bold text-sm">
            <span aria-hidden="true">✓</span>
            <span>평가와 피드백이 성공적으로 제출되었습니다!</span>
          </div>

          <button
            type="button"
            onClick={onNextRound}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-8 py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-hidden"
          >
            {loading ? "확인 중..." : "다음 배정된 알고리즘 실행하기 (2/2) ➔"}
          </button>
        </div>
      )}
    </div>
  );
}

function RatingField({
  idPrefix,
  label,
  description,
  value,
  onChange,
}: {
  idPrefix: string;
  label: string;
  description: string;
  value: number | null;
  onChange: (val: number) => void;
}) {
  const ratingLabels: Record<number, string> = {
    1: "1점 (매우 미흡)",
    2: "2점 (다소 미흡)",
    3: "3점 (보통)",
    4: "4점 (우수)",
    5: "5점 (매우 우수)",
  };

  return (
    <fieldset className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <legend className="text-xs font-bold text-slate-800">
          {label} <span className="text-rose-500" aria-hidden="true">*</span>
        </legend>
        <span className="text-[11px] font-semibold text-blue-700">
          {value ? ratingLabels[value] : "점수를 선택하세요 (1~5점)"}
        </span>
      </div>
      <p className="text-[11px] text-slate-500">{description}</p>

      <div
        role="radiogroup"
        aria-label={`${label} 1점에서 5점 별점 선택`}
        className="grid grid-cols-5 gap-1.5 pt-1"
      >
        {[1, 2, 3, 4, 5].map((score) => {
          const isSelected = value !== null && value >= score;
          const isExact = value === score;
          const radioId = `${idPrefix}-score-${score}`;

          return (
            <label
              key={score}
              htmlFor={radioId}
              className={`group flex h-11 flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 rounded-xl border text-xs font-bold transition cursor-pointer select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 has-[:focus-visible]:ring-offset-1 ${
                isExact
                  ? "border-blue-600 bg-blue-600 text-white shadow-xs"
                  : isSelected
                  ? "border-amber-400 bg-amber-50 text-amber-900"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              <input
                id={radioId}
                type="radio"
                name={idPrefix}
                value={score}
                checked={value === score}
                onChange={() => onChange(score)}
                className="sr-only"
                aria-label={`${label} ${score}점`}
              />
              <span className={`text-base leading-none ${isSelected ? "text-amber-400 group-hover:scale-110 transition" : "text-slate-300"}`}>
                ★
              </span>
              <span className="text-[11px] sm:text-xs">{score}점</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
