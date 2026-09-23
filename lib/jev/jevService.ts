import type { AlgorithmExecutionState, IJevService, JevStepEvaluation } from "./types";
import { JEV_EXECUTION_THRESHOLD } from "./types";
import { candidateActions, schema } from "./problemSchema";

interface TypeSafeSystemOneResponse {
  model?: string;
  answers?: {
    executable?: { type?: string; noul?: number };
    action_id?: {
      type?: string;
      choice?: string;
      probabilities?: Record<string, number>;
      confidence?: number;
    };
  };
  error?: string | { message?: string };
}

/**
 * Real Jev API client connecting to TypeSafe AI's System One endpoint.
 *
 * Grounded in the problem's JSON schema (lib/jev/problems/*.json): instead
 * of asking Jev to pick from 8 generic action categories and then having the
 * execution engine guess at specifics via keyword matching, the `choice`
 * question's options ARE the schema's concretely-defined actions that
 * currently apply — each with a single, deterministic effect. Jev only has
 * to recognize which one (if any) the student's sentence names; it never
 * has to decide *what* a vague ASSIGN actually assigns.
 */
export class JevService implements IJevService {
  readonly mode = "jev-api" as const;
  private readonly apiKey: string;
  private readonly endpoint: string;

  constructor(apiKey: string, endpoint = "https://api.typesafe.ai/v1/systemone") {
    if (!apiKey) {
      throw new Error("TYPESAFE_API_KEY is required for JevService.");
    }
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  async evaluateStep(params: {
    stepIndex: number;
    stepText: string;
    allSteps: string[];
    currentState: AlgorithmExecutionState;
    threshold?: number;
  }): Promise<JevStepEvaluation> {
    const { stepIndex, stepText, currentState, threshold = JEV_EXECUTION_THRESHOLD } = params;

    const candidates = candidateActions(currentState);

    // No schema action makes sense from the current state at all (shouldn't
    // normally happen — every phase has at least one candidate) — fail
    // closed rather than ask Jev to choose among nothing.
    if (candidates.length === 0) {
      return {
        stepIndex,
        stepText,
        executable: false,
        confidence: 0,
        action: "UNKNOWN",
        reason: "현재 상태에서 진행 가능한 행동이 정의되어 있지 않습니다.",
      };
    }

    const criteria: Record<string, string> = {};
    for (const c of candidates) criteria[c.id] = c.description;
    criteria.NONE_OF_THESE = "학생의 문장이 위 어떤 구체적 행동과도 명확히 일치하지 않는다.";

    // Natural-language "executor role" framing + criteria with worked examples —
    // both validated empirically to matter a lot for this task. A plain
    // JSON-blob state and criteria without concrete examples scored much
    // lower for equally-clear sentences (e.g. INIT steps ~0.5 vs ~0.95).
    const stateContext = `현재 상태: 메모지 = ${currentState.maxVal ?? "아직 없음"}, 방금 확인한 상자의 사과 개수 = ${currentState.currentValue ?? "아직 없음"}, 로봇 위치 = ${currentState.currentIndex}.`;
    const stateText = `당신은 자연어 지시를 한 치의 해석이나 추론 없이 문자 그대로만 따르는 프로그램이다. 문제: "${schema.prompt}" ${stateContext} 다음 지시: "${stepText}"`;

    const requestBody = {
      model: "jev-latest",
      state: stateText,
      questions: {
        executable: {
          type: "noul",
          instructions:
            "위 다음 지시를 지금 상태에 적용했을 때, 어떤 변수를 어떻게 바꾸거나 어떤 판단을 내릴지 정확히 하나로 결정할 수 있는가?",
          criteria: {
            true: "지시문에 등장한 단어만으로 어떤 변수를 무엇으로 바꾸는지, 또는 무엇과 무엇을 비교하는지가 유일하게 하나로 정해진다. 예: '메모지에 기록한다' → 대상(메모지)과 새 값(방금 확인한 상자의 사과 개수)이 명확함. 문체는 격식체든 구어체든 상관없다 — '메모지에 적어둠'도 마찬가지로 참이다. 처음 상태를 정하는 단계도 마찬가지다 — 예: '상자를 확인한다' → 로봇이 지금 서 있는 상자를 연다는 뜻이 이 문장 안에서 명확하므로 참이다.",
            false:
              "'그것', '적당히', '크면', '바꾼다'처럼 무엇을 가리키는지 지시문 밖의 맥락을 추론해야 알 수 있는 표현이 있거나, 반복 범위·종료 조건이 지시문에 없다. 예: '메모지보다 크면 바꾼다' → 무엇으로 바꾸는지 지시문에 없음.",
          },
        },
        action_id: {
          type: "choice",
          instructions:
            "학생의 문장이 아래 정의된 구체적 행동 중 정확히 어느 것에 해당하는지 고르시오. 애매하면 NONE_OF_THESE를 고르시오.",
          criteria,
        },
      },
    };

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Jev API request failed with status ${res.status}: ${errText || res.statusText}`);
    }

    const data = (await res.json()) as TypeSafeSystemOneResponse;

    const noul = data.answers?.executable?.noul ?? 0;
    const choiceId = data.answers?.action_id?.choice;
    const choiceConf = data.answers?.action_id?.confidence ?? 1.0;

    const matchedAction = candidates.find((c) => c.id === choiceId);

    // Empirically, `noul` (the "is this executable" yes/no) is unreliable in
    // the *middle* of its range — clear, unambiguous steps (MOVE steps,
    // "메모지에 기록한다", etc.) have scored anywhere from ~0.2 to ~0.5 for no
    // discernible reason, category-dependent and re-broken by every wording
    // change. `choice`'s own confidence is consistently trustworthy instead
    // — it reliably lands >0.9 on a correct match and falls back to
    // NONE_OF_THESE for genuinely vague phrasing.
    // The one thing `choice` alone gets wrong: a vague phrase that
    // superficially resembles one action's description (e.g. "크면 바꾼다"
    // scores 0.99 on UPDATE_MEMO_IF_GREATER despite naming no target or
    // value). But `noul` *is* reliable at the extreme low end — every
    // genuinely ambiguous step we've tested scored well under 0.15 there —
    // so it's kept only as a veto for that case, not as a general gate.
    const confidence = noul < 0.15 ? noul : choiceConf;
    const executable = confidence >= threshold && Boolean(matchedAction);

    return {
      stepIndex,
      stepText,
      executable,
      confidence,
      action: matchedAction?.category ?? "UNKNOWN",
      actionId: matchedAction?.id,
      reason: executable ? undefined : "이 단계만으로는 실행할 행동을 하나로 결정하기 어렵습니다.",
      rawResponse: data,
    };
  }
}
