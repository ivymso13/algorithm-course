import type { AlgorithmExecutionState, IJevService, JevStepEvaluation } from "./types";
import { JEV_EXECUTION_THRESHOLD } from "./types";
import { candidateActions, schema, type ProblemAction } from "./problemSchema";
import { JevConfigurationError, JevApiError } from "./errors";

export const DEFAULT_JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
/** Per-request budget. One trial makes ~13 sequential calls, so keep this bounded. */
export const DEFAULT_JEV_TIMEOUT_MS = 8_000;

export interface JevServiceOptions {
  endpoint?: string;
  timeoutMs?: number;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

function isProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

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
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  /**
   * Throws JevConfigurationError without a key. Never retries: a failed or
   * malformed call throws JevApiError (safe Korean message) and retry policy is the caller's.
   */
  constructor(apiKey: string, endpointOrOptions?: string | JevServiceOptions) {
    if (!apiKey) {
      throw new JevConfigurationError("Jev 서비스가 설정되지 않았습니다 (TYPESAFE_API_KEY 없음). 관리자에게 문의하세요.");
    }
    const options: JevServiceOptions =
      typeof endpointOrOptions === "string" ? { endpoint: endpointOrOptions } : endpointOrOptions ?? {};
    this.apiKey = apiKey;
    this.endpoint = options.endpoint ?? DEFAULT_JEV_ENDPOINT;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_JEV_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
  }

  /** POSTs with a hard timeout; maps every transport problem to a safe JevApiError. */
  private async post(requestBody: unknown): Promise<TypeSafeSystemOneResponse> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      let res: Response;
      try {
        res = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
      } catch {
        if (timedOut) throw new JevApiError("timeout", `Jev API 응답 시간이 초과되었습니다 (${this.timeoutMs}ms). 잠시 후 다시 시도해 주세요.`);
        throw new JevApiError("network", "Jev API에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
      }

      if (!res.ok) {
        // Upstream body is deliberately not included — it may echo the
        // request or internal details. Status is enough to act on.
        await res.body?.cancel().catch(() => {});
        throw new JevApiError("http", `Jev API 요청이 실패했습니다 (HTTP ${res.status}).`, { status: res.status });
      }

      try {
        return (await res.json()) as TypeSafeSystemOneResponse;
      } catch {
        if (timedOut) throw new JevApiError("timeout", `Jev API 응답 시간이 초과되었습니다 (${this.timeoutMs}ms). 잠시 후 다시 시도해 주세요.`);
        throw new JevApiError("invalid_response", "Jev API 응답을 해석할 수 없습니다.");
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async evaluateStep(params: {
    stepIndex: number;
    stepText: string;
    allSteps: string[];
    currentState: AlgorithmExecutionState;
    threshold?: number;
  }): Promise<JevStepEvaluation> {
    const { stepIndex, stepText, currentState, threshold = JEV_EXECUTION_THRESHOLD } = params;

    // REPEAT's appliesWhen is its loop guard, not a precondition: a loop
    // whose guard is already false runs zero times (see executionEngine),
    // so the student's REPEAT sentence must stay recognizable here too.
    const applicable = candidateActions(currentState);
    const candidates = [
      ...applicable,
      ...schema.actions.filter((a) => a.effect.replayFromReferencedStep && !applicable.includes(a)),
    ];

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

    const data = await this.post(requestBody);

    // Fail closed: a response missing either score (or with a non-probability
    // value) is an API problem, not evidence about the student's step — so
    // it's an infrastructure error, never a default like "confidence 1.0".
    const noul = data.answers?.executable?.noul;
    const choiceId = data.answers?.action_id?.choice;
    const choiceConf = data.answers?.action_id?.confidence;
    if (!isProbability(noul) || !isProbability(choiceConf) || typeof choiceId !== "string") {
      throw new JevApiError("invalid_response", "Jev API 응답에 유효한 판단 결과 또는 확신도가 없습니다.");
    }

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

    // The first question only offers actions that apply now, so a clear
    // sentence naming an action that is impossible here (e.g. moving left
    // from the first box) comes back as NONE_OF_THESE. Only in that case —
    // never on the success path, whose prompt stays unchanged — ask once
    // more among the currently impossible actions so the student is told
    // "지금은 할 수 없는 행동" instead of "애매하다". Genuinely vague steps
    // (the noul veto) skip the follow-up and keep the unclear reason.
    if (!matchedAction && noul >= 0.15) {
      const impossible = await this.matchImpossibleAction(stateText, candidates, threshold);
      if (impossible) {
        return {
          stepIndex,
          stepText,
          executable: false,
          confidence: impossible.confidence,
          action: impossible.action.category,
          actionId: impossible.action.id,
          reason: `지금 상태에서는 이 행동을 할 수 없습니다: ${impossible.action.description}`,
          rawResponse: data,
        };
      }
    }

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

  /** The schema action (not offered in `offered`) the step clearly names, or null. One extra call. */
  private async matchImpossibleAction(
    stateText: string,
    offered: ProblemAction[],
    threshold: number
  ): Promise<{ action: ProblemAction; confidence: number } | null> {
    const impossible = schema.actions.filter((a) => !offered.includes(a));
    if (impossible.length === 0) return null;

    const criteria: Record<string, string> = {};
    for (const a of impossible) criteria[a.id] = a.description;
    criteria.NONE_OF_THESE = "학생의 문장이 위 어떤 구체적 행동과도 명확히 일치하지 않는다.";

    const data = await this.post({
      model: "jev-latest",
      state: stateText,
      questions: {
        action_id: {
          type: "choice",
          instructions:
            "현재 상태와 상관없이, 학생의 문장이 아래 정의된 구체적 행동 중 정확히 어느 것을 하라는 뜻인지 고르시오. 애매하면 NONE_OF_THESE를 고르시오.",
          criteria,
        },
      },
    });

    const choiceId = data.answers?.action_id?.choice;
    const choiceConf = data.answers?.action_id?.confidence;
    if (!isProbability(choiceConf) || typeof choiceId !== "string") {
      throw new JevApiError("invalid_response", "Jev API 응답에 유효한 판단 결과 또는 확신도가 없습니다.");
    }
    const action = impossible.find((a) => a.id === choiceId);
    return action && choiceConf >= threshold ? { action, confidence: choiceConf } : null;
  }
}
