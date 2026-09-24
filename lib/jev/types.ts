/**
 * Types and interfaces for the Jev AI executor system.
 */

export type ActionType =
  | "ASSIGN" // 값을 저장하거나 변경 (Store or update a value)
  | "COMPARE" // 값을 비교하거나 조건을 확인 (Compare values or check conditions)
  | "MOVE" // 다음 또는 이전 대상으로 이동 (Move to next/prev element)
  | "CALCULATE" // 계산 수행 (Perform calculation)
  | "REPEAT" // 특정 단계나 행동 반복 (Repeat step or loop)
  | "OUTPUT" // 결과 제시 (Output result)
  | "STOP" // 실행 종료 (Terminate execution)
  | "UNKNOWN"; // 하나의 행동으로 결정하기 어려움 (Ambiguous or unclear)

/** Execution state for the 'Finding Maximum' problem */
export interface AlgorithmExecutionState {
  numbers: number[];
  currentIndex: number; // 0-based pointer into numbers
  currentValue: number | null;
  maxVal: number | null;
  output: number | null;
  isTerminated: boolean;
}

/** Individual step evaluation returned by Jev / MockJev */
export interface JevStepEvaluation {
  stepIndex: number; // 1-based
  stepText: string;
  executable: boolean;
  action: ActionType;
  /**
   * Must be a finite number; the engine fails closed (refuses the step) on
   * a missing/invalid value or one below the threshold, even if
   * `executable` is true.
   */
  confidence: number;
  /**
   * Which problem-schema action (lib/jev/problems/*.json `actions[].id`) this
   * step resolves to, when the service is schema-aware (see JevService).
   * When present it must name a schema action whose appliesWhen holds, or
   * the step fails. When absent, executionEngine uses the one schema action
   * in the `action` category that currently applies, and fails if there
   * are zero or several.
   */
  actionId?: string;
  reason?: string;
  rawResponse?: unknown;
}

/** Structured trace log entry for step-by-step visualization */
export interface TraceEntry {
  stepNumber: number;
  instruction: string;
  action: ActionType;
  status: "success" | "failed";
  logMessage: string;
  stateBefore: AlgorithmExecutionState;
  stateAfter: AlgorithmExecutionState;
  iteration?: number;
  failureReason?: string;
}

/** Final overall algorithm execution result */
export interface ExecutionResult {
  executable: boolean;
  correct: boolean | null;
  failedStep: number | null;
  /**
   * Why the run is not a correct result, when there is a specific reason:
   * the failed step's reason when `executable` is false, or a missing
   * submission when the algorithm ran but never output an answer.
   */
  failureReason?: string;
  finalState: AlgorithmExecutionState;
  trace: TraceEntry[];
  diagnostics: {
    totalSteps: number;
    executedSteps: number;
    threshold: number;
    evaluations: JevStepEvaluation[];
    mode: "mock" | "jev-api";
    rawResponses?: unknown[];
  };
}

/** Revision history record for versioning natural language algorithm drafts */
export interface AlgorithmVersionRecord {
  version: number;
  timestamp: string;
  steps: string[];
  result: ExecutionResult | null;
}

/**
 * Default constant threshold for strict Jev execution confidence.
 *
 * The spec's original 0.8 was an arbitrary starting guess, not a measured
 * value. Manual probing against the live Jev API (see project notes) found
 * that even textbook-clear steps only reliably score ~0.72-0.96 depending on
 * phase (initialization steps sit at the low end; steps updating an
 * already-named variable sit near the top), while genuinely ambiguous steps
 * ("크면 바꾼다", missing loop bounds, etc.) consistently score 0.05-0.15.
 * 0.65 sits with real margin above every observed ambiguous score and below
 * every observed clear score, incl. the hardest case (a first-step
 * initialization). This is still a small hand-probed sample, not a
 * validated study against human raters — revisit once real submissions are
 * available to check against.
 */
export const JEV_EXECUTION_THRESHOLD = 0.65;

/** Default input numbers for the prototype problem */
export const DEFAULT_INPUT_NUMBERS: number[] = [7, 3, 12, 5, 9];

/** The robot starts at box 1 (index 0), matching MaxBoxSandbox's default —
 * game and Jev execution share the same starting position. */
export const DEFAULT_INITIAL_STATE: AlgorithmExecutionState = {
  numbers: DEFAULT_INPUT_NUMBERS,
  currentIndex: 0,
  currentValue: null,
  maxVal: null,
  output: null,
  isTerminated: false,
};

/** Abstract interface for Jev / Mock services */
export interface IJevService {
  readonly mode: "mock" | "jev-api";
  evaluateStep(params: {
    stepIndex: number;
    stepText: string;
    allSteps: string[];
    currentState: AlgorithmExecutionState;
    threshold?: number;
  }): Promise<JevStepEvaluation>;
}
