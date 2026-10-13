import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestApp,expectStatus,STUDENTS} from './support/jevHarness.mjs';
test('teacher student preview isolates classroom data and permits a full first draft, feedback, revision cycle',async()=>{
 const app=await createTestApp();try{
  await expectStatus(app,'/api/teacher/student-preview',{method:'POST'},401);
  const started=await expectStatus(app,'/api/teacher/student-preview',{method:'POST',teacher:true},200);
  const cookie=started.response.headers.get('set-cookie').split(';')[0];
  const initial=(await expectStatus(app,'/api/warmup/round',{cookie},200)).data;
  assert.equal(initial.mySubmission,null);assert.match(initial.round.title,/学生|学生体験|학생 체험/);
  await expectStatus(app,'/api/warmup/student-preview',{method:'POST',cookie},400);
  const original='1. 상자의 숫자를 확인한다.\n2. 짝수이면 메모지에 1 더하기\n3. 오른쪽으로 이동하기\n4. 마지막 상자가 아니라면 1단계로 돌아가기\n5. 정답 제출하기';
  await expectStatus(app,'/api/warmup/submit',{method:'POST',cookie,body:{algorithmText:original}},200);
  const before=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;
  assert.equal(before.incoming.length,2);assert.equal(before.outgoing.length,2);assert.equal(before.canRevise,false);
  await expectStatus(app,'/api/warmup/student-preview',{method:'POST',cookie},200);
  await expectStatus(app,'/api/warmup/student-preview',{method:'POST',cookie},200);
  const after=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;
  assert.equal(after.canRevise,true);assert.equal(after.incoming.filter(a=>a.status==='completed').length,2);assert.equal(after.outgoing.filter(a=>a.status==='completed').length,0);
  assert.ok(after.incoming.every(a=>a.feedback.includes('체험용 예시')));
  await expectStatus(app,'/api/warmup/submit',{method:'POST',cookie,body:{algorithmText:'1. 메모지를 0으로 초기화한다.\n'+original,reason:'예시 피드백을 읽고 초기화를 추가했습니다.'}},200);
  const history=(await expectStatus(app,'/api/warmup/research',{cookie},200)).data;assert.equal(history.versions.length,2);assert.equal(history.versions[0].algorithm_text,original);
  const normal=await expectStatus(app,'/api/student/login',{method:'POST',body:{...STUDENTS[0],consent:true}},200);
  const normalCookie=normal.response.headers.get('set-cookie').split(';')[0];
  await expectStatus(app,'/api/warmup/student-preview',{method:'POST',cookie:normalCookie},403);
  const rounds=(await expectStatus(app,'/api/teacher/warmup/rounds',{teacher:true},200)).data;assert.equal(rounds.rounds.length,0);
 }finally{await app.dispose();}
});
