import { interpretCandy, runCandy, CANDY_CASES, CANDY_ACTIONS } from "./candyActivity";
import { getD1 } from "@/db";
import { resolveWarmupSandboxProblemType } from "./warmupProblems";
import { PROBLEM_ALLOWED_ACTIONS } from "./problemMeta";
import { parseAlgorithmSteps } from "./algorithmSteps";
import { interpretEven, runEven, EVEN_CASES,EVEN_ACTIONS } from "./evenActivity";
import { interpretTruck, runTruck, TRUCK_CASES, TRUCK_ACTIONS } from "./truckActivity";
import { schema } from "./jev/problemSchema";
import { JevService } from "./jev/jevService";
import { executeAlgorithm } from "./jev/executionEngine";
import { splitCompoundStep } from "./jev/compoundStep";
import { DEFAULT_INITIAL_STATE, type JevStepEvaluation } from "./jev/types";
import {claimTrialSlot,releaseTrialSlot,type TrialSlot} from "./jevRunner";

export const RESEARCH_CASE_VERSION="fixed-10-v1";
export const RESEARCH_EVEN_CASES=[...EVEN_CASES,[2,1,4,3,6],[10,0,1,1,1],[9,9,9,9,0],[1,2,3,4,5]];
const MAX_CASES=Array.from({length:10},(_,i)=>{const a=Array.from({length:8+i%5},(_,j)=>(j*7+i*3)%29+1);a[i%a.length]=30;return a;});
export async function runResearchAI(courseId:number,studentKey:string,versionId:number) {
  const db=await getD1();const owned=await db.prepare(`SELECT v.algorithm_text,r.problem_id,r.title,r.prompt FROM algorithm_versions v JOIN warmup_submissions s ON s.id=v.submission_id JOIN warmup_rounds r ON r.id=v.round_id WHERE v.id=? AND v.course_id=? AND s.student_key=? AND r.status='open'`).bind(versionId,courseId,studentKey).first<{algorithm_text:string;problem_id:string;title:string;prompt:string}>();
  if(!owned)return false;
  const now=Date.now(),token=crypto.randomUUID();
  await db.prepare("INSERT OR IGNORE INTO algorithm_ai_feedback(version_id,created_at,updated_at) VALUES(?,?,?)").bind(versionId,new Date(now).toISOString(),new Date(now).toISOString()).run();
  const claimed=await db.prepare(`UPDATE algorithm_ai_feedback SET status='running',token=?,lease_until=?,error=NULL WHERE version_id=? AND (status IN('queued','failed') OR status='running' AND lease_until<?) RETURNING id`).bind(token,now+120000,versionId,now).first();
  if(!claimed)return true;
  let slot:TrialSlot|null=null;
  const guardedFetch:typeof fetch=async(...args)=>{
    if(Date.now()>now+100000)throw new Error("deadline");
    const current=await db.prepare("SELECT 1 FROM algorithm_ai_feedback WHERE version_id=? AND token=? AND status='running' AND lease_until>?").bind(versionId,token,Date.now()).first();
    if(!current||!slot||slot.leaseUntil<Date.now())throw new Error("stale");
    return fetch(...args);
  };
  try {
    slot=await claimTrialSlot(`research:${versionId}`);
    if(!slot){await db.prepare("UPDATE algorithm_ai_feedback SET status='queued',token=NULL,lease_until=NULL WHERE version_id=? AND token=?").bind(versionId,token).run();return true;}
    const key=process.env.TYPESAFE_API_KEY?.trim();if(!key)throw new Error("configuration");
    const steps=parseAlgorithmSteps(owned.algorithm_text);const type=resolveWarmupSandboxProblemType({problemId:owned.problem_id,title:owned.title,prompt:owned.prompt});
    let result:unknown;
    if(owned.problem_id==='candy-sharing') {
      const {plan,interpretations}=await interpretCandy(steps,key,guardedFetch);
      result={kind:'execution',interpretations:interpretations.map(p=>({...p,actionId:p.action,action:p.action==='NONE'?'자동 해석을 확정하지 못했습니다.':CANDY_ACTIONS[p.action as keyof typeof CANDY_ACTIONS]??p.action})),trials:plan.length?CANDY_CASES.map(n=>runCandy(plan,n)):[],caseSetVersion:'candy-fixed-10-v1',promptVersion:'candy-program-v2',model:'jev-latest',notice:'사탕 수 N에 대한 최대 친구 수를 검사합니다. 실제 배분 과정은 요구하지 않습니다. 해석을 확정하지 못한 풀이의 검사는 보류합니다.'};
    } else if(owned.problem_id==='even-count') {
      const {plan,interpretations}=await interpretEven(steps,key,guardedFetch);
      result={kind:'execution',interpretations:interpretations.map(p=>({...p,actionId:p.action,action:EVEN_ACTIONS[p.action as keyof typeof EVEN_ACTIONS]??p.action})),trials:plan.length?RESEARCH_EVEN_CASES.map(n=>runEven(plan,n)):[],caseSetVersion:RESEARCH_CASE_VERSION,promptVersion:'even-actions-v2',model:'jev-latest'};
    } else if(owned.problem_id==='truck-loading') {
      const {plan,interpretations}=await interpretTruck(steps,key,guardedFetch);
      result={kind:'execution',interpretations:interpretations.map(p=>({...p,actionId:p.action,action:p.action==='NONE'?'자동 해석을 확정하지 못했습니다.':TRUCK_ACTIONS[p.action as keyof typeof TRUCK_ACTIONS]??p.action})),trials:plan.length?TRUCK_CASES.map(n=>{const t=runTruck(plan,n);return {...t,trace:t.trace.map(s=>({...s,memo:s.trucks}))};}):[],caseSetVersion:RESEARCH_CASE_VERSION,promptVersion:'truck-actions-v2',model:'jev-latest'};
    } else if(type==='maxbox') {
      const service=new JevService(key,{classificationOnly:true,fetchImpl:guardedFetch});const map=new Map<string,JevStepEvaluation>();const interpretations=[];
      for(let i=0;i<steps.length;i++)for(const text of splitCompoundStep(steps[i])){const evaluation=await service.evaluateStep({stepIndex:i+1,stepText:text,allSteps:steps,currentState:DEFAULT_INITIAL_STATE});map.set(text,evaluation);interpretations.push({step:i+1,text,action:evaluation.actionId??evaluation.action,confidence:evaluation.confidence,accepted:evaluation.executable,reason:evaluation.reason});}
      const accepted=interpretations.every(i=>i.accepted);const compiled={mode:'jev-api' as const,evaluateStep:async(p:{stepText:string;stepIndex:number})=>({...map.get(p.stepText)!,stepIndex:p.stepIndex})};
      const trials=[];if(accepted)for(const numbers of MAX_CASES){const execution=await executeAlgorithm(steps,{numbers},{service:compiled});trials.push({numbers,expected:Math.max(...numbers),output:execution.finalState.output,executable:execution.executable,correct:execution.correct===true,failure:execution.failureReason,trace:execution.trace.map(t=>({step:t.stepNumber,text:t.instruction,index:t.stateAfter.currentIndex,value:t.stateAfter.currentValue,memo:t.stateAfter.maxVal,output:t.stateAfter.output}))});}
      result={kind:'execution',interpretations:interpretations.map(p=>({...p,actionId:p.action,action:schema.actions.find(a=>a.id===p.action)?.description??p.action})),trials,caseSetVersion:RESEARCH_CASE_VERSION,promptVersion:'max-actions-compile-v1',model:'jev-latest'};
    } else {
      const criteria:Record<string,string>={};for(const [i,action] of (type?PROBLEM_ALLOWED_ACTIONS[type]:[]).entries())criteria['ACTION_'+i]=action;criteria.NONE="명령의 대상이나 행동을 구체적으로 해석할 수 없다. 조건이나 반복 문장은 해당 조건과 범위를 확인한다.";criteria.CONTROL="어떤 조건에서 무엇을 하거나 어떤 단계 범위를 반복하는지 구체적으로 정해진 조건/반복 지시이다.";
      const interpretations=[];
      for(let i=0;i<steps.length;i++){
        const response=await guardedFetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(8000),body:JSON.stringify({model:'jev-latest',state:`문제: ${owned.prompt}. 학생의 단계별 자연어 명령을 해석한다. 빠진 절차를 보충하지 않는다. 명령: ${JSON.stringify(steps[i])}`,questions:{action:{type:'choice',instructions:'문장에 명시된 행동 또는 제어 지시를 분류하라.',criteria}}})});
        if(!response.ok)throw new Error('upstream');const data=await response.json() as {answers?:{action?:{choice?:string;confidence?:number}}};const a=data.answers?.action;if(!a||typeof a.confidence!=='number'||!Number.isFinite(a.confidence)||a.confidence<0||a.confidence>1||!a.choice||!Object.hasOwn(criteria,a.choice))throw new Error('response');
        interpretations.push({step:i+1,text:steps[i],action:a.choice==='CONTROL'?`조건·반복 지시로 읽음: ${steps[i]}`:criteria[a.choice],confidence:a.confidence,accepted:a.choice!=='NONE'&&a.confidence>=0.65});
      }
      result={kind:'interpretation',interpretations,trials:[],caseSetVersion:null,promptVersion:'activity-reading-v1',model:'jev-latest',notice:'이 활동은 JEV의 명령 읽기 피드백을 제공합니다. 자동 실행 정답 검사는 지원하지 않으며 동료가 실제로 따라 실행합니다.'};
    }
    await db.prepare("UPDATE algorithm_ai_feedback SET status='completed',result=?,updated_at=?,token=NULL,lease_until=NULL WHERE version_id=? AND token=?").bind(JSON.stringify(result),new Date().toISOString(),versionId,token).run();
  }catch{await db.prepare("UPDATE algorithm_ai_feedback SET status='failed',error=?,updated_at=?,token=NULL,lease_until=NULL WHERE version_id=? AND token=?").bind('JEV 응답을 받지 못했습니다. 학생의 오답으로 처리하지 않았습니다. 다시 실행할 수 있습니다.',new Date().toISOString(),versionId,token).run();}
  finally{if(slot)await releaseTrialSlot(slot);}
  return true;
}
