import { interpretEven, runEven, EVEN_CASES } from "@/lib/evenActivity";
import { readJevBody, validateJevSteps, JevRequestError } from "@/lib/jevRequest";
import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && !isAuthorizedRequest(request)) return unauthorizedResponse();
  try {
    const body = await readJevBody(request);
    const steps = validateJevSteps(body.steps);
    if (steps.length > 12 || steps.join("\n").length > 2000) throw new JevRequestError("12단계, 전체 2,000자 이내로 작성하세요.");
    const key = process.env.TYPESAFE_API_KEY?.trim();
    if (!key) return Response.json({ error: "JEV 연결을 준비 중입니다. 로컬 서버에 TYPESAFE_API_KEY를 설정해야 실제 해석과 채점이 가능합니다." }, { status: 503 });
    const { plan, interpretations } = await interpretEven(steps, key);
    const trials = plan.length ? EVEN_CASES.map(numbers => runEven(plan, numbers)) : [];
    return Response.json({ mode: "jev-api", interpretations, trials, correctCount: trials.filter(t => t.correct).length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof JevRequestError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "JEV에서 유효한 응답을 받지 못했습니다. 이번 요청은 오답으로 처리하지 않았습니다. 잠시 후 다시 시도하세요." }, { status: 503 });
  }
}
