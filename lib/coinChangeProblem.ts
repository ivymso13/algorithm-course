/** Presentation only; the supported input range and grading rules stay unchanged. */
export const LEGACY_COIN_PROMPT = '루루는 주말마다 이모네 문방구 계산대를 돕는다. 문방구 금고에는 500원, 100원, 50원, 10원짜리 동전이 넉넉하게 들어 있다. 손님에게 거스름돈을 줄 때는 동전 개수가 가장 적어지도록 주고 싶다. 손님에게 줄 거스름돈이 주어질 때, 500원, 100원, 50원, 10원짜리 동전을 각각 몇 개씩 주어야 하는지 구해 보자. 거스름돈은 0원 이상 10,000원 이하이며 10원 단위로 주어진다(0원, 10원, 20원, …, 10,000원). 500원, 100원, 50원, 10원짜리 동전의 개수를 각각 구하는 자연어 알고리즘을 작성하세요. 거스름돈이 달라져도 실행할 수 있어야 합니다.';
export const COIN_PROBLEM = {
  paragraphs: [
    '루루는 주말마다 이모네 문방구 계산대를 돕는다. 문방구 금고에는 500원, 100원, 50원, 10원짜리 동전이 넉넉하게 들어 있다.',
    '손님에게 거스름돈을 줄 때는 동전 개수가 가장 적어지도록 주고 싶다.',
    '손님에게 줄 거스름돈이 주어질 때, 500원, 100원, 50원, 10원짜리 동전을 각각 몇 개씩 주어야 하는지 구해 보자.',
  ],
  input: '첫째 줄에 손님에게 줄 거스름돈 M이 주어진다.',
  output: '동전 개수가 최소가 되도록 거스름돈을 줄 때, 500원, 100원, 50원, 10원짜리 동전의 개수를 순서대로 공백으로 구분하여 출력한다.',
  limits: ['M은 정수이다.', '0 ≤ M ≤ 10,000', 'M은 10의 배수이다.'],
  example: { input: '760', output: '1 2 1 1' },
} as const;
export const COIN_PROMPT = [
  ...COIN_PROBLEM.paragraphs,
  `입력\n${COIN_PROBLEM.input}`,
  `출력\n${COIN_PROBLEM.output}`,
  `제한\n${COIN_PROBLEM.limits.map(s=>'- '+s).join('\n')}`,
  `예제 입력 1\n${COIN_PROBLEM.example.input}`,
  `예제 출력 1\n${COIN_PROBLEM.example.output}`,
].join('\n\n');
export function isCoinProblemStatement(prompt: string) {
  return prompt===COIN_PROMPT || prompt===LEGACY_COIN_PROMPT;
}
