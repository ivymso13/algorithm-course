import test from 'node:test';
import assert from 'node:assert/strict';
import {COIN_PROBLEM,COIN_PROMPT,LEGACY_COIN_PROMPT,isCoinProblemStatement} from '../lib/coinChangeProblem';
import {changeCoins} from '../lib/coinChangeActivity';
test('the displayed input/output example agrees with the coin oracle',()=>{
 assert.deepEqual(COIN_PROBLEM.example.output.split(' ').map(Number),changeCoins(Number(COIN_PROBLEM.example.input)));
 assert.ok(COIN_PROMPT.includes('입력\n'));assert.ok(COIN_PROMPT.includes('출력\n'));assert.ok(COIN_PROMPT.includes('제한\n'));
});
test('previously stored coin statements use the clean presentation without matching unrelated problems',()=>{
 assert.equal(isCoinProblemStatement(LEGACY_COIN_PROMPT),true);assert.equal(isCoinProblemStatement(COIN_PROMPT),true);
 assert.equal(isCoinProblemStatement('다른 거스름돈 문제'),false);
 assert.ok(!COIN_PROMPT.includes('자연어 알고리즘을 작성'));assert.ok(!COIN_PROMPT.includes('JEV'));
});
