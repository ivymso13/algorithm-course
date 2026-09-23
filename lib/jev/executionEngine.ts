import type { AlgorithmExecutionState, ExecutionResult, IJevService, JevStepEvaluation, TraceEntry } from "./types";
import { DEFAULT_INITIAL_STATE, JEV_EXECUTION_THRESHOLD } from "./types";
import { MockJevService } from "./mockService";
import { evaluateExpr } from "./effectEngine";
import { applyProblemAction, asScope, resolveAction } from "./problemSchema";

const MAX_REPEAT_ITERATIONS = 1000; // safety valve against a broken algorithm that never advances

/** "3단계부터" / "3번째 단계부터" → 3. Returns null if no step number is named. */
function extractReferencedStep(instruction: string): number | null {
  const match = instruction.match(/(\d+)\s*(?:번째\s*)?단계/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

interface StepRunResult {
  ok: boolean;
  state: AlgorithmExecutionState;
  logMessage: string;
  evaluation: JevStepEvaluation;
  failureReason?: string;
}

export interface ExecuteAlgorithmOptions {
  threshold?: number;
  service?: IJevService;
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
 * REPEAT is deliberately NOT a schema-declared action sequence: it replays
 * the student's own referenced steps (e.g. "3단계부터 반복한다") through this
 * same evaluate-resolve-apply pipeline. If the student never wrote a
 * comparison inside that range, the memo never updates during the replay —
 * the engine does not privately know the "find the max" strategy and never
 * substitutes it in. An incomplete algorithm should run to completion and
 * land on a wrong answer, not a suspiciously correct one.
 */
export async function executeAlgorithm(
  steps: string[],
  initialState?: Partial<AlgorithmExecutionState>,
  options?: ExecuteAlgorithmOptions
): Promise<ExecutionResult> {
  const threshold = options?.threshold ?? JEV_EXECUTION_THRESHOLD;
  const service = options?.service ?? new MockJevService();

  let state: AlgorithmExecutionState = {
    ...DEFAULT_INITIAL_STATE,
    ...(initialState ?? {}),
    numbers: initialState?.numbers ? [...initialState.numbers] : [...DEFAULT_INITIAL_STATE.numbers],
  };

  const rawResponses: unknown[] = [];
  const evaluations: JevStepEvaluation[] = [];
  const trace: TraceEntry[] = [];

  const nonBlankSteps = steps.map((s) => s.trim()).filter((s) => s.length > 0);

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

  /** Evaluate + resolve + apply exactly one instruction against `current`. Does not touch `trace`. */
  async function runStep(instruction: string, current: AlgorithmExecutionState): Promise<StepRunResult> {
    const evaluation = await service.evaluateStep({
      stepIndex: 0, // filled in by the caller's own numbering when relevant
      stepText: instruction,
      allSteps: nonBlankSteps,
      currentState: current,
      threshold,
    });
    evaluations.push(evaluation);
    if (evaluation.rawResponse) rawResponses.push(evaluation.rawResponse);

    if (!evaluation.executable) {
      return {
        ok: false,
        state: current,
        logMessage: "",
        evaluation,
        failureReason: evaluation.reason || "이 단계만으로는 실행할 행동을 하나로 결정하기 어렵습니다.",
      };
    }

    const resolved = resolveAction(evaluation, current);
    if (!resolved) {
      // Category has no matching schema action for this problem — apply no
      // state change, mirroring the old engine's generic fallback.
      return { ok: true, state: current, logMessage: "→ 단계 실행", evaluation };
    }
    if (resolved.effect.replayFromReferencedStep) {
      // A REPEAT step encountered while already inside a replay: refuse
      // rather than recurse — nested nautral-language loops aren't supported.
      return {
        ok: false,
        state: current,
        logMessage: "",
        evaluation,
        failureReason: "반복 안에서 또 반복을 참조하는 단계는 지원하지 않습니다.",
      };
    }
    const applied = applyProblemAction(resolved, current);
    return { ok: true, state: applied.state, logMessage: applied.logMessage, evaluation };
  }

  /**
   * Replays nonBlankSteps[refStep-1 .. repeatStepNumber-2] (1-based,
   * inclusive of the referenced step, up to but excluding the REPEAT step
   * itself) against `current`, re-running each through the exact same
   * evaluate-resolve-apply pipeline, until `untilExpr` holds. Returns the
   * first inner failure verbatim (as if the whole algorithm failed there).
   */
  async function replayReferencedSteps(
    repeatStepNumber: number,
    repeatInstruction: string,
    untilExpr: string,
    current: AlgorithmExecutionState
  ): Promise<{ ok: true; state: AlgorithmExecutionState } | { ok: false; failedStep: number; reason: string }> {
    const refStep = extractReferencedStep(repeatInstruction);
    if (refStep === null || refStep >= repeatStepNumber) {
      return {
        ok: false,
        failedStep: repeatStepNumber,
        reason: "반복을 시작할 단계 번호가 명확하지 않습니다 (예: '3단계부터 반복한다'처럼 써야 합니다).",
      };
    }

    let iteration = 0;
    while (!evaluateExpr(untilExpr, asScope(current)) && iteration < MAX_REPEAT_ITERATIONS) {
      iteration++;
      for (let idx = refStep - 1; idx <= repeatStepNumber - 2; idx++) {
        const innerStepNumber = idx + 1;
        const innerInstruction = nonBlankSteps[idx];
        const before = { ...current };
        const result = await runStep(innerInstruction, current);

        if (!result.ok) {
          trace.push({
            stepNumber: innerStepNumber,
            instruction: `[반복 ${iteration}회차] ${innerInstruction}`,
            action: result.evaluation.action,
            status: "failed",
            logMessage: `→ 반복 중 ${innerStepNumber}단계를 실행할 수 없습니다: ${result.failureReason}`,
            stateBefore: before,
            stateAfter: current,
            failureReason: result.failureReason,
            iteration,
          });
          return { ok: false, failedStep: innerStepNumber, reason: result.failureReason ?? "실행 실패" };
        }

        current = result.state;
        trace.push({
          stepNumber: innerStepNumber,
          instruction: `[반복 ${iteration}회차] ${innerInstruction}`,
          action: result.evaluation.action,
          status: "success",
          logMessage: `→ [반복 ${iteration}회차] ${result.logMessage.replace(/^→ /, "")}`,
          stateBefore: before,
          stateAfter: { ...current },
          iteration,
        });
      }
    }

    return { ok: true, state: current };
  }

  for (let i = 0; i < nonBlankSteps.length; i++) {
    const stepNumber = i + 1;
    const instruction = nonBlankSteps[i];
    const stateBefore: AlgorithmExecutionState = { ...state };

    // Peek the resolved action before running it, purely to detect a REPEAT
    // step — REPEAT needs the *step's own number* (for "3단계부터") and
    // drives its own trace entries via replayReferencedSteps, so it can't
    // go through the generic runStep path below.
    const evaluation = await service.evaluateStep({
      stepIndex: stepNumber,
      stepText: instruction,
      allSteps: nonBlankSteps,
      currentState: state,
      threshold,
    });
    evaluations.push(evaluation);
    if (evaluation.rawResponse) rawResponses.push(evaluation.rawResponse);

    if (!evaluation.executable) {
      const failureReason = evaluation.reason || "이 단계만으로는 실행할 행동을 하나로 결정하기 어렵습니다.";
      trace.push({
        stepNumber,
        instruction,
        action: evaluation.action,
        status: "failed",
        logMessage: `→ ${stepNumber}단계를 실행할 수 없습니다: ${failureReason}`,
        stateBefore,
        stateAfter: { ...state },
        failureReason,
      });
      return {
        executable: false,
        correct: null,
        failedStep: stepNumber,
        finalState: state,
        trace,
        diagnostics: { totalSteps: nonBlankSteps.length, executedSteps: i, threshold, evaluations, mode: service.mode, rawResponses },
      };
    }

    const resolved = resolveAction(evaluation, state);

    if (resolved?.effect.replayFromReferencedStep) {
      const untilExpr = resolved.effect.until ?? "true";
      const replayed = await replayReferencedSteps(stepNumber, instruction, untilExpr, state);

      if (!replayed.ok) {
        return {
          executable: false,
          correct: null,
          failedStep: replayed.failedStep,
          finalState: state,
          trace,
          diagnostics: { totalSteps: nonBlankSteps.length, executedSteps: i, threshold, evaluations, mode: service.mode, rawResponses },
        };
      }

      state = replayed.state;
      trace.push({
        stepNumber,
        instruction,
        action: evaluation.action,
        status: "success",
        logMessage: "→ 모든 상자 확인 완료 (반복 종료)",
        stateBefore,
        stateAfter: { ...state },
      });
      continue;
    }

    let logMessage = "→ 단계 실행";
    if (resolved) {
      const applied = applyProblemAction(resolved, state);
      state = applied.state;
      logMessage = applied.logMessage;
    }

    trace.push({
      stepNumber,
      instruction,
      action: evaluation.action,
      status: "success",
      logMessage,
      stateBefore,
      stateAfter: { ...state },
    });
  }

  const trueMax = Math.max(...state.numbers);
  const finalResultNumber = state.output !== null ? state.output : state.maxVal;
  const correct = finalResultNumber === trueMax;

  return {
    executable: true,
    correct,
    failedStep: null,
    finalState: state,
    trace,
    diagnostics: {
      totalSteps: nonBlankSteps.length,
      executedSteps: nonBlankSteps.length,
      threshold,
      evaluations,
      mode: service.mode,
      rawResponses,
    },
  };
}
