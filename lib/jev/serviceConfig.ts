import type { IJevService } from "./types";
import { JevConfigurationError } from "./errors";
import { JevService } from "./jevService";
import { MockJevService } from "./mockService";

export interface JevServiceEnv {
  NODE_ENV?: string;
  USE_JEV_MOCK?: string;
  TYPESAFE_API_KEY?: string;
}

/**
 * The one place API routes should get an IJevService from.
 *
 * MockJevService is only allowed when explicitly requested outside
 * production (NODE_ENV !== "production" && USE_JEV_MOCK === "true"). There
 * is no silent fallback to the mock when the key is missing: a missing key
 * throws JevConfigurationError, so a misconfigured deploy fails loudly
 * instead of grading students with regexes.
 */
/** The mode createJevService would use, without requiring the key to be present. */
export function configuredJevMode(env: JevServiceEnv = process.env): IJevService["mode"] {
  const isProduction = process.env.NODE_ENV === "production" || env.NODE_ENV === "production";
  return env.USE_JEV_MOCK === "true" && !isProduction ? "mock" : "jev-api";
}

export interface CreateJevServiceOptions {
  /** Called before every upstream call (every evaluateStep for the mock). */
  beforeRequest?: () => Promise<void>;
}

export function createJevService(env: JevServiceEnv = process.env, options: CreateJevServiceOptions = {}): IJevService {
  const isProduction = process.env.NODE_ENV === "production" || env.NODE_ENV === "production";
  const wantsMock = env.USE_JEV_MOCK === "true";

  if (wantsMock) {
    if (isProduction) {
      throw new JevConfigurationError("운영 환경에서는 Jev 모의(mock) 서비스를 사용할 수 없습니다.");
    }
    const mock = new MockJevService();
    const { beforeRequest } = options;
    if (!beforeRequest) return mock;
    return {
      mode: mock.mode,
      evaluateStep: async (params) => { await beforeRequest(); return mock.evaluateStep(params); },
    };
  }

  const apiKey = env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    throw new JevConfigurationError("Jev 서비스가 설정되지 않았습니다 (TYPESAFE_API_KEY 없음). 관리자에게 문의하세요.");
  }
  return new JevService(apiKey, { beforeRequest: options.beforeRequest });
}
