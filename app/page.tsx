import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "알고리즘 워밍업",
  description: "아이디어를 쓰고, 추천하고, 직접 따라 해보는 알고리즘 워밍업",
};

const mainCards = [
  {
    href: "/write",
    badge: "1단계",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    title: "워밍업 참여",
    subtitle: "다 같이 푸는 문제에 알고리즘 제출",
    icon: "✍️",
    actionText: "워밍업 참여하러 가기 ➔",
    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  {
    href: "/execute",
    badge: "2단계",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    title: "알고리즘 체험",
    subtitle: "다른 학생의 알고리즘을 그대로 따라가기",
    icon: "🤖",
    actionText: "체험하러 가기 ➔",
    buttonClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
];

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

        {/* Student workflow cards */}
        <section className="grid gap-6 sm:grid-cols-2">
          {mainCards.map((card) => (
            <div
              key={card.href}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:shadow-md hover:border-slate-300"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{card.icon}</span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${card.badgeColor}`}
                  >
                    {card.badge}
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-snug">
                    {card.title}
                  </h2>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    {card.subtitle}
                  </p>
                </div>

              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <a
                  href={card.href}
                  className={`flex w-full items-center justify-center rounded-xl py-2.5 px-4 text-xs font-bold transition shadow-xs ${card.buttonClass}`}
                >
                  {card.actionText}
                </a>
              </div>
            </div>
          ))}
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
