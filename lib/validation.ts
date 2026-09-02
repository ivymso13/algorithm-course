/**
 * Input length/format validation for everything that reaches the API layer
 * from an anonymous, unauthenticated client (this site has no ChatGPT/GitHub
 * login gate — the course code + roster check is the only thing standing
 * between the public internet and these fields, so every one of them is
 * validated server-side regardless of what the client UI already enforces).
 */

export class ValidationError extends Error {}

const COURSE_CODE_PATTERN = /^[A-Za-z0-9-]{4,32}$/;
const STUDENT_ID_PATTERN = /^[A-Za-z0-9]{1,20}$/;
// Hangul syllables/jamo, ASCII letters, spaces and a middle dot (common in
// transliterated names) — long enough for real names, short enough to block
// pasted-in essays.
const NAME_PATTERN = /^[A-Za-zㄱ-ㆎ가-힣·\s]{1,20}$/;

export const ALGORITHM_TEXT_MIN_LENGTH = 10;
export const ALGORITHM_TEXT_MAX_LENGTH = 4000;
export const UNEXECUTABLE_REASON_MIN_LENGTH = 1;
export const UNEXECUTABLE_REASON_MAX_LENGTH = 500;

export function validateCourseCode(value: unknown): string {
  const trimmed = requireString(value, "수업 코드");
  if (!COURSE_CODE_PATTERN.test(trimmed)) {
    throw new ValidationError("수업 코드 형식이 올바르지 않습니다 (영문/숫자/하이픈 4~32자)");
  }
  return trimmed;
}

export function validateStudentId(value: unknown): string {
  const trimmed = requireString(value, "학번");
  if (!STUDENT_ID_PATTERN.test(trimmed)) {
    throw new ValidationError("학번 형식이 올바르지 않습니다 (영문/숫자 1~20자)");
  }
  return trimmed;
}

export function validateName(value: unknown): string {
  const trimmed = requireString(value, "이름");
  if (!NAME_PATTERN.test(trimmed)) {
    throw new ValidationError("이름 형식이 올바르지 않습니다 (한글/영문 1~20자)");
  }
  return trimmed;
}

export function validateAlgorithmText(value: unknown): string {
  const trimmed = requireString(value, "알고리즘 내용");
  if (trimmed.length < ALGORITHM_TEXT_MIN_LENGTH || trimmed.length > ALGORITHM_TEXT_MAX_LENGTH) {
    throw new ValidationError(
      `알고리즘 내용은 ${ALGORITHM_TEXT_MIN_LENGTH}자 이상 ${ALGORITHM_TEXT_MAX_LENGTH}자 이하로 입력해주세요`
    );
  }
  return trimmed;
}

export function validateUnexecutableReason(value: unknown): string {
  const trimmed = requireString(value, "실행 불가 사유");
  if (
    trimmed.length < UNEXECUTABLE_REASON_MIN_LENGTH ||
    trimmed.length > UNEXECUTABLE_REASON_MAX_LENGTH
  ) {
    throw new ValidationError(
      `실행 불가 사유는 ${UNEXECUTABLE_REASON_MIN_LENGTH}자 이상 ${UNEXECUTABLE_REASON_MAX_LENGTH}자 이하로 입력해주세요`
    );
  }
  return trimmed;
}

export const ROUND_TITLE_MIN_LENGTH = 2;
export const ROUND_TITLE_MAX_LENGTH = 60;
export const ROUND_PROMPT_MIN_LENGTH = 10;
export const ROUND_PROMPT_MAX_LENGTH = 2000;
export const WARMUP_FEEDBACK_MIN_LENGTH = 2;
export const WARMUP_FEEDBACK_MAX_LENGTH = 200;

export function validateRoundTitle(value: unknown): string {
  const trimmed = requireString(value, "제목");
  if (trimmed.length < ROUND_TITLE_MIN_LENGTH || trimmed.length > ROUND_TITLE_MAX_LENGTH) {
    throw new ValidationError(
      `제목은 ${ROUND_TITLE_MIN_LENGTH}자 이상 ${ROUND_TITLE_MAX_LENGTH}자 이하로 입력해주세요`
    );
  }
  return trimmed;
}

export function validateRoundPrompt(value: unknown): string {
  const trimmed = requireString(value, "문제 설명");
  if (trimmed.length < ROUND_PROMPT_MIN_LENGTH || trimmed.length > ROUND_PROMPT_MAX_LENGTH) {
    throw new ValidationError(
      `문제 설명은 ${ROUND_PROMPT_MIN_LENGTH}자 이상 ${ROUND_PROMPT_MAX_LENGTH}자 이하로 입력해주세요`
    );
  }
  return trimmed;
}

export function validateWarmupFeedback(value: unknown): string {
  const trimmed = requireString(value, "피드백");
  if (trimmed.length < WARMUP_FEEDBACK_MIN_LENGTH || trimmed.length > WARMUP_FEEDBACK_MAX_LENGTH) {
    throw new ValidationError(
      `피드백은 ${WARMUP_FEEDBACK_MIN_LENGTH}자 이상 ${WARMUP_FEEDBACK_MAX_LENGTH}자 이하로 입력해주세요`
    );
  }
  return trimmed;
}

export function validateConsent(value: unknown): true {
  if (value !== true) {
    throw new ValidationError("개인정보 수집·이용에 동의해야 시작할 수 있습니다");
  }
  return true;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${label}을(를) 입력하세요`);
  }
  return value.trim();
}
