import assert from "node:assert/strict";
import test from "node:test";
import {
  BOARD_PAGE_SIZE,
  clampPageIndex,
  entriesForPage,
  isBoardFullyReviewed,
  pageCount,
} from "../lib/boardPagination.ts";

const A = { id: 10 };
const B = { id: 20 };
const C = { id: 30 };
const D = { id: 40 };

test("BOARD_PAGE_SIZE: shows 3 entries per page", () => {
  assert.equal(BOARD_PAGE_SIZE, 3);
});

test("pageCount: divides entries into pages of the given size", () => {
  assert.equal(pageCount(0, 3), 0);
  assert.equal(pageCount(1, 3), 1);
  assert.equal(pageCount(3, 3), 1);
  assert.equal(pageCount(4, 3), 2);
  assert.equal(pageCount(6, 3), 2);
  assert.equal(pageCount(7, 3), 3);
});

test("clampPageIndex: keeps a page index within [0, totalPages - 1]", () => {
  assert.equal(clampPageIndex(0, 3), 0);
  assert.equal(clampPageIndex(2, 3), 2);
  assert.equal(clampPageIndex(5, 3), 2);
  assert.equal(clampPageIndex(-1, 3), 0);
});

test("clampPageIndex: falls back to 0 when there are no pages", () => {
  assert.equal(clampPageIndex(0, 0), 0);
  assert.equal(clampPageIndex(4, 0), 0);
});

test("entriesForPage: slices entries by page, `pageSize` at a time", () => {
  assert.deepEqual(entriesForPage([A, B, C, D], 0, 3), [A, B, C]);
  assert.deepEqual(entriesForPage([A, B, C, D], 1, 3), [D]);
});

test("entriesForPage: an out-of-range page returns an empty slice", () => {
  assert.deepEqual(entriesForPage([A, B, C], 5, 3), []);
});

test("isBoardFullyReviewed: false until every current entry has been viewed", () => {
  assert.equal(isBoardFullyReviewed([A, B, C], new Set([10])), false);
  assert.equal(isBoardFullyReviewed([A, B, C], new Set([10, 20])), false);
  assert.equal(isBoardFullyReviewed([A, B, C], new Set([10, 20, 30])), true);
});

test("isBoardFullyReviewed: an empty board is never 'fully reviewed' (nothing to show)", () => {
  assert.equal(isBoardFullyReviewed([], new Set()), false);
});

test("isBoardFullyReviewed: extra viewed ids no longer on the board don't matter", () => {
  assert.equal(isBoardFullyReviewed([A, B], new Set([10, 20, 999])), true);
});
