import type { ProblemType } from "@/lib/assignments";

export type LogEntry = {
  at: string;
  type: "action" | "unexecutable";
  action?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  reason?: string;
};

export type GeneratedInstance<Input> = {
  input: Input;
  correctAnswer: number;
  referenceActionCount: number;
  state: unknown;
};

export type ActionOutcome = {
  state: unknown;
  result: unknown;
  counted: boolean;
};

export interface ProblemModule<Input = unknown> {
  type: ProblemType;
  label: string;
  /** Actions the "실행 불가" flag and every allowed-action button map to. */
  actions: readonly string[];
  generate(): GeneratedInstance<Input>;
  /** Strips fields the executor must not see (e.g. which coin is fake). Defaults to identity. */
  publicInput?(input: Input): unknown;
  /** Throws Error(message) on an invalid/disallowed action. */
  applyAction(
    state: unknown,
    input: Input,
    action: string,
    params: Record<string, unknown>
  ): ActionOutcome;
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
