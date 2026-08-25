/**
 * Validation for the optional star-rating / short free-text extension to the
 * post-execution evaluation contract (see lib/store.ts `EvaluationResponses`).
 *
 * These four fields are additive and optional at the API boundary: the
 * current execute-page client does not send them yet, and older stored
 * evaluation JSON never has them either. Omitting a field is always valid
 * ("별점 없음" / no rating given) — only an actually-provided value gets
 * checked against the bounds below.
 */

export const RATING_MIN = 1;
export const RATING_MAX = 5;

export const SUBJECTIVE_FEEDBACK_MIN_LENGTH = 2;
export const SUBJECTIVE_FEEDBACK_MAX_LENGTH = 300;

export class EvaluationValidationError extends Error {}

/**
 * Parses one of clarityRating / accuracyRating / efficiencyRating.
 * Returns `undefined` when the field was omitted (null/undefined/""),
 * the trimmed integer 1-5 otherwise, or throws EvaluationValidationError.
 */
export function parseOptionalRating(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < RATING_MIN || n > RATING_MAX) {
    throw new EvaluationValidationError(
      `${label}은(는) ${RATING_MIN}~${RATING_MAX} 사이의 정수여야 합니다`
    );
  }
  return n;
}

/**
 * Parses subjectiveFeedback. Returns `undefined` when omitted or blank
 * (whitespace-only input is treated as "not given", not a length violation),
 * the trimmed string when its length is within bounds, or throws
 * EvaluationValidationError when a non-blank value is out of bounds.
 */
export function parseOptionalSubjectiveFeedback(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  if (
    trimmed.length < SUBJECTIVE_FEEDBACK_MIN_LENGTH ||
    trimmed.length > SUBJECTIVE_FEEDBACK_MAX_LENGTH
  ) {
    throw new EvaluationValidationError(
      `주관식 피드백은 ${SUBJECTIVE_FEEDBACK_MIN_LENGTH}자 이상 ${SUBJECTIVE_FEEDBACK_MAX_LENGTH}자 이하로 입력해주세요`
    );
  }
  return trimmed;
}
