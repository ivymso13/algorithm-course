import * as XLSX from "xlsx";
import { getDb } from "@/db";
import { attempts, submissions, warmupAssignmentReassignments, warmupExecutions, warmupReflections, warmupSubmissions, warmupTeacherAssessments, warmupVersions } from "@/db/schema";
import { listAssignments } from "@/lib/roster";
import { getOrCreateDefaultCourse } from "@/lib/store";
import type { EvaluationResponses } from "@/lib/store";

function json(value: unknown): string {
  return value === null || value === undefined ? "" : JSON.stringify(value);
}

export async function buildExportWorkbook(): Promise<Uint8Array> {
  const db = await getDb();
  const stage = await getOrCreateDefaultCourse();
  const [allSubmissions, allAttempts, assignments, researchSubmissions, versions, executions, reflections, teacherAssessments, reassignments] = await Promise.all([
    db.select().from(submissions),
    db.select().from(attempts),
    listAssignments(stage.id),
    db.select().from(warmupSubmissions), db.select().from(warmupVersions), db.select().from(warmupExecutions), db.select().from(warmupReflections), db.select().from(warmupTeacherAssessments), db.select().from(warmupAssignmentReassignments),
  ]);
  const submissionById = new Map(allSubmissions.map((s) => [s.id, s]));

  const wb = XLSX.utils.book_new();

  const researchSubmissionById = new Map(researchSubmissions.map(s=>[s.id,s]));
  const assignmentByStudentKey = new Map(assignments.map(assignment=>[assignment.studentKey,assignment]));
  const researchId=(submissionId:number)=>{const s=researchSubmissionById.get(submissionId);return s?`R${String(s.roundId).padStart(3,"0")}-${String(s.id).padStart(4,"0")}`:""};
  const evaluatorResearchId=(studentKey:string)=>{const index=assignments.findIndex(assignment=>assignment.studentKey===studentKey);return index<0?"":`E${String(index+1).padStart(3,"0")}`};
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(researchSubmissions.map(s=>({연구ID:researchId(s.id),라운드:s.roundId,학교:assignmentByStudentKey.get(s.studentKey)?.school??"",학번:s.studentId,이름:s.studentName}))), "교사용_대응표");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(versions.map(v=>({연구ID:researchId(v.submissionId),라운드:v.roundId,버전:`v${v.version}`,구분:v.isFinal?"수정 후 최종본":v.version===1?"수정 전 최초본":"중간 수정본",최종제출:v.isFinal?"Y":"N",알고리즘:v.algorithmText,단계수:v.algorithmText.split(/\n+/).filter(Boolean).length,글자수:v.algorithmText.length,수정이유:v.revisionReason??"",작성수정시각:v.createdAt}))), "연구_버전");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(executions.map(e=>{const v=versions.find(x=>x.id===e.versionId);return {연구ID:researchId(e.submissionId),라운드:e.roundId,버전:`v${v?.version??""}`,익명평가자ID:`E${String(e.executorId).slice(-4)}`,실행결과:e.result,문제해결여부:e.solvedStatus,문제발생위치:e.problemLocation??"",실행기록:e.executionNote,실행시각:e.createdAt};})), "연구_동료평가");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reflections.map(r=>{const v=versions.find(x=>x.id===r.versionId);return {연구ID:researchId(r.submissionId),버전:`v${v?.version??""}`,연결평가ID목록:json(r.sourceExecutionIds),동료평가수:r.peerFeedbackCount,예상일치:r.expectedMatch,문제발생부분:r.problemLocation??"",원인:r.cause,수정계획:r.plannedRevision,평가시각:r.createdAt};})), "연구_자기평가");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(teacherAssessments.map(a=>{const v=versions.find(x=>x.id===a.versionId);return {연구ID:researchId(a.submissionId),라운드:a.roundId,버전:`v${v?.version??""}`,명확성:a.clarity,완전성:a.completeness,정확성:a.accuracy,실행가능성:a.executability,총점:a.clarity+a.completeness+a.accuracy+a.executability,문제해결여부:a.solvedStatus,종합의견:a.comment??"",평가시각:a.updatedAt};})), "연구_교사평가");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reassignments.map(row=>({라운드:row.roundId,연구ID:researchId(row.submissionId),기존평가자:evaluatorResearchId(row.fromEvaluatorStudentKey),대체평가자:evaluatorResearchId(row.toEvaluatorStudentKey),재배정시각:row.createdAt}))), "연구_재배정이력");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(researchSubmissions.map(s=>{const studentVersions=versions.filter(v=>v.submissionId===s.id);const v1=studentVersions.find(v=>v.version===1);const final=studentVersions.find(v=>v.isFinal);const v1Assessment=teacherAssessments.find(a=>a.versionId===v1?.id);const finalAssessment=teacherAssessments.find(a=>a.versionId===final?.id);const total=(a:typeof v1Assessment)=>a?a.clarity+a.completeness+a.accuracy+a.executability:null;const before=total(v1Assessment);const after=total(finalAssessment);return {연구ID:researchId(s.id),라운드:s.roundId,동료평가수:v1?executions.filter(e=>e.versionId===v1.id).length:0,자기평가완료:reflections.some(r=>r.submissionId===s.id)?"Y":"N",최종제출:final?"Y":"N",교사_v1총점:before??"",교사_최종총점:after??"",점수변화:before!==null&&after!==null?after-before:"",최종성공:finalAssessment?.solvedStatus==="solved"?"Y":finalAssessment?"N":""};})), "연구_학생요약");

  const submissionRows = allSubmissions.map((s) => ({
    id: s.id,
    문제유형: s.problemType,
    학번: s.studentId,
    이름: s.studentName,
    알고리즘: s.algorithmText,
    예시입력: json(s.exampleInput),
    제출시각: s.createdAt,
    수정시각: s.updatedAt,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(submissionRows),
    "제출_알고리즘"
  );

  const attemptRows = allAttempts.map((a) => {
    const author = submissionById.get(a.submissionId);
    const evalResponses = (a.evaluationResponses ?? null) as EvaluationResponses | null;
    return {
      id: a.id,
      문제유형: a.problemType,
      작성자학번: author?.studentId ?? "",
      작성자이름: author?.studentName ?? "",
      실행자학번: a.executorId,
      실행자이름: a.executorName,
      입력데이터: json(a.input),
      정답: a.correctAnswer,
      제출답: a.finalAnswer,
      정오여부: a.isCorrect === null ? "" : a.isCorrect ? "O" : "X",
      행동횟수: a.actionCount,
      기준행동횟수: a.referenceActionCount,
      실행불가여부: a.unexecutableFlag ? "Y" : "N",
      실행불가사유: a.unexecutableReason ?? "",
      행동로그: json(a.actionLog),
      평가_끝까지실행가능: evalResponses?.couldFollowFully ?? "",
      평가_실행불가지점: evalResponses?.unexecutablePoint ?? "",
      평가_애매함여부: evalResponses?.hadAmbiguity ?? "",
      평가_애매함메모: evalResponses?.ambiguityNote ?? "",
      평가_정확하다고판단: evalResponses?.consideredCorrect ?? "",
      평가_판단근거: evalResponses?.correctnessReason ?? "",
      평가_명확성별점: evalResponses?.clarityRating ?? "",
      평가_정확성별점: evalResponses?.accuracyRating ?? "",
      평가_효율성별점: evalResponses?.efficiencyRating ?? "",
      평가_한줄피드백: evalResponses?.subjectiveFeedback ?? "",
      상태: a.status,
      생성시각: a.createdAt,
      제출시각: a.submittedAt ?? "",
      평가시각: a.evaluatedAt ?? "",
    };
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(attemptRows),
    "실행_기록"
  );

  const assignmentRows = assignments.map((a) => ({
    학교: a.school,
    학번: a.studentId,
    이름: a.name,
    작성_유형1: a.write[0],
    작성_유형2: a.write[1],
    실행_유형1: a.execute[0],
    실행_유형2: a.execute[1],
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(assignmentRows),
    "학생_배정"
  );

  const stageRows = [
    {
      수업코드: stage.code,
      "2단계_활성화": stage.stage2Active ? "Y" : "N",
      활성화시각: stage.activatedAt ?? "",
      보관기한_일: stage.retentionDays,
      내보낸시각: new Date().toISOString(),
    },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stageRows), "단계_상태");

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(out as ArrayBuffer);
}
