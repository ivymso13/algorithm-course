"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { StudentLoginCard } from "@/components/StudentLoginCard";
import { splitAlgorithmIntoSteps } from "@/lib/warmupSteps";

type SubmissionView = {
  id: number;
  anonLabel: string;
  algorithmText: string;
  roundId: number;
  roundStatus: "draft" | "open" | "closed";
};

type Experience = {
  checkedSteps: number[];
  executable: boolean;
  feedback: string;
};

type BoardItem = {
  id: number;
  anonLabel: string;
  algorithmText: string;
  experienced: boolean;
};

export default function ExecutePage() {
  const searchParams = useSearchParams();
  const submissionIdParam = searchParams.get("submissionId");
  const submissionId = submissionIdParam ? Number(submissionIdParam) : null;
  const hasSubmissionId = submissionId !== null && Number.isInteger(submissionId);

  const [checkingSession, setCheckingSession] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [studentLabel, setStudentLabel] = useState<string | null>(null);

  const [submission, setSubmission] = useState<SubmissionView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [executable, setExecutable] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Fallback board list if opened without submissionId
  const [boardList, setBoardList] = useState<BoardItem[] | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch("/api/student/me")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }: { ok: boolean; data: { studentKey?: string } }) => {
        if (ignore) return;
        if (ok && data.studentKey) {
          setLoggedIn(true);
          setStudentLabel(data.studentKey);
        } else {
          setLoggedIn(false);
        }
      })
      .catch(() => {
        if (!ignore) setLoggedIn(false);
      })
      .finally(() => {
        if (!ignore) setCheckingSession(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const loadSubmissionData = useCallback((id: number) => {
    setLoadError(null);
    Promise.all([
      fetch(`/api/warmup/submission?id=${id}`).then((res) =>
        res.json().then((data) => ({ ok: res.ok, data }))
      ),
      fetch(`/api/warmup/experience?submissionId=${id}`).then((res) =>
        res.json().then((data) => ({ ok: res.ok, data }))
      ),
    ])
      .then(
        ([subRes, expRes]: [
          { ok: boolean; data: { submission?: SubmissionView; error?: string } },
          { ok: boolean; data: { experience?: (Experience & { checkedSteps: unknown }) | null } }
        ]) => {
          if (!subRes.ok || !subRes.data.submission) {
            setLoadError(subRes.data.error ?? "알고리즘을 불러오지 못했습니다.");
            return;
          }
          setSubmission(subRes.data.submission);
          const experience = expRes.data.experience;
          if (experience) {
            setChecked(new Set((experience.checkedSteps as number[]) ?? []));
            setExecutable(experience.executable);
            setFeedback(experience.feedback);
            setSubmitted(true);
          }
        }
      )
      .catch(() => {
        setLoadError("알고리즘을 불러오지 못했습니다.");
      });
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    let ignore = false;
    const timer = window.setTimeout(() => {
      if (hasSubmissionId && submissionId !== null) {
        loadSubmissionData(submissionId);
      } else {
        setBoardLoading(true);
        fetch("/api/warmup/board")
          .then((res) => res.json())
          .then((data: { entries?: BoardItem[] }) => {
            if (!ignore) setBoardList(data.entries ?? []);
          })
          .catch(() => {
            if (!ignore) setBoardList([]);
          })
          .finally(() => {
            if (!ignore) setBoardLoading(false);
          });
      }
    }, 0);
    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [loggedIn, hasSubmissionId, submissionId, loadSubmissionData]);

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
      if (!res.ok || !data.studentKey) throw new Error(data.error ?? "로그인에 실패했습니다.");
      setStudentLabel(data.studentKey);
      setLoggedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    setLoggedIn(false);
    setSubmission(null);
    fetch("/api/student/logout", { method: "POST" }).catch(() => {});
  }

  function toggleStep(index: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!submission || executable === null) {
      setError("실행 가능 여부를 선택하세요.");
      return;
    }
    const trimmed = feedback.trim();
    if (trimmed.length < 2) {
      setError("피드백을 2자 이상 입력해주세요.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/warmup/experience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission.id,
          checkedSteps: Array.from(checked),
          executable,
          feedback: trimmed,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "제출에 실패했습니다.");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="mx-auto flex flex-1 w-full items-center justify-center px-4 py-16 text-sm text-slate-500">
          <div role="status" aria-live="polite" className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            <span>세션 확인 중...</span>
          </div>
        </main>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="mx-auto flex flex-1 w-full items-center justify-center px-4 py-8 sm:py-12">
          <StudentLoginCard
            title="알고리즘 체험"
            subtitle="수업 코드와 학번, 이름을 입력해 시작하세요."
            stepNumber="2단계"
            onLogin={handleLogin}
            loading={loading}
            error={error}
          />
        </main>
      </div>
    );
  }

  // If no submissionId was provided in query, show selector
  if (!hasSubmissionId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar currentStudentKey={studentLabel} onLogout={handleLogout} />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
          <header className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                5단계 · 단계별 체험
              </span>
              <h1 className="text-base font-bold text-slate-900 mt-1">체험할 알고리즘 선택</h1>
            </div>
            <Link href="/write" className="text-xs text-blue-600 hover:underline font-semibold">
              ← 워밍업 보드로
            </Link>
          </header>

          {boardLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
              목록 불러오는 중...
            </div>
          ) : !boardList || boardList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3 shadow-xs">
              <p className="text-sm text-slate-600">아직 제출된 알고리즘이 없습니다.</p>
              <Link
                href="/write"
                className="inline-block rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
              >
                1단계로 이동해 내 알고리즘 작성하기 ➔
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">체험하고 피드백을 남길 알고리즘을 선택하세요:</p>
              {boardList.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-800">
                      {item.anonLabel}
                    </span>
                    {item.experienced && (
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        ✓ 체험 완료
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 font-mono text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg">
                    {item.algorithmText}
                  </p>
                  <div className="flex justify-end pt-1">
                    <Link
                      href={`/execute?submissionId=${item.id}`}
                      className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                    >
                      체험 시작 ➔
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar currentStudentKey={studentLabel} onLogout={handleLogout} />
        <main className="mx-auto flex flex-1 w-full items-center justify-center px-4 py-16 text-center">
          <div className="max-w-sm space-y-3">
            <p className="text-sm font-bold text-rose-700">⚠️ {loadError}</p>
            <Link href="/write" className="inline-block text-xs font-bold text-blue-600 hover:underline">
              워밍업 보드로 돌아가기 ➔
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar currentStudentKey={studentLabel} onLogout={handleLogout} />
        <main className="mx-auto flex flex-1 w-full items-center justify-center px-4 py-16 text-sm text-slate-400">
          <div role="status" aria-live="polite" className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            <span>알고리즘 불러오는 중...</span>
          </div>
        </main>
      </div>
    );
  }

  const steps = splitAlgorithmIntoSteps(submission.algorithmText);
  const isClosed = submission.roundStatus !== "open";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentStudentKey={studentLabel} onLogout={handleLogout} />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        {/* 5-Stage Stepper Header */}
        <nav
          aria-label="워밍업 진행 순서"
          className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs"
        >
          <div className="flex items-center justify-between gap-1 overflow-x-auto text-[11px] font-medium text-slate-500">
            <Link href="/write" className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg hover:bg-slate-50">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">✓</span>
              <span>1. 문제</span>
            </Link>
            <span className="text-slate-300">➔</span>

            <Link href="/write" className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg hover:bg-slate-50">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">✓</span>
              <span>2. 작성</span>
            </Link>
            <span className="text-slate-300">➔</span>

            <Link href="/write" className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg hover:bg-slate-50">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">✓</span>
              <span>3. 아이디어</span>
            </Link>
            <span className="text-slate-300">➔</span>

            <Link href="/write" className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg hover:bg-slate-50">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">✓</span>
              <span>4. 추천</span>
            </Link>
            <span className="text-slate-300">➔</span>

            <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold ring-1 ring-emerald-300">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">5</span>
              <span>단계별 체험</span>
            </div>
          </div>
        </nav>

        {/* Algorithm Header */}
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                5. 단계별 체험
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  !isClosed ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-700"
                }`}
              >
                {!isClosed ? "진행 중" : "종료됨"}
              </span>
            </div>
            <h1 className="text-base font-bold text-slate-900 mt-1">{submission.anonLabel}의 알고리즘</h1>
          </div>
          <Link
            href="/write"
            className="text-xs text-blue-600 hover:underline font-semibold shrink-0"
          >
            ← 보드로
          </Link>
        </header>

        {isClosed && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800">
            라운드가 종료되었습니다. 이전에 작성된 피드백만 확인할 수 있습니다.
          </div>
        )}

        {/* Step-by-Step Checklist */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">단계별 체크</h2>
              <p className="text-[11px] text-slate-500">순서대로 확인한 단계만 체크하세요.</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {checked.size} / {steps.length}단계 확인
            </span>
          </div>

          <ol className="space-y-2">
            {steps.map((step, idx) => {
              const isChecked = checked.has(idx);
              return (
                <li key={idx}>
                  <label
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition select-none ${
                      isChecked
                        ? "border-emerald-400 bg-emerald-50/50 text-slate-900"
                        : "border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      checked={isChecked}
                      onChange={() => toggleStep(idx)}
                    />
                    <span className="text-xs sm:text-sm font-mono whitespace-pre-wrap leading-relaxed">
                      {step}
                    </span>
                  </label>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Evaluation Assessment & Short Feedback */}
        {submitted ? (
          <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-xs text-center space-y-3">
            <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 text-emerald-700 font-bold text-sm">
              <span>✓</span>
              <span>피드백이 성공적으로 제출되었습니다.</span>
            </div>
            <p className="text-xs text-slate-500">다른 학생의 알고리즘도 이어서 체험해보세요.</p>
            <div className="pt-2">
              <Link
                href="/write"
                className="inline-block rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
              >
                다른 알고리즘 체험하러 가기 ➔
              </Link>
            </div>
          </section>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4"
          >
            <div className="border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold text-slate-900">실행 판정 및 피드백</h2>
              <p className="text-[11px] text-slate-500">실행 가능 여부와 2자 이상의 간단한 의견을 남겨주세요.</p>
            </div>

            <div className="grid grid-cols-2 gap-2" role="group" aria-label="실행 가능 여부 선택">
              <button
                type="button"
                onClick={() => setExecutable(true)}
                disabled={isClosed}
                aria-pressed={executable === true}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-bold transition cursor-pointer disabled:opacity-50 ${
                  executable === true
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-300"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>✅</span>
                <span>그대로 실행 가능</span>
              </button>

              <button
                type="button"
                onClick={() => setExecutable(false)}
                disabled={isClosed}
                aria-pressed={executable === false}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-bold transition cursor-pointer disabled:opacity-50 ${
                  executable === false
                    ? "border-rose-500 bg-rose-50 text-rose-800 ring-2 ring-rose-300"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>❌</span>
                <span>실행 불가</span>
              </button>
            </div>

            <div className="space-y-1">
              <textarea
                required
                rows={3}
                maxLength={200}
                disabled={isClosed}
                aria-label="한 줄 피드백"
                placeholder="어려웠거나 고치면 좋을 점 (2~200자)"
                className="w-full rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-base sm:text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 focus:outline-hidden disabled:opacity-60"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
              <div className="flex justify-end">
                <span className={`text-[11px] font-mono ${feedback.trim().length >= 2 ? "text-slate-400" : "text-amber-600"}`}>
                  {feedback.trim().length} / 200자
                </span>
              </div>
            </div>

            {error && (
              <div role="alert" aria-live="assertive" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || isClosed || executable === null || feedback.trim().length < 2}
              className="w-full rounded-xl bg-emerald-600 py-2.5 px-4 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
            >
              {loading ? "제출 중..." : "피드백 제출하기 ➔"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
