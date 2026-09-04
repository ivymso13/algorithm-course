import { getWarmupProblem, WARMUP_PROBLEMS, type WarmupProblem } from "@/lib/warmupProblems";

/**
 * Pure demo-submission data/helpers — no `@/db` import, so this module
 * (unlike `lib/warmupDemoSubmissions.ts`) can be unit-tested without a
 * D1/Cloudflare Workers runtime.
 */

/**
 * Single switch to disable seeding new example cards without touching any
 * call site — set to false and `ensureDemoSubmissionsForRound` becomes a
 * no-op. Existing demo rows (and the `is_demo` column/index behavior) are
 * otherwise untouched by this flag; removing the feature entirely just means
 * deleting this file, `lib/warmupDemoSubmissions.ts`, its 3 call sites, and
 * the `isDemo` column.
 */
export const WARMUP_DEMO_SUBMISSIONS_ENABLED = true;

/** Reserved prefix for demo studentKeys — never producible by `studentKeyOf`
 * (real student IDs/names never contain ":", per lib/validation.ts's
 * STUDENT_ID_PATTERN/NAME_PATTERN), so a demo card can never collide with,
 * shadow, or be mistaken for a real student's row. */
const DEMO_STUDENT_KEY_PREFIX = "demo";

export function demoStudentKey(problemId: string, label: string): string {
  return `${DEMO_STUDENT_KEY_PREFIX}:${problemId}:${label}`;
}

export function isDemoStudentKey(studentKey: string): boolean {
  return studentKey.startsWith(`${DEMO_STUDENT_KEY_PREFIX}:`);
}

export type DemoAlgorithm = { label: "A" | "B" | "C"; algorithmText: string };

/**
 * Exactly 3 example submissions per source problem (see
 * lib/warmupProblems.ts), each a genuinely different — and correct —
 * approach so recommending/comparing them is worthwhile: one clear and
 * efficient, one correct but more roundabout, and one whose steps are valid
 * but written less precisely (a realistic "명확성" gap, not a wrong answer).
 */
