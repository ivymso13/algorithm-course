import test from "node:test";
import assert from "node:assert/strict";
import {
  JevRequestError,
  jevErrorResponse,
  positiveId,
  readJevBody,
  validateJevSteps,
  validateTrials,
} from "../lib/jevRequest";
import { JevApiError, JevConfigurationError } from "../lib/jev";

/** Worker types declare Response#json() as Promise<unknown>. */
const errorBody = async (res: Response) => (await res.json()) as { error: string };

const post = (body: BodyInit | null) => new Request("http://localhost/x", { method: "POST", body });

test("validateJevSteps: trims valid steps and rejects empty, oversized or non-string input", () => {
  assert.deepEqual(validateJevSteps(["  상자를 확인한다. ", "제출한다."]), ["상자를 확인한다.", "제출한다."]);
  for (const bad of [
    undefined,
    "상자를 확인한다.",
    [],
    ["ok", "   "],
    ["ok", 3],
    Array.from({ length: 41 }, () => "a"),
    ["a".repeat(1001)],
    Array.from({ length: 11 }, () => "a".repeat(999)), // > 10,000 chars total
  ]) {
    assert.throws(() => validateJevSteps(bad), (e) => e instanceof JevRequestError && e.status === 400, JSON.stringify(bad)?.slice(0, 40));
  }
  assert.equal(validateJevSteps(Array.from({ length: 40 }, () => "a")).length, 40);
});

test("positiveId accepts only positive safe integers", () => {
  assert.equal(positiveId(7), 7);
  assert.equal(positiveId("7"), 7, "numeric strings from query/body are accepted");
  for (const bad of [0, -1, 1.5, "abc", undefined, null, Number.MAX_SAFE_INTEGER + 1, []]) {
    assert.throws(() => positiveId(bad), JevRequestError, String(bad));
  }
});

test("validateTrials defaults to 20 and accepts only integers 1..50", () => {
  assert.equal(validateTrials(undefined), 20);
  assert.equal(validateTrials(1), 1);
  assert.equal(validateTrials(50), 50);
  for (const bad of [0, 51, 2.5, "5", null, Number.NaN]) {
    assert.throws(() => validateTrials(bad), JevRequestError, String(bad));
  }
});

test("readJevBody parses JSON objects and rejects missing, malformed, non-object and oversized bodies", async () => {
  assert.deepEqual(await readJevBody(post(JSON.stringify({ a: 1 }))), { a: 1 });

  for (const body of [null, "", "{nope", "[]", "null", "42"]) {
    await assert.rejects(readJevBody(post(body)), (e) => e instanceof JevRequestError && e.status === 400, String(body));
  }

  const big = JSON.stringify({ steps: ["a".repeat(60_000)] });
  await assert.rejects(readJevBody(post(big)), (e) => e instanceof JevRequestError && e.status === 413);

  // Chunked body with no content-length is still bounded.
  const chunk = new TextEncoder().encode("a".repeat(20_000));
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent++ < 10) controller.enqueue(chunk);
      else controller.close();
    },
  });
  const chunked = new Request("http://localhost/x", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  await assert.rejects(readJevBody(chunked), (e) => e instanceof JevRequestError && e.status === 413);
  assert.ok(sent < 10, "stops reading once over the limit");
});

test("jevErrorResponse maps request, configuration and upstream errors without leaking details", async () => {
  const req = jevErrorResponse(new JevRequestError("잘못된 요청", 409));
  assert.equal(req.status, 409);
  assert.deepEqual(await req.json(), { error: "잘못된 요청" });

  const config = jevErrorResponse(new JevConfigurationError("Jev 서비스가 설정되지 않았습니다."));
  assert.equal(config.status, 503);
  assert.match((await errorBody(config)).error, /설정되지 않았습니다/);

  for (const error of [new JevApiError("http", "Jev API 요청이 실패했습니다 (HTTP 500)."), new Error("SQLITE_ERROR: secret column x"), "boom"]) {
    const res = jevErrorResponse(error);
    assert.equal(res.status, 503);
    const { error: message } = await errorBody(res);
    assert.ok(!message.includes("SQLITE") && !message.includes("HTTP 500"), message);
  }
});
