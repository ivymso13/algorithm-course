import type { ActionType, AlgorithmExecutionState, ExecutionResult, IJevService, JevStepEvaluation, TraceEntry } from "./types";
import { DEFAULT_INITIAL_STATE, JEV_EXECUTION_THRESHOLD } from "./types";
import { MockJevService } from "./mockService";
import { evaluateExpr } from "./effectEngine";
import { splitCompoundStep } from "./compoundStep";
import { applyProblemAction, asScope, isReplayAction, resolveAction, schema, type ProblemAction } from "./problemSchema";

/** Hard cap on loop iterations. Hitting it is an algorithm failure, never a silent success. */
export const MAX_REPEAT_ITERATIONS = 1000;
/**
 * Default cap on service evaluations (≈ paid Jev calls) per run. The
 * documented forward-scan algorithm on the largest box instance (12) needs
 * 37; running out is an algorithm failure at the step that would exceed it.
 */
export const MAX_EVALUATIONS_PER_RUN = 60;

const DEFAULT_UNCLEAR_REASON = "이 단계만으로는 실행할 행동을 하나로 결정하기 어렵습니다.";
export const NO_OUTPUT_REASON = "정답을 제출(출력)하는 단계가 없어 결과를 채점할 수 없습니다.";
const SUPPORTED_LOOP_EXAMPLE = "'확인하지 않은 상자가 있으면 3단계부터 반복한다'";

/**
 * The one loop shape the engine supports: a forward scan that replays the
 * student's own steps from an explicitly numbered start step up to the step
 * just before the REPEAT, while unchecked boxes remain. Anything else
 * (counted loops, missing/negated conditions, arbitrary ranges) is refused
 * with a clear reason rather than being silently reinterpreted as
 * "walk to the right edge".
 */
type LoopSpec = { ok: true; startStep: number } | { ok: false; reason: string };

const STEP_REF = /(\d+)\s*(?:번째\s*)?단계/g;
const COUNTED_LOOP = /\d+\s*(?:번|회)\s*(?:더\s*)?반복/;
const REMAINING_ITEMS = /(?:확인하지\s*않은|남은|남아\s*있는)\s*(?:상자|숫자)/;
const REMAINING_ITEMS_POSITIVE = /(?:있으면|있다면|있는\s*동안|없을\s*때까지)/;
const UNTIL_LAST_ITEM = /(?:마지막|끝)\s*(?:상자|숫자)[^.]*까지/;

export function parseForwardScanLoop(instruction: string, repeatStepNumber: number): LoopSpec {
  if (COUNTED_LOOP.test(instruction)) {
    return {
      ok: false,
      reason: `정해진 횟수만큼 반복하는 것은 지원하지 않습니다. ${SUPPORTED_LOOP_EXAMPLE}처럼 써야 합니다.`,
    };
  }

  const refs = [...instruction.matchAll(STEP_REF)].map((m) => Number(m[1]));
  if (refs.length === 0 || refs[0] < 1 || refs[0] >= repeatStepNumber) {
    return {
      ok: false,
      reason: `반복을 시작할 단계 번호가 명확하지 않습니다 (예: ${SUPPORTED_LOOP_EXAMPLE}처럼 써야 합니다).`,
    };
  }
  // "3단계부터 5단계까지" is fine only when it ends right before this REPEAT step.
  if (refs.length > 2 || (refs.length === 2 && refs[1] !== repeatStepNumber - 1)) {
    return {
      ok: false,
      reason: `반복 범위는 'N단계부터' 이 반복 단계 바로 앞까지만 지원합니다 (예: ${SUPPORTED_LOOP_EXAMPLE}).`,
    };
  }

  const scansRemaining = REMAINING_ITEMS.test(instruction) && REMAINING_ITEMS_POSITIVE.test(instruction);
  if (!scansRemaining && !UNTIL_LAST_ITEM.test(instruction)) {
    return {
      ok: false,
      reason: `반복을 언제 멈출지(종료 조건)가 없거나 지원하지 않는 형태입니다. ${SUPPORTED_LOOP_EXAMPLE}처럼 써야 합니다.`,
    };
  }

  return { ok: true, startStep: refs[0] };
}

/** What one evaluated step means for the engine. */
type StepPlan =
  | { kind: "fail"; reason: string }
  | { kind: "stop" }
  | { kind: "repeat"; action: ProblemAction }
  | { kind: "apply"; action: ProblemAction };

