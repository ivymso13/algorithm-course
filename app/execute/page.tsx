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
import { UnexecutableBox } from "@/components/execute/UnexecutableBox";
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
  const [studentKey, setStudentKey] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem("algo_student_key");
    } catch {
      return null;
    }
  });

  const [phase, setPhase] = useState<
    "login" | "waiting" | "finished" | "noneAvailable" | "running" | "result"
  >("login");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestAssignment = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/execute/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentKey: key }),
      });
      const data = (await res.json()) as AssignResponse & { error?: string };
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "요청에 실패했습니다.");

      if (data.status === "ready") {
        setAttempt(data.attempt);
        setPhase(data.attempt.status === "in_progress" ? "running" : "result");
      } else {
        setPhase(data.status);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-restore login on mount
  useEffect(() => {
    let ignore = false;
    if (studentKey && phase === "login") {
      fetch("/api/execute/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentKey }),
      })
        .then((res) => res.json())
        .then((data: AssignResponse & { error?: string }) => {
          if (!ignore) {
            if (data.status === "ready") {
              setAttempt(data.attempt);
              setPhase(data.attempt.status === "in_progress" ? "running" : "result");
            } else if (data.status) {
              setPhase(data.status);
            }
          }
        })
        .catch((err) => {
          if (!ignore) {
            setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
          }
        });
    }
    return () => {
      ignore = true;
    };
  }, [studentKey, phase]);

  // Auto-polling for "waiting" and "noneAvailable" states
  useEffect(() => {
    if ((phase === "waiting" || phase === "noneAvailable") && studentKey) {
      const interval = setInterval(() => {
        requestAssignment(studentKey);
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [phase, studentKey, requestAssignment]);

  async function handleLogin(studentId: string, name: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, name }),
      });
      const data = (await res.json()) as { studentKey?: string; error?: string };
      if (!res.ok || !data.studentKey) {
        throw new Error(data.error ?? "로그인에 실패했습니다.");
      }
      setStudentKey(data.studentKey);
      try {
        sessionStorage.setItem("algo_student_key", data.studentKey);
      } catch {
        // ignore storage error
      }
      await requestAssignment(data.studentKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setLoading(false);
    }
  }

  function handleLogout() {
    setStudentKey(null);
    setPhase("login");
    setAttempt(null);
    try {
      sessionStorage.removeItem("algo_student_key");
    } catch {
      // ignore storage error
    }
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

  async function handleUnexecutable(reason: string) {
    if (!attempt) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/execute/unexecutable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: attempt.id, reason }),
      });
      const data = (await res.json()) as { attempt?: Attempt; error?: string };
      if (!res.ok || !data.attempt) {
        throw new Error(data.error ?? "기록할 수 없습니다.");
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

  if (phase === "login" || !studentKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="mx-auto flex flex-1 w-full items-center justify-center px-4 py-12">
          <StudentLoginCard
            title="2단계 · 인간 컴퓨터 실행"
            subtitle="학번과 이름을 입력해 다른 학생의 알고리즘을 실행하세요."
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
                onClick={() => studentKey && requestAssignment(studentKey)}
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
                onClick={() => studentKey && requestAssignment(studentKey)}
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

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 shadow-xs">
            ⚠️ {error}
          </div>
        )}

        {phase === "running" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (5 cols): Algorithm Text & Checklist & Unexecutable Reporter */}
            <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
              <AlgorithmReader algorithmText={attempt.algorithmText} />

              <UnexecutableBox
                unexecutableFlag={attempt.unexecutableFlag}
                unexecutableReason={attempt.unexecutableReason}
                onRecord={handleUnexecutable}
                loading={loading}
              />
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
            onNextRound={() => requestAssignment(studentKey)}
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
  const [couldFollowFully, setCouldFollowFully] = useState(true);
  const [unexecutablePoint, setUnexecutablePoint] = useState("");
  const [hadAmbiguity, setHadAmbiguity] = useState(false);
  const [ambiguityNote, setAmbiguityNote] = useState("");
  const [consideredCorrect, setConsideredCorrect] = useState(true);
  const [correctnessReason, setCorrectnessReason] = useState("");

  const [submitted, setSubmitted] = useState(attempt.status === "evaluated");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCorrect = attempt.isCorrect;

  async function handleEvaluationSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/execute/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: attempt.id,
          couldFollowFully,
          unexecutablePoint,
          hadAmbiguity,
          ambiguityNote,
          consideredCorrect,
          correctnessReason,
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

      {/* 3-Question Post-Execution Evaluation Form */}
      {!submitted ? (
        <form
          onSubmit={handleEvaluationSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6"
        >
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              📝 실행자 평가 문항 (3문항)
            </h3>
            <p className="text-xs text-slate-500">
              작성자의 알고리즘을 평가해주세요. 이 내용은 작성자 피드백과 교사 대시보드에 기록됩니다.
            </p>
          </div>

          {/* Q1 */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-800 block">
              1. 알고리즘을 끝까지 그대로 실행할 수 있었습니까?
            </span>
            <div className="flex gap-4 text-xs font-medium">
              <label
                htmlFor="couldFollow-yes"
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  id="couldFollow-yes"
                  type="radio"
                  name="couldFollow"
                  checked={couldFollowFully}
                  onChange={() => setCouldFollowFully(true)}
                  className="text-blue-600"
                />
                <span>예 (끝까지 수행 가능)</span>
              </label>
              <label
                htmlFor="couldFollow-no"
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  id="couldFollow-no"
                  type="radio"
                  name="couldFollow"
                  checked={!couldFollowFully}
                  onChange={() => setCouldFollowFully(false)}
                  className="text-blue-600"
                />
                <span>아니오 (중간에 막힘)</span>
              </label>
            </div>
            {!couldFollowFully && (
              <input
                type="text"
                required
                aria-label="실행 불가 지점"
                className="mt-2 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden"
                placeholder="실행할 수 없었던 지점이나 단계를 적어주세요 (예: 2단계에서 평형일 때 어디로 가는지 없음)"
                value={unexecutablePoint}
                onChange={(e) => setUnexecutablePoint(e.target.value)}
              />
            )}
          </div>

          {/* Q2 */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-800 block">
              2. 애매해서 실행자가 임의로 해석해야 했던 부분이 있었습니까?
            </span>
            <div className="flex gap-4 text-xs font-medium">
              <label
                htmlFor="ambiguity-no"
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  id="ambiguity-no"
                  type="radio"
                  name="ambiguity"
                  checked={!hadAmbiguity}
                  onChange={() => setHadAmbiguity(false)}
                  className="text-blue-600"
                />
                <span>없음 (모든 지시가 명확함)</span>
              </label>
              <label
                htmlFor="ambiguity-yes"
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  id="ambiguity-yes"
                  type="radio"
                  name="ambiguity"
                  checked={hadAmbiguity}
                  onChange={() => setHadAmbiguity(true)}
                  className="text-blue-600"
                />
                <span>있음 (추측해서 실행함)</span>
              </label>
            </div>
            {hadAmbiguity && (
              <input
                type="text"
                required
                aria-label="임의 해석 메모"
                className="mt-2 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden"
                placeholder="어디가 애매해서 어떻게 추측했는지 짧게 적어주세요"
                value={ambiguityNote}
                onChange={(e) => setAmbiguityNote(e.target.value)}
              />
            )}
          </div>

          {/* Q3 */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-800 block">
              3. 이 알고리즘은 논리적으로 정확하다고 볼 수 있습니까? (우연히 맞았을 가능성 고려)
            </span>
            <div className="flex gap-4 text-xs font-medium">
              <label
                htmlFor="consideredCorrect-yes"
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  id="consideredCorrect-yes"
                  type="radio"
                  name="consideredCorrect"
                  checked={consideredCorrect}
                  onChange={() => setConsideredCorrect(true)}
                  className="text-blue-600"
                />
                <span>예 (논리적으로 정확함)</span>
              </label>
              <label
                htmlFor="consideredCorrect-no"
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  id="consideredCorrect-no"
                  type="radio"
                  name="consideredCorrect"
                  checked={!consideredCorrect}
                  onChange={() => setConsideredCorrect(false)}
                  className="text-blue-600"
                />
                <span>아니오 (우연히 맞았거나 논리 결함 있음)</span>
              </label>
            </div>
            <input
              type="text"
              aria-label="판단 근거"
              className="mt-2 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden"
              placeholder="판단 근거를 적어주세요 (선택 사항)"
              value={correctnessReason}
              onChange={(e) => setCorrectnessReason(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-xs text-rose-600 font-bold">⚠️ {error}</p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-blue-600 py-3 px-4 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
            >
              {submitting ? "평가 제출 중..." : "평가 제출 완료하기 ➔"}
            </button>
          </div>
        </form>
      ) : (
        /* Evaluation Submitted -> Next Action Button */
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-xs text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold text-sm">
            <span>✓</span>
            <span>평가가 성공적으로 제출되었습니다!</span>
          </div>

          <button
            type="button"
            onClick={onNextRound}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-8 py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
          >
            {loading ? "확인 중..." : "다음 배정된 알고리즘 실행하기 (2/2) ➔"}
          </button>
        </div>
      )}
    </div>
  );
}
