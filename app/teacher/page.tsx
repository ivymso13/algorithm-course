"use client";

import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { ProblemSandboxContainer } from "@/components/write/sandbox/ProblemSandboxContainer";
import { PROBLEM_LABELS, PROBLEM_ICONS, type ProblemType } from "@/lib/problemMeta";
import {
  WARMUP_ROUND_STATUS_LABELS,
  WARMUP_VOTE_ICONS,
  WARMUP_VOTE_LABELS,
  WARMUP_VOTE_TYPES,
  type WarmupRoundStatus,
  type WarmupVoteType,
} from "@/lib/warmupMeta";

type WarmupRoundSummary = {
  id: number;
  title: string;
  prompt: string;
  status: WarmupRoundStatus;
  submissionCount: number;
  voteCount: number;
  experienceCount: number;
};

type WarmupRoundDetail = {
  round: WarmupRoundSummary;
  items: {
    submission: { id: number; studentId: string; studentName: string; anonLabel: string; algorithmText: string };
    voteCounts: Record<WarmupVoteType, number>;
    experiences: { executorId: string; executorName: string; executable: boolean; feedback: string }[];
  }[];
};

type DashboardStudent = {
  studentKey: string;
  studentId: string;
  name: string;
  write: { problemType: ProblemType; submitted: boolean; submittedAt: string | null }[];
  execute: { problemType: ProblemType; executed: boolean; isCorrect: boolean | null; status: string | null }[];
  writeComplete: boolean;
};

type ReviewAttempt = {
  id: number;
  executorId: string;
  executorName: string;
  finalAnswer: number | null;
  correctAnswer: number;
  isCorrect: boolean | null;
  actionCount: number;
  referenceActionCount: number;
  unexecutableFlag: boolean;
  unexecutableReason: string | null;
  status: string;
  evaluationResponses: {
    couldFollowFully: boolean;
    unexecutablePoint: string;
    hadAmbiguity: boolean;
    ambiguityNote: string;
    consideredCorrect: boolean;
    correctnessReason: string;
    // Additive star-rating + short free-text fields. Absent on older
    // evaluation records and on any submission that didn't include them —
    // always treat as "별점 없음", never assume presence.
    clarityRating?: number;
    accuracyRating?: number;
    efficiencyRating?: number;
    subjectiveFeedback?: string;
  } | null;
};

type ReviewGroup = {
  problemType: ProblemType;
  items: {
    submission: { id: number; studentId: string; studentName: string; algorithmText: string };
    attempts: ReviewAttempt[];
  }[];
};

