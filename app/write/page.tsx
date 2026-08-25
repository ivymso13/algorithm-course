"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { StudentLoginCard } from "@/components/StudentLoginCard";
import { ProblemPrompt } from "@/components/write/ProblemPrompt";
import { ReviewCardList } from "@/components/write/ReviewCardList";
import { PROBLEM_LABELS, PROBLEM_ICONS, type ProblemType } from "@/lib/problemMeta";

type WriteStatus = {
  problemType: ProblemType;
  submitted: boolean;
  algorithmText: string;
  submittedAt: string | null;
  updatedAt: string | null;
};

type ReviewCard = {
  attempt: {
    id: number;
    problemType: ProblemType;
    executorName: string;
    finalAnswer: number | null;
    correctAnswer: number;
    isCorrect: boolean | null;
    actionCount: number;
    referenceActionCount: number;
    unexecutableFlag: boolean;
    unexecutableReason: string | null;
    actionLog: unknown[];
    evaluationResponses: {
      couldFollowFully: boolean;
      unexecutablePoint: string;
      hadAmbiguity: boolean;
      ambiguityNote: string;
      consideredCorrect: boolean;
      correctnessReason: string;
    } | null;
  };
  submission: { algorithmText: string; problemType: ProblemType } | null;
};

type Snapshot = {
  studentKey?: string;
  assignment: {
    studentId: string;
    name: string;
    write: ProblemType[];
    execute: ProblemType[];
  };
  writeStatus: WriteStatus[];
  nextProblemType: ProblemType | null;
  exampleInput: unknown;
  reviewCards: ReviewCard[];
};

