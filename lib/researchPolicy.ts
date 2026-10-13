export function reviewPairs(ids: readonly number[], count = 2) {
  return ids.flatMap((versionId, i) => Array.from({length: Math.min(count, Math.max(0,ids.length-1))},(_,j)=>({versionId, reviewerIndex:(i+j+1)%ids.length})));
}
export function revisionAllowed(required:number, completed:number, override=false) { return override || required>0 && completed===required; }