function planStep(evaluation: JevStepEvaluation, state: AlgorithmExecutionState, threshold: number): StepPlan {
  if (!evaluation.executable) {
    return { kind: "fail", reason: evaluation.reason || DEFAULT_UNCLEAR_REASON };
  }
  // Fail closed: a service claiming "executable" without a valid confidence
  // at or above the threshold is not trusted.
  if (typeof evaluation.confidence !== "number" || !Number.isFinite(evaluation.confidence) || evaluation.confidence < threshold) {
    return { kind: "fail", reason: "판단 확신도가 없거나 기준에 미치지 못합니다." };
  }
  // STOP is engine-level (termination), not a schema state change.
  if (evaluation.action === "STOP" && !schema.actions.some((a) => a.category === "STOP")) {
    return { kind: "stop" };
  }
  const resolved = resolveAction(evaluation, state);
  if (!resolved.ok) return { kind: "fail", reason: resolved.reason };
  return isReplayAction(resolved.action)
    ? { kind: "repeat", action: resolved.action }
    : { kind: "apply", action: resolved.action };
}

type LoopOutcome =
  | { status: "done"; state: AlgorithmExecutionState }
  | { status: "stopped"; state: AlgorithmExecutionState }
  | { status: "failed"; state: AlgorithmExecutionState; failedStep: number; reason: string };

export interface ExecuteAlgorithmOptions {
  threshold?: number;
  service?: IJevService;
  /** Defaults to MAX_EVALUATIONS_PER_RUN. */
  maxEvaluations?: number;
}

/**
 * Model-independent execution engine for natural language algorithms.
 * Evaluates each step sequentially with the injected Jev service, halts
 * immediately upon failure without arbitrarily completing omitted
 * information, and maintains strict separation between 'executable' and
 * 'correct'. State transitions themselves come from the declarative
 * per-problem JSON schema (lib/jev/problems/*.json) via effectEngine, not
 * from guessing at the student's wording.
 *
 * Every step must resolve to exactly one schema action whose appliesWhen
 * holds; otherwise the run fails at that step. Grading uses only the
 * explicitly submitted `output` — never the memo as a fallback.
 *
 * REPEAT is deliberately NOT a schema-declared action sequence: it replays
 * the student's own referenced steps (e.g. "3단계부터 반복한다") through this
 * same evaluate-plan-apply pipeline. If the student never wrote a
 * comparison inside that range, the memo never updates during the replay —
 * the engine does not privately know the "find the max" strategy and never
 * substitutes it in. An incomplete algorithm should run to completion and
 * land on a wrong answer, not a suspiciously correct one.
 *
 * Service errors (JevApiError / JevConfigurationError) are NOT turned
 * into algorithm failures: they propagate to the caller, which owns retries.
 */
