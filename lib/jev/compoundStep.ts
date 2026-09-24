/**
 * Splits one student step that names several actions in a row ("상자를
 * 확인하고 메모지에 기록한다") into its clauses, so each clause is judged and
 * executed in order under the same step number. Without this, Jev picks one
 * of the actions and the rest is silently dropped (or the step fails as
 * "unclear" run-to-run).
 *
 * Deliberately conservative — a missed split leaves the step whole (the
 * previous behavior), while a wrong split would change what the student
 * wrote. Split points, kept on the left clause:
 *   - a verb connective ending in -고 ("확인하고", "적고", "확인하고 나서")
 *   - "-ㄴ 뒤/후/다음(에)" ("확인한 뒤")
 *   - a sentence end "다." / "다," followed by more words
 * and "그리고" between clauses, which is dropped.
 * Loop steps ("…반복한다") are never split: the loop parser reads the whole
 * sentence.
 */

/** -고 endings that are not "do A and then B": quotes, nouns, adjectives, copula. */
const NON_CONNECTIVE_GO = /(?:라고|다고|자고|냐고|최고|창고|참고|재고|경고|광고|크고|작고|많고|같고|없고|있고|높고|낮고|이고)$/;
const SEQUENCE_WORD = /^(?:뒤|후|다음)(?:에)?,?$/;

function endsWithNieun(word: string): boolean {
  const code = word.charCodeAt(word.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 4;
}

function isGoConnective(word: string, next: string | undefined): boolean {
  const bare = word.replace(/,$/, "");
  return /[가-힣]고$/.test(bare) && !NON_CONNECTIVE_GO.test(bare) && next !== undefined && !/^있/.test(next);
}

export function splitCompoundStep(step: string): string[] {
  const text = step.trim();
  if (text.includes("반복")) return [text];

  const words = text.split(/\s+/);
  const clauses: string[][] = [[]];
  const current = () => clauses[clauses.length - 1];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const next = words[i + 1];
    if (/^그리고,?$/.test(word)) {
      if (current().length > 0) clauses.push([]);
      continue;
    }
    current().push(word);
    if (next === undefined) break;

    if (isGoConnective(word, next)) {
      if (/^나서,?$/.test(next)) current().push(words[++i]);
      clauses.push([]);
    } else if (SEQUENCE_WORD.test(word) && i > 0 && endsWithNieun(words[i - 1])) {
      clauses.push([]);
    } else if (/다[.,]$/.test(word)) {
      clauses.push([]);
    }
  }

  const parts = clauses.map((c) => c.join(" ").trim()).filter((c) => c.length > 0);
  // A lone fragment ("확인한 뒤" with nothing before "뒤") means the split
  // misread the sentence — keep it whole rather than guess.
  if (parts.length < 2 || parts.some((p) => p.replace(/[\s.,]/g, "").length < 2)) return [text];
  return parts;
}
