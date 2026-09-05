import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "알고리즘 워밍업",
  description: "아이디어를 쓰고, 추천하고, 직접 따라 해보는 알고리즘 워밍업",
};


export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        {/* Hero Section */}
        <section className="text-center space-y-4">
          <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-800">오늘의 워밍업</div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
            아이디어를 쓰고, 추천하고, <br className="hidden sm:inline" />
            <span className="bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              그대로 따라 해보세요
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-600 leading-relaxed">
            프로그래밍 전 10분, 알고리즘 생각을 깨웁니다.
          </p>
        </section>

        {/* Student workflow card */}
        <section className="mx-auto w-full max-w-2xl">
          <div className="flex flex-col justify-between rounded-3xl border border-blue-200/80 bg-white p-6 sm:p-8 shadow-xs transition hover:shadow-md hover:border-blue-300">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl sm:text-4xl" aria-hidden="true">
                  ✍️
                </span>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  워밍업 시작
                </span>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                  워밍업 참여
                </h2>
                <p className="text-xs sm:text-sm font-medium text-slate-600 mt-1 leading-relaxed">
                  오늘의 문제를 직접 조작해보고, 단계별 알고리즘을 작성하여 다른 학생들의 아이디어와 비교·추천해보세요.
                </p>
              </div>

              {/* 3-Step Flow Preview */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-semibold text-slate-600">
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">
                  1 문제·실습
                </span>
                <span className="text-slate-400" aria-hidden="true">
                  ➔
                </span>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">
                  2 알고리즘 작성
                </span>
                <span className="text-slate-400" aria-hidden="true">
                  ➔
                </span>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">
                  3 아이디어·추천
                </span>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100">
              <a
                href="/write"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-6 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-blue-700 hover:shadow transition"
              >
                <span>워밍업 참여하러 가기</span>
                <span aria-hidden="true">➔</span>
              </a>
            </div>
          </div>
        </section>

        {/* How It Works Banner */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">진행 순서</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: "📝", text: "선생님이 문제 1개를 공개" },
              { icon: "✍️", text: "전원이 알고리즘 제출" },
              { icon: "🗳️", text: "익명 보드에서 서로 투표" },
              { icon: "✅", text: "골라서 단계 체크·체험" },
            ].map((step) => (
              <div key={step.text} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 space-y-1">
                <span className="text-lg">{step.icon}</span>
                <p className="text-[11px] font-semibold text-slate-700 leading-tight">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
