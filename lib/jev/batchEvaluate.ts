import { executeAlgorithm } from "./executionEngine";
import type { ExecutionResult, IJevService } from "./types";

/** One randomized trial's outcome. */
export interface BatchTrialResult {
  trialIndex: number;
  numbers: number[];
  executable: boolean;
  correct: boolean | null;
  failedStep: number | null;
  finalAnswer: number | null;
  correctAnswer: number;
  /** Human-readable reason this trial failed or was wrong, for UI examples. */
  failureReason?: string;
}

export interface BatchEvaluationSummary {
  totalTrials: number;
  correctCount: number;
  incorrectCount: number;
  errorCount: number;
  trials: BatchTrialResult[];
}

/** Produces one fresh randomized problem instance: the input the algorithm runs against, plus its known-correct answer. */
export type InstanceGenerator = () => { numbers: number[]; correctAnswer: number };

function failureReasonFor(result: ExecutionResult, correctAnswer: number): string | undefined {
  if (result.failureReason) return result.failureReason;
  if (result.correct === false) {
    return `제출한 답 ${result.finalState.output}은(는) 정답 ${correctAnswer}과(와) 다릅니다.`;
  }
  return undefined;
}

/**
 * Runs the SAME student-written algorithm against `trials` independently
 * randomized instances (not the one they solved by hand), through the exact
 * same evaluate-resolve-apply pipeline as a single run. A single successful
 * run can be luck — an algorithm with a real bug might still land on the
 * right answer for one particular arrangement. Running many tells you how
 * often it's actually right, and running it fast is exactly what Jev
 * ("System One") is for.
 *
 * Deliberately problem-agnostic: `generateInstance` is the only thing that
 * knows about "boxes of apples" (see the box-specific generator passed in
 * from the API route). Wiring a second activity later means writing one
 * more generator function, not touching this file.
 *
 * Infrastructure errors (JevApiError etc.) from any trial reject the
 * whole batch rather than being counted as algorithm errors; retrying is
 * the caller's decision.
 */
export async function batchEvaluate(
  steps: string[],
  trials: number,
  generateInstance: InstanceGenerator,
  options?: { threshold?: number; service?: IJevService; concurrency?: number }
): Promise<BatchEvaluationSummary> {
  const concurrency = Math.max(1, options?.concurrency ?? 5);
  const results: BatchTrialResult[] = new Array(trials);

  async function runOne(trialIndex: number) {
    const { numbers, correctAnswer } = generateInstance();
    const result = await executeAlgorithm(steps, { numbers }, {
      threshold: options?.threshold,
      service: options?.service,
    });
    const failureReason = failureReasonFor(result, correctAnswer);
    results[trialIndex] = {
      trialIndex,
      numbers,
      executable: result.executable,
      correct: result.correct,
      failedStep: result.failedStep,
      finalAnswer: result.finalState.output,
      correctAnswer,
      ...(failureReason ? { failureReason } : {}),
    };
  }

  // Bounded-concurrency batches — fast, without firing hundreds of Jev
  // calls at once.
  for (let i = 0; i < trials; i += concurrency) {
    const batch = Array.from({ length: Math.min(concurrency, trials - i) }, (_, j) => runOne(i + j));
    await Promise.all(batch);
  }

  return {
    totalTrials: trials,
    correctCount: results.filter((r) => r.correct === true).length,
    incorrectCount: results.filter((r) => r.correct === false).length,
    errorCount: results.filter((r) => !r.executable).length,
    trials: results,
  };
}
