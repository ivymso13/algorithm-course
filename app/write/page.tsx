"use client";

/* Native <a> links intentionally avoid a client-router navigation bug seen in
 * some classroom browsers (see components/Navbar.tsx for the original fix):
 * after a next/link soft navigation, the destination page's client
 * components did not reliably hydrate, leaving buttons unresponsive. */

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { StudentLoginCard } from "@/components/StudentLoginCard";
import { ProblemSandboxContainer } from "@/components/write/sandbox/ProblemSandboxContainer";
import { StudentStepNav } from "@/components/write/StudentStepNav";
import { useWarmupSession } from "@/components/write/useWarmupSession";

export default function WriteProblemPage() {
  const {
    checkingSession,
    loggedIn,
    studentLabel,
    round,
    mySubmission,
    sessionRestoredNotice,
    setSessionRestoredNotice,
    handleLogin,
    handleLogout,
    error,
    loading,
  } = useWarmupSession();

  const [sandboxCopyNotice, setSandboxCopyNotice] = useState(false);

  /**
   * Only ever runs when the student clicks the sandbox's own "기록 복사"
   * button — never automatically. The step editor lives on a different page
   * (/write/algorithm), so there's no live `steps` state to check here; the
   * sessionStorage draft (or, once submitted, the saved algorithm) is the
   * best available signal for "is there existing content" — read it first so
   * an empty draft is simply filled in, while existing content is only ever
   * appended to after the student explicitly confirms.
   */
  function handleCopySandboxHistory(summary: string) {
    if (!round) return;
    const draftKey = `algo_warmup_draft_${round.id}`;
    try {
      const existing = sessionStorage.getItem(draftKey)?.trim() || mySubmission?.algorithmText.trim() || "";
      if (existing) {
        const confirmed = window.confirm(
          "이미 작성 중인 알고리즘 내용이 있습니다. 실습 기록을 뒤에 추가할까요?"
        );
        if (!confirmed) return;
        sessionStorage.setItem(draftKey, `${existing}\n${summary}`);
      } else {
        sessionStorage.setItem(draftKey, summary);
      }
      setSandboxCopyNotice(true);
      window.setTimeout(() => setSandboxCopyNotice(false), 4000);
    } catch {
      // ignore storage errors
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="mx-auto flex flex-1 w-full items-center justify-center px-4 py-16 text-sm text-slate-500">
          <div role="status" aria-live="polite" className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
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
            title="워밍업 참여"
            subtitle="학교와 학번을 입력해 시작하세요."
            stepNumber="1단계"
            onLogin={handleLogin}
            loading={loading}
            error={error}
          />
        </main>
      </div>
    );
  }

  const hasSubmitted = Boolean(mySubmission);
  const isOpen = round?.status === "open";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentStudentKey={studentLabel} onLogout={handleLogout} />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        {/* 3-Step Navigation */}
        <StudentStepNav currentStep={1} hasSubmitted={hasSubmitted} />

        {sessionRestoredNotice && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs text-blue-900 flex items-center justify-between gap-2 shadow-2xs"
          >
            <span>👋 이전 세션이 복구되었습니다.</span>
            <button
              type="button"
              onClick={() => setSessionRestoredNotice(false)}
              className="text-blue-700 hover:text-blue-900 font-bold p-1 cursor-pointer"
              aria-label="알림 닫기"
            >
              ✕
            </button>
          </div>
        )}

        {!round ? (
          /* Empty / Waiting state */
          <section className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-xs space-y-2">
            <span className="text-3xl inline-block" aria-hidden="true">⏳</span>
            <h1 className="text-base font-bold text-slate-900">진행 중인 워밍업이 없습니다</h1>
            <p className="text-xs text-slate-500">선생님이 문제를 공개하면 화면이 자동으로 갱신됩니다.</p>
          </section>
        ) : (
          <>
            {/* 문제 확인 (Problem Details) */}
            <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 sm:p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                  문제 확인
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isOpen
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {isOpen ? "진행 중" : "종료됨"}
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900">{round.title}</h1>
              <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {round.prompt}
              </p>
            </section>

            {/* Sandbox Copy Notification */}
            {sandboxCopyNotice && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs font-bold text-blue-900 shadow-2xs flex items-center gap-2"
              >
                <span aria-hidden="true">🧪</span>
                <span>실습 기록이 알고리즘 초안에 복사되었습니다. 알고리즘 작성 화면에서 확인하세요.</span>
              </div>
            )}

            {/* 직접 실습 (Interactive Sandbox) */}
            {round.problemType ? (
              <section className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">직접 조작하며 규칙 찾기</h2>
                    <p className="text-[11px] text-slate-500">
                      문제를 직접 손으로 풀어보며 어떤 순서로 조작해야 하는지 감을 잡아보세요.
                    </p>
                  </div>
                </div>
                <ProblemSandboxContainer
                  problemType={round.problemType}
                  onCopyHistory={handleCopySandboxHistory}
                  defaultOpen={true}
                />
              </section>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs space-y-1">
                <p className="text-xs font-bold text-slate-700">이 문제는 별도 실습 도구 없이 바로 생각해보는 문제입니다</p>
                <p className="text-[11px] text-slate-500">
                  위 문제 설명을 꼼꼼히 읽고 어떻게 해결할지 생각한 후 다음 단계로 이동하세요.
                </p>
              </section>
            )}

            {/* Bottom CTA to next step */}
            <div className="pt-2">
              {hasSubmitted ? (
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <a
                    href="/write/algorithm"
                    className="w-full sm:w-1/2 rounded-xl border border-slate-300 bg-white py-3 px-4 text-xs sm:text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition text-center"
                  >
                    ✏️ 내 알고리즘 수정하기
                  </a>
                  <a
                    href="/write/explore"
                    className="w-full sm:w-1/2 rounded-xl bg-blue-600 py-3 px-4 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-blue-700 transition text-center"
                  >
                    아이디어 보드로 가기 ➔
                  </a>
                </div>
              ) : (
                <a
                  href="/write/algorithm"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 px-4 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-blue-700 transition"
                >
                  <span>단계별 알고리즘 작성하러 가기 ➔</span>
                </a>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
