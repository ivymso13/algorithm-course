import assert from "node:assert/strict";
import test from "node:test";
import {
  EvaluationValidationError,
  parseOptionalRating,
  parseOptionalSubjectiveFeedback,
  RATING_MIN,
  RATING_MAX,
  SUBJECTIVE_FEEDBACK_MIN_LENGTH,
  SUBJECTIVE_FEEDBACK_MAX_LENGTH,
} from "../lib/evaluationValidation.ts";

test("parseOptionalRating: accepts every integer in the 1-5 range", () => {
  for (let n = RATING_MIN; n <= RATING_MAX; n += 1) {
    assert.equal(parseOptionalRating(n, "테스트 평점"), n);
  }
});

test("parseOptionalRating: accepts numeric strings within range", () => {
  assert.equal(parseOptionalRating("3", "테스트 평점"), 3);
});

test("parseOptionalRating: omitted (undefined/null/empty string) means 'no rating', not an error", () => {
  assert.equal(parseOptionalRating(undefined, "테스트 평점"), undefined);
  assert.equal(parseOptionalRating(null, "테스트 평점"), undefined);
  assert.equal(parseOptionalRating("", "테스트 평점"), undefined);
});

test("parseOptionalRating: rejects out-of-range, non-integer, and non-numeric values", () => {
  for (const bad of [0, 6, -1, 3.5, "abc", NaN, {}, []]) {
    assert.throws(
      () => parseOptionalRating(bad, "테스트 평점"),
      EvaluationValidationError,
      `expected ${JSON.stringify(bad)} to be rejected`
    );
  }
});

test("parseOptionalRating: error message names the field", () => {
  try {
    parseOptionalRating(9, "명확성 평점(clarityRating)");
    assert.fail("expected a throw");
  } catch (error) {
    assert.ok(error instanceof EvaluationValidationError);
    assert.match((error as Error).message, /명확성 평점\(clarityRating\)/);
    assert.match((error as Error).message, /1~5/);
  }
});

test("parseOptionalSubjectiveFeedback: omitted, non-string, or blank input means 'no feedback', not an error", () => {
  assert.equal(parseOptionalSubjectiveFeedback(undefined), undefined);
  assert.equal(parseOptionalSubjectiveFeedback(null), undefined);
  assert.equal(parseOptionalSubjectiveFeedback(42), undefined);
  assert.equal(parseOptionalSubjectiveFeedback(""), undefined);
  assert.equal(parseOptionalSubjectiveFeedback("   "), undefined);
});

test("parseOptionalSubjectiveFeedback: trims and accepts text within bounds", () => {
  assert.equal(parseOptionalSubjectiveFeedback("  좋았어요  "), "좋았어요");
  const exactlyMin = "가".repeat(SUBJECTIVE_FEEDBACK_MIN_LENGTH);
  const exactlyMax = "가".repeat(SUBJECTIVE_FEEDBACK_MAX_LENGTH);
  assert.equal(parseOptionalSubjectiveFeedback(exactlyMin), exactlyMin);
  assert.equal(parseOptionalSubjectiveFeedback(exactlyMax), exactlyMax);
});

test("parseOptionalSubjectiveFeedback: rejects text shorter than the minimum", () => {
  const tooShort = "가".repeat(SUBJECTIVE_FEEDBACK_MIN_LENGTH - 1);
  assert.throws(() => parseOptionalSubjectiveFeedback(tooShort), EvaluationValidationError);
});

test("parseOptionalSubjectiveFeedback: rejects text longer than the maximum", () => {
  const tooLong = "가".repeat(SUBJECTIVE_FEEDBACK_MAX_LENGTH + 1);
  assert.throws(() => parseOptionalSubjectiveFeedback(tooLong), EvaluationValidationError);
});

test("backward compatibility: an evaluation object with only the original 6 fields is a valid EvaluationResponses shape", () => {
  // Mirrors evaluation JSON saved before this rating/feedback extension
  // existed — none of the new keys are present at all.
  const legacy = {
    couldFollowFully: true,
    unexecutablePoint: "",
    hadAmbiguity: false,
    ambiguityNote: "",
    consideredCorrect: true,
    correctnessReason: "",
  };
  assert.equal((legacy as { clarityRating?: number }).clarityRating, undefined);
  assert.equal((legacy as { accuracyRating?: number }).accuracyRating, undefined);
  assert.equal((legacy as { efficiencyRating?: number }).efficiencyRating, undefined);
  assert.equal((legacy as { subjectiveFeedback?: string }).subjectiveFeedback, undefined);
});
