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
