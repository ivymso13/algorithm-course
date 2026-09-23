import {
  executeAlgorithm,
  JevService,
  MockJevService,
  JEV_EXECUTION_THRESHOLD,
  type IJevService,
} from "@/lib/jev";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      steps?: string[];
      initialState?: Record<string, unknown>;
      threshold?: number;
    };

    const steps = Array.isArray(body.steps) ? body.steps : [];
    const threshold =
      typeof body.threshold === "number"
        ? body.threshold
        : typeof process.env.JEV_EXECUTION_THRESHOLD === "string"
        ? parseFloat(process.env.JEV_EXECUTION_THRESHOLD) || JEV_EXECUTION_THRESHOLD
        : JEV_EXECUTION_THRESHOLD;

    const useMock =
      process.env.USE_JEV_MOCK === "true" || !process.env.TYPESAFE_API_KEY;

    let service: IJevService;
    if (!useMock && process.env.TYPESAFE_API_KEY) {
      service = new JevService(process.env.TYPESAFE_API_KEY);
    } else {
      service = new MockJevService();
    }

    // Execute algorithm through pure execution engine
    const result = await executeAlgorithm(steps, body.initialState, {
      threshold,
      service,
    });

    // Server-side structured local test logging
    console.log("=========================================");
    console.log("[Jev Server Executor] Step Execution Run");
    console.log("Mode:", service.mode);
    console.log("Steps Input:", steps);
    console.log("Threshold:", threshold);
    console.log("Executable:", result.executable);
    console.log("Correct:", result.correct);
    console.log("Failed Step:", result.failedStep);
    console.log(
      "Final Result:",
      result.finalState.output !== null
        ? result.finalState.output
        : result.finalState.maxVal
    );
    console.log("Evaluations:", JSON.stringify(result.diagnostics.evaluations, null, 2));
    console.log("=========================================");

    return Response.json(result);
  } catch (error) {
    console.error("[Jev Server Executor] Error:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "알고리즘 실행 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
