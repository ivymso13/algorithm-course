/**
 * Pure derivation of the 3-step student nav's per-step state — no React/Next
 * import, so it can be unit-tested directly (see `StudentStepNav.tsx`, which
 * only handles rendering these into markup).
 *
 * `label` must NOT include the step number: `StudentStepNav` already renders
 * `number` on its own in a circular badge next to `label` — prefixing the
 * label with the number too is exactly the "3 3 아이디어·추천" duplicate-digit
 * bug this file previously had.
 *
 * The flow is 3 steps, not 4: peer-algorithm "체험" (/execute) is reached as
 * a sub-flow from inside step 3's board (see app/write/explore/page.tsx),
 * not as its own top-level numbered step.
 */

export type StepNumber = 1 | 2 | 3;

export type StepNavItem = {
  number: StepNumber;
  label: string;
  href: string;
  isCurrent: boolean;
  isCompleted: boolean;
  isLocked: boolean;
};

const STEP_DEFS: { number: StepNumber; label: string; href: string }[] = [
  { number: 1, label: "문제·실습", href: "/write" },
  { number: 2, label: "알고리즘 작성", href: "/write/algorithm" },
  { number: 3, label: "아이디어·추천", href: "/write/explore" },
];

/**
 * Steps 1-2 are never locked, so a student can always step back to re-read
 * the problem or revise their algorithm. Step 3 stays locked until the
 * algorithm is submitted — that's the only real gate in the flow, and it's
 * enforced again independently by every step-3 API endpoint server-side
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
    // Step 3 is the flow's terminal step — there's nothing after it to mark
    // it "completed" against, so it simply stays uncompleted once reached.
    return { ...step, isCurrent, isCompleted: false, isLocked: !hasSubmitted };
  });
}
