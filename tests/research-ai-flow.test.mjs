import test from "node:test";
import assert from "node:assert/strict";
import { Response as MfResponse } from "miniflare";
import { createTestApp,createFakeJev,expectStatus,requestJson,STUDENTS } from "./support/jevHarness.mjs";
import * as XLSX from "xlsx";

test("an ambiguous instruction retains all interpretation records and withholds execution rather than grading wrong",async()=>{
 const fake=createFakeJev();let count=0;
 fake.answer=async()=>MfResponse.json({answers:{action:{choice:++count===1?'NONE':'CHECK',confidence:0.95}}});
 const app=await createTestApp({fake});try{
  const started=await expectStatus(app,'/api/teacher/student-preview',{method:'POST',teacher:true},200);
  const cookie=started.response.headers.get('set-cookie').split(';')[0];
  await expectStatus(app,'/api/warmup/submit',{method:'POST',cookie,body:{algorithmText:'1. 적당하게 한다\n2. 상자를 확인한다\n3. 상자를 확인한다'}},200);
  const view=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;
  await expectStatus(app,'/api/warmup/research-ai',{method:'POST',cookie,body:{versionId:view.versions[0].id}},200);
  const version=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data.versions[0];
  assert.equal(version.ai_status,'completed');const result=JSON.parse(version.ai_result);
  assert.equal(result.interpretations.length,3);assert.equal(result.interpretations[0].accepted,false);assert.equal(result.trials.length,0);assert.equal(count,3);
 }finally{await app.dispose();}
});

test("JEV reads one immutable even-count program once and executes 10 fixed cases",async()=>{
 const fake=createFakeJev();
 fake.answer=async(request)=>{const b=await request.json();const text=JSON.parse(b.state.match(/분류할 문장: (.+)$/)[1]);const choice=text.includes('남아')?'LOOP_MOVE':text.includes('짝수')?'ADD_EVEN':text.includes('제출')?'OUTPUT':'CHECK';return MfResponse.json({model:'test-model',answers:{action:{choice,confidence:0.95}}});};
 const app=await createTestApp({fake});
 try{
  const created=await expectStatus(app,'/api/teacher/warmup/rounds',{method:'POST',teacher:true,body:{problemId:'even-count'}},200);
  await expectStatus(app,'/api/teacher/warmup/publish',{method:'POST',teacher:true,body:{roundId:created.data.round.id}},200);
  const login=await expectStatus(app,'/api/student/login',{method:'POST',body:{...STUDENTS[0],consent:true}},200),cookie=login.response.headers.get('set-cookie').split(';')[0];
  await expectStatus(app,'/api/warmup/submit',{method:'POST',cookie,body:{algorithmText:'1. 상자를 확인한다\n2. 짝수이면 메모지에 1을 더한다\n3. 오른쪽에 상자가 남아 있으면 이동하고 단계 1로 돌아간다\n4. 메모지의 수를 제출한다'}},200);
  const view=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data,versionId=view.versions[0].id;
  await expectStatus(app,'/api/warmup/research-ai',{method:'POST',cookie,body:{versionId}},200);
  const result=JSON.parse((await expectStatus(app,'/api/warmup/research',{cookie},200)).data.versions[0].ai_result);
  assert.equal(result.trials.length,10);assert.equal(result.trials.every(t=>t.correct),true);assert.equal(fake.calls,4,'one call per instruction, not per case');assert.equal(result.caseSetVersion,'fixed-10-v1');
  await expectStatus(app,'/api/warmup/research-ai',{method:'POST',cookie,body:{versionId}},200);assert.equal(fake.calls,4,'completed interpretation is reused');
  const exportResponse=await app.dispatchFetch('http://localhost/api/teacher/export',{headers:{'x-teacher-password':'jev-flow-test'}});
  assert.equal(exportResponse.status,200);const workbook=XLSX.read(new Uint8Array(await exportResponse.arrayBuffer()));
  assert.ok(workbook.SheetNames.includes('워밍업_버전'));assert.ok(workbook.SheetNames.includes('JEV_명령해석'));assert.equal(XLSX.utils.sheet_to_json(workbook.Sheets['JEV_테스트']).length,10);assert.ok(XLSX.utils.sheet_to_json(workbook.Sheets['JEV_실행단계']).length>10);
  const other=await expectStatus(app,'/api/student/login',{method:'POST',body:{...STUDENTS[1],consent:true}},200),otherCookie=other.response.headers.get('set-cookie').split(';')[0];
  await expectStatus(app,'/api/warmup/research-ai',{method:'POST',cookie:otherCookie,body:{versionId}},404);
  await expectStatus(app,'/api/teacher/warmup/revision-open',{method:'POST',teacher:true,body:{submissionId:view.versions[0].submission_id,reason:'평가자 미참여로 교사가 개별 지도 후 개방'}},200);
  assert.equal((await expectStatus(app,'/api/warmup/research',{cookie},200)).data.canRevise,true);
 }finally{await app.dispose();}
});

test("every registered activity uses the same durable first submission and JEV feedback protocol",async()=>{
 const fake=createFakeJev(),originalAnswer=fake.answer;
 fake.answer=async(request)=>{const body=await request.clone().json();if(!body.questions.action)return originalAnswer.call(fake,request);const criteria=body.questions.action.criteria;return MfResponse.json({answers:{action:{choice:Object.hasOwn(criteria,'CHECK')?'CHECK':Object.keys(criteria)[0],confidence:0.95}}});};
 const app=await createTestApp({fake});
 try{
  const problems=(await expectStatus(app,'/api/teacher/warmup/rounds',{teacher:true},200)).data.problems;
  assert.equal(problems.length,10);
  const login=await expectStatus(app,'/api/student/login',{method:'POST',body:{...STUDENTS[0],consent:true}},200),cookie=login.response.headers.get('set-cookie').split(';')[0];
  for(const problem of problems){
    const created=await expectStatus(app,'/api/teacher/warmup/rounds',{method:'POST',teacher:true,body:{problemId:problem.id}},200),roundId=created.data.round.id;
    await expectStatus(app,'/api/teacher/warmup/publish',{method:'POST',teacher:true,body:{roundId}},200);
    await expectStatus(app,'/api/warmup/submit',{method:'POST',cookie,body:{algorithmText:problem.id==='max-box'?'1. 상자를 확인한다.':'1. 현재 대상을 확인한다.'}},200);
    const before=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;
    await expectStatus(app,'/api/warmup/research-ai',{method:'POST',cookie,body:{versionId:before.versions[0].id}},200);
    const after=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;
    assert.equal(after.versions[0].ai_status,'completed',problem.id);
    const result=JSON.parse(after.versions[0].ai_result);assert.equal(result.kind,['max-box','even-count','truck-loading'].includes(problem.id)?'execution':'interpretation');
    assert.equal(after.canRevise,false);
    await expectStatus(app,'/api/teacher/warmup/close',{method:'POST',teacher:true,body:{roundId}},200);
  }
 }finally{await app.dispose();}
});
