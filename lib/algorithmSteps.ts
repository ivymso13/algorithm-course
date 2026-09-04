/**
 * Parse/serialize helpers for the step-by-step algorithm editor on the write
 * page. The wire format never changes — a plain "1. ...\n2. ..." string is
 * still what's stored in sessionStorage drafts and sent to the server (see
 * `lib/validation.ts`'s `validateAlgorithmText` and
 * `lib/warmupSteps.ts`'s `splitAlgorithmIntoSteps`, both of which keep
 * operating on that same string) — only the client's editing widget is new,
 * representing the same text as an array of per-step strings.
 */

const STEP_PREFIX_PATTERN = /^\s*\d+[.)]\s*/;

/**
 * Recovers step contents from stored algorithm text: one step per non-empty
 * line, with a leading "1. " / "1) "-style numeric marker safely stripped if
 * present. Text with no numbering (or blank/whitespace-only lines) still
 * restores line-by-line — every line becomes one step, numbered or not.
 */
export function parseAlgorithmSteps(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(STEP_PREFIX_PATTERN, ""));
}

/**
 * Renders step contents back into the "1. ...\n2. ..." wire format. Blank
 * steps are dropped and the rest renumbered sequentially, so a stray empty
 * step (e.g. one added but never filled in) never produces a gap or an
 * empty-looking line. Any newlines a step's own textarea picked up are
 * collapsed to spaces first — the wire format is one line per step, so a
 * step can't be allowed to span multiple lines itself.
 */
export function serializeAlgorithmSteps(steps: string[]): string {
  return steps
    .map((step) => step.replace(/\s+/g, " ").trim())
    .filter((step) => step.length > 0)
    .map((step, index) => `${index + 1}. ${step}`)
    .join("\n");
}
