import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PROBLEM_LABELS, PROBLEM_ICONS } from "@/lib/problemMeta";
import { PROBLEM_TYPES } from "@/lib/assignments";

export const metadata: Metadata = {
  title: "알고리즘 첫 수업 — 인간 컴퓨터 체험",
  description: "올바른 알고리즘의 재현성을 직접 검증하는 인간 컴퓨터 웹 활동",
};

const mainCards = [
  {
    href: "/write",
    badge: "1단계",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    title: "문제 풀이 & 알고리즘 작성",
    subtitle: "내가 컴퓨터에게 자연어로 지시 내리기",
    description:
      "배정된 2개 문제를 해결하는 절차(알고리즘)를 한 단계씩 명확히 서술하여 제출합니다. 실행자는 여러분의 문제 화면을 보지 못하므로 모든 판단 기준과 종료 조건을 빠짐없이 적어야 합니다.",
    icon: "✍️",
    actionText: "알고리즘 작성하러 가기 ➔",
    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  {
    href: "/execute",
    badge: "2단계",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    title: "인간 컴퓨터 실행 & 즉시 평가",
    subtitle: "다른 학생의 알고리즘을 그대로 수행하기",
    description:
      "다른 학생이 쓴 알고리즘만을 보고 허용된 조작 버튼으로 그대로 실행합니다. 내 생각이나 추측을 덧붙이지 않고 기계처럼 수행하여 알고리즘의 재현성을 테스트합니다.",
    icon: "🤖",
    actionText: "인간 컴퓨터 실행하기 ➔",
    buttonClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  {
    href: "/teacher",
    badge: "교사용",
    badgeColor: "bg-slate-800 text-white border-slate-700",
    title: "교사용 관리 대시보드",
    subtitle: "실시간 제출 현황 및 마무리 토론 뷰",
    description:
      "학급 학생들의 1·2단계 제출 현황을 실시간으로 모니터링하고, 2단계를 학급 전체에 개방하며, 문제별 사례를 프로젝트 화면으로 띄워 수업 마무리 토론을 진행합니다.",
    icon: "📊",
    actionText: "교사용 화면 입장 ➔",
    buttonClass: "bg-slate-900 hover:bg-slate-800 text-white",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
        {/* Hero Section */}
        <section className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-800 shadow-2xs">
            <span>✨ 알고리즘 첫 수업 웹 활동</span>
            <span className="text-blue-300">•</span>
            <span>인간 컴퓨터 체험 (Human Computer)</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
            올바른 알고리즘의 본질, <br className="hidden sm:inline" />
            <span className="bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              재현성(Reproducibility)
            </span>
            을 직접 테스트해보세요
          </h1>

          <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-600 leading-relaxed">
            &ldquo;올바른 알고리즘이라면, 처음 보는 사람이 그대로 따라 해도 항상 같은 결과가 나와야 한다.&rdquo;
            <br />
            정답을 맞히는 게임이 아니라, 내가 쓴 설명이 기계처럼 오차 없이 실행되는지 확인하는 상호 실행 활동입니다.
          </p>
        </section>

        {/* 3 Core Workflow Cards */}
        <section className="grid gap-6 md:grid-cols-3">
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

                <p className="text-xs text-slate-600 leading-relaxed">
                  {card.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <Link
                  href={card.href}
                  className={`flex w-full items-center justify-center rounded-xl py-2.5 px-4 text-xs font-bold transition shadow-xs ${card.buttonClass}`}
                >
                  {card.actionText}
                </Link>
              </div>
            </div>
          ))}
        </section>

        {/* 4 Problem Types Preview Banner */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              🧩 다루는 4가지 알고리즘 문제 유형
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              학생 1인당 작성 2개 + 실행 2개 배정
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PROBLEM_TYPES.map((type) => (
              <div
                key={type}
                className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{PROBLEM_ICONS[type]}</span>
                  <h4 className="text-xs font-bold text-slate-800">
                    {PROBLEM_LABELS[type]}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {type === "12coins" && "양팔저울 3회 이내로 무게가 다른 가짜 동전 찾기"}
                  {type === "card" && "오름차순 뒤집힌 카드에서 이진 탐색으로 목표 숫자 찾기"}
                  {type === "josephus" && "원형으로 둘러앉아 매 k번째 사람을 제거해 최후 1인 찾기"}
                  {type === "pancake" && "위에서 k장 뒤집기 조작만으로 오름차순 팬케이크 정렬"}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Pedagogical Step Guide Footer */}
        <section className="rounded-2xl border border-blue-100 bg-linear-to-r from-blue-50/60 to-indigo-50/60 p-6 text-center space-y-2">
          <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
            📖 수업 진행 순서
          </h4>
          <p className="text-xs sm:text-sm text-slate-700">
            <strong>1. 학번+이름 로그인</strong> ➔ <strong>2. 배정된 2문제 알고리즘 작성 & 제출</strong> ➔{" "}
            <strong>3. 교사의 2단계 개방</strong> ➔ <strong>4. 다른 학생 알고리즘 인간 컴퓨터 실행 & 채점</strong> ➔{" "}
            <strong>5. 학급 전체 마무리 토론</strong>
          </p>
        </section>
      </main>
    </div>
  );
}
