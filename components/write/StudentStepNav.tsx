"use client";

import Link from "next/link";
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
      aria-label="학생 활동 단계 내비게이션"
      className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-2.5 shadow-2xs"
    >
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-0.5">
        {steps.map((step, idx) => {
          const showArrow = idx < steps.length - 1;

          return (
            <div key={step.number} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {step.isCurrent ? (
                <div
                  aria-current="step"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-xs"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-blue-700 text-[11px] font-black">
                    {step.isCompleted ? "✓" : step.number}
                  </span>
                  <span>{step.label}</span>
                </div>
              ) : step.isLocked ? (
                <div
                  title="2단계 알고리즘 제출 후 열립니다"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 font-medium text-xs opacity-75 select-none cursor-not-allowed"
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 text-[10px]"
                    aria-hidden="true"
                  >
                    🔒
                  </span>
                  <span>{step.label}</span>
                </div>
              ) : step.isCompleted ? (
                <Link
                  href={step.href}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold text-xs hover:bg-emerald-100 transition cursor-pointer"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                    ✓
                  </span>
                  <span>{step.label}</span>
                </Link>
              ) : (
                <Link
                  href={step.href}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-xs hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                    {step.number}
                  </span>
                  <span>{step.label}</span>
                </Link>
              )}

              {showArrow && (
                <span className="text-slate-300 text-xs select-none" aria-hidden="true">
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
