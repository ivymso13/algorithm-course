/**
 * Splits a free-form warm-up algorithm into generic checklist steps — one
 * per non-empty line. There is no fixed problem type here (unlike
 * lib/problems/*), so there is no simulator to derive real steps from; the
 * "체크 체험" is a self-report checklist over the author's own line breaks.
 */
export function splitAlgorithmIntoSteps(algorithmText: string): string[] {
  return algorithmText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Keeps only in-range integer indices — defends `checkedSteps` against a
 * client sending stale/out-of-bounds indices after the text changes. */
export function sanitizeCheckedSteps(checkedSteps: unknown, totalSteps: number): number[] {
  if (!Array.isArray(checkedSteps)) return [];
  const unique = new Set(
    checkedSteps.filter(
      (n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n < totalSteps
    )
  );
  return Array.from(unique).sort((a, b) => a - b);
}
