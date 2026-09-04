import assert from "node:assert/strict";
import test from "node:test";
import {
  isCarouselFullyReviewed,
  nextCarouselId,
  reconcileCarouselId,
  resolveCarouselIndex,
} from "../lib/boardCarousel.ts";

const A = { id: 10 };
const B = { id: 20 };
const C = { id: 30 };

test("resolveCarouselIndex: finds the entry by id regardless of array position", () => {
  assert.equal(resolveCarouselIndex([A, B, C], 20), 1);
  assert.equal(resolveCarouselIndex([C, A, B], 20), 2);
});

test("resolveCarouselIndex: falls back to 0 for null id, missing id, or an empty board", () => {
  assert.equal(resolveCarouselIndex([A, B, C], null), 0);
  assert.equal(resolveCarouselIndex([A, B, C], 999), 0);
  assert.equal(resolveCarouselIndex([], 10), 0);
});

test("nextCarouselId: advances to the following entry", () => {
  assert.equal(nextCarouselId([A, B, C], 10), 20);
  assert.equal(nextCarouselId([A, B, C], 20), 30);
});

test("nextCarouselId: wraps back to the first entry past the last one", () => {
  assert.equal(nextCarouselId([A, B, C], 30), 10);
});

test("nextCarouselId: starting from null/unknown id lands on the second entry (index 0 -> 1)", () => {
  // resolveCarouselIndex(null) is 0, so "next" is index 1 — matches clicking
  // "다음 아이디어" from a just-reconciled first entry.
  assert.equal(nextCarouselId([A, B, C], null), 20);
  assert.equal(nextCarouselId([A, B, C], 999), 20);
});

test("nextCarouselId: a single-entry board wraps to itself", () => {
  assert.equal(nextCarouselId([A], 10), 10);
});

test("nextCarouselId: an empty board has no next id", () => {
  assert.equal(nextCarouselId([], 10), null);
});

test("reconcileCarouselId: keeps the current id when it's still present, even after reordering", () => {
  assert.equal(reconcileCarouselId([C, B, A], 20), 20);
});

test("reconcileCarouselId: falls back to the first entry when current id is null or gone", () => {
  assert.equal(reconcileCarouselId([A, B, C], null), 10);
  assert.equal(reconcileCarouselId([A, B, C], 999), 10);
});

test("reconcileCarouselId: an empty board reconciles to null", () => {
  assert.equal(reconcileCarouselId([], 10), null);
});

test("isCarouselFullyReviewed: false until every current entry has been viewed", () => {
  assert.equal(isCarouselFullyReviewed([A, B, C], new Set([10])), false);
  assert.equal(isCarouselFullyReviewed([A, B, C], new Set([10, 20])), false);
  assert.equal(isCarouselFullyReviewed([A, B, C], new Set([10, 20, 30])), true);
});

test("isCarouselFullyReviewed: an empty board is never 'fully reviewed' (nothing to show)", () => {
  assert.equal(isCarouselFullyReviewed([], new Set()), false);
});

test("isCarouselFullyReviewed: extra viewed ids no longer on the board don't matter", () => {
  assert.equal(isCarouselFullyReviewed([A, B], new Set([10, 20, 999])), true);
});
