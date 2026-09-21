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
  {
    id: "tree-cutting",
    title: "나무 자르기로 목표 목재량 채우기",
    prompt: "나무 N그루의 높이가 모두 주어집니다(각각 1~100 사이 정수). 절단 높이 H로 자르면 H보다 높은 나무는 초과분만큼만 목재로 쌓입니다. 절단 높이 후보가 101가지나 되어 하나씩 다 확인할 수는 없으니, 목표 목재량 M 이상을 확보하면서 절단 높이를 최대한 높게 설정하는 알고리즘을 최소한의 확인 횟수로 작성하세요.",
  },
  {
    id: "constellation",
    title: "별자리 만들기로 모든 별 최소 비용 연결하기",
    prompt: "좌표평면 위에 별 N개가 흩어져 있고, 모든 별의 좌표는 처음부터 공개되어 있습니다. 별과 별 사이를 선으로 이어 모든 별이 서로 연결되도록 만들되, 이미 연결된 두 별을 또 잇는 것은 낭비이므로 피해야 합니다. 사용한 모든 선의 길이 합이 최소가 되도록 별들을 연결하는 알고리즘을 작성하세요.",
  },
  {
    id: "max-apple-box",
    title: "상자 속 사과 개수 중 최댓값 찾기",
    prompt: "상자 N개가 왼쪽에서 오른쪽으로 한 줄로 놓여 있고, 각 상자에는 서로 다른 개수의 사과가 들어 있습니다. 상자는 왼쪽부터 순서대로 한 번에 하나씩만 열어볼 수 있고, 한 번 닫은 상자는 다시 열어 개수를 확인할 수 없습니다. 모든 상자를 다 확인한 뒤, 그중 가장 많았던 사과 개수를 찾는 알고리즘을 작성하세요.",
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
  "tree-cutting": "woodcut",
  constellation: "constellation",
  "max-apple-box": "maxbox",
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
