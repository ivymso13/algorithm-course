import type {
  ActionType,
  AlgorithmExecutionState,
  IJevService,
  JevStepEvaluation,
} from "./types";
import { JEV_EXECUTION_THRESHOLD } from "./types";

/**
 * Mock implementation of Jev service for local MVP testing and offline development.
 * Strictly adheres to Rules 1-6 without calling external APIs.
 */
export class MockJevService implements IJevService {
  readonly mode = "mock" as const;

  async evaluateStep(params: {
    stepIndex: number;
    stepText: string;
    allSteps: string[];
    currentState: AlgorithmExecutionState;
    threshold?: number;
  }): Promise<JevStepEvaluation> {
    const { stepIndex, stepText, threshold = JEV_EXECUTION_THRESHOLD } = params;
    const trimmed = stepText.trim();

    // 1. Check for empty or excessively short steps
    if (!trimmed || trimmed.length < 2) {
      return {
        stepIndex,
        stepText,
        executable: false,
        confidence: 0.05,
        action: "UNKNOWN",
        reason: "지시문 내용이 비어있거나 너무 짧아 실행할 수 없습니다.",
      };
    }

    // Rule 3: Vague condition check
    const vagueConditionRegex = /(적당|알아서|대충|느낌대로|알맞게|상황 봐서)/;
    if (vagueConditionRegex.test(trimmed)) {
      return {
        stepIndex,
        stepText,
        executable: false,
        confidence: 0.25,
        action: "UNKNOWN",
        reason: "조건이 불명확하여 실행할 수 없습니다 (모호한 표현 사용).",
      };
    }

    // Rule 2 & Rule 1: Action target unclear (e.g. "바꾼다", "변경한다" alone)
    const bareChangeRegex = /^(그냥\s*)?(바꾼다|변경한다|교체한다)\.?$/;
    if (bareChangeRegex.test(trimmed)) {
      return {
        stepIndex,
        stepText,
        executable: false,
        confidence: 0.2,
        action: "UNKNOWN",
        reason: "행동의 대상(무엇을 무엇으로 바꾸는지)이 명확하지 않아 실행할 수 없습니다.",
      };
    }

    // Rule 1 & Rule 2: "큰 것으로 바꾼다", "큰 수가 나오면 바꾼다", "크면 바꾼다" without specifying what to set to what
    // e.g. "현재 최댓값보다 크면 바꾼다", "큰 것으로 바꾼다"
    const missingTargetChangeRegex =
      /(큰\s*것으로\s*바꾼다|크면\s*바꾼다|큰\s*수가\s*나오면\s*바꾼다|더\s*크면\s*바꾼다|최댓값보다\s*크면\s*바꾼다)/;
    if (missingTargetChangeRegex.test(trimmed) && !trimmed.includes("최댓값을")) {
      return {
        stepIndex,
        stepText,
        executable: false,
        confidence: 0.4,
        action: "UNKNOWN",
        reason: "이 단계만으로는 실행할 행동을 하나로 결정하기 어렵습니다.",
      };
    }

    // Rule 4: Unclear loop / termination condition
    const unclearRepeatRegex = /^(계속\s*반복한다|그냥\s*반복한다|반복한다|계속한다)\.?$/;
    if (unclearRepeatRegex.test(trimmed)) {
      return {
        stepIndex,
        stepText,
        executable: false,
        confidence: 0.3,
        action: "UNKNOWN",
        reason: "반복 범위 또는 종료 조건이 불명확하여 실행할 수 없습니다.",
      };
    }

    // Now evaluate recognized valid actions:
    let action: ActionType = "UNKNOWN";
    let confidence = 0.3;
    let reason: string | undefined;

    // Target-variable noun: either the original "숫자 최댓값" framing or the
    // "상자 속 사과" framing (메모지/메모/정답), so the same regexes work for
    // both problem phrasings without duplicating every branch.
    const targetNoun = /(최댓값|최대값|메모지|메모)/;

    // 1. ASSIGN
    // e.g., "첫 번째 숫자를 최댓값으로 정한다", "메모지에 기록한다"
    const isAssign =
      targetNoun.test(trimmed) &&
      (trimmed.includes("정한다") ||
        trimmed.includes("설정한다") ||
        trimmed.includes("넣는다") ||
        trimmed.includes("기억한다") ||
        trimmed.includes("기록한다") ||
        trimmed.includes("초기화") ||
        (trimmed.includes("변경한다") && targetNoun.test(trimmed)));

    // 2. MOVE
    // e.g., "다음 숫자를 확인한다", "상자를 확인한다", "왼쪽으로 이동한다"
    const isMove =
      (trimmed.includes("다음") ||
        trimmed.includes("그 다음") ||
        trimmed.includes("상자") ||
        trimmed.includes("왼쪽") ||
        trimmed.includes("오른쪽")) &&
      (trimmed.includes("확인") ||
        trimmed.includes("이동") ||
        trimmed.includes("가져온다") ||
        trimmed.includes("넘어간다") ||
        trimmed.includes("본다"));

    // 3. COMPARE
    // e.g., "현재 최댓값보다 크면 최댓값을 그 숫자로 변경한다", "메모지보다 크면 기록한다"
    const isCompare =
      (trimmed.includes("비교") ||
        trimmed.includes("크면") ||
        trimmed.includes("작으면") ||
        trimmed.includes("크다면") ||
        trimmed.includes("같으면")) &&
      (targetNoun.test(trimmed) || trimmed.includes("값"));

    // 4. REPEAT
    // e.g., "확인하지 않은 숫자가 있으면 2단계부터 반복한다", "남은 상자가 있으면 반복한다"
    const isRepeat =
      (trimmed.includes("반복") || trimmed.includes("돌아간다") || trimmed.includes("다시")) &&
      (trimmed.includes("단계") ||
        trimmed.includes("남은") ||
        trimmed.includes("확인하지 않은") ||
        trimmed.includes("있으면") ||
        trimmed.includes("까지"));

    // 5. OUTPUT
    // e.g., "현재 최댓값을 출력한다", "메모지 값을 출력한다", "정답으로 제출한다"
    const isOutput =
      (trimmed.includes("출력") ||
        trimmed.includes("말한다") ||
        trimmed.includes("제시") ||
        trimmed.includes("제출") ||
        trimmed.includes("보여준다")) &&
      (targetNoun.test(trimmed) || trimmed.includes("결과") || trimmed.includes("값") || trimmed.includes("정답"));

    // 6. STOP
    // e.g., "종료한다", "알고리즘을 마친다", "끝낸다"
    const isStop =
      trimmed.includes("종료") || trimmed.includes("끝낸다") || trimmed.includes("마친다");

    // Mock only classifies the coarse category by regex — but several
    // problem actions can share one category (MOVE has three: left/right/
    // check), and resolveAction's category-only fallback can't tell them
    // apart. Give it a best-guess actionId too, the same way the real
    // JevService's `choice` call does, so local/test runs resolve to the
    // actually-intended action instead of always the first MOVE action.
    let actionId: string | undefined;

    if (isOutput) {
      action = "OUTPUT";
      confidence = 0.96;
      actionId = "SUBMIT_ANSWER";
    } else if (isRepeat) {
      action = "REPEAT";
      confidence = 0.93;
      actionId = "REPEAT_STUDENT_STEPS";
    } else if (isCompare && trimmed.includes("변경")) {
      // Comparison + assignment branch
      action = "COMPARE";
      confidence = 0.94;
      actionId = "UPDATE_MEMO_IF_GREATER";
    } else if (isCompare) {
      action = "COMPARE";
      confidence = 0.91;
      actionId = "UPDATE_MEMO_IF_GREATER";
    } else if (isMove) {
      action = "MOVE";
      confidence = 0.95;
      actionId = trimmed.includes("왼쪽")
        ? "MOVE_LEFT_BOX"
        : trimmed.includes("오른쪽")
        ? "MOVE_RIGHT_BOX"
        : "CHECK_SELECTED_BOX";
    } else if (isAssign) {
      action = "ASSIGN";
      confidence = 0.95;
      actionId = "WRITE_MEMO";
    } else if (isStop) {
      action = "STOP";
      confidence = 0.95;
    } else {
      action = "UNKNOWN";
      confidence = 0.35;
      reason = "이 단계만으로는 실행할 행동을 하나로 결정하기 어렵습니다.";
    }

    const executable = confidence >= threshold && action !== "UNKNOWN";

    return {
      stepIndex,
      stepText,
      executable,
      confidence,
      action,
      actionId: executable ? actionId : undefined,
      reason: executable ? undefined : reason || "판단 확신도가 기준에 미치지 못합니다.",
    };
  }
}
