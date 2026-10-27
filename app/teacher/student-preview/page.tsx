"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { PROBLEM_ALLOWED_ACTIONS, PROBLEM_ICONS, type ProblemType } from "@/lib/problemMeta";
import type { StudentPreviewProblemId } from "@/lib/studentPreview";
import { getWarmupProblem } from "@/lib/warmupProblems";

type PreviewActivityMeta = {
  id: StudentPreviewProblemId;
  sandboxType: ProblemType | null;
  shortTitle: string;
  subtitle: string;
  jevBadge: string;
  peerBadge: string;
};

const PREVIEW_ACTIVITIES: readonly PreviewActivityMeta[] = [
  { id: "candy-sharing", sandboxType: null, shortTitle: "사탕 나누기", subtitle: "문제를 읽고 최대 친구 수를 구하는 자연어 알고리즘 작성", jevBadge: "JEV 반복형·공식형 · 고정 10사례", peerBadge: "단계 체크 · 동료 피드백" },
  {
    id: "card-flip",
    sandboxType: "cardflip",
    shortTitle: "카드 뒤집기",
    subtitle: "6장 카드의 앞·뒷면을 오른쪽 끝부터 확인하며 한 차례 규칙 실행",
    jevBadge: "JEV 문장별 명령 해석",
    peerBadge: "동료 평가 시 카드 실습 연동",
  },
  {
    id: "even-count",
    sandboxType: "evencount",
    shortTitle: "상자 속 짝수 세기",
    subtitle: "5개 상자를 순서대로 열어 짝수 개수를 메모지에 기록·제출",
    jevBadge: "JEV 고정 10사례 자동 채점",
    peerBadge: "단계 체크 · 동료 피드백",
  },
  {
    id: "truck-loading",
    sandboxType: "truckload",
    shortTitle: "택배 트럭",
    subtitle: "10kg 적재 한도를 지키며 트럭 출발·적재를 반복해 필요한 트럭 수 계산",
    jevBadge: "JEV 고정 10사례 자동 채점",
    peerBadge: "동료 평가 시 트럭 실습 연동",
  },
];

const FLOW_STEPS = [
  { step: "1", title: "문제 이해", desc: "문제를 읽고 해결 방법을 생각합니다. 실습 도구가 있는 활동은 함께 사용합니다." },
  { step: "2", title: "알고리즘 제출", desc: "단계별 자연어 알고리즘을 작성해 1차 원문을 제출합니다." },
  { step: "3", title: "JEV 결과 확인", desc: "문장별 명령 해석과 고정 테스트(10개) 실행 결과를 점검합니다." },
  { step: "4", title: "동료평가 체험", desc: "상단 배너에서 ‘예시 동료평가 받기’를 누르고 동료 알고리즘도 평가합니다." },
  { step: "5", title: "이유 기록·수정", desc: "도착한 피드백을 바탕으로 수정 이유를 적고 2차 버전을 제출합니다." },
] as const;

