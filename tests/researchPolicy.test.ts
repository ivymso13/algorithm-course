import test from "node:test";
import assert from "node:assert/strict";
import { reviewPairs,revisionAllowed } from "../lib/researchPolicy";
test("two peers per writer and reviewer, no self-review, deterministic cohort",()=>{const ids=[1,2,3,4,5];const pairs=reviewPairs(ids);for(const [i,id] of ids.entries()){assert.equal(pairs.filter(p=>p.versionId===id).length,2);assert.equal(pairs.filter(p=>p.reviewerIndex===i).length,2);assert.ok(pairs.every(p=>p.versionId!==ids[p.reviewerIndex]));}assert.deepEqual(reviewPairs(ids),pairs);});
test("small cohorts and incoming completion govern revision",()=>{assert.equal(reviewPairs([1]).length,0);assert.equal(reviewPairs([1,2]).length,2);assert.equal(revisionAllowed(0,0),false);assert.equal(revisionAllowed(2,1),false);assert.equal(revisionAllowed(2,2),true);assert.equal(revisionAllowed(0,0,true),true);});
