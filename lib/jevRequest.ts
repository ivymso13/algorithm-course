export class JevRequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function validateJevSteps(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 40 ||
      value.some((s) => typeof s !== "string" || !s.trim() || s.length > 1000) ||
      value.join("\n").length > 10000) {
    throw new JevRequestError("알고리즘은 빈 단계 없이 1~40단계, 전체 10,000자 이하로 입력하세요.");
  }
  return value.map((s: string) => s.trim());
}
export function positiveId(value: unknown): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new JevRequestError("올바른 작업 또는 라운드 번호가 필요합니다.");
  return id;
}
export function validateTrials(value: unknown): number {
  if (value === undefined) return 10;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 50)
    throw new JevRequestError("실행 횟수는 1~50 사이 정수여야 합니다.");
  return value;
}
export async function readJevBody(request: Request): Promise<Record<string, unknown>> {
  // Payload is bounded before JSON parsing, including chunked requests.
  const reader = request.body?.getReader();
  if (!reader) throw new JevRequestError("요청 내용이 필요합니다.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 50000) { await reader.cancel(); throw new JevRequestError("요청이 너무 큽니다.", 413); }
      chunks.push(value);
    }
    const buffer = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder().decode(buffer));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch (error) {
    if (error instanceof JevRequestError) throw error;
    throw new JevRequestError("올바른 JSON 요청이 필요합니다.");
  }
}
export function jevErrorResponse(error: unknown): Response {
  if (error instanceof JevRequestError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && error.name === "JevConfigurationError")
    return Response.json({ error: error.message }, { status: 503 });
  return Response.json({ error: "AI 실행 서비스에 연결하지 못했습니다. 완료한 결과는 보존됩니다. 잠시 후 다시 시도하세요." }, { status: 503 });
}
