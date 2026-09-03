/**
 * Pure derivation of the 4-step student nav's per-step state — no React/Next
 * import, so it can be unit-tested directly (see `StudentStepNav.tsx`, which
 * only handles rendering these into markup).
 */

export type StepNumber = 1 | 2 | 3 | 4;

export type StepNavItem = {
  number: StepNumber;
  label: string;
  href: string;
  isCurrent: boolean;
  isCompleted: boolean;
  isLocked: boolean;
};

const STEP_DEFS: { number: StepNumber; label: string; href: string }[] = [
  { number: 1, label: "1 문제·실습", href: "/write" },
  { number: 2, label: "2 알고리즘 작성", href: "/write/algorithm" },
  { number: 3, label: "3 아이디어·추천", href: "/write/explore" },
  { number: 4, label: "4 체험", href: "/execute" },
];

/**
 * Steps 1-2 are never locked, so a student can always step back to re-read
 * the problem or revise their algorithm. Steps 3-4 stay locked until the
 * algorithm is submitted — that's the only real gate in the flow, and it's
 * enforced again independently by every step-3/4 API endpoint server-side
 * regardless of what this nav renders.
 */
export function computeStepNavItems(currentStep: StepNumber, hasSubmitted: boolean): StepNavItem[] {
  return STEP_DEFS.map((step): StepNavItem => {
    const isCurrent = currentStep === step.number;
    if (step.number <= 2) {
      return {
        ...step,
        isCurrent,
        isCompleted: step.number === 1 ? currentStep > 1 || hasSubmitted : hasSubmitted,
        isLocked: false,
      };
    }
    return {
      ...step,
      isCurrent,
      isCompleted: step.number === 3 ? currentStep === 4 : false,
      isLocked: !hasSubmitted,
    };
  });
}
