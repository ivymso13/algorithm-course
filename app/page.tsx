import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "알고리즘 워밍업",
  description: "문제를 만져보고, 생각을 쓰고, 함께 나누는 10분 알고리즘 워밍업",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
        {/* Hero Section */}
        <section className="text-center space-y-5 pt-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/90 px-4 py-1.5 text-xs font-semibold text-blue-800 shadow-2xs">
            <span className="flex h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
            <span>수업 전 10분 알고리즘 워밍업</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight sm:leading-[1.2]">
            문제를 만져보고, 생각을 쓰고, <br className="hidden sm:inline" />
            <span className="bg-linear-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent">
              함께 나누는 알고리즘 워밍업
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-600 leading-relaxed">
            프로그래밍 실습 전 10분, 인터랙티브 샌드박스로 문제 감을 잡고 나만의 단계별 알고리즘을 작성하여 동료들과 아이디어를 공유해보세요.
          </p>

          {/* Direct Hero CTA Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 sm:pt-3">
            <a
              href="/write"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-2xl bg-blue-600 px-8 py-3.5 text-sm sm:text-base font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/30 transition-all cursor-pointer"
            >
              <span>워밍업 바로 시작하기</span>
              <span aria-hidden="true">➔</span>
            </a>
          </div>
        </section>

        {/* 3-Step Learning Journey Showcase Card */}
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 md:p-10 shadow-xs space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Learning Flow</span>
              <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900 mt-0.5">
                수업 진행 3단계
              </h2>
            </div>
            <span className="self-start sm:self-auto rounded-full bg-blue-50 border border-blue-200/80 px-3 py-1 text-xs font-semibold text-blue-700">
              ⏱️ 10분 완성 코스
            </span>
          </div>

          {/* 3 Steps Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
            {/* Step 1 */}
            <div className="relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 transition hover:bg-white hover:border-blue-300 hover:shadow-md">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-xl shadow-2xs" aria-hidden="true">
                    🧩
                  </span>
                  <span className="rounded-full bg-white border border-blue-200 px-2.5 py-0.5 text-xs font-extrabold text-blue-700">
                    STEP 1
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">문제 확인 &amp; 실습</h3>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    문제를 눈으로만 읽지 않고, 인터랙티브 샌드박스에서 직접 데이터를 조작해보며 문제의 핵심 패턴을 발견합니다.
                  </p>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-200/70 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <span>첫 진입 화면</span>
                <span className="text-blue-600 font-bold">1단계 ➔</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 transition hover:bg-white hover:border-indigo-300 hover:shadow-md">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-xl shadow-2xs" aria-hidden="true">
                    ✍️
                  </span>
                  <span className="rounded-full bg-white border border-indigo-200 px-2.5 py-0.5 text-xs font-extrabold text-indigo-700">
                    STEP 2
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">알고리즘 작성</h3>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    머릿속 해결책을 순서대로 명확히 쪼개어 단계별 자연어 알고리즘으로 작성하고 학급 보드에 제출합니다.
                  </p>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-200/70 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <span>풀이 제출 완료</span>
                <span className="text-indigo-600 font-bold">2단계 ➔</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 transition hover:bg-white hover:border-emerald-300 hover:shadow-md">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-xl shadow-2xs" aria-hidden="true">
                    💡
                  </span>
                  <span className="rounded-full bg-white border border-emerald-200 px-2.5 py-0.5 text-xs font-extrabold text-emerald-700">
                    STEP 3
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">아이디어 추천 &amp; 체험</h3>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    새로운 랜덤 문제로 친구들의 알고리즘을 차례대로 실습해보고, 4종 추천 투표와 단계별 체험으로 시야를 넓힙니다.
                  </p>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-200/70 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <span>익명 상호 평가</span>
                <span className="text-emerald-600 font-bold">3단계 ➔</span>
              </div>
            </div>
          </div>

          {/* Integrated Action Banner inside Showcase */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-linear-to-r from-blue-600 to-indigo-600 p-5 sm:p-6 text-white shadow-md">
            <div className="space-y-1 text-center sm:text-left">
              <p className="text-sm sm:text-base font-bold">오늘 수업의 워밍업에 참여해보세요</p>
              <p className="text-xs text-blue-100">별도 가입 없이 학교와 학번만 입력하면 바로 시작할 수 있습니다.</p>
            </div>
            <a
              href="/write"
              className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-xs sm:text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50 transition cursor-pointer"
            >
              <span>워밍업 참여하러 가기</span>
              <span aria-hidden="true">➔</span>
            </a>
          </div>
        </section>

        {/* Teacher / Administrator Gateway Banner */}
        <section className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-xs text-slate-600 shadow-2xs">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-base" aria-hidden="true">
              👩‍🏫
            </span>
            <span>
              <strong className="font-semibold text-slate-800">선생님이신가요?</strong> 새 문제 출제, 학생 제출 현황 확인 및 수업 관리는 교사용 대시보드를 이용하세요.
            </span>
          </div>
          <a
            href="/teacher"
            className="shrink-0 inline-flex items-center gap-1.5 font-bold text-blue-600 hover:text-blue-800 transition"
          >
            <span>교사 대시보드 바로가기</span>
            <span aria-hidden="true">➔</span>
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        <p>© 알고리즘 워밍업 · 인터랙티브 샌드박스로 시작하는 컴퓨팅 사고력</p>
      </footer>
    </div>
  );
}
