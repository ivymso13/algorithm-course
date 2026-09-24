/**
 * Typed infrastructure errors for the Jev executor.
 *
 * These are deliberately separate from *algorithm* failures (a student's
 * step being ambiguous, a loop that never terminates, ...), which are
 * reported in ExecutionResult as `executable: false` / `correct: false`.
 * An infrastructure error means "we could not evaluate the algorithm at
 * all" — callers should surface a generic retryable error (and decide for
 * themselves whether to retry), never blame the student's wording.
 *
 * `message` is always safe to show to a user or log: it never contains the
 * API key, request body, or raw upstream response text.
 */

/** Server is misconfigured (e.g. missing TYPESAFE_API_KEY). Not retryable. */
export class JevConfigurationError extends Error {
  readonly code = "JEV_CONFIGURATION" as const;
  constructor(message: string) {
    super(message);
    this.name = "JevConfigurationError";
  }
}

export type JevApiErrorKind = "timeout" | "network" | "http" | "invalid_response";

/** The Jev API call itself failed or returned something unusable. */
export class JevApiError extends Error {
  readonly code = "JEV_API" as const;
  readonly kind: JevApiErrorKind;
  /** Upstream HTTP status, for kind === "http". */
  readonly status?: number;
  /** Whether a caller-side retry could plausibly succeed. */
  readonly retryable: boolean;

  constructor(kind: JevApiErrorKind, message: string, options?: { status?: number }) {
    super(message);
    this.name = "JevApiError";
    this.kind = kind;
    this.status = options?.status;
    this.retryable =
      kind === "timeout" ||
      kind === "network" ||
      (kind === "http" && (options?.status === 429 || (options?.status ?? 0) >= 500));
  }
}

/**
 * A runner stopped a trial before its next API call: the trial's deadline
 * passed ("deadline", retried later like an outage), or its lease/submission
 * revision is no longer current ("stale", dropped without writing anything).
 * Never an algorithm failure.
 */
export class JevTrialAbortedError extends Error {
  readonly code = "JEV_TRIAL_ABORTED" as const;
  constructor(readonly reason: "deadline" | "stale") {
    super(reason === "deadline" ? "AI 실행 제한 시간을 넘었습니다." : "더 이상 유효하지 않은 실행입니다.");
    this.name = "JevTrialAbortedError";
  }
}

export function isJevInfrastructureError(error: unknown): error is JevConfigurationError | JevApiError {
  return error instanceof JevConfigurationError || error instanceof JevApiError;
}
