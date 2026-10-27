export type JevJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export interface JevJobSummary {
  id: number;
  roundId: number;
  status: JevJobStatus;
  mode: string;
  totalStudents: number;
  completedStudents: number;
  failedStudents: number;
  skippedStudents: number;
  lastError: string | null;
  trialsPerStudent: number;
  completedTrials: number;
}

export interface JevJobItemSummary {
  id: number;
  studentId: string;
  studentName: string;
  submissionVersion: number;
  status: string;
  completedTrials: number;
  correctCount: number;
  incorrectCount: number;
  errorCount: number;
  lastError: string | null;
}
export interface JevJobItemResult extends JevJobItemSummary {
  submissionText: string;
  trials: import('./jev/batchEvaluate').BatchTrialResult[];
}
