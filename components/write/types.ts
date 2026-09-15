import type { ProblemType } from "@/lib/assignments";
import type { WarmupVoteType } from "@/lib/warmupMeta";

export type RoundInfo = {
  id: number;
  title: string;
  prompt: string;
  status: "draft" | "open" | "closed";
  reviewOpenedAt: string | null;
  writingOpenedAt: string | null;
  selfReviewOpenedAt: string | null;
  activityStage: 1 | 2 | 3 | 4;
  problemType: ProblemType | null;
};

export type MySubmission = {
  id: number;
  algorithmText: string;
  createdAt: string;
  updatedAt: string;
};

export type BoardEntry = {
  id: number;
  anonLabel: string;
  algorithmText: string;
  voteCounts: Record<WarmupVoteType, number>;
  myVotes: WarmupVoteType[];
  experienced: boolean;
  evaluated: boolean;
};
