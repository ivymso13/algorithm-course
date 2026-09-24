import type { JevJobSummary } from "./jevJobTypes";

export type JevJobProgressInput = Pick<JevJobSummary, "totalStudents" | "skippedStudents" | "trialsPerStudent" | "completedTrials">;

/**
 * Progress measured in trials, not students: with 20 trials per student a
 * student-based bar sits at 0% for minutes while every request is saving a
 * result. Skipped students (nothing to run, no trials saved) count as fully
 * done; a failed student's saved trials count, its remaining ones do not.
 */
export function jevJobProgress(job: JevJobProgressInput): { doneTrials: number; totalTrials: number; percent: number } {
  const totalTrials = Math.max(0, job.totalStudents * job.trialsPerStudent);
  const doneTrials = Math.min(totalTrials, job.completedTrials + job.skippedStudents * job.trialsPerStudent);
  const percent = totalTrials > 0 ? Math.floor((doneTrials / totalTrials) * 100) : 0;
  return { doneTrials, totalTrials, percent };
}