export default function WritePage() {
  const [studentKey, setStudentKey] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem("algo_student_key");
    } catch {
      return null;
    }
  });

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [algorithmText, setAlgorithmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/write/next?studentKey=${encodeURIComponent(key)}`);
      const data = (await res.json()) as Snapshot & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "정보를 불러오지 못했습니다.");
      setSnapshot({ studentKey: key, ...data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    if (studentKey && !snapshot) {
      fetch(`/api/write/next?studentKey=${encodeURIComponent(studentKey)}`)
        .then((res) => res.json())
        .then((data: Snapshot & { error?: string }) => {
          if (!ignore) {
            if (data.error) {
              setError(data.error);
            } else {
              setSnapshot({ studentKey, ...data });
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
  }, [studentKey, snapshot]);

  async function handleLogin(sId: string, sName: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: sId, name: sName }),
      });
      const data = (await res.json()) as Snapshot & { error?: string; studentKey?: string };
      if (!res.ok || !data.studentKey) {
        throw new Error(data.error ?? "로그인에 실패했습니다.");
      }
      setStudentKey(data.studentKey);
      setSnapshot(data);
      try {
        sessionStorage.setItem("algo_student_key", data.studentKey);
      } catch {
        // ignore storage error
      }
      setAlgorithmText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    setStudentKey(null);
    setSnapshot(null);
    setAlgorithmText("");
    try {
      sessionStorage.removeItem("algo_student_key");
    } catch {
      // ignore storage error
    }
  }

  function handleInsertTemplate(textToInsert: string) {
    setAlgorithmText((prev) => (prev ? `${prev}\n${textToInsert}` : textToInsert));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!snapshot?.studentKey || !snapshot.nextProblemType) return;
    setError(null);

    const trimmed = algorithmText.trim();
    if (!trimmed) {
      setError("알고리즘 내용을 입력하세요.");
      return;
    }
    if (trimmed.length < 10) {
      setError("알고리즘을 조금 더 구체적으로 단계별로 서술해주세요. (최소 10자 이상)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/write/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentKey: snapshot.studentKey,
          problemType: snapshot.nextProblemType,
          algorithmText: trimmed,
        }),
      });
      const data = (await res.json()) as Snapshot & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "제출에 실패했습니다.");
      setSnapshot((prev) => (prev ? { ...prev, ...data } : data));
      setAlgorithmText("");
      setSubmitSuccess("알고리즘이 성공적으로 제출되었습니다!");
      setTimeout(() => setSubmitSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (!snapshot || !studentKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="mx-auto flex flex-1 w-full items-center justify-center px-4 py-12">
          <StudentLoginCard
            title="1단계 · 알고리즘 작성"
            subtitle="학번과 이름을 입력하거나 명렬표에서 선택해 시작하세요."
            stepNumber="1단계"
            onLogin={handleLogin}
            loading={loading}
            error={error}
          />
        </main>
      </div>
    );
  }

  const assignedWrite = snapshot.assignment.write;
  const completedCount = snapshot.writeStatus.filter((w) => w.submitted).length;
  const totalCount = assignedWrite.length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentStudentKey={studentKey} onLogout={handleLogout} />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        {/* Step Progress Stepper Bar */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                1단계 진행 현황
              </span>
              <h1 className="text-lg font-bold text-slate-900">
                {snapshot.assignment.studentId} · {snapshot.assignment.name}님의 작성 과제
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">진행도:</span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {completedCount} / {totalCount} 완료
              </span>
            </div>
          </div>

          {/* Stepper nodes */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {assignedWrite.map((pType, idx) => {
              const status = snapshot.writeStatus.find((w) => w.problemType === pType);
              const isCurrent = snapshot.nextProblemType === pType;
              const isDone = Boolean(status?.submitted);

              return (
                <div
                  key={pType}
                  className={`flex items-center gap-3 rounded-xl p-3 border transition ${
                    isDone
                      ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
                      : isCurrent
                      ? "border-blue-300 bg-blue-50/70 text-blue-950 ring-2 ring-blue-200"
                      : "border-slate-200 bg-slate-50 text-slate-500 opacity-60"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isDone
                        ? "bg-emerald-600 text-white"
                        : isCurrent
                        ? "bg-blue-600 text-white"
                        : "bg-slate-300 text-slate-700"
                    }`}
                  >
                    {isDone ? "✓" : idx + 1}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[11px] font-semibold opacity-75">
                      문제 {idx + 1}
                    </p>
                    <p className="truncate text-xs font-bold">
                      {PROBLEM_ICONS[pType]} {PROBLEM_LABELS[pType]}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Success Alert Banner */}
        {submitSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 shadow-xs flex items-center gap-2">
            <span>🎉</span>
            <span>{submitSuccess}</span>
          </div>
        )}

        {/* Review Cards Section (진입 조건 분기) */}
        {snapshot.reviewCards.length > 0 && (
          <ReviewCardList cards={snapshot.reviewCards} />
        )}

        {/* Problem Writing Section (Active Problem) */}
        {snapshot.nextProblemType ? (
          <section className="space-y-4">
            <ProblemPrompt
              problemType={snapshot.nextProblemType}
              exampleInput={snapshot.exampleInput}
              onInsertTemplate={handleInsertTemplate}
            />

            {/* Algorithm Writing Box Form */}
            <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    ✍️ 알고리즘 작성 에디터
                  </h3>
                  <p className="text-xs text-slate-500">
                    실행자가 그대로 따라 할 수 있도록 한 줄씩 번호를 매겨 적으세요.
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                  <span>{algorithmText.length}자</span>
                  <span>•</span>
                  <span>{algorithmText.split("\n").filter(Boolean).length}줄</span>
                </div>
              </div>

              <div className="relative">
                <textarea
                  required
                  rows={10}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 p-4 font-mono text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 focus:outline-hidden"
                  placeholder={`1. 카드를 왼쪽부터 확인한다.\n2. 만약 현재 카드의 숫자가 목표 숫자보다 크다면:\n   - 탐색 범위를 왼쪽 절반으로 좁힌다.\n3. 목표 숫자를 찾을 때까지 또는 범위가 빌 때까지 1~2를 반복한다.\n4. 목표 숫자가 없으면 0을 최종 답으로 출력한다.`}
                  value={algorithmText}
                  onChange={(e) => setAlgorithmText(e.target.value)}
                />
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                  ⚠️ {error}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setAlgorithmText("")}
                  disabled={!algorithmText || loading}
                  className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer disabled:opacity-30"
                >
                  입력 지우기
                </button>

                <button
                  type="submit"
                  disabled={loading || !algorithmText.trim()}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  {loading ? (
                    <span>제출 중...</span>
                  ) : (
                    <span>
                      {completedCount + 1 === totalCount
                        ? "최종 제출 완료하기 ➔"
                        : "제출하고 다음 문제로 ➔"}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </section>
        ) : (
          /* All Problems Completed State */
          <section className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-linear-to-b from-emerald-50 to-white p-6 shadow-xs text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-3xl text-white shadow-xs">
                🎉
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  배정된 2개 문제를 모두 제출했습니다!
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                  수고하셨습니다. 여러분이 작성한 알고리즘은 2단계에서 다른 학생(인간 컴퓨터)에게 무작위로 전달되어 실행됩니다.
                  교사의 안내에 따라 2단계 실행 화면으로 이동하세요.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/execute"
                  className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                >
                  2단계 · 인간 컴퓨터 실행 화면으로 이동 ➔
                </Link>
              </div>
            </div>

            {/* Submitted Algorithms Review & Edit Accordions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  📜 내가 제출한 알고리즘 목록 (수정 가능)
                </h3>
                <span className="text-xs text-slate-400">
                  필요 시 내용을 수정하고 저장할 수 있습니다.
                </span>
              </div>

              <div className="space-y-3">
                {snapshot.writeStatus.map((item, idx) => (
                  <details
                    key={item.problemType}
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition"
                  >
                    <summary className="flex items-center justify-between p-3.5 cursor-pointer bg-white font-bold text-xs text-slate-800 hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span>{PROBLEM_ICONS[item.problemType]}</span>
                        <span>문제 {idx + 1}: {PROBLEM_LABELS[item.problemType]}</span>
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          제출 완료
                        </span>
                      </div>
                      <span className="text-slate-400 group-open:rotate-180 transition text-xs">
                        ▼
                      </span>
                    </summary>

                    <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
                      <EditSubmission
                        problemType={item.problemType}
                        initialText={item.algorithmText}
                        studentKey={snapshot.studentKey ?? ""}
                        onSaved={() => studentKey && fetchSnapshot(studentKey)}
                      />
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function EditSubmission({
  problemType,
  initialText,
  studentKey,
  onSaved,
}: {
  problemType: ProblemType;
  initialText: string;
  studentKey: string;
  onSaved: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/write/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentKey, problemType, algorithmText: text }),
      });
      if (!res.ok) throw new Error("수정에 실패했습니다.");
      setMsg("수정 사항이 저장되었습니다!");
      onSaved();
      setTimeout(() => setMsg(null), 3000);
    } catch {
      setMsg("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-bold text-slate-700 block">
        알고리즘 본문 수정:
      </span>
      <textarea
        rows={6}
        className="w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs leading-relaxed text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex items-center justify-between">
        {msg ? (
          <span className="text-xs font-bold text-emerald-700">{msg}</span>
        ) : (
          <span className="text-[11px] text-slate-400">
            수정 후 아래 버튼을 누르면 즉시 반영됩니다.
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving || !text.trim()}
          className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
        >
          {saving ? "저장 중..." : "수정 내용 저장"}
        </button>
      </div>
    </div>
  );
}
