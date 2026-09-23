import { executeAlgorithm } from "./executionEngine";
import type { IJevService } from "./types";

/** One randomized trial's outcome. */
export interface BatchTrialResult {
  trialIndex: number;
  numbers: number[];
  executable: boolean;
  correct: boolean | null;
  failedStep: number | null;
  finalAnswer: number | null;
  correctAnswer: number;
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
    results[trialIndex] = {
      trialIndex,
      numbers,
      executable: result.executable,
      correct: result.correct,
      failedStep: result.failedStep,
      finalAnswer: result.finalState.output,
      correctAnswer,
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
