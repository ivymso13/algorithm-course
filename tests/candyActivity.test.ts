import test from 'node:test';
import assert from 'node:assert/strict';
import { maxCandyFriends,runCandy,interpretCandy,CANDY_CASES,type CandyAction,type CandyInstruction } from '../lib/candyActivity';
const program=(actions:CandyAction[]):CandyInstruction[]=>actions.map((action,i)=>({step:i+1,text:action,action}));
const sum=program(['COUNT_ZERO','SUM_ZERO','NEXT_ONE','WHILE_SUM_FITS','ADD_NEXT','INC_COUNT','INC_NEXT','END_LOOP','OUTPUT_COUNT']);
const remainder=program(['COUNT_ZERO','REMAIN_N','NEXT_ONE','WHILE_REMAIN_FITS','SUB_NEXT','INC_COUNT','INC_NEXT','END_LOOP','OUTPUT_COUNT']);
test('oracle satisfies both triangular bounds for every supported N',()=>{
 for(let n=1;n<=10000;n++){const k=maxCandyFriends(n);assert.ok(k*(k+1)/2<=n);assert.ok((k+1)*(k+2)/2>n);}
});
test('accumulation, subtraction, inequality and formula execute at triangular boundaries',()=>{
 for(let k=1;k<=140;k++)for(const n of [Math.max(1,k*(k+1)/2-1),k*(k+1)/2,k*(k+1)/2+1])
  for(const plan of [sum,remainder,program(['FORMULA_FLOOR','OUTPUT_COUNT']),program(['MAX_TRIANGULAR','OUTPUT_COUNT']),program(['OUTPUT_FORMULA_FLOOR'])])assert.equal(runCandy(plan,n).correct,true,`${n}: ${plan[0].action}`);
});
test('count-as-next and trailing explicit repeat retain their control flow',()=>{
 const count=program(['COUNT_ZERO','SUM_ZERO','WHILE_COUNT_FITS','INC_COUNT','ADD_COUNT','END_LOOP','OUTPUT_COUNT']);
 const repeat=program(['COUNT_ZERO','SUM_ZERO','NEXT_ONE','ADD_NEXT','INC_COUNT','INC_NEXT','REPEAT_SUM_FITS','OUTPUT_COUNT']);repeat[6].start=4;
 for(const n of CANDY_CASES)for(const plan of [count,repeat])assert.equal(runCandy(plan,n).correct,true);
});
test('strict inequality, ceiling and omitted integer handling are not repaired',()=>{
 assert.equal(runCandy(sum.map(p=>p.action==='WHILE_SUM_FITS'?{...p,action:'WHILE_SUM_STRICT'}:p),6).output,2);
 for(const action of ['FORMULA_CEIL','FORMULA_RAW'] as const)assert.equal(runCandy(program([action,'OUTPUT_COUNT']),8).correct,false);
});
test('missing initialization/output, malformed loops and nontermination fail explicitly',()=>{
 for(const plan of [sum.slice(1),sum.slice(0,-1),program(['END_LOOP']),sum.filter(p=>p.action!=='END_LOOP'),program(['COUNT_ZERO','SUM_ZERO','NEXT_ONE','WHILE_SUM_FITS','END_LOOP','OUTPUT_COUNT'])])assert.equal(runCandy(plan,8).executable,false);
});
test('interpreter preserves each classified step and never executes ambiguous programs',async()=>{
 const fake=(choices:string[],confidence=0.95):typeof fetch=>async()=>Response.json({answers:{action:{choice:choices.shift(),confidence}}});
 const valid=await interpretCandy(['k를 (√(8N+1)-1)/2를 내림한 정수로 계산한다','k를 출력한다'],'test',fake(['FORMULA_FLOOR','OUTPUT_COUNT']));
 assert.equal(runCandy(valid.plan,8).correct,true);
 for(const choices of [['NONE','OUTPUT_COUNT'],['NOT_AN_ACTION']]){
  if(choices[0]==='NOT_AN_ACTION')await assert.rejects(interpretCandy(['문장'],'test',fake(choices)),/JEV_INVALID_RESPONSE/);
  else {const result=await interpretCandy(['모호한 문장','출력한다'],'test',fake(choices));assert.equal(result.plan.length,0);assert.equal(result.interpretations.length,2);}
 }
 assert.equal((await interpretCandy(['출력한다'],'test',fake(['OUTPUT_COUNT'],0.2))).plan.length,0);
 assert.equal((await interpretCandy(['계속 반복한다'],'test',fake(['REPEAT_SUM_FITS']))).plan.length,0);
 await assert.rejects(interpretCandy(['문장'],'test',async()=>new Response('',{status:503})),/JEV_HTTP_503/);
});
