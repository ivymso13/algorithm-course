import test from "node:test";
import assert from "node:assert/strict";
import { Response as MfResponse } from "miniflare";
import { createTestApp,createFakeJev,expectStatus,STUDENTS } from "./support/jevHarness.mjs";
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
  assert.equal(problems.length,11);
  const login=await expectStatus(app,'/api/student/login',{method:'POST',body:{...STUDENTS[0],consent:true}},200),cookie=login.response.headers.get('set-cookie').split(';')[0];
  for(const problem of problems){
    const created=await expectStatus(app,'/api/teacher/warmup/rounds',{method:'POST',teacher:true,body:{problemId:problem.id}},200),roundId=created.data.round.id;
    await expectStatus(app,'/api/teacher/warmup/publish',{method:'POST',teacher:true,body:{roundId}},200);
    await expectStatus(app,'/api/warmup/submit',{method:'POST',cookie,body:{algorithmText:problem.id==='max-box'?'1. 상자를 확인한다.':'1. 현재 대상을 확인한다.'}},200);
    const before=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;
    await expectStatus(app,'/api/warmup/research-ai',{method:'POST',cookie,body:{versionId:before.versions[0].id}},200);
    const after=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;
    assert.equal(after.versions[0].ai_status,'completed',problem.id);
    const result=JSON.parse(after.versions[0].ai_result);assert.equal(result.kind,['max-box','even-count','truck-loading','candy-sharing'].includes(problem.id)?'execution':'interpretation');
    assert.equal(after.canRevise,false);
    await expectStatus(app,'/api/teacher/warmup/close',{method:'POST',teacher:true,body:{roundId}},200);
  }
 }finally{await app.dispose();}
});

test('candy preview has no simulator and grades the immutable formula with isolated results',async()=>{
 const fake=createFakeJev();
 fake.answer=async(request)=>{const body=await request.json();const text=JSON.parse(body.state.match(/분류할 문장: (.+)$/)[1]);return MfResponse.json({answers:{action:{choice:text.includes('출력')?'OUTPUT_COUNT':text.includes('제곱근')?'FORMULA_FLOOR':'NONE',confidence:0.95}}});};
 const app=await createTestApp({fake});
 try{
  const started=await expectStatus(app,'/api/teacher/student-preview',{method:'POST',teacher:true,body:{problemId:'candy-sharing'}},200);
  const cookie=started.response.headers.get('set-cookie').split(';')[0];
  const round=(await expectStatus(app,'/api/warmup/round',{cookie},200)).data.round;
  assert.equal((await expectStatus(app,'/api/warmup/student-preview',{cookie},200)).data.problemId,'candy-sharing');assert.equal(round.problemType,null);
  await expectStatus(app,'/api/warmup/submit',{method:'POST',cookie,body:{algorithmText:'1. 8N+1의 제곱근에서 1을 빼고 2로 나눈 값의 정수 부분을 k로 정한다.\n2. k를 출력한다.'}},200);
  const view=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;
  await expectStatus(app,'/api/warmup/research-ai',{method:'POST',cookie,body:{versionId:view.versions[0].id}},200);
  const result=JSON.parse((await expectStatus(app,'/api/warmup/research',{cookie},200)).data.versions[0].ai_result);
  assert.equal(result.kind,'execution');
  assert.equal(result.trials.length,10);assert.ok(result.trials.every(t=>t.correct));
  assert.equal(result.caseSetVersion,'candy-fixed-10-v1');assert.equal(fake.calls,2);
  await expectStatus(app,'/api/warmup/research-ai',{method:'POST',cookie,body:{versionId:view.versions[0].id}},200);assert.equal(fake.calls,2);
  await expectStatus(app,'/api/warmup/student-preview',{method:'POST',cookie},200);
  const received=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;assert.equal(received.canRevise,true);
  await expectStatus(app,'/api/warmup/submit',{method:'POST',cookie,body:{algorithmText:'1. 삼각수 공식을 사용한다.',reason:'초기 풀이의 설명을 바꾸고 검증 보류 여부 확인'}},200);
  const revised=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;
  const latest=revised.versions.at(-1);
  await expectStatus(app,'/api/warmup/research-ai',{method:'POST',cookie,body:{versionId:latest.id}},200);
  const after=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;
  const withheld=JSON.parse(after.versions.at(-1).ai_result);assert.equal(withheld.trials.length,0);assert.equal(withheld.interpretations[0].accepted,false);
  assert.equal(JSON.parse(after.versions[0].ai_result).trials.length,10);
 }finally{await app.dispose();}
});

