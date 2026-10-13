import { getDb, getD1 } from "@/db";
import { courses, roster } from "@/db/schema";
import { getCourseById, getOrCreateDefaultCourse, findOrCreateStudent, createSession } from "./store";
import { createWarmupRound, publishWarmupRound, openWarmupReview, getOpenWarmupRound } from "./warmupStore";
import { saveResearchSubmission, researchView, completeResearchReview } from "./researchStore";
import { getWarmupProblem } from "./warmupProblems";

const PREFIX = "STUDENT-PREVIEW-";
export async function isStudentPreview(courseId:number) {
  return (await getCourseById(courseId))?.code.startsWith(PREFIX) ?? false;
}
export async function createStudentPreview() {
  // Keep the real classroom as the default course even on a fresh database.
  await getOrCreateDefaultCourse();
  const db=await getDb(), now=new Date().toISOString();
  const [course]=await db.insert(courses).values({code:PREFIX+crypto.randomUUID(),name:"학생 체험 · 연구 자료 제외",createdAt:now,rosterSeededAt:now}).returning();
  const people=[{studentId:"90001",name:"체험 학생"},{studentId:"90002",name:"예시 동료 A"},{studentId:"90003",name:"예시 동료 B"}];
  for(const [index,person] of people.entries())await db.insert(roster).values({courseId:course.id,school:"체험",...person,studentKey:person.studentId+" "+person.name,sortOrder:index,active:true,createdAt:now,updatedAt:now});
  const problem=getWarmupProblem("even-count")!;
  const round=await createWarmupRound(course.id,"[학생 체험] "+problem.title,problem.prompt,problem.id);
  await publishWarmupRound(round.id,course.id);
  const samples=["1. 상자의 숫자를 확인한다.\n2. 짝수이면 메모지에 1을 더한다.\n3. 오른쪽으로 이동한다.\n4. 상자가 남으면 1단계로 돌아간다.\n5. 메모지의 값을 정답으로 제출한다.","1. 메모지를 0으로 초기화한다.\n2. 현재 상자의 숫자를 확인한다.\n3. 확인한 숫자가 짝수이면 메모지에 1을 더한다.\n4. 오른쪽에 상자가 남아 있으면 오른쪽으로 이동하고 2단계부터 반복한다.\n5. 메모지에 적힌 값을 정답으로 제출한다."];
  for(const [index,person] of people.slice(1).entries())await saveResearchSubmission({courseId:course.id,roundId:round.id,studentKey:person.studentId+" "+person.name,studentId:person.studentId,studentName:person.name,algorithmText:samples[index],reason:""});
  const person=people[0],studentKey=person.studentId+" "+person.name;
  const student=await findOrCreateStudent({courseId:course.id,...person,studentKey});
  return createSession({studentDbId:student.id,courseId:course.id,studentKey});
}
export async function openStudentPreviewReview(courseId:number) {
  if(!await isStudentPreview(courseId))return;
  const round=await getOpenWarmupRound(courseId);
  if(round&&!round.reviewOpenedAt)await openWarmupReview(round.id,courseId);
}
export async function receivePreviewFeedback(courseId:number,studentKey:string) {
  const round=await getOpenWarmupRound(courseId);
  if(!round)throw new Error("체험 활동을 찾을 수 없습니다.");
  const view=await researchView(courseId,round.id,studentKey);
  if(!view.versions.length)throw new Error("알고리즘을 먼저 작성하고 제출해 주세요.");
  const feedback=["[체험용 예시 피드백 A] 메모지의 시작 값이 명확한지 확인해 주세요. 어떤 값에서 시작하는지 독자가 알 수 있어야 합니다.","[체험용 예시 피드백 B] 마지막 상자에서 이동해도 되는지 확인해 주세요. 반복 조건과 돌아갈 단계 번호를 구체적으로 적어 주세요."];
  for(const [index,a] of view.incoming.entries())if(a.status==="pending") {
    // Only complete the synthetic peers' assigned reviews of this learner.
    const row=await (await getD1()).prepare("SELECT reviewer_key FROM algorithm_review_assignments WHERE id=?").bind(a.id).first<{reviewer_key:string}>();
    if(row)await completeResearchReview(courseId,Number(view.versions[0].submission_id),row.reviewer_key,feedback[index],false,[]);
  }
}
