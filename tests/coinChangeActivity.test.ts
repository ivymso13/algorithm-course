import test from 'node:test';
import assert from 'node:assert/strict';
import { changeCoins,runCoinChange,interpretCoinChange,mentionedCoins,coinOrder,COIN_CASES,COINS,type CoinInstruction } from '../lib/coinChangeActivity';
const ALL=Array.from({length:1001},(_,i)=>i*10);
const at=(plan:Omit<CoinInstruction,'step'|'text'>[]):CoinInstruction[]=>plan.map((p,i)=>({step:i+1,text:p.action,...p}));
const divmod=at([...COINS.flatMap(coin=>[{action:'DIV' as const,coin,source:'AMOUNT' as const},{action:'MOD' as const,coin,source:'AMOUNT' as const,target:'AMOUNT' as const}]),{action:'OUTPUT_COUNTS'}]);
const restStyle=at([{action:'DIVMOD',coin:500,source:'AMOUNT',target:'REST'},...[100,50,10].map(coin=>({action:'DIVMOD' as const,coin:coin as 100,source:'REST' as const,target:'REST' as const})),{action:'OUTPUT_COUNTS'}]);
const giveLoop=at([...COINS.map(coin=>({action:'GIVE_SUB_WHILE' as const,coin,source:'AMOUNT' as const})),{action:'OUTPUT_COUNTS'}]);
const forEach=(order:CoinInstruction['order'])=>at([{action:'FOR_EACH_COIN',order},{action:'DIV',coin:'CURRENT',source:'AMOUNT'},{action:'MOD',coin:'CURRENT',source:'AMOUNT',target:'AMOUNT'},{action:'END_LOOP'},{action:'OUTPUT_COUNTS'}]);

