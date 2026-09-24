import { getD1 } from "@/db";
import type { BatchTrialResult } from "./jev";
import { loadAutoTrials, summarizeAutoTrials } from "./jevAuto";

export interface StudentJevResult {
  roundTitle: string | null;
  submissionText: string | null;
  submissionVersion: number | null;
  totalTrials: number;
  correctCount: number;
  incorrectCount: number;
  errorCount: number;
  examples: BatchTrialResult[];
  createdAt: string;
}

/**
 * The student's newest real (jev-api) AI result, from either a teacher job
 * or their automatic run, but only for a submission revision that is still
 * their current one, in their own course. Legacy, student-run and mock rows
 * are never presented as real AI feedback.
 */
export async function getLatestJevResultForStudent(courseId: number, studentKey: string): Promise<StudentJevResult | null> {
  const db = await getD1();
  const teacher = await db.prepare(`SELECT e.submission_text AS submissionText, e.submission_version AS submissionVersion,
      e.total_trials AS totalTrials, e.correct_count AS correctCount, e.incorrect_count AS incorrectCount,
      e.error_count AS errorCount, e.trials, e.created_at AS createdAt, w.title AS roundTitle
    FROM jev_batch_evaluations e
    JOIN warmup_rounds w ON w.id = e.round_id AND w.course_id = e.course_id
    JOIN warmup_submissions s ON s.id = e.submission_id AND s.round_id = e.round_id AND s.student_key = e.student_key
      AND s.revision = e.submission_version
    WHERE e.course_id = ? AND e.student_key = ? AND e.source = 'teacher' AND e.mode = 'jev-api'
    ORDER BY e.id DESC LIMIT 1`).bind(courseId, studentKey)
    .first<Omit<StudentJevResult, "examples"> & { trials: string }>();
  const auto = await db.prepare(`SELECT r.id, r.algorithm_text AS submissionText, r.submission_version AS submissionVersion,
      coalesce(r.completed_at, r.updated_at) AS createdAt, w.title AS roundTitle
    FROM jev_auto_runs r
    JOIN warmup_rounds w ON w.id = r.round_id AND w.course_id = r.course_id
    JOIN warmup_submissions s ON s.id = r.submission_id AND s.student_key = r.student_key AND s.revision = r.submission_version
    WHERE r.course_id = ? AND r.student_key = ? AND r.status = 'completed' AND r.mode = 'jev-api'
    ORDER BY r.completed_at DESC, r.id DESC LIMIT 1`).bind(courseId, studentKey)
    .first<{ id: number; submissionText: string; submissionVersion: number; createdAt: string; roundTitle: string }>();

  if (auto && (!teacher || auto.createdAt > teacher.createdAt)) {
    const summary = summarizeAutoTrials(await loadAutoTrials(auto.id), auto.createdAt, auto.submissionText);
    return { roundTitle: auto.roundTitle, submissionVersion: auto.submissionVersion, ...summary };
  }
  if (!teacher) return null;
  const { trials, ...rest } = teacher;
  const parsed = JSON.parse(trials) as BatchTrialResult[];
  return { ...rest, examples: parsed.filter((trial) => trial.correct !== true).slice(0, 3) };
}
