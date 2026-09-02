import * as XLSX from "xlsx";
import { getDb } from "@/db";
import { attempts, submissions } from "@/db/schema";
import { listAssignments } from "@/lib/assignments";
import { getOrCreateDefaultCourse } from "@/lib/store";
import type { EvaluationResponses } from "@/lib/store";

function json(value: unknown): string {
  return value === null || value === undefined ? "" : JSON.stringify(value);
}

export async function buildExportWorkbook(): Promise<Uint8Array> {
  const db = await getDb();
  const [allSubmissions, allAttempts, stage] = await Promise.all([
    db.select().from(submissions),
    db.select().from(attempts),
    getOrCreateDefaultCourse(),
  ]);
  const submissionById = new Map(allSubmissions.map((s) => [s.id, s]));

  const wb = XLSX.utils.book_new();

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

  const assignmentRows = listAssignments().map((a) => ({
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