test('oracle gives the fewest coins for every supported amount',()=>{
 for(const m of ALL){const k=changeCoins(m);assert.equal(k.reduce((s,n,i)=>s+n*COINS[i],0),m);assert.ok(k[1]<=4&&k[2]<=1&&k[3]<=4,`${m}`);}
 assert.deepEqual(changeCoins(0),[0,0,0,0]);assert.deepEqual(changeCoins(990),[1,4,1,4]);assert.deepEqual(changeCoins(10000),[20,0,0,0]);
 assert.ok(COIN_CASES.every(m=>m>=0&&m<=10000&&m%10===0));
});
test('quotient/remainder, separate remainder, repeated giving and for-each solutions pass every amount',()=>{
 for(const plan of [divmod,restStyle,giveLoop,forEach([...COINS])])for(const m of ALL){const r=runCoinChange(plan,m);assert.equal(r.correct,true,`${plan[0].action} ${m}: ${r.failure}`);assert.deepEqual(r.output,changeCoins(m));}
});
test('explicit loops with counters, end markers and numbered returns execute literally',()=>{
 const whileBlock=at([{action:'ALL_ZERO'},...COINS.flatMap(coin=>[{action:'WHILE_FITS' as const,coin,source:'AMOUNT' as const},{action:'INC_SUB' as const,coin,source:'AMOUNT' as const},{action:'END_LOOP' as const}]),{action:'OUTPUT_COUNTS'}]);
 const jump=at([{action:'GIVE_SUB_IF_FITS',coin:500,source:'AMOUNT'},{action:'REPEAT_FITS',coin:500,source:'AMOUNT',start:1},...[100,50,10].map(coin=>({action:'GIVE_SUB_WHILE' as const,coin:coin as 100,source:'AMOUNT' as const})),{action:'OUTPUT_COUNTS'}]);
 const nested=at([{action:'FOR_EACH_COIN',order:[...COINS]},{action:'WHILE_FITS',coin:'CURRENT',source:'AMOUNT'},{action:'GIVE_SUB',coin:'CURRENT',source:'AMOUNT'},{action:'END_LOOP'},{action:'END_LOOP'},{action:'OUTPUT_COUNTS'}]);
 for(const plan of [whileBlock,jump,nested])for(const m of COIN_CASES)assert.equal(runCoinChange(plan,m).correct,true,`${m}`);
});
test('0 and each coin boundary report all four counts',()=>{
 for(const [m,expected] of [[0,[0,0,0,0]],[40,[0,0,0,4]],[50,[0,0,1,0]],[90,[0,0,1,4]],[100,[0,1,0,0]],[490,[0,4,1,4]],[500,[1,0,0,0]]] as const){
  const r=runCoinChange(divmod,m);assert.deepEqual(r.expected,expected);assert.deepEqual(r.output,expected);assert.deepEqual(r.answerLabels,['500원','100원','50원','10원']);
 }
});
test('wrong solutions are executed as written, not repaired',()=>{
 const noRemainder=at(COINS.map(coin=>({action:'DIV' as const,coin,source:'AMOUNT' as const})).concat([{action:'OUTPUT_COUNTS'}] as never));
 assert.deepEqual(runCoinChange(noRemainder,600).output,[1,6,12,60]);assert.equal(runCoinChange(noRemainder,600).correct,false);
 assert.equal(runCoinChange(forEach([10,50,100,500]),600).correct,false,'ascending order is not reordered');
 const usesOriginal=at([{action:'DIVMOD',coin:500,source:'AMOUNT',target:'REST'},{action:'DIV',coin:100,source:'AMOUNT'},{action:'OUTPUT_COUNT',coin:100}]);
 assert.equal(runCoinChange(usesOriginal,600).output?.[1],6,'reading M after storing the remainder elsewhere stays M');
 const partial=at([{action:'DIV',coin:500,source:'AMOUNT'},{action:'OUTPUT_COUNT',coin:500}]);
 const r=runCoinChange(partial,600);assert.equal(r.executable,true);assert.deepEqual(r.output,[1,null,null,null]);assert.equal(r.correct,false);
 const once=at([{action:'GIVE_SUB_IF_FITS',coin:500,source:'AMOUNT'},{action:'OUTPUT_COUNTS',text:'500원 동전 개수를 출력한다'} as never]);
 assert.equal(runCoinChange(once,1000).output?.[0],1,'a condition is not turned into a loop');
});
test('missing initialization, output and loop structure stop execution instead of being supplied',()=>{
 for(const plan of [
  at([{action:'INC',coin:500},{action:'OUTPUT_COUNTS'}]),
  at([{action:'DIV',coin:100,source:'REST'},{action:'OUTPUT_COUNTS'}]),
  at([{action:'DIV',coin:500,source:'AMOUNT'}]),
  at([{action:'END_LOOP'},{action:'OUTPUT_COUNTS'}]),
  at([{action:'WHILE_FITS',coin:500,source:'AMOUNT'},{action:'OUTPUT_COUNTS'}]),
  at([{action:'WHILE_FITS',coin:10,source:'AMOUNT'},{action:'GIVE',coin:10},{action:'END_LOOP'},{action:'OUTPUT_COUNTS'}]),
  at([{action:'SUB_COIN',coin:500,source:'AMOUNT'},{action:'OUTPUT_COUNTS'}]),
 ])assert.equal(runCoinChange(plan,120).executable,false,plan.map(p=>p.action).join());
});
test('written coin amounts and orders are read from the sentence',()=>{
 assert.deepEqual(mentionedCoins('거스름돈을 500으로 나눈 몫을 500원짜리 개수로 한다'),[500]);
 assert.deepEqual(mentionedCoins('10원 단위 거스름돈 1000원과 10개'),[10]);
 assert.deepEqual(mentionedCoins('오백원과 백 원, 오십원, 십원'),[500,100,50,10]);
 assert.deepEqual(coinOrder('500원부터 10원까지 차례로 반복한다'),[...COINS]);
 assert.deepEqual(coinOrder('큰 동전부터 각 동전에 대해 반복한다'),[...COINS]);
 assert.deepEqual(coinOrder('10원, 50원, 100원, 500원 순서로 반복한다'),[10,50,100,500]);
 assert.equal(coinOrder('각 동전에 대해 반복한다'),undefined);
});

