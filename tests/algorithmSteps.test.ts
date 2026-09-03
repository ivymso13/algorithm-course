import assert from "node:assert/strict";
import test from "node:test";
import { parseAlgorithmSteps, serializeAlgorithmSteps } from "../lib/algorithmSteps.ts";

test("serializeAlgorithmSteps: numbers steps sequentially starting at 1", () => {
  assert.equal(serializeAlgorithmSteps(["시작한다", "확인한다", "종료한다"]), "1. 시작한다\n2. 확인한다\n3. 종료한다");
});

test("serializeAlgorithmSteps: drops blank/whitespace-only steps and renumbers with no gaps", () => {
  assert.equal(serializeAlgorithmSteps(["a", "  ", "b", ""]), "1. a\n2. b");
});

test("serializeAlgorithmSteps: collapses internal newlines/whitespace within one step to spaces", () => {
  assert.equal(serializeAlgorithmSteps(["line one\nline two"]), "1. line one line two");
  assert.equal(serializeAlgorithmSteps(["  extra   spaces  "]), "1. extra spaces");
});

test("serializeAlgorithmSteps: empty input yields empty string", () => {
  assert.equal(serializeAlgorithmSteps([]), "");
  assert.equal(serializeAlgorithmSteps(["", "  "]), "");
});

test("parseAlgorithmSteps: strips '1. '-style numeric prefixes", () => {
  assert.deepEqual(parseAlgorithmSteps("1. 시작한다\n2. 확인한다\n3. 종료한다"), [
    "시작한다",
    "확인한다",
    "종료한다",
  ]);
});

test("parseAlgorithmSteps: strips '1)'-style numeric prefixes too", () => {
  assert.deepEqual(parseAlgorithmSteps("1) 시작한다\n2) 확인한다"), ["시작한다", "확인한다"]);
});

test("parseAlgorithmSteps: restores unnumbered free text line-by-line", () => {
  assert.deepEqual(parseAlgorithmSteps("시작한다\n확인한다\n종료한다"), ["시작한다", "확인한다", "종료한다"]);
});

test("parseAlgorithmSteps: ignores blank lines", () => {
  assert.deepEqual(parseAlgorithmSteps("1. 시작한다\n\n  \n2. 종료한다\n"), ["시작한다", "종료한다"]);
});

test("parseAlgorithmSteps: empty/whitespace-only text yields no steps", () => {
  assert.deepEqual(parseAlgorithmSteps(""), []);
  assert.deepEqual(parseAlgorithmSteps("   \n  \n"), []);
});

test("parseAlgorithmSteps: only strips one leading numeric marker, preserving a step whose own content starts with a number", () => {
  assert.deepEqual(parseAlgorithmSteps("1. 1단계처럼 보이는 내용"), ["1단계처럼 보이는 내용"]);
});

test("round-trip: serialize then parse recovers the original step contents", () => {
  const steps = ["첫 번째 단계", "두 번째 단계", "세 번째 단계"];
  assert.deepEqual(parseAlgorithmSteps(serializeAlgorithmSteps(steps)), steps);
});
