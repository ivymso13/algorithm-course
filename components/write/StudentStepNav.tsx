"use client";

/* Native <a> links intentionally avoid a client-router navigation bug seen in
 * some classroom browsers (see components/Navbar.tsx for the original fix):
 * after a next/link soft navigation, the destination page's client
 * components did not reliably hydrate, leaving buttons unresponsive. */

import { computeStepNavItems, type StepNumber } from "./stepNavItems";

export type { StepNumber };

interface StudentStepNavProps {
  currentStep: StepNumber;
  hasSubmitted: boolean;
}

export function StudentStepNav({ currentStep, hasSubmitted }: StudentStepNavProps) {
  const steps = computeStepNavItems(currentStep, hasSubmitted);

  return (
    <nav
      aria-label="학생 활동 3단계 내비게이션"
      className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-2.5 shadow-2xs"
    >
      <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto py-0.5">
        {steps.map((step, idx) => {
          const showArrow = idx < steps.length - 1;

          return (
            <div key={step.number} className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {step.isCurrent ? (
                <div
                  aria-current="step"
                  className="flex min-h-[40px] items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs sm:text-[13px] shadow-xs select-none"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-blue-700 text-[11px] font-black">
                    {step.isCompleted ? "✓" : step.number}
                  </span>
                  <span>{step.label}</span>
                </div>
              ) : step.isLocked ? (
                <div
                  title="알고리즘 제출 후 열립니다"
                  className="flex min-h-[40px] items-center gap-2 px-3.5 py-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 font-medium text-xs sm:text-[13px] opacity-75 select-none cursor-not-allowed"
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 text-[10px]"
                    aria-hidden="true"
                  >
                    🔒
                  </span>
                  <span>{step.label}</span>
                </div>
              ) : step.isCompleted ? (
                <a
                  href={step.href}
                  className="flex min-h-[40px] items-center gap-2 px-3.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold text-xs sm:text-[13px] hover:bg-emerald-100 hover:border-emerald-300 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                    ✓
                  </span>
                  <span>{step.label}</span>
                </a>
              ) : (
                <a
                  href={step.href}
                  className="flex min-h-[40px] items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-xs sm:text-[13px] hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                    {step.number}
                  </span>
                  <span>{step.label}</span>
                </a>
              )}

              {showArrow && (
                <span className="text-slate-300 text-xs select-none px-0.5" aria-hidden="true">
                  ➔
                </span>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
