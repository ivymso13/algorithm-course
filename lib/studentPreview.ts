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
export type StudentPreviewStatus = {
  preview: boolean;
  problemId?: string | null;
  roundTitle?: string | null;
  hasSubmitted?: boolean;
  revision?: number;
  aiStatus?: string | null;
  incomingCompleted?: number;
  incomingTotal?: number;
  outgoingCompleted?: number;
  outgoingTotal?: number;
  canRevise?: boolean;
};
export async function getStudentPreviewStatus(courseId: number, studentKey: string): Promise<StudentPreviewStatus> {
  if (!(await isStudentPreview(courseId))) return { preview: false };
  const round = await getOpenWarmupRound(courseId);
  if (!round) return { preview: true, problemId: null, roundTitle: null, hasSubmitted: false, revision: 0, aiStatus: null, incomingCompleted: 0, incomingTotal: 0, outgoingCompleted: 0, outgoingTotal: 0, canRevise: false };
  const view = await researchView(courseId, round.id, studentKey);
  const latest = view.versions.at(-1);
  return {
    preview: true,
    problemId: round.problemId,
    roundTitle: round.title,
    hasSubmitted: view.versions.length > 0,
    revision: Number(latest?.revision ?? 0),
    aiStatus: typeof latest?.ai_status === "string" ? latest.ai_status : null,
    incomingCompleted: view.incoming.filter((r) => r.status === "completed").length,
    incomingTotal: view.incoming.length,
    outgoingCompleted: view.outgoing.filter((a) => a.status === "completed").length,
    outgoingTotal: view.outgoing.length,
    canRevise: view.canRevise,
  };
}
export type StudentPreviewProblemId = "even-count" | "card-flip" | "truck-loading" | "candy-sharing" | "coin-change";
export const STUDENT_PREVIEW_PROBLEM_IDS: readonly StudentPreviewProblemId[] = ["even-count", "card-flip", "truck-loading", "candy-sharing", "coin-change"];
const COIN_SAMPLES = ["1. 거스름돈을 500으로 나눈 몫을 500원 동전 개수로 정한다.\n2. 거스름돈을 100으로 나눈 몫을 100원 동전 개수로 정한다.\n3. 거스름돈을 50으로 나눈 몫을 50원 동전 개수로 정한다.\n4. 거스름돈을 10으로 나눈 몫을 10원 동전 개수로 정한다.\n5. 500원, 100원, 50원, 10원 동전 개수를 출력한다.", "1. 남은 돈이 500원 이상인 동안 500원 동전을 1개 주고 남은 돈에서 500을 빼는 것을 반복한다.\n2. 남은 돈이 100원 이상인 동안 100원 동전을 1개 주고 남은 돈에서 100을 빼는 것을 반복한다.\n3. 남은 돈이 50원 이상인 동안 50원 동전을 1개 주고 남은 돈에서 50을 빼는 것을 반복한다.\n4. 남은 돈이 10원 이상인 동안 10원 동전을 1개 주고 남은 돈에서 10을 빼는 것을 반복한다.\n5. 준 500원, 100원, 50원, 10원 동전 개수를 각각 출력한다."];
const COIN_FEEDBACK = ["[체험용 예시 피드백 A] 큰 동전을 준 뒤 남은 금액으로 다음 동전 개수를 구하나요? 600원처럼 여러 동전이 섞인 금액으로 따라 해 보세요.", "[체험용 예시 피드백 B] 거스름돈이 0원이거나 40원, 90원, 490원일 때도 네 동전의 개수가 모두 출력되는지 확인해 주세요."];
const TRUCK_SAMPLES = ["1. 트럭 수를 1로 한다.\n2. 상자의 무게를 확인한다.\n3. 상자를 트럭에 싣는다.\n4. 오른쪽으로 이동한다.\n5. 상자가 남으면 2단계로 돌아간다.\n6. 트럭 수를 제출한다.", "1. 트럭 수에 1을 더한다.\n2. 현재 상자의 무게를 확인한다.\n3. 이 상자를 실으면 10kg을 넘으면 트럭을 출발시키고 새 트럭을 부른다.\n4. 상자를 지금 트럭에 싣는다.\n5. 오른쪽에 상자가 남아 있으면 오른쪽으로 이동하고 2단계부터 반복한다.\n6. 트럭 수를 제출한다."];
const TRUCK_FEEDBACK = ["[체험용 예시 피드백 A] 상자를 싣기 전에 10kg을 넘는지 확인하나요? 넘칠 때 트럭을 출발시키는 단계가 있는지 점검해 주세요.", "[체험용 예시 피드백 B] 트럭을 출발시킨 뒤 그 상자를 새 트럭에 싣는지, 처음 트럭과 마지막 트럭을 어떻게 세는지 확인해 주세요."];
export async function createStudentPreview(problemId: StudentPreviewProblemId = "even-count") {
  // Keep the real classroom as the default course even on a fresh database.
  await getOrCreateDefaultCourse();
  const db=await getDb(), now=new Date().toISOString();
  const [course]=await db.insert(courses).values({code:PREFIX+crypto.randomUUID(),name:"학생 체험 · 연구 자료 제외",createdAt:now,rosterSeededAt:now}).returning();
  const people=[{studentId:"90001",name:"체험 학생"},{studentId:"90002",name:"예시 동료 A"},{studentId:"90003",name:"예시 동료 B"}];
  for(const [index,person] of people.entries())await db.insert(roster).values({courseId:course.id,school:"체험",...person,studentKey:person.studentId+" "+person.name,sortOrder:index,active:true,createdAt:now,updatedAt:now});
  const problem=getWarmupProblem(problemId)!;
  const round=await createWarmupRound(course.id,"[학생 체험] "+problem.title,problem.prompt,problem.id);
  await publishWarmupRound(round.id,course.id);
  const samples=problemId==="coin-change" ? COIN_SAMPLES : problemId==="candy-sharing" ? ["1. 친구 수 k를 0으로 정한다.\n2. 누적 합 s를 0으로 정한다.\n3. 다음 수 a를 1로 정한다.\n4. s+a가 N보다 작은 동안 반복한다.\n5. s에 a를 더한다.\n6. k에 1을 더한다.\n7. a에 1을 더한다.\n8. 반복을 끝내고 조건으로 돌아간다.\n9. k를 출력한다.", "1. k를 (√(8N+1)-1)/2의 소수 부분을 버린 정수로 계산한다.\n2. k를 정답으로 출력한다."] : problemId==="truck-loading" ? TRUCK_SAMPLES : problemId==="card-flip" ? ["1. 오른쪽 끝 카드의 면을 확인한다.\n2. 카드를 뒤집는다.\n3. 앞면이면 왼쪽으로 이동하고 1단계부터 반복한다.\n4. 이번 차례를 끝낸다.", "1. 오른쪽 끝 카드에서 시작한다.\n2. 현재 카드의 면을 확인한다.\n3. 확인한 면이 뒷면이면 카드를 앞면으로 뒤집고 이번 차례를 끝낸다.\n4. 확인한 면이 앞면이면 카드를 뒷면으로 뒤집는다.\n5. 왼쪽에 카드가 남아 있으면 왼쪽으로 한 칸 이동하고 2단계부터 반복한다.\n6. 이번 차례를 끝낸다."] : ["1. 상자의 숫자를 확인한다.\n2. 짝수이면 메모지에 1을 더한다.\n3. 오른쪽으로 이동한다.\n4. 상자가 남으면 1단계로 돌아간다.\n5. 메모지의 값을 정답으로 제출한다.","1. 메모지를 0으로 초기화한다.\n2. 현재 상자의 숫자를 확인한다.\n3. 확인한 숫자가 짝수이면 메모지에 1을 더한다.\n4. 오른쪽에 상자가 남아 있으면 오른쪽으로 이동하고 2단계부터 반복한다.\n5. 메모지에 적힌 값을 정답으로 제출한다."];
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
  const feedback=round.problemId==="coin-change" ? COIN_FEEDBACK : round.problemId==="candy-sharing" ? ["[체험용 예시 피드백 A] 합계가 사탕 수와 정확히 같은 경우에도 같은 친구 수가 나오는지 확인해 주세요.", "[체험용 예시 피드백 B] 계산한 값이 정수인지, 마지막에 친구 수를 출력하는지 확인해 주세요."] : round.problemId==="truck-loading" ? TRUCK_FEEDBACK : round.problemId==="card-flip" ? ["[체험용 예시 피드백 A] 조건은 뒤집기 전의 면을 기준으로 하나요? 확인한 면을 기억하고 판단하는 시점을 명확히 적어 주세요.", "[체험용 예시 피드백 B] 뒷면 카드를 앞면으로 뒤집었을 때와 왼쪽에 카드가 더 없을 때 어떻게 끝나는지 확인해 주세요."] : ["[체험용 예시 피드백 A] 메모지의 시작 값이 명확한지 확인해 주세요. 어떤 값에서 시작하는지 독자가 알 수 있어야 합니다.","[체험용 예시 피드백 B] 마지막 상자에서 이동해도 되는지 확인해 주세요. 반복 조건과 돌아갈 단계 번호를 구체적으로 적어 주세요."];
  for(const [index,a] of view.incoming.entries())if(a.status==="pending") {
    // Only complete the synthetic peers' assigned reviews of this learner.
    const row=await (await getD1()).prepare("SELECT reviewer_key FROM algorithm_review_assignments WHERE id=?").bind(a.id).first<{reviewer_key:string}>();
    if(row)await completeResearchReview(courseId,Number(view.versions[0].submission_id),row.reviewer_key,feedback[index],false,[]);
  }
}