export default function StudentPreviewPage() {
  const [problemId, setProblemId] = useState<StudentPreviewProblemId>("card-flip");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("problemId");
      if (requested && PREVIEW_ACTIVITIES.some((a) => a.id === requested)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setProblemId(requested as StudentPreviewProblemId);
      }
      const savedPw = sessionStorage.getItem("algo_teacher_pw");
      if (savedPw) {
        setPassword(savedPw);
      }
    } catch {
      // ignore storage/search errors
    }
  }, []);

  async function start() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/teacher/student-preview", {
        method: "POST",
        headers: {
          "x-teacher-password": password,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ problemId }),
      });
      const d = (await r.json()) as { error?: string; url?: string };
      if (!r.ok) throw new Error(d.error);
      try {
        sessionStorage.setItem("algo_teacher_pw", password);
      } catch {
        // ignore storage errors
      }
      window.location.assign(d.url ?? "/write");
    } catch (e) {
      setError(e instanceof Error ? e.message : "체험을 시작하지 못했습니다.");
      setBusy(false);
    }
  }

  const selectedMeta = PREVIEW_ACTIVITIES.find((a) => a.id === problemId) ?? PREVIEW_ACTIVITIES[0];
  const selectedProblem = getWarmupProblem(selectedMeta.id);
  const allowedActions = selectedMeta.sandboxType ? PROBLEM_ALLOWED_ACTIONS[selectedMeta.sandboxType] : [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        {/* Top Header Card */}
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-bold text-white">
                교사용 체험 환경
              </span>
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                연구 자료·수업 명단 제외
              </span>
            </div>
            <a
              href="/teacher"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              ← 교사 관리 콘솔로 돌아가기
            </a>
          </div>

          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              학생 입장에서 체험하기
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
              선택한 활동으로 격리된 임시 학급을 만들고, 학생 화면에서{" "}
              <strong className="font-semibold text-slate-800">
                문제 이해 → 자연어 알고리즘 작성 → JEV 해석·채점 확인 → 예시 동료평가 → 이유를 적고 수정
              </strong>
              까지 전체 흐름을 점검합니다.
            </p>
          </div>

          {/* 5-Step Flow Overview */}
          <ol
            aria-label="체험 진행 5단계 흐름"
            className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-5"
          >
            {FLOW_STEPS.map((item) => (
              <li
                key={item.step}
                className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-2.5 text-xs"
              >
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">
                    {item.step}
                  </span>
                  <span>{item.title}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-600">{item.desc}</p>
              </li>
            ))}
          </ol>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
          className="space-y-5"
        >
          {/* Section 1: Activity Selection */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  1. 체험할 활동 선택
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  점검하려는 워밍업 활동을 선택하세요. 각 활동마다 예시 동료 2명의 제출물과 피드백이 함께 준비됩니다.
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800">
                총 {PREVIEW_ACTIVITIES.length}개 활동 지원
              </span>
            </div>

            {/* 3 Equal-Height Choice Cards */}
            <div
              role="radiogroup"
              aria-label="체험할 활동"
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            >
              {PREVIEW_ACTIVITIES.map((act) => {
                const selected = problemId === act.id;
                const icon = act.sandboxType ? PROBLEM_ICONS[act.sandboxType] : "🍬";
                const radioId = `preview-activity-${act.id}`;
                return (
                  <label
                    key={act.id}
                    htmlFor={radioId}
                    aria-label={act.shortTitle}
                    className={`relative flex flex-col justify-between rounded-xl border-2 p-4 transition cursor-pointer select-none ${
                      selected
                        ? "border-blue-600 bg-blue-50/40 shadow-2xs"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                    }`}
                  >
                    <input
                      id={radioId}
                      type="radio"
                      name="problemId"
                      value={act.id}
                      checked={selected}
                      onChange={() => setProblemId(act.id)}
                      className="sr-only"
                    />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-base">
                            {icon}
                          </span>
                          <span>{act.shortTitle}</span>
                        </span>
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold ${
                            selected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-300 bg-white text-transparent"
                          }`}
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600">{act.subtitle}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1 border-t border-slate-100 pt-2.5">
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                        {act.jevBadge}
                      </span>
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        {act.peerBadge}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Selected Activity Details Preview */}
            {selectedProblem && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base" aria-hidden="true">
                      {selectedMeta.sandboxType ? PROBLEM_ICONS[selectedMeta.sandboxType] : "🍬"}
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      {selectedProblem.title}
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    학생 화면에 표시될 문제 지시문 및 허용 행동
                  </span>
                </div>

                <p className="rounded-lg border border-slate-200/80 bg-white p-3 text-xs leading-relaxed text-slate-700">
                  {selectedProblem.prompt}
                </p>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="font-bold text-slate-700 mr-1">{allowedActions.length ? "허용된 행동:" : "조작 도구 없이 자연어로 계산 방법을 작성합니다. 반복형과 공식형을 지원하며, 해석이 불명확하면 검사를 보류합니다."}</span>
                  {allowedActions.map((act) => (
                    <span
                      key={act}
                      className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-600"
                    >
                      ✔ {act}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Section 2: Teacher Password & Launch Control */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                2. 교사 인증 및 체험 시작
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                교사 비밀번호를 확인한 뒤 선택한 활동({selectedMeta.shortTitle})의 새 체험 세션을 엽니다.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor="preview-teacher-password"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  교사 비밀번호
                </label>
                <input
                  id="preview-teacher-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="교사 관리 콘솔 비밀번호 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={busy || !password.trim()}
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50 cursor-pointer shrink-0 h-[42px]"
              >
                {busy ? "체험 준비 중…" : `‘${selectedMeta.shortTitle}’ 새 학생 체험 시작 ➔`}
              </button>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700"
              >
                ⚠️ {error}
              </p>
            )}

            <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-600 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-2.5">
                <strong className="font-bold text-slate-800 block">🔒 수업·연구 데이터 격리</strong>
                <span>실제 수업 명단·라운드·연구용 엑셀 내보내기와 완전히 분리된 별도 공간이 생성됩니다.</span>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <strong className="font-bold text-slate-800 block">🤖 실제 JEV 엔진 연동</strong>
                <span>서버에 연결된 실제 JEV API로 문장별 해석과 고정 테스트 케이스를 실행합니다.</span>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <strong className="font-bold text-slate-800 block">👤 브라우저 세션 전환</strong>
                <span>시작하면 이 브라우저의 학생 세션이 ‘90001 체험 학생’ 계정으로 바뀝니다.</span>
              </div>
            </div>
          </section>
        </form>
      </main>
    </div>
  );
}
