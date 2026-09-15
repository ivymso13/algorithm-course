import assert from "node:assert/strict";
import test from "node:test";
import {planBalancedReassignment} from "../lib/peerReassignment.ts";

const authors=new Map([[1,"A"],[2,"B"],[3,"C"],[4,"D"],[5,"E"]]);
const assignments=[
  {id:1,submissionId:1,evaluatorStudentKey:"B"},{id:2,submissionId:1,evaluatorStudentKey:"C"},{id:3,submissionId:1,evaluatorStudentKey:"D"},
  {id:4,submissionId:2,evaluatorStudentKey:"A"},{id:5,submissionId:2,evaluatorStudentKey:"C"},{id:6,submissionId:2,evaluatorStudentKey:"D"},
  {id:7,submissionId:3,evaluatorStudentKey:"A"},{id:8,submissionId:3,evaluatorStudentKey:"B"},{id:9,submissionId:3,evaluatorStudentKey:"D"},
  {id:10,submissionId:4,evaluatorStudentKey:"A"},{id:11,submissionId:4,evaluatorStudentKey:"B"},{id:12,submissionId:4,evaluatorStudentKey:"C"},
];

test("결석자의 미완료 평가는 가능한 학생들에게 균등 분산된다",()=>{const result=planBalancedReassignment({absentStudentKey:"A",participantStudentKeys:["A","B","C","D","E","F","G"],assignments,completedSubmissionIds:new Set(),authorBySubmission:authors});assert.equal(result.plans.length,3);assert.equal(new Set(result.plans.map(plan=>plan.toEvaluatorStudentKey)).size,3);assert.deepEqual(result.unresolved,[]);});
test("이미 완료한 평가는 재배정하지 않는다",()=>{const result=planBalancedReassignment({absentStudentKey:"A",participantStudentKeys:["A","B","C","D","E","F","G"],assignments,completedSubmissionIds:new Set([2]),authorBySubmission:authors});assert.equal(result.plans.length,2);assert.ok(result.plans.every(plan=>plan.submissionId!==2));});
test("자기 알고리즘과 동일 알고리즘 중복 평가는 배정하지 않는다",()=>{const result=planBalancedReassignment({absentStudentKey:"A",participantStudentKeys:["A","B","C","D","E","F","G"],assignments,completedSubmissionIds:new Set(),authorBySubmission:authors});for(const plan of result.plans){assert.notEqual(plan.toEvaluatorStudentKey,authors.get(plan.submissionId));assert.ok(!assignments.some(row=>row.submissionId===plan.submissionId&&row.evaluatorStudentKey===plan.toEvaluatorStudentKey));}});
test("참여 인원이 부족하면 해결하지 못한 빈자리를 반환한다",()=>{const result=planBalancedReassignment({absentStudentKey:"A",participantStudentKeys:["A","B","C","D"],assignments,completedSubmissionIds:new Set(),authorBySubmission:authors});assert.ok(result.unresolved.length>0);});
