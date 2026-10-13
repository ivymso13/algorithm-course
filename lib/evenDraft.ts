import { parseAlgorithmSteps, serializeAlgorithmSteps } from "./algorithmSteps";

interface BrowserStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
function read(storage: BrowserStorage, key: string) { try { return storage.getItem(key); } catch { return null; } }
export function restoreEvenSteps(session: BrowserStorage, local: BrowserStorage): string[] {
  const structured = read(session, "even-count-steps");
  if (structured) { try { const steps = JSON.parse(structured); if (Array.isArray(steps) && steps.length > 0 && steps.every(s => typeof s === "string")) return steps; } catch { /* legacy fallback */ } }
  const draft = read(local, "even-count-draft");
  if (draft?.trim()) return parseAlgorithmSteps(draft);
  const submitted = read(session, "even-count-submission");
  if (submitted?.trim()) return parseAlgorithmSteps(submitted);
  const result = read(session, "even-count-result");
  if (result) { try { const data = JSON.parse(result); if (typeof data.submissionText === "string" && data.submissionText.trim()) return parseAlgorithmSteps(data.submissionText); } catch { /* no saved result */ } }
  return [""];
}
export function saveEvenSteps(steps: string[], session: BrowserStorage, local: BrowserStorage) {
  try { session.setItem("even-count-steps", JSON.stringify(steps)); } catch { /* alternate storage */ }
  try { local.setItem("even-count-draft", serializeAlgorithmSteps(steps)); } catch { /* session draft remains */ }
}