export async function executeAlgorithm(
  steps: string[],
  initialState?: Partial<AlgorithmExecutionState>,
  options?: ExecuteAlgorithmOptions
): Promise<ExecutionResult> {
  const threshold = options?.threshold ?? JEV_EXECUTION_THRESHOLD;
  const service = options?.service ?? new MockJevService();
  const maxEvaluations = options?.maxEvaluations ?? MAX_EVALUATIONS_PER_RUN;
  const budgetReason = `실행에 필요한 판단 횟수가 한도(${maxEvaluations}회)를 넘었습니다. 반복이 너무 길거나 끝나지 않습니다.`;

  let state: AlgorithmExecutionState = {
    ...DEFAULT_INITIAL_STATE,
    ...(initialState ?? {}),
    numbers: initialState?.numbers ? [...initialState.numbers] : [...DEFAULT_INITIAL_STATE.numbers],
  };

  const rawResponses: unknown[] = [];
  const evaluations: JevStepEvaluation[] = [];
  const trace: TraceEntry[] = [];

  const nonBlankSteps = steps.map((s) => s.trim()).filter((s) => s.length > 0);

  const diagnostics = (executedSteps: number): ExecutionResult["diagnostics"] => ({
    totalSteps: nonBlankSteps.length,
    executedSteps,
    threshold,
    evaluations,
    mode: service.mode,
    rawResponses,
  });

  if (nonBlankSteps.length === 0) {
    return {
      executable: false,
      correct: null,
      failedStep: null,
      finalState: state,
      trace: [],
      diagnostics: { totalSteps: 0, executedSteps: 0, threshold, evaluations: [], mode: service.mode },
    };
  }

  const stepClauses = nonBlankSteps.map(splitCompoundStep);

  const budgetExhausted = () => evaluations.length >= maxEvaluations;

  async function evaluate(stepNumber: number, clause: number, current: AlgorithmExecutionState): Promise<JevStepEvaluation> {
    const evaluation = await service.evaluateStep({
      stepIndex: stepNumber,
      stepText: stepClauses[stepNumber - 1][clause],
      allSteps: nonBlankSteps,
      currentState: current,
      threshold,
    });
    evaluations.push(evaluation);
    if (evaluation.rawResponse) rawResponses.push(evaluation.rawResponse);
    return evaluation;
  }

  function pushTrace(entry: Omit<TraceEntry, "instruction"> & { iteration?: number }) {
    const instruction = nonBlankSteps[entry.stepNumber - 1];
    trace.push({
      ...entry,
      instruction: entry.iteration ? `[반복 ${entry.iteration}회차] ${instruction}` : instruction,
    });
  }

  function failTrace(stepNumber: number, action: ActionType, before: AlgorithmExecutionState, reason: string, iteration?: number) {
    pushTrace({
      stepNumber,
      action,
      status: "failed",
      logMessage: iteration
        ? `→ 반복 중 ${stepNumber}단계를 실행할 수 없습니다: ${reason}`
        : `→ ${stepNumber}단계를 실행할 수 없습니다: ${reason}`,
      stateBefore: before,
      stateAfter: { ...before },
      failureReason: reason,
      iteration,
    });
  }

  function budgetTrace(stepNumber: number, before: AlgorithmExecutionState, iteration?: number) {
    failTrace(stepNumber, "UNKNOWN", before, budgetReason, iteration);
  }

  function stopTrace(stepNumber: number, evaluation: JevStepEvaluation, before: AlgorithmExecutionState, after: AlgorithmExecutionState, iteration?: number) {
    pushTrace({
      stepNumber,
      action: evaluation.action,
      status: "success",
      logMessage: "→ 실행 종료",
      stateBefore: before,
      stateAfter: { ...after },
      iteration,
    });
  }

  type StepRun =
    | { kind: "done" | "stop"; state: AlgorithmExecutionState }
    | { kind: "fail"; state: AlgorithmExecutionState; reason: string }
    | { kind: "repeat"; state: AlgorithmExecutionState; action: ProblemAction; evaluation: JevStepEvaluation };

  /**
   * Runs one student step: each of its clauses (see splitCompoundStep) is
   * judged and applied in order under the same step number. A REPEAT is
   * handed back to the caller, and only allowed as a step of its own.
   */
  async function runStep(stepNumber: number, current: AlgorithmExecutionState, iteration?: number): Promise<StepRun> {
    const clauses = stepClauses[stepNumber - 1];
    for (let clause = 0; clause < clauses.length; clause++) {
      const before = { ...current };
      if (budgetExhausted()) {
        budgetTrace(stepNumber, before, iteration);
        return { kind: "fail", state: current, reason: budgetReason };
      }
      const evaluation = await evaluate(stepNumber, clause, current);
      const plan = planStep(evaluation, current, threshold);

      if (plan.kind === "repeat" && clauses.length === 1) {
        return { kind: "repeat", state: current, action: plan.action, evaluation };
      }
      if (plan.kind === "fail" || plan.kind === "repeat") {
        const reason = plan.kind === "fail" ? plan.reason : "반복은 다른 행동과 나눠 한 단계로 따로 써야 합니다.";
        failTrace(stepNumber, evaluation.action, before, reason, iteration);
        return { kind: "fail", state: current, reason };
      }
      if (plan.kind === "stop") {
        current = { ...current, isTerminated: true };
        stopTrace(stepNumber, evaluation, before, current, iteration);
        return { kind: "stop", state: current };
      }

      const applied = applyProblemAction(plan.action, current);
      current = applied.state;
      pushTrace({
        stepNumber,
        action: evaluation.action,
        status: "success",
        logMessage: iteration ? `→ [반복 ${iteration}회차] ${applied.logMessage.replace(/^→ /, "")}` : applied.logMessage,
        stateBefore: before,
        stateAfter: { ...current },
        iteration,
      });
    }
    return { kind: "done", state: current };
  }

  /**
   * Replays steps [startStep, repeatStepNumber - 1] until the schema's
   * `until` holds. Fails (never silently succeeds) when a loop cannot
   * terminate: an iteration that starts from a state already seen at the
   * start of an earlier iteration can only repeat forever, and the
   * iteration cap is a last-resort backstop.
   */
  async function runLoop(
    repeatStepNumber: number,
    action: ProblemAction,
    current: AlgorithmExecutionState
  ): Promise<LoopOutcome> {
    const spec = parseForwardScanLoop(nonBlankSteps[repeatStepNumber - 1], repeatStepNumber);
    if (!spec.ok) return { status: "failed", state: current, failedStep: repeatStepNumber, reason: spec.reason };
    const untilExpr = action.effect.until;
    if (!untilExpr) {
      return { status: "failed", state: current, failedStep: repeatStepNumber, reason: "이 반복에는 종료 조건이 정의되어 있지 않습니다." };
    }

    const seen = new Set<string>();
    let iteration = 0;
    while (!evaluateExpr(untilExpr, asScope(current))) {
      const key = JSON.stringify(current);
      if (seen.has(key)) {
        return {
          status: "failed",
          state: current,
          failedStep: repeatStepNumber,
          reason: "반복을 한 바퀴 돌아도 다음 상자로 나아가지 않아 반복이 끝나지 않습니다 (무한 반복).",
        };
      }
      seen.add(key);
      if (iteration >= MAX_REPEAT_ITERATIONS) {
        return {
          status: "failed",
          state: current,
          failedStep: repeatStepNumber,
          reason: `반복이 ${MAX_REPEAT_ITERATIONS}회를 넘어도 끝나지 않습니다 (무한 반복).`,
        };
      }
      iteration++;

      for (let stepNumber = spec.startStep; stepNumber < repeatStepNumber; stepNumber++) {
        const before = { ...current };
        const run = await runStep(stepNumber, current, iteration);
        current = run.state;
        if (run.kind === "fail") return { status: "failed", state: current, failedStep: stepNumber, reason: run.reason };
        if (run.kind === "repeat") {
          const reason = "반복 안에서 또 반복을 참조하는 단계는 지원하지 않습니다.";
          failTrace(stepNumber, run.evaluation.action, before, reason, iteration);
          return { status: "failed", state: current, failedStep: stepNumber, reason };
        }
        if (run.kind === "stop") return { status: "stopped", state: current };
      }
    }
    return { status: "done", state: current };
  }

  function failure(failedStep: number, executedSteps: number, reason: string): ExecutionResult {
    return {
      executable: false,
      correct: null,
      failedStep,
      failureReason: reason,
      finalState: state,
      trace,
      diagnostics: diagnostics(executedSteps),
    };
  }

  let executedSteps = 0;
  for (let i = 0; i < nonBlankSteps.length && !state.isTerminated; i++) {
    const stepNumber = i + 1;
    const stateBefore: AlgorithmExecutionState = { ...state };
    const run = await runStep(stepNumber, state);
    state = run.state;

    if (run.kind === "fail") return failure(stepNumber, i, run.reason);

    if (run.kind === "repeat") {
      const outcome = await runLoop(stepNumber, run.action, state);
      state = outcome.state;
      if (outcome.status === "failed") {
        // The REPEAT step's own failures (bad loop spec, nontermination)
        // have no inner trace entry yet — record one.
        if (outcome.failedStep === stepNumber) failTrace(stepNumber, run.evaluation.action, { ...state }, outcome.reason);
        return failure(outcome.failedStep, i, outcome.reason);
      }
      if (outcome.status === "stopped") {
        executedSteps = stepNumber;
        break;
      }
      pushTrace({
        stepNumber,
        action: run.evaluation.action,
        status: "success",
        logMessage: run.action.logTemplate,
        stateBefore,
        stateAfter: { ...state },
      });
    }
    executedSteps = stepNumber;
    if (run.kind === "stop") break;
  }

  // Graded only on the explicitly submitted answer; the memo is never used
  // as a stand-in for a missing submission. A run that never outputs is an
  // execution failure (no single step is at fault), not a wrong answer.
  if (state.output === null) {
    return {
      executable: false,
      correct: null,
      failedStep: null,
      failureReason: NO_OUTPUT_REASON,
      finalState: state,
      trace,
      diagnostics: diagnostics(executedSteps),
    };
  }

  const trueMax = Math.max(...state.numbers);

  return {
    executable: true,
    correct: state.output === trueMax,
    failedStep: null,
    finalState: state,
    trace,
    diagnostics: diagnostics(executedSteps),
  };
}
