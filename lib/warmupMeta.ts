/** The 4 fixed recommendation tags students can put on a peer's submission. */
export const WARMUP_VOTE_TYPES = ["clear", "accurate", "efficient", "creative"] as const;
export type WarmupVoteType = (typeof WARMUP_VOTE_TYPES)[number];

export const WARMUP_VOTE_LABELS: Record<WarmupVoteType, string> = {
  clear: "명확해요",
  accurate: "정확해요",
  efficient: "효율적이에요",
  creative: "창의적이에요",
};

export const WARMUP_VOTE_ICONS: Record<WarmupVoteType, string> = {
  clear: "🔍",
  accurate: "🎯",
  efficient: "⚡",
  creative: "💡",
};

export function isWarmupVoteType(value: unknown): value is WarmupVoteType {
  return typeof value === "string" && (WARMUP_VOTE_TYPES as readonly string[]).includes(value);
}

export type WarmupRoundStatus = "draft" | "open" | "closed";

export const WARMUP_ROUND_STATUS_LABELS: Record<WarmupRoundStatus, string> = {
  draft: "준비 중",
  open: "진행 중",
  closed: "종료됨",
};
