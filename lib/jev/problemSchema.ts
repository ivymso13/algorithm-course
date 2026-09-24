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

export function isReplayAction(action: ProblemAction): boolean {
  return Boolean(action.effect.replayFromReferencedStep);
}

/** Whether `action` may run from `state`. REPEAT's appliesWhen is its loop guard (zero iterations), not a precondition. */
export function actionApplies(action: ProblemAction, state: AlgorithmExecutionState): boolean {
  return isReplayAction(action) || Boolean(evaluateExpr(action.appliesWhen, asScope(state)));
}

export type ActionResolution = { ok: true; action: ProblemAction } | { ok: false; reason: string };

/**
 * Resolve a Jev evaluation to exactly one concrete schema action, or refuse.
 *
 * - An `actionId` (schema-aware services) must name a real schema action, and
 *   that action's `appliesWhen` must hold now — no falling back to a
 *   different action in the same category.
 * - Without `actionId`, the category must match exactly one action that
 *   applies now; zero or several is a refusal, never a guess.
 */
export function resolveAction(
  evaluation: Pick<JevStepEvaluation, "action" | "actionId">,
  state: AlgorithmExecutionState
): ActionResolution {
  if (evaluation.actionId !== undefined) {
    const found = schema.actions.find((a) => a.id === evaluation.actionId);
    if (!found) {
      return { ok: false, reason: `이 문제에 정의되지 않은 행동(${evaluation.actionId})입니다.` };
    }
    if (!actionApplies(found, state)) {
      return { ok: false, reason: `지금 상태에서는 이 행동을 할 수 없습니다: ${found.description}` };
    }
    return { ok: true, action: found };
  }

  const inCategory = schema.actions.filter((a) => a.category === evaluation.action);
  const applicable = inCategory.filter((a) => actionApplies(a, state));
  if (applicable.length === 1) return { ok: true, action: applicable[0] };
  if (applicable.length > 1) {
    return { ok: false, reason: "이 단계가 가리키는 행동이 여러 가지로 해석될 수 있어 하나로 정할 수 없습니다." };
  }
  if (inCategory.length > 0) {
    return { ok: false, reason: "지금 상태에서는 이 단계의 행동을 할 수 없습니다." };
  }
  return { ok: false, reason: "이 단계에 해당하는 행동이 이 문제에 정의되어 있지 않습니다." };
}

/** Applies a `set` or `conditionalSet` effect (not `replayFromReferencedStep` — see executionEngine). */
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
  // effect.replayFromReferencedStep is handled by the caller (executionEngine), not here.

  const context: Record<string, unknown> = {
    ...asScope(nextState),
    currentIndexDisplay: nextState.currentIndex + 1,
    condResult: condResult === undefined ? undefined : condResult ? "참" : "거짓",
  };
  return { state: nextState, logMessage: renderTemplate(action.logTemplate, context) };
}
