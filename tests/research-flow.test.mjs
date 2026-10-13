import test from "node:test";
import assert from "node:assert/strict";
import { createTestApp,expectStatus,requestJson,STUDENTS } from "./support/jevHarness.mjs";

test("all activities retain immutable first drafts, assigned feedback gates revision, notes and exports are persisted",async()=>{
 const app=await createTestApp();
 try{
  const created=await expectStatus(app,'/api/teacher/warmup/rounds',{method:'POST',teacher:true,body:{problemId:'hidden-card'}},200);
  const roundId=created.data.round.id;await expectStatus(app,'/api/teacher/warmup/publish',{method:'POST',teacher:true,body:{roundId}},200);
  const cookies=[],ids=[];const original='1. 가운데 카드를 확인한다\n2. 목표 숫자와 비교하여 탐색 범위를 줄인다';
  for(const student of STUDENTS.slice(0,3)){const login=await expectStatus(app,'/api/student/login',{method:'POST',body:{...student,consent:true}},200);const cookie=login.response.headers.get('set-cookie').split(';')[0];cookies.push(cookie);const saved=await expectStatus(app,'/api/warmup/submit',{method:'POST',cookie,body:{algorithmText:original}},200);ids.push(saved.data.mySubmission.id);}
  await expectStatus(app,'/api/warmup/submit',{method:'POST',cookie:cookies[0],body:{algorithmText:original+'\n3. 정답을 제출한다',reason:'누락한 출력 단계 추가'}},400);
  await expectStatus(app,'/api/teacher/warmup/review-open',{method:'POST',teacher:true,body:{roundId}},200);
  let view=(await expectStatus(app,'/api/warmup/research',{cookie:cookies[0]},200)).data;
  assert.equal(view.canRevise,false);assert.equal(view.incoming.length,2);assert.equal(view.versions[0].algorithm_text,original);
  assert.equal((await expectStatus(app,'/api/warmup/round',{cookie:cookies[0]},200)).data.round.canRevise,false);
  for(const cookie of cookies){const v=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;for(const a of v.outgoing){await expectStatus(app,'/api/warmup/experience',{method:'POST',cookie,body:{submissionId:a.submission_id,checkedSteps:[0,1],executable:false,feedback:'2단계에서 범위를 어떻게 줄이는지 구체적인 기준이 필요합니다.'}},200);}}
  view=(await expectStatus(app,'/api/warmup/research',{cookie:cookies[0]},200)).data;assert.equal(view.canRevise,true);assert.equal(view.incoming.filter(r=>r.status==='completed').length,2);
  assert.equal((await expectStatus(app,'/api/warmup/round',{cookie:cookies[0]},200)).data.round.canRevise,true);
  const versionId=view.versions[0].id;
  await expectStatus(app,'/api/warmup/research',{method:'POST',cookie:cookies[0],body:{versionId,agrees:false,note:'범위를 줄이는 방향은 문장에 없었는데 해석이 보충되었습니다.'}},200);
  await expectStatus(app,'/api/warmup/research',{method:'POST',cookie:cookies[1],body:{versionId,agrees:true,note:''}},404);
  await expectStatus(app,'/api/warmup/submit',{method:'POST',cookie:cookies[0],body:{algorithmText:original+'\n3. 정답을 제출한다',reason:'동료가 지적한 출력 누락을 수정했습니다.'}},200);
  view=(await expectStatus(app,'/api/warmup/research',{cookie:cookies[0]},200)).data;assert.equal(view.versions.length,2);assert.equal(view.versions[0].algorithm_text,original);assert.match(view.versions[1].reason,/동료/);
  const peer=(await expectStatus(app,'/api/warmup/submission?id='+ids[0],{cookie:cookies[1]},200)).data;assert.equal(peer.submission.algorithmText,original,'peer always sees frozen assigned version');
  await expectStatus(app,'/api/teacher/warmup/close',{method:'POST',teacher:true,body:{roundId}},200);
  const history=(await expectStatus(app,'/api/warmup/research?roundId='+roundId,{cookie:cookies[0]},200)).data;
  assert.equal(history.versions.length,2);assert.equal(history.canRevise,false);
  await expectStatus(app,'/api/warmup/history',{cookie:cookies[0]},200);
  await expectStatus(app,'/api/warmup/submit',{method:'POST',cookie:cookies[0],body:{algorithmText:original,reason:'종료 후 수정 시도'}},400);
 }finally{await app.dispose();}
});