const WARMUP_DEMO_ALGORITHMS: Record<WarmupProblem["id"], [DemoAlgorithm, DemoAlgorithm, DemoAlgorithm]> = {
  "fake-coin": [
    {
      label: "A",
      algorithmText:
        "1. 동전을 4개씩 세 그룹 A(1~4번), B(5~8번), C(9~12번)로 나눈다.\n2. A그룹과 B그룹을 저울에 올려 비교한다.\n3. 평형이면 가짜는 C그룹에 있고, 기울면 무겁거나 가벼운 4개짜리 그룹에 있다.\n4. 가짜가 있는 것으로 좁혀진 4개를 2개씩 나눠 저울에 올려 비교한다.\n5. 평형이면 저울에 올리지 않은 2개 중, 기울면 저울질로 좁혀진 2개 중에 가짜가 있다.\n6. 남은 2개 중 1개씩 저울에 올려 비교해 가짜 동전을 확정한다.\n7. 최종적으로 가짜 동전 번호를 답으로 출력한다.",
    },
    {
      label: "B",
      algorithmText:
        "1. 1번과 2번 동전을 저울에 올려 비교한다.\n2. 평형이면 둘 다 진짜이므로 3번, 4번으로 넘어가 같은 방식으로 비교한다.\n3. 저울이 기울면 둘 중 하나가 가짜이므로, 그중 1개를 이미 진짜로 확인된 동전과 다시 비교한다.\n4. 이 비교에서 기울면 방금 올린 동전이, 평형이면 나머지 하나가 가짜다.\n5. 앞의 비교에서 계속 평형이 나오면 다음 두 동전 쌍으로 넘어가며 같은 과정을 반복한다.\n6. 모든 쌍을 다 확인할 때까지 반복한다.\n7. 기울어짐이 발견된 동전 번호를 최종 답으로 출력한다.",
    },
    {
      label: "C",
      algorithmText:
        "1. 동전을 6개씩 두 그룹으로 나눠 저울에 올린다.\n2. 기울어진 쪽 6개 안에 가짜 동전이 있다고 본다.\n3. 그 6개를 다시 3개씩 나눠 저울에 올려 기운 쪽 3개를 찾는다.\n4. 3개 중 2개를 뽑아 저울에 올린다.\n5. 평형이면 나머지 1개가, 기울면 무겁거나 가벼운 쪽이 가짜다.\n6. 찾은 동전 번호를 답으로 낸다.",
    },
  ],
  "hidden-card": [
    {
      label: "A",
      algorithmText:
        "1. 탐색 범위를 시작=1, 끝=N으로 설정한다.\n2. 시작이 끝보다 크면 목표 숫자가 없는 것이므로 0을 출력하고 종료한다.\n3. 가운데 위치 = (시작+끝)/2(소수점 버림)의 카드를 뒤집어 숫자를 확인한다.\n4. 확인한 숫자가 목표 숫자와 같으면 그 위치를 최종 답으로 출력하고 종료한다.\n5. 확인한 숫자가 목표 숫자보다 작으면 시작 = 가운데+1로 갱신하고 2번으로 돌아간다.\n6. 확인한 숫자가 목표 숫자보다 크면 끝 = 가운데-1로 갱신하고 2번으로 돌아간다.",
    },
    {
      label: "B",
      algorithmText:
        "1. 왼쪽 끝(1번)부터 카드를 한 장씩 순서대로 뒤집어 숫자를 확인한다.\n2. 확인한 숫자가 목표 숫자와 같으면 그 위치를 최종 답으로 출력하고 종료한다.\n3. 확인한 숫자가 목표 숫자보다 커지는 순간 정렬 순서상 더 찾을 수 없으므로 즉시 0을 출력하고 종료한다.\n4. 마지막 카드까지 확인했는데도 못 찾았으면 0을 출력하고 종료한다.\n5. 다음 카드로 넘어가며 이 과정을 반복한다.",
    },
    {
      label: "C",
      algorithmText:
        "1. 카드 전체를 앞쪽, 가운데, 뒤쪽 세 구간으로 나눈다.\n2. 각 구간의 경계 카드를 뒤집어 목표 숫자가 어느 구간에 있을 수 있는지 판단한다.\n3. 해당하는 구간을 다시 세 구간으로 나눠 같은 방식으로 좁혀나간다.\n4. 구간에 카드가 1장만 남을 때까지 반복한다.\n5. 남은 카드를 뒤집어 목표 숫자와 같으면 그 위치를, 다르면 0을 답으로 출력한다.",
    },
  ],
  josephus: [
    {
      label: "A",
      algorithmText:
        "1. 1번부터 N번까지 원형으로 앉은 사람 목록을 만든다.\n2. 세기 시작 위치를 1번 사람으로 지정한다.\n3. 현재 위치부터 시계 방향으로 k번째 사람을 센다 (제거된 사람은 세지 않는다).\n4. k번째로 센 사람을 목록에서 제거한다.\n5. 제거된 사람의 바로 다음 사람부터 다시 3번 과정을 시작한다.\n6. 목록에 한 사람만 남을 때까지 3~5번을 반복한다.\n7. 마지막으로 남은 사람의 번호를 최종 답으로 출력한다.",
    },
    {
      label: "B",
      algorithmText:
        "1. 모든 사람에게 '생존' 표시를 해둔다.\n2. 1번 사람부터 시계 방향으로 이동하며 생존한 사람만 세어 나간다.\n3. 정확히 k번째로 센 생존자를 '탈락'으로 표시한다.\n4. 탈락한 사람의 다음 생존자부터 다시 세기를 시작한다.\n5. 생존자가 한 명만 남을 때까지 2~4번을 반복한다.\n6. 마지막까지 생존한 사람의 번호를 최종 답으로 출력한다.",
    },
    {
      label: "C",
      algorithmText:
        "1. 사람들을 원으로 세워두고 1번부터 순서대로 번호를 매긴다.\n2. k번째마다 한 명씩 빼면서 계속 돌아간다.\n3. 사람이 다 빠질 때까지 계속 돌면서 세는 것을 반복한다.\n4. 마지막에 남는 사람 번호가 정답이다.",
    },
  ],
  "pancake-sort": [
    {
      label: "A",
      algorithmText:
        "1. 아직 정렬 안 된 범위를 맨 위부터 맨 아래까지로 설정한다.\n2. 그 범위에서 가장 큰 팬케이크를 찾는다.\n3. 그 팬케이크가 있는 위치까지 통째로 뒤집어 맨 위로 오게 한다.\n4. 정렬 안 된 범위의 크기만큼 다시 통째로 뒤집어 가장 큰 팬케이크를 그 범위의 맨 아래로 보낸다.\n5. 정렬 안 된 범위를 한 칸 줄인다.\n6. 범위가 1장 이하가 될 때까지 2~5번을 반복한다.\n7. 완성된 순서(위에서 아래로)를 최종 답으로 출력한다.",
    },
    {
      label: "B",
      algorithmText:
        "1. 아직 자리가 정해지지 않은 범위에서 가장 작은 팬케이크를 찾는다.\n2. 그 팬케이크가 있는 위치까지 통째로 뒤집어 맨 위로 올린다.\n3. 이미 자리 잡은 위쪽 팬케이크들은 그대로 두고, 그 아래 범위 전체를 뒤집어 방금 찾은 가장 작은 팬케이크를 자리 잡지 않은 범위의 맨 위로 보낸다.\n4. 자리 잡은 범위를 한 칸 늘리고 나머지 범위에서 1~3번을 반복한다.\n5. 모든 팬케이크의 자리가 정해지면 완성된 순서를 최종 답으로 출력한다.",
    },
    {
      label: "C",
      algorithmText:
        "1. 가장 큰 팬케이크를 찾아서 맨 아래로 보낸다.\n2. 남은 팬케이크들 중에서 또 가장 큰 것을 찾아 그다음 아래 자리로 보낸다.\n3. 이 과정을 팬케이크가 하나 남을 때까지 반복한다.\n4. 다 끝나면 순서대로 답을 적는다.",
    },
  ],
};

export function getDemoAlgorithmsForProblem(
  problemId: string | null
): [DemoAlgorithm, DemoAlgorithm, DemoAlgorithm] | undefined {
  if (!problemId) return undefined;
  return Object.prototype.hasOwnProperty.call(WARMUP_DEMO_ALGORITHMS, problemId)
    ? WARMUP_DEMO_ALGORITHMS[problemId as WarmupProblem["id"]]
    : undefined;
}

/** Resolve old rounds created before problem_id existed. */
export function resolveDemoProblemId(round: {
  problemId: string | null;
  title?: string;
  prompt?: string;
}): WarmupProblem["id"] | null {
  const byId = getWarmupProblem(round.problemId);
  if (byId) return byId.id;
  const byContent = WARMUP_PROBLEMS.find(
    (problem) => problem.title === round.title || problem.prompt === round.prompt
  );
  return byContent?.id ?? null;
}
