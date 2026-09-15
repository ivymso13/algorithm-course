/**
 * Pure derivation of the 4-step student nav's per-step state — no React/Next
 * import, so it can be unit-tested directly (see `StudentStepNav.tsx`, which
 * only handles rendering these into markup).
 *
 * `label` must NOT include the step number: `StudentStepNav` already renders
 * `number` on its own in a circular badge next to `label` — prefixing the
 * label with the number too would create a duplicate step number.
 * bug this file previously had.
 *
 * Peer-algorithm execution remains a sub-flow inside step 3; step 4 is the
 * author's aggregate reflection and final revision.
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
  { number: 1, label: "문제·실습", href: "/write" },
  { number: 2, label: "알고리즘 작성", href: "/write/algorithm" },
  { number: 3, label: "동료 평가", href: "/write/explore" },
  { number: 4, label: "자기 평가", href: "/write/reflect" },
];

/**
 * Steps 1-2 are never locked, so a student can always step back to re-read
 * the problem or revise their algorithm. Step 3 stays locked until the
 * algorithm is submitted — that's the only real gate in the flow, and it's
 * enforced again independently by every step-3 API endpoint server-side
 * regardless of what this nav renders.
 */
export function computeStepNavItems(currentStep: StepNumber, hasSubmitted: boolean, activityStage = 4): StepNavItem[] {
  return STEP_DEFS.map((step): StepNavItem => {
    const isCurrent = currentStep === step.number;
    const teacherLocked = step.number > activityStage;
    const submissionLocked = step.number >= 3 && !hasSubmitted;
    return { ...step, isCurrent, isCompleted: currentStep > step.number, isLocked: teacherLocked || submissionLocked };
  });
}