export default function TeacherPage() {
  const [password, setPassword] = useState("");

  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"warmup" | "dashboard" | "review" | "practice">("warmup");
  const [stage2Active, setStage2Active] = useState(false);
  const [course, setCourse] = useState<{ code: string; name: string; retentionDays: number } | null>(null);
  const [students, setStudents] = useState<DashboardStudent[]>([]);
  const [rounds, setRounds] = useState<WarmupRoundSummary[]>([]);
  const [roundDetail, setRoundDetail] = useState<WarmupRoundDetail | null>(null);
  const [roundDetailId, setRoundDetailId] = useState<number | null>(null);
  const [newRoundTitle, setNewRoundTitle] = useState("");
  const [newRoundPrompt, setNewRoundPrompt] = useState("");
  const [warmupBusy, setWarmupBusy] = useState(false);
  const [groups, setGroups] = useState<ReviewGroup[]>([]);
  const [selectedGroupType, setSelectedGroupType] = useState<ProblemType>("12coins");
  const [reviewFilter, setReviewFilter] = useState<"all" | "incorrect" | "ambiguous">("all");
  const [presentationMode, setPresentationMode] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setPassword(sessionStorage.getItem("algo_teacher_pw") || "");
      } catch {
        // ignore storage errors
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const authHeaders = useCallback((customPw?: string): HeadersInit => {
    return { "x-teacher-password": customPw || password };
  }, [password]);

  const loadWarmupRounds = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/warmup/rounds", { headers: authHeaders() });
      const data = (await res.json()) as { rounds?: WarmupRoundSummary[]; error?: string };
      if (res.ok) setRounds(data.rounds ?? []);
    } catch {
      // ignore — the warmup tab shows its own error state via the create/publish/close actions
    }
  }, [authHeaders]);

  const loadDashboardWithPw = useCallback(async (pw: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/dashboard", { headers: authHeaders(pw) });
      const data = (await res.json()) as {
        students?: DashboardStudent[];
        stage2Active?: boolean;
        course?: { code: string; name: string; retentionDays: number };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "불러오기에 실패했습니다.");
      setStudents(data.students ?? []);
      setStage2Active(Boolean(data.stage2Active));
      setCourse(data.course ?? null);
      setAuthed(true);
      try {
        sessionStorage.setItem("algo_teacher_pw", pw);
      } catch {
        // ignore storage error
      }
      loadWarmupRounds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증에 실패했습니다.");
      setAuthed(false);
      try {
        sessionStorage.removeItem("algo_teacher_pw");
      } catch {
        // ignore storage error
      }
    } finally {
      setLoading(false);
    }
  }, [authHeaders, loadWarmupRounds]);

  const loadDashboard = useCallback(async () => {
    await loadDashboardWithPw(password);
  }, [loadDashboardWithPw, password]);

  const loadReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/review", { headers: authHeaders() });
      const data = (await res.json()) as { groups?: ReviewGroup[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "불러오기에 실패했습니다.");
      setGroups(data.groups ?? []);
      setTab("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  async function handleCreateRound(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarmupBusy(true);
    try {
      const res = await fetch("/api/teacher/warmup/rounds", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ title: newRoundTitle.trim(), prompt: newRoundPrompt.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "라운드 생성에 실패했습니다.");
      setNewRoundTitle("");
      setNewRoundPrompt("");
      await loadWarmupRounds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "라운드 생성에 실패했습니다.");
    } finally {
      setWarmupBusy(false);
    }
  }

  async function handlePublishRound(roundId: number) {
    setError(null);
    setWarmupBusy(true);
    try {
      const res = await fetch("/api/teacher/warmup/publish", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ roundId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "공개에 실패했습니다.");
      await loadWarmupRounds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "공개에 실패했습니다.");
    } finally {
      setWarmupBusy(false);
    }
  }

  async function handleCloseRound(roundId: number) {
    if (!confirm("이 라운드를 종료하시겠습니까? 학생들은 더 이상 제출/투표/체험할 수 없습니다.")) return;
    setError(null);
    setWarmupBusy(true);
    try {
      const res = await fetch("/api/teacher/warmup/close", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ roundId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "종료에 실패했습니다.");
      await loadWarmupRounds();
      if (roundDetailId === roundId) await loadRoundDetail(roundId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "종료에 실패했습니다.");
    } finally {
      setWarmupBusy(false);
    }
  }

  const loadRoundDetail = useCallback(
    async (roundId: number) => {
      setRoundDetailId(roundId);
      try {
        const res = await fetch(`/api/teacher/warmup/round?id=${roundId}`, { headers: authHeaders() });
        const data = (await res.json()) as WarmupRoundDetail & { error?: string };
        if (res.ok) setRoundDetail(data);
      } catch {
        // ignore
      }
    },
    [authHeaders]
  );

  // Try auto-login on mount if password was stored
  useEffect(() => {
    let ignore = false;
    if (password && !authed) {
      fetch("/api/teacher/dashboard", { headers: { "x-teacher-password": password } })
        .then((res) => res.json())
        .then(
          (data: {
            students?: DashboardStudent[];
            stage2Active?: boolean;
            course?: { code: string; name: string; retentionDays: number };
            error?: string;
          }) => {
            if (!ignore) {
              if (!data.error) {
                setStudents(data.students ?? []);
                setStage2Active(Boolean(data.stage2Active));
                setCourse(data.course ?? null);
                setAuthed(true);
                loadWarmupRounds();
              }
            }
          }
        )
        .catch(() => {
          // ignore auto-login failure on mount
        });
    }
    return () => {
      ignore = true;
    };
  }, [password, authed, loadWarmupRounds]);

  // Auto-refresh interval
  useEffect(() => {
    if (!authed || !autoRefresh) return;
    const interval = setInterval(() => {
      if (tab === "warmup") {
        loadWarmupRounds();
        if (roundDetailId) loadRoundDetail(roundDetailId);
      } else if (tab === "dashboard") {
        loadDashboard();
      } else {
        loadReview();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [authed, autoRefresh, tab, roundDetailId, loadWarmupRounds, loadRoundDetail, loadDashboard, loadReview]);

  async function handleActivateStage2() {
    if (
      !confirm(
        "전체 학급에 2단계를 개방하시겠습니까? 학생들이 페이지 2(인간 컴퓨터 실행)에 접속할 수 있게 됩니다."
      )
    )
      return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/stage2", {
        method: "POST",
        headers: authHeaders(),
      });
      const data = (await res.json()) as { stage2Active?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "활성화에 실패했습니다.");
      setStage2Active(Boolean(data.stage2Active));
    } catch (err) {
      setError(err instanceof Error ? err.message : "활성화에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function regenerateCourseCode() {
    if (!confirm("수업 코드를 재발급하시겠습니까? 이전 코드로는 더 이상 새로 로그인할 수 없습니다 (이미 로그인한 학생의 세션은 유지됩니다).")) {
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/teacher/course", { method: "POST", headers: authHeaders() });
      const data = (await res.json()) as { course?: { code: string; name: string; retentionDays: number }; error?: string };
      if (!res.ok) throw new Error(data.error ?? "코드 재발급에 실패했습니다.");
      setCourse(data.course ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "코드 재발급에 실패했습니다.");
    }
  }

  async function exportExcel() {
    setError(null);
    try {
      const res = await fetch("/api/teacher/export", { headers: authHeaders() });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "엑셀 내보내기에 실패했습니다.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `algorithm-class-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "엑셀 다운로드에 실패했습니다.");
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="mx-auto flex flex-1 w-full items-center justify-center px-4 py-16">
          <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-2xl text-white shadow-xs">
                🔒
              </div>
              <h1 className="text-xl font-bold text-slate-900">
                교사용 관리 대시보드 로그인
              </h1>
              <p className="text-xs text-slate-500">
                선생님 전용 관리 화면입니다. 비밀번호를 입력해주세요.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadDashboard();
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="teacher-pw" className="text-xs font-semibold text-slate-700 block mb-1">
                  비밀번호
                </label>
                <input
                  id="teacher-pw"
                  type="password"
                  required
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 focus:outline-hidden"
                  placeholder="교사 비밀번호 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                  ⚠️ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password.trim()}
                className="w-full rounded-xl bg-slate-900 py-2.5 px-4 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? "확인 중..." : "대시보드 입장 ➔"}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // Summary Metrics calculations
  const totalStudents = students.length;
  const writeCompletedStudents = students.filter((s) => s.writeComplete).length;
  const executeAttemptedCount = students.reduce(
    (acc, s) => acc + s.execute.filter((e) => e.executed).length,
    0
  );
  const totalPossibleExecutions = totalStudents * 2;
  const correctExecutionCount = students.reduce(
    (acc, s) => acc + s.execute.filter((e) => e.executed && e.isCorrect).length,
    0
  );
  const accuracyRate =
    executeAttemptedCount > 0
      ? Math.round((correctExecutionCount / executeAttemptedCount) * 100)
      : 0;

  // Warmup Metrics
  const totalWarmupSubmissions = rounds.reduce((acc, r) => acc + r.submissionCount, 0);
  const totalWarmupVotes = rounds.reduce((acc, r) => acc + r.voteCount, 0);
  const totalWarmupExperiences = rounds.reduce((acc, r) => acc + r.experienceCount, 0);
  const activeWarmupRounds = rounds.filter((r) => r.status === "open").length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        {/* Top Control Bar */}
        <header className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold text-white">
                교사용 콘솔
              </span>
              {course && (
                <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-bold text-slate-800">
                  수업 코드: <span className="text-blue-700 font-black tracking-wider">{course.code}</span>
                </span>
              )}
            </div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
              알고리즘 수업 관리 콘솔
            </h1>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {course && (
              <button
                type="button"
                onClick={regenerateCourseCode}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                title="수업 코드를 재발급합니다"
              >
                코드 재발급
              </button>
            )}

            <button
              type="button"
              onClick={exportExcel}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
            >
              <span>📊</span>
              <span>엑셀 다운로드</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoRefresh((prev) => !prev)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-2xs transition cursor-pointer ${
                autoRefresh
                  ? "border-blue-400 bg-blue-50 text-blue-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {autoRefresh ? "🔄 자동 새로고침 ON" : "자동 새로고침 OFF"}
            </button>

            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem("algo_teacher_pw");
                setAuthed(false);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 hover:text-rose-600 transition cursor-pointer"
            >
              로그아웃
            </button>
          </div>
        </header>

        {/* Live Metrics Overview Cards */}
        {tab === "warmup" ? (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 block">
                등록 학생 수
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900">{totalStudents}명</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 block">
                워밍업 라운드
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-blue-600">{rounds.length}개</span>
                <span className="text-xs text-slate-400 font-medium">({activeWarmupRounds}개 진행 중)</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 block">
                누적 제출 건수
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-600">{totalWarmupSubmissions}건</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 block">
                추천 투표 · 체험
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900">
                {totalWarmupVotes}건 · {totalWarmupExperiences}건
              </span>
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  등록 학생 수
                </span>
                <span className="text-2xl font-black text-slate-900">{totalStudents}명</span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  1단계 작성 완료율
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-blue-600">
                    {writeCompletedStudents}
                  </span>
                  <span className="text-xs text-slate-400">/ {totalStudents}명</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  2단계 실행 완료 건수
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-emerald-600">
                    {executeAttemptedCount}
                  </span>
                  <span className="text-xs text-slate-400">/ {totalPossibleExecutions}건</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  평균 정답 재현율
                </span>
                <span className="text-2xl font-black text-slate-900">{accuracyRate}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-xs font-semibold text-slate-700">
                2단계(인간 컴퓨터 실행) 개방 제어:
              </span>
              <button
                type="button"
                onClick={handleActivateStage2}
                disabled={loading || stage2Active}
                className={`rounded-xl px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                  stage2Active
                    ? "bg-emerald-600 text-white cursor-default opacity-90"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {stage2Active ? "✓ 2단계 활성화 완료" : "🚀 2단계 전체 개방하기"}
              </button>
            </div>
          </section>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => {
              setTab("warmup");
              loadWarmupRounds();
            }}
            className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition cursor-pointer ${
              tab === "warmup"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            🔥 워밍업 문제 관리 (기본)
          </button>

          <span className="text-slate-300 hidden sm:inline">|</span>

          <button
            type="button"
            onClick={() => {
              setTab("dashboard");
              loadDashboard();
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              tab === "dashboard"
                ? "bg-slate-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            (이전) 4문제 현황
          </button>

          <button
            type="button"
            onClick={loadReview}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              tab === "review"
                ? "bg-slate-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            (이전) 토론 화면
          </button>

          <button
            type="button"
            onClick={() => setTab("practice")}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              tab === "practice"
                ? "bg-slate-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            (이전) 문제별 풀어보기
          </button>
        </div>

        {error && (
          <div role="alert" aria-live="assertive" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 shadow-xs">
            ⚠️ {error}
          </div>
        )}

        {/* TAB 0: Warm-up round management */}
        {tab === "warmup" && (
          <section className="space-y-4">
            {/* 1. Create Warmup Round */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
              <h2 className="text-sm font-bold text-slate-900">➕ 새 워밍업 문제 만들기</h2>
              <form onSubmit={handleCreateRound} className="space-y-2.5">
                <input
                  type="text"
                  required
                  maxLength={60}
                  placeholder="문제 제목 (예: 오늘의 워밍업 — 최댓값 찾기)"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 focus:outline-hidden"
                  value={newRoundTitle}
                  onChange={(e) => setNewRoundTitle(e.target.value)}
                />
                <textarea
                  required
                  rows={3}
                  maxLength={2000}
                  placeholder="문제 지시문 (학생 화면에 그대로 표시됩니다)"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 focus:outline-hidden"
                  value={newRoundPrompt}
                  onChange={(e) => setNewRoundPrompt(e.target.value)}
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={warmupBusy || !newRoundTitle.trim() || !newRoundPrompt.trim()}
                    className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
                  >
                    {warmupBusy ? "저장 중..." : "+ 라운드 만들기"}
                  </button>
                </div>
              </form>
            </div>

            {/* 2. Round List & Live Status */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">📊 라운드 목록 및 현황 ({rounds.length})</h2>
                <button
                  type="button"
                  onClick={loadWarmupRounds}
                  className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  새로고침
                </button>
              </div>

              {rounds.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-400">
                  아직 만든 라운드가 없습니다. 위에서 문제를 만들어 공개하세요.
                </div>
              ) : (
                <div className="space-y-3">
                  {rounds.map((round) => (
                    <div key={round.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              round.status === "open"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : round.status === "closed"
                                ? "bg-slate-100 text-slate-700 border border-slate-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            {WARMUP_ROUND_STATUS_LABELS[round.status]}
                          </span>
                          <span className="text-sm font-bold text-slate-900">{round.title}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {round.status === "draft" && (
                            <button
                              type="button"
                              onClick={() => handlePublishRound(round.id)}
                              disabled={warmupBusy}
                              className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                            >
                              🚀 공개하기
                            </button>
                          )}
                          {round.status === "open" && (
                            <button
                              type="button"
                              onClick={() => handleCloseRound(round.id)}
                              disabled={warmupBusy}
                              className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                            >
                              ⏹️ 라운드 종료
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (roundDetailId === round.id) {
                                setRoundDetailId(null);
                              } else {
                                loadRoundDetail(round.id);
                              }
                            }}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            {roundDetailId === round.id ? "현황 닫기 ▲" : `현황 보기 (${round.submissionCount}명) ▼`}
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2">{round.prompt}</p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                        <span className="font-semibold text-slate-700">제출 {round.submissionCount}건</span>
                        <span>·</span>
                        <span>투표 {round.voteCount}건</span>
                        <span>·</span>
                        <span>체험 {round.experienceCount}건</span>
                      </div>

                      {roundDetailId === round.id && roundDetail && (
                        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                          <h3 className="text-xs font-bold text-slate-800">
                            제출 목록 및 동료 피드백 ({roundDetail.items.length}명)
                          </h3>
                          {roundDetail.items.length === 0 ? (
                            <p className="text-xs text-slate-400 py-2">아직 제출이 없습니다.</p>
                          ) : (
                            roundDetail.items.map((item) => (
                              <div key={item.submission.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-bold text-slate-800">
                                    {item.submission.anonLabel} · {item.submission.studentId} {item.submission.studentName}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {WARMUP_VOTE_TYPES.map((type) => (
                                      <span
                                        key={type}
                                        title={WARMUP_VOTE_LABELS[type]}
                                        className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                                      >
                                        {WARMUP_VOTE_ICONS[type]} {item.voteCounts[type]}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <pre className="whitespace-pre-wrap rounded-lg bg-white p-2.5 font-mono text-[11px] leading-relaxed text-slate-800 max-h-36 overflow-y-auto border border-slate-200">
                                  {item.submission.algorithmText}
                                </pre>
                                {item.experiences.length > 0 ? (
                                  <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">동료 체험 피드백:</span>
                                    {item.experiences.map((exp, idx) => (
                                      <p key={idx} className="text-[11px] text-slate-700">
                                        <span className="font-bold">{exp.executable ? "✅" : "❌"} {exp.executorName} ({exp.executorId}):</span> “{exp.feedback}”
                                      </p>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-slate-400">아직 동료 체험 피드백이 없습니다.</p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 1: Live Dashboard */}
        {tab === "dashboard" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                👥 학생별 1·2단계 진행 테이블
              </h2>
              <button
                type="button"
                onClick={loadDashboard}
                disabled={loading}
                className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                {loading ? "새로고침 중..." : "지금 새로고침"}
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[700px] text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-left">
                  <tr>
                    <th className="p-3 w-20">학번</th>
                    <th className="p-3 w-24">이름</th>
                    <th className="p-3">1단계: 알고리즘 작성 (2개)</th>
                    <th className="p-3">2단계: 인간 컴퓨터 실행 (2개)</th>
                    <th className="p-3 w-24 text-center">전체 상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s) => {
                    const isAllDone =
                      s.writeComplete &&
                      s.execute.every((e) => e.executed);

                    return (
                      <tr key={s.studentKey} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {s.studentId}
                        </td>
                        <td className="p-3 font-semibold text-slate-800">
                          {s.name}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            {s.write.map((w) => (
                              <span
                                key={w.problemType}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold ${
                                  w.submitted
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : "bg-slate-100 text-slate-500 border border-slate-200"
                                }`}
                              >
                                <span>{PROBLEM_ICONS[w.problemType]}</span>
                                <span>{PROBLEM_LABELS[w.problemType]}</span>
                                <span>{w.submitted ? "✓ 완료" : "대기"}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            {s.execute.map((ex) => (
                              <span
                                key={ex.problemType}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold ${
                                  ex.executed
                                    ? ex.isCorrect
                                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                      : "bg-rose-50 text-rose-800 border border-rose-200"
                                    : "bg-slate-100 text-slate-500 border border-slate-200"
                                }`}
                              >
                                <span>{PROBLEM_ICONS[ex.problemType]}</span>
                                <span>{PROBLEM_LABELS[ex.problemType]}</span>
                                <span>
                                  {ex.executed
                                    ? ex.isCorrect
                                      ? "🎯 일치(O)"
                                      : "❌ 불일치(X)"
                                    : "대기"}
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              isAllDone
                                ? "bg-emerald-600 text-white"
                                : s.writeComplete
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {isAllDone
                              ? "전체 완료"
                              : s.writeComplete
                              ? "1단계 완료"
                              : "작성 중"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 2: Review & Discussion Projector Mode */}
        {tab === "review" && (
          <section className="space-y-6">
            {/* Section 5 Pedagogical Discussion Guide Banner */}
            <div className="rounded-2xl border border-indigo-200 bg-linear-to-r from-indigo-50 to-blue-50 p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎙️</span>
                <h3 className="text-base font-bold text-slate-900">
                  수업 마무리 토론 가이드 (STEP 7 핵심 질문)
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-800">
                <div className="rounded-xl bg-white/80 p-3 border border-indigo-100 shadow-2xs space-y-1">
                  <span className="font-bold text-indigo-900 block">
                    Q1. 가장 막혔던 지점은?
                  </span>
                  <p className="text-slate-600">
                    다른 학생의 알고리즘을 인간 컴퓨터로서 수행하면서 어디서 가장 막혔나요?
                  </p>
                </div>
                <div className="rounded-xl bg-white/80 p-3 border border-indigo-100 shadow-2xs space-y-1">
                  <span className="font-bold text-indigo-900 block">
                    Q2. 당연하다고 착각한 지점은?
                  </span>
                  <p className="text-slate-600">
                    내가 작성할 때는 당연하다고 생각했지만 실행자는 이해하지 못한 부분이 있었나요?
                  </p>
                </div>
                <div className="rounded-xl bg-white/80 p-3 border border-indigo-100 shadow-2xs space-y-1">
                  <span className="font-bold text-indigo-900 block">
                    Q3. 우연히 맞은 경우 vs 완벽한 알고리즘
                  </span>
                  <p className="text-slate-600">
                    결과 숫자가 맞았다고 해서 항상 논리적으로 정확한 알고리즘일까요?
                  </p>
                </div>
                <div className="rounded-xl bg-white/80 p-3 border border-indigo-100 shadow-2xs space-y-1">
                  <span className="font-bold text-indigo-900 block">
                    Q4. 다양한 해결 경로의 비교
                  </span>
                  <p className="text-slate-600">
                    같은 문제를 해결하는 여러 알고리즘 중 어떤 것이 더 명확하고 효율적인가요?
                  </p>
                </div>
              </div>
            </div>

            {/* Problem Type Selector Tabs */}
            <div className="flex flex-wrap gap-2">
              {(["12coins", "card", "josephus", "pancake"] as ProblemType[]).map(
                (pType) => (
                  <button
                    key={pType}
                    type="button"
                    onClick={() => setSelectedGroupType(pType)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer ${
                      selectedGroupType === pType
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{PROBLEM_ICONS[pType]}</span>
                    <span>{PROBLEM_LABELS[pType]}</span>
                  </button>
                )
              )}
            </div>

            {/* Case Filters */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-slate-600">사례 필터:</span>
              <button
                type="button"
                onClick={() => setReviewFilter("all")}
                className={`rounded-lg px-3 py-1 font-semibold cursor-pointer ${
                  reviewFilter === "all"
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                전체 사례
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter("incorrect")}
                className={`rounded-lg px-3 py-1 font-semibold cursor-pointer ${
                  reviewFilter === "incorrect"
                    ? "bg-rose-600 text-white"
                    : "bg-white border border-rose-300 text-rose-900 hover:bg-rose-50"
                }`}
              >
                ❌ 정답 불일치 사례
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter("ambiguous")}
                className={`rounded-lg px-3 py-1 font-semibold cursor-pointer ${
                  reviewFilter === "ambiguous"
                    ? "bg-purple-600 text-white"
                    : "bg-white border border-purple-300 text-purple-900 hover:bg-purple-50"
                }`}
              >
                🤔 임의 해석 필요했던 사례
              </button>
            </div>

            {/* Submissions & Attempts List */}
            {(() => {
              const group = groups.find((g) => g.problemType === selectedGroupType);
              if (!group || group.items.length === 0) {
                return (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-xs text-slate-400">
                    해당 문제 유형에 제출된 알고리즘이 아직 없습니다.
                  </div>
                );
              }

              const filteredItems = group.items.filter(({ attempts }) => {
                if (reviewFilter === "all") return true;
                if (reviewFilter === "incorrect") {
                  return attempts.some((a) => a.isCorrect === false);
                }
                if (reviewFilter === "ambiguous") {
                  return attempts.some(
                    (a) => a.evaluationResponses?.hadAmbiguity
                  );
                }
                return true;
              });

              if (filteredItems.length === 0) {
                return (
                  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                    선택한 필터 조건에 해당하는 사례가 없습니다.
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {filteredItems.map(({ submission, attempts }) => (
                    <article
                      key={submission.id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs p-6 space-y-4"
                    >
                      {/* Submission Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-900">
                            작성자: {submission.studentId} · {submission.studentName}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          실행된 횟수: {attempts.length}회
                        </span>
                      </div>

                      {/* Algorithm Text (Line Numbered) */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-slate-700 block">
                          📜 제출된 알고리즘 원문:
                        </span>
                        <pre className="whitespace-pre-wrap rounded-xl bg-slate-900 p-4 font-mono text-xs sm:text-sm leading-relaxed text-emerald-300 shadow-inner max-h-72 overflow-y-auto">
                          {submission.algorithmText}
                        </pre>
                      </div>

                      {/* Attempts on this submission */}
                      <div className="space-y-3 pt-2">
                        <span className="text-xs font-bold text-slate-700 block">
                          👥 다른 학생들의 실행 및 평가 결과:
                        </span>

                        {attempts.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                            아직 실행자가 배정되지 않았습니다.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {attempts.map((a) => {
                              const ev = a.evaluationResponses;
                              return (
                                <div
                                  key={a.id}
                                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-800">
                                        실행자: {a.executorId} {a.executorName}
                                      </span>
                                      <span className="text-slate-400">•</span>
                                      <span className="font-mono text-slate-600">
                                        답 {a.finalAnswer ?? "-"} / 정답 {a.correctAnswer}
                                      </span>
                                      <span className="text-slate-400">•</span>
                                      <span className="font-bold text-blue-700">
                                        행동 {a.actionCount}회 (기준 {a.referenceActionCount}회)
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`rounded-full px-2.5 py-0.5 font-bold text-[11px] ${
                                          a.isCorrect
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-rose-100 text-rose-800"
                                        }`}
                                      >
                                        {a.isCorrect ? "🎯 정답 일치" : "❌ 정답 불일치"}
                                      </span>
                                      {a.unexecutableFlag && (
                                        <span className="rounded-full bg-amber-100 text-amber-900 px-2.5 py-0.5 font-bold text-[11px]">
                                          ⚠️ 실행 불가
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {a.unexecutableFlag && a.unexecutableReason && (
                                    <div className="rounded-lg bg-amber-100/70 p-2 text-amber-950 text-[11px]">
                                      <strong>🚨 실행 불가 신고:</strong> {a.unexecutableReason}
                                    </div>
                                  )}

                                  {ev && (
                                    <div className="rounded-lg bg-white p-2.5 border border-slate-200 text-slate-700 space-y-1">
                                      <p>
                                        • <strong>끝까지 실행 가능:</strong>{" "}
                                        {ev.couldFollowFully ? "예" : "아니오"}
                                        {ev.unexecutablePoint && ` (${ev.unexecutablePoint})`}
                                      </p>
                                      <p>
                                        • <strong>임의 해석 여부:</strong>{" "}
                                        {ev.hadAmbiguity ? "있음 (애매한 지점 존재)" : "없음"}
                                        {ev.ambiguityNote && ` — ${ev.ambiguityNote}`}
                                      </p>
                                      <p>
                                        • <strong>정확하다고 판단:</strong>{" "}
                                        {ev.consideredCorrect ? "예" : "아니오"}
                                        {ev.correctnessReason && ` — ${ev.correctnessReason}`}
                                      </p>
                                      <div className="mt-1.5 border-t border-slate-100 pt-1.5">
                                        {ev.clarityRating || ev.accuracyRating || ev.efficiencyRating ? (
                                          <p>
                                            • <strong>별점:</strong> 명확성{" "}
                                            {ev.clarityRating ?? "-"}/5 · 정확성 {ev.accuracyRating ?? "-"}/5 ·
                                            효율성 {ev.efficiencyRating ?? "-"}/5
                                          </p>
                                        ) : (
                                          <p className="text-slate-400">
                                            • 별점 없음 (이전 형식의 평가 데이터)
                                          </p>
                                        )}
                                        {ev.subjectiveFeedback && (
                                          <p className="mt-0.5">
                                            • <strong>한 줄 피드백:</strong> “{ev.subjectiveFeedback}”
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              );
            })()}
          </section>
        )}

        {/* TAB 3: Solve-Together Practice Area */}
        {tab === "practice" && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-blue-200 bg-linear-to-r from-blue-50 to-indigo-50 p-5 shadow-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧩</span>
                <h3 className="text-base font-bold text-slate-900">
                  문제별 함께 풀어보기
                </h3>
              </div>
              <p className="text-xs text-slate-600">
                학생 제출/채점과는 무관한 별도의 연습 공간입니다. 프로젝터로 화면을 띄우고 학생들과
                함께 저울질하거나, 카드를 뒤집거나, 사람을 제거하거나, 팬케이크를 뒤집어보며 문제
                해결 규칙을 같이 찾아보세요.
              </p>
            </div>

            {/* Problem Type Selector + Presentation Mode Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {(["12coins", "card", "josephus", "pancake"] as ProblemType[]).map(
                  (pType) => (
                    <button
                      key={pType}
                      type="button"
                      onClick={() => setSelectedGroupType(pType)}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer ${
                        selectedGroupType === pType
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{PROBLEM_ICONS[pType]}</span>
                      <span>{PROBLEM_LABELS[pType]}</span>
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={() => setPresentationMode((prev) => !prev)}
                className={`rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer ${
                  presentationMode
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {presentationMode ? "📽️ 발표 모드 (크게 보기)" : "🔎 기본 크기로 보기"}
              </button>
            </div>

            <ProblemSandboxContainer
              problemType={selectedGroupType}
              presentationMode={presentationMode}
            />
          </section>
        )}
      </main>
    </div>
  );
}
