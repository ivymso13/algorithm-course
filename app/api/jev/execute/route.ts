import { executeAlgorithm, createJevService } from "@/lib/jev";
import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { JevRequestError, jevErrorResponse, readJevBody, validateJevSteps } from "@/lib/jevRequest";

/** Teacher-only diagnostic run; never writes student results. */
export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();
  try {
    const body = await readJevBody(request);
    if (body.initialState !== undefined || body.threshold !== undefined)
      throw new JevRequestError("초기 상태와 판정 기준은 서버가 결정합니다.");
    const steps = validateJevSteps(body.steps);
    const service = createJevService();
    const result = await executeAlgorithm(steps, undefined, { service });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jevErrorResponse(error); }
}
