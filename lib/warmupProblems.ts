import type { ProblemType } from "@/lib/assignments";

/** Source-controlled warm-up problem bank. Add one object to publish a new option. */
export const WARMUP_PROBLEMS = [
  {
    id: "fake-coin",
    title: "12개의 동전 중 가짜 찾기",
    prompt: "동전 12개(1~12번) 중 정확히 1개만 무게가 다릅니다. 더 무거운지 가벼운지는 알 수 없습니다. 양팔저울을 사용해서 무게가 다른 동전의 번호를 찾는 알고리즘을 작성하세요.",
  },
  {
    id: "hidden-card",
    title: "뒤집힌 카드에서 목표 숫자 찾기",
    prompt: "오름차순으로 정렬되어 있지만 모두 뒤집힌 카드에서 목표 숫자의 위치를 찾는 알고리즘을 작성하세요. 목표 숫자가 없을 때는 0을 결과로 내야 합니다.",
  },
  {
    id: "josephus",
    title: "원형 자리에서 마지막 생존자 찾기",
    prompt: "N명이 원형으로 앉아 1번부터 세기 시작합니다. 매 k번째 사람을 제거할 때 마지막까지 남는 사람의 번호를 찾는 알고리즘을 작성하세요.",
  },
  {
    id: "pancake-sort",
    title: "팬케이크 뒤집기로 정렬하기",
    prompt: "크기가 서로 다른 팬케이크가 뒤섞여 있습니다. 위에서부터 k장을 한꺼번에 뒤집는 행동만 사용해 작은 팬케이크가 위, 큰 팬케이크가 아래에 오도록 정렬하는 알고리즘을 작성하세요.",
  },
] as const;

export type WarmupProblem = (typeof WARMUP_PROBLEMS)[number];

export function getWarmupProblem(id: unknown): WarmupProblem | undefined {
  if (typeof id !== "string") return undefined;
  return WARMUP_PROBLEMS.find((problem) => problem.id === id);
}

/** Which interactive sandbox (see components/write/sandbox) matches each source problem. */
export const WARMUP_PROBLEM_SANDBOX_TYPES: Record<WarmupProblem["id"], ProblemType> = {
  "fake-coin": "12coins",
  "hidden-card": "card",
  josephus: "josephus",
  "pancake-sort": "pancake",
};

/**
 * Which sandbox (if any) matches a warm-up round, for the student write
 * page's "직접 실습해보기" section. Prefers the round's stored `problemId`;
 * rounds created before that column existed have none, so this falls back
 * to matching the round's title/prompt against the problem bank (rounds are
 * only ever created by copying a bank entry's title/prompt verbatim, so an
 * exact match reliably recovers the source problem for old rows). Returns
 * null — hide the sandbox, writing is unaffected — when neither resolves.
 */
export function resolveWarmupSandboxProblemType(round: {
  problemId: string | null;
  title: string;
  prompt: string;
}): ProblemType | null {
  const byId = getWarmupProblem(round.problemId);
  if (byId) return WARMUP_PROBLEM_SANDBOX_TYPES[byId.id];

  const byContent = WARMUP_PROBLEMS.find((p) => p.title === round.title || p.prompt === round.prompt);
  return byContent ? WARMUP_PROBLEM_SANDBOX_TYPES[byContent.id] : null;
}