test('natural candy allocation keeps conditional scope and never inserts an omitted loop',async()=>{
 const fake=createFakeJev();
 fake.answer=async(request)=>{const body=await request.json();const text=JSON.parse(body.state.match(/분류할 문장: (.+)$/)[1]);const choice=text.includes('첫 번째')?'GIVE_FIRST_ONE':text.includes('N에서 1')?'SUB_ONE_FROM_N':text.includes('출력')?'OUTPUT_GIVEN_IF_CANNOT':text.includes('반복')?'GIVE_MORE_SUB_WHILE':'GIVE_MORE_SUB_IF_FITS';return MfResponse.json({answers:{action:{choice,confidence:0.95}}});};
 const app=await createTestApp({fake});
 try{
  const started=await expectStatus(app,'/api/teacher/student-preview',{method:'POST',teacher:true,body:{problemId:'candy-sharing'}},200);
  const cookie=started.response.headers.get('set-cookie').split(';')[0];
  const original='1. 첫 번째 학생에게 1개의 사탕을 주고 지금 가지고 있는 사탕의 수 N에서 1을 뺀다.\n2. 만약 이전 학생보다 사탕을 1개 더 줄 수 있다면 그만큼 주고 가지고 있는 사탕의 수에서 뺀다.\n3. 이전 학생보다 사탕을 1개 더 줄 수 없다면 지금까지 사탕을 준 학생 수를 출력한다.';
  await expectStatus(app,'/api/warmup/submit',{method:'POST',cookie,body:{algorithmText:original}},200);
  const before=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;
  await expectStatus(app,'/api/warmup/research-ai',{method:'POST',cookie,body:{versionId:before.versions[0].id}},200);
  const first=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;
  const result=JSON.parse(first.versions[0].ai_result);
  assert.equal(result.promptVersion,'candy-program-v2');assert.equal(result.interpretations.length,4);assert.ok(result.interpretations.every(p=>p.accepted));assert.equal(result.trials.length,10);
  assert.ok(result.trials.some(t=>t.correct));assert.ok(result.trials.some(t=>!t.executable&&t.failure.includes('반복')));
  await expectStatus(app,'/api/warmup/student-preview',{method:'POST',cookie},200);
  const revised=original.replace('만약 이전 학생보다 사탕을 1개 더 줄 수 있다면 그만큼 주고 가지고 있는 사탕의 수에서 뺀다.','이전 학생보다 사탕을 1개 더 줄 수 있는 동안 그만큼 주고 가지고 있는 사탕의 수에서 빼는 과정을 반복한다.');
  await expectStatus(app,'/api/warmup/submit',{method:'POST',cookie,body:{algorithmText:revised,reason:'동작이 한 번만 실행되어 반복할 조건과 범위를 명시했습니다.'}},200);
  const versions=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data.versions;
  await expectStatus(app,'/api/warmup/research-ai',{method:'POST',cookie,body:{versionId:versions.at(-1).id}},200);
  const after=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;
  assert.ok(JSON.parse(after.versions.at(-1).ai_result).trials.every(t=>t.correct));
  assert.equal(after.versions[0].algorithm_text,original);assert.deepEqual(JSON.parse(after.versions[0].ai_result),result);
 }finally{await app.dispose();}
});

test('truck compound conditions and count observation execute without silently adding an else',async()=>{
 const fake=createFakeJev();
 fake.answer=async(request)=>{const body=await request.json();const text=JSON.parse(body.state.match(/분류할 문장: (.+)$/)[1]);const choice=text.includes('무게를 확인')?'CHECK':text.includes('그렇지 않으면')?'LOAD_OR_DEPART_LOAD':text.includes('크다면')?'DEPART_LOAD_IF_OVER':text.includes('남은 상자')?'LOOP_MOVE':text.includes('트럭 수 확인')?'CHECK_TRUCK_COUNT':'OUTPUT';return MfResponse.json({answers:{action:{choice,confidence:0.95}}});};
 const app=await createTestApp({fake});
 try{
  const started=await expectStatus(app,'/api/teacher/student-preview',{method:'POST',teacher:true,body:{problemId:'truck-loading'}},200);
  const cookie=started.response.headers.get('set-cookie').split(';')[0];
  const original='1. 상자의 무게를 확인한다.\n2. 만약 현재 상자 무게와 현재 적재 무게의 합이 10kg보다 크다면 트럭을 출발시키고 새 트럭에 싣는다.\n3. 남은 상자가 있다면 오른쪽으로 이동하고 단계 1로 이동한다.\n4. 트럭 수 확인하고 정답 출력한다.';
  await expectStatus(app,'/api/warmup/submit',{method:'POST',cookie,body:{algorithmText:original}},200);
  const before=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;
  await expectStatus(app,'/api/warmup/research-ai',{method:'POST',cookie,body:{versionId:before.versions[0].id}},200);
  const result=JSON.parse((await expectStatus(app,'/api/warmup/research',{cookie},200)).data.versions[0].ai_result);
  assert.equal(result.promptVersion,'truck-actions-v2');assert.equal(result.interpretations.length,5);assert.ok(result.interpretations.every(p=>p.accepted));assert.equal(result.trials.length,10);assert.ok(result.trials.every(t=>!t.executable&&t.failure.includes('실리지')));
  await expectStatus(app,'/api/warmup/student-preview',{method:'POST',cookie},200);
  const revised=original.replace('새 트럭에 싣는다.','새 트럭에 싣고 그렇지 않으면 현재 트럭에 싣는다.');
  await expectStatus(app,'/api/warmup/submit',{method:'POST',cookie,body:{algorithmText:revised,reason:'동료 피드백을 반영하여 초과하지 않을 때의 싣기를 추가했습니다.'}},200);
  const versions=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data.versions;
  await expectStatus(app,'/api/warmup/research-ai',{method:'POST',cookie,body:{versionId:versions.at(-1).id}},200);
  const after=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;
  assert.ok(JSON.parse(after.versions.at(-1).ai_result).trials.every(t=>t.correct));assert.deepEqual(JSON.parse(after.versions[0].ai_result),result);
 }finally{await app.dispose();}
});
