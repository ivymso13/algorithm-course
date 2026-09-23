import type { ActionType, AlgorithmExecutionState, JevStepEvaluation } from "./types";
import { applyConditionalSet, applySet, evaluateExpr, renderTemplate } from "./effectEngine";
import maxFindingSchema from "./problems/max-finding.json";

export interface ProblemAction {
  id: string;
  category: ActionType;
  description: string;
  /** Short label for a player-facing button, when `playable`. */
  buttonLabel?: string;
  /** Whether this action can be triggered directly as a button (some, like REPEAT, are pure narration over other playable actions). */
  playable?: boolean;
  playableNote?: string;
  appliesWhen: string;
  effect: {
    set?: Record<string, string>;
    conditionalSet?: { if: string; then: Record<string, string> };
    /** REPEAT actions only — see executionEngine's replayReferencedSteps. The
     * step range and body come from the student's own written steps, never
     * a schema-declared action list, so the engine can't silently complete
     * a strategy the student didn't actually write. */
    replayFromReferencedStep?: boolean;
    until?: string;
  };
  logTemplate: string;
}

export interface ProblemSchema {
  problemId: string;
  title: string;
  prompt: string;
  input: { numbers: number[] };
  state: Record<string, unknown>;
  actions: ProblemAction[];
  correctness: { formula: string; compareField: string };
}

// MVP: exactly one problem schema, wired in directly. Once a second problem
// is added, this becomes a lookup by problemId.
export const schema = maxFindingSchema as ProblemSchema;

export function asScope(state: AlgorithmExecutionState): Record<string, unknown> {
  return state as unknown as Record<string, unknown>;
}

/** Schema actions whose `appliesWhen` currently holds, given the state. */
export function candidateActions(state: AlgorithmExecutionState): ProblemAction[] {
  return schema.actions.filter((a) => Boolean(evaluateExpr(a.appliesWhen, asScope(state))));
}

/** Same as candidateActions, restricted to buttons a UI can offer directly (playable: true). */
export function playableCandidateActions(state: AlgorithmExecutionState): ProblemAction[] {
  return candidateActions(state).filter((a) => a.playable);
}

/**
 * Resolve a Jev evaluation to a concrete schema action. Prefers the precise
 * `actionId` a schema-aware service (JevService) returns; falls back to the
 * single currently-applicable action in that `category`, which is what lets
 * MockJevService (category-only) keep working unchanged.
 */
export function resolveAction(
  evaluation: Pick<JevStepEvaluation, "action" | "actionId">,
  state: AlgorithmExecutionState
): ProblemAction | undefined {
  if (evaluation.actionId) {
    const found = schema.actions.find((a) => a.id === evaluation.actionId);
    if (found) return found;
  }
  return candidateActions(state).find((a) => a.category === evaluation.action);
}

/** Applies a `set` or `conditionalSet` effect (not `loopBackTo` — see executionEngine's runRepeatAction). */
export function applyProblemAction(
  action: ProblemAction,
  state: AlgorithmExecutionState
): { state: AlgorithmExecutionState; logMessage: string } {
  let nextState = state;
  let condResult: boolean | undefined;

  if (action.effect.set) {
    nextState = applySet(asScope(state), action.effect.set) as unknown as AlgorithmExecutionState;
  } else if (action.effect.conditionalSet) {
    const result = applyConditionalSet(asScope(state), action.effect.conditionalSet);
    nextState = result.state as unknown as AlgorithmExecutionState;
    condResult = result.condResult;
  }
  // effect.loopBackTo is handled by the caller (executionEngine's runRepeatAction), not here.

  const context: Record<string, unknown> = {
    ...asScope(nextState),
    currentIndexDisplay: nextState.currentIndex + 1,
    condResult: condResult === undefined ? undefined : condResult ? "참" : "거짓",
  };
  return { state: nextState, logMessage: renderTemplate(action.logTemplate, context) };
}
