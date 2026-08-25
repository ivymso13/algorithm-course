import type { ProblemType } from "@/lib/assignments";
import { coinsProblem } from "./coins";
import { cardsProblem } from "./cards";
import { josephusProblem } from "./josephus";
import { pancakeProblem } from "./pancake";
import type { ActionOutcome, GeneratedInstance, ProblemModule } from "./types";

export const PROBLEM_MODULES: Record<ProblemType, ProblemModule> = {
  "12coins": coinsProblem,
  card: cardsProblem,
  josephus: josephusProblem,
  pancake: pancakeProblem,
};

export function getProblemModule(type: ProblemType): ProblemModule {
  const mod = PROBLEM_MODULES[type];
  if (!mod) throw new Error(`unknown problem type: ${type}`);
  return mod;
}

export function generateInstance(type: ProblemType): GeneratedInstance<unknown> {
  return getProblemModule(type).generate();
}

export function publicInputFor(type: ProblemType, input: unknown): unknown {
  const mod = getProblemModule(type);
  return mod.publicInput ? mod.publicInput(input) : input;
}

export function applyProblemAction(
  type: ProblemType,
  state: unknown,
  input: unknown,
  action: string,
  params: Record<string, unknown>
): ActionOutcome {
  return getProblemModule(type).applyAction(state, input, action, params);
}

export type { ProblemModule, GeneratedInstance, ActionOutcome, LogEntry } from "./types";
