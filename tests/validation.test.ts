import assert from "node:assert/strict";
import test from "node:test";
import {
  ALGORITHM_TEXT_MAX_LENGTH,
  ALGORITHM_TEXT_MIN_LENGTH,
  ROUND_PROMPT_MAX_LENGTH,
  ROUND_TITLE_MAX_LENGTH,
  UNEXECUTABLE_REASON_MAX_LENGTH,
  ValidationError,
  WARMUP_FEEDBACK_MAX_LENGTH,
  validateAlgorithmText,
  validateConsent,
  validateCourseCode,
  validateName,
  validateRoundPrompt,
  validateRoundTitle,
  validateStudentId,
  validateUnexecutableReason,
  validateWarmupFeedback,
} from "../lib/validation.ts";

test("validateCourseCode: accepts well-formed codes, trims whitespace", () => {
  assert.equal(validateCourseCode("  ABCD1234  "), "ABCD1234");
  assert.equal(validateCourseCode("abc-123"), "abc-123");
});

test("validateCourseCode: rejects too short/long or invalid characters", () => {
  assert.throws(() => validateCourseCode("ab"), ValidationError);
  assert.throws(() => validateCourseCode("a".repeat(33)), ValidationError);
  assert.throws(() => validateCourseCode("has space"), ValidationError);
  assert.throws(() => validateCourseCode("코드1234"), ValidationError);
  assert.throws(() => validateCourseCode(undefined), ValidationError);
  assert.throws(() => validateCourseCode(""), ValidationError);
});

test("validateStudentId: accepts alnum, rejects other scripts/symbols/overlong input", () => {
  assert.equal(validateStudentId(" 10101 "), "10101");
  assert.throws(() => validateStudentId("10-101"), ValidationError);
  assert.throws(() => validateStudentId("a".repeat(21)), ValidationError);
  assert.throws(() => validateStudentId(null), ValidationError);
});

test("validateName: accepts Korean/Latin names, rejects overlong or symbol-laden input", () => {
  assert.equal(validateName(" 홍길동 "), "홍길동");
  assert.equal(validateName("Jane Doe"), "Jane Doe");
  assert.throws(() => validateName("a".repeat(21)), ValidationError);
  assert.throws(() => validateName("<script>"), ValidationError);
  assert.throws(() => validateName("홍길동1"), ValidationError);
});

test("validateAlgorithmText: enforces the min/max length window", () => {
  assert.throws(() => validateAlgorithmText("short"), ValidationError);
  assert.throws(() => validateAlgorithmText("a".repeat(ALGORITHM_TEXT_MAX_LENGTH + 1)), ValidationError);
  const ok = "a".repeat(ALGORITHM_TEXT_MIN_LENGTH);
  assert.equal(validateAlgorithmText(ok), ok);
});

test("validateUnexecutableReason: enforces the max length window", () => {
  assert.throws(
    () => validateUnexecutableReason("a".repeat(UNEXECUTABLE_REASON_MAX_LENGTH + 1)),
    ValidationError
  );
  assert.equal(validateUnexecutableReason(" 막힘 "), "막힘");
  assert.throws(() => validateUnexecutableReason(""), ValidationError);
});

test("validateConsent: only `true` passes; anything else (including string 'true') throws", () => {
  assert.equal(validateConsent(true), true);
  assert.throws(() => validateConsent(false), ValidationError);
  assert.throws(() => validateConsent("true"), ValidationError);
  assert.throws(() => validateConsent(undefined), ValidationError);
});

test("validateRoundTitle: enforces the min/max length window", () => {
  assert.throws(() => validateRoundTitle("a"), ValidationError);
  assert.throws(() => validateRoundTitle("a".repeat(ROUND_TITLE_MAX_LENGTH + 1)), ValidationError);
  assert.equal(validateRoundTitle(" 워밍업 문제 "), "워밍업 문제");
});

test("validateRoundPrompt: enforces the min/max length window", () => {
  assert.throws(() => validateRoundPrompt("short"), ValidationError);
  assert.throws(() => validateRoundPrompt("a".repeat(ROUND_PROMPT_MAX_LENGTH + 1)), ValidationError);
  const ok = "a".repeat(20);
  assert.equal(validateRoundPrompt(ok), ok);
});

test("validateWarmupFeedback: enforces the min/max length window", () => {
  assert.throws(() => validateWarmupFeedback("a"), ValidationError);
  assert.throws(() => validateWarmupFeedback("a".repeat(WARMUP_FEEDBACK_MAX_LENGTH + 1)), ValidationError);
  assert.equal(validateWarmupFeedback(" 좋아요 "), "좋아요");
});