type Reply={action:string;coin?:string;source?:string;target?:string;confidence?:number};
const fake=(pick:(text:string)=>Reply,seen:string[]=[]):typeof fetch=>async(_url,init)=>{
 const body=JSON.parse(String(init?.body));const text=JSON.parse(body.state.match(/분류할 문장: (.+)$/)[1]);seen.push(text);const r=pick(text);const c=r.confidence??0.95;
 return Response.json({answers:{action:{choice:r.action,confidence:c},coin:{choice:r.coin??'NONE',confidence:c},source:{choice:r.source??'NONE',confidence:c},target:{choice:r.target??'NONE',confidence:c}}});
};
test('natural sentences with any variable names are interpreted and verified on many inputs',async()=>{
 const steps=['거스름돈 x를 500으로 나눈 몫을 a라 하고 나머지를 x로 한다.','x를 100으로 나눈 몫은 b, 나머지는 x로 한다.','x를 50으로 나눈 몫은 c, 나머지는 x로 한다.','x를 10으로 나눈 몫을 d라 한다.','a, b, c, d를 차례로 출력한다.'];
 const coins=['C500','C100','C50','C10'];
 const result=await interpretCoinChange(steps,'test',fake(t=>t.startsWith('a,')?{action:'OUTPUT_COUNTS'}:t.includes('나머지')?{action:'DIVMOD',coin:coins[steps.indexOf(t)],source:'AMOUNT',target:'AMOUNT'}:{action:'DIV',coin:'C10',source:'AMOUNT'}));
 assert.ok(result.interpretations.every(p=>p.accepted));
 for(const m of ALL)assert.equal(runCoinChange(result.plan,m).correct,true);
});
test('unsupported, low-confidence, mismatched or unresolved readings withhold the check',async()=>{
 const one=async(text:string,r:Reply)=>(await interpretCoinChange([text,'각 동전의 개수를 출력한다.'],'test',fake(t=>t===text?r:{action:'OUTPUT_COUNTS'})));
 for(const [text,r] of [
  ['거스름돈을 잘 계산한다.',{action:'NONE'}],
  ['M을 500으로 나눈 몫을 구한다.',{action:'DIV',coin:'C500',source:'AMOUNT',confidence:0.3}],
  ['M을 500으로 나눈 몫을 구한다.',{action:'DIV',coin:'C100',source:'AMOUNT'}],
  ['M을 나눈 몫을 구한다.',{action:'DIV',coin:'NONE',source:'AMOUNT'}],
  ['그 동전으로 나눈 몫을 구한다.',{action:'DIV',coin:'CURRENT',source:'AMOUNT'}],
  ['각 동전에 대해 다음을 반복한다.',{action:'FOR_EACH_COIN'}],
  ['500원 이상이면 다시 돌아간다.',{action:'REPEAT_FITS',coin:'C500',source:'AMOUNT'}],
 ] as const){const res=await one(text,r);assert.equal(res.plan.length,0,text);assert.equal(res.interpretations[0].accepted,false);assert.match(res.interpretations[0].reason!,/보류/);}
 await assert.rejects(interpretCoinChange(['문장'],'test',async()=>Response.json({answers:{action:{choice:'DIV',confidence:0.9}}})),/JEV_INVALID_RESPONSE/);
 await assert.rejects(interpretCoinChange(['문장'],'test',async()=>new Response('',{status:503})),/JEV_HTTP_503/);
});
test('conditional and division sentences stay whole; plain sequences split',async()=>{
 const seen:string[]=[];
 await interpretCoinChange(['500원 동전을 1개 주고 M에서 500을 뺀다.','M이 500 이상이면 500원 동전을 주고 500을 뺀다.','M을 500으로 나누고 몫을 a로 한다.'],'test',fake(()=>({action:'NONE'}),seen));
 assert.deepEqual(seen,['500원 동전을 1개 주고','M에서 500을 뺀다.','M이 500 이상이면 500원 동전을 주고 500을 뺀다.','M을 500으로 나누고 몫을 a로 한다.']);
});
