import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ELLIPSIS_END,
  ELLIPSIS_START,
  SIZES,
  buildRange,
  clampCount,
  clampPage,
  fillLabel,
  normalizeSize,
  pageAnnouncement,
  pageSlice,
} from '../../components/pagination/source/pagination-core.js';

describe('attribute normalisation', () => {
  it('keeps every documented size', () => {
    for (const size of SIZES) {
      assert.equal(normalizeSize(size), size);
    }

    assert.equal(normalizeSize('large'), 'md');
    assert.equal(normalizeSize(null), 'md');
  });

  it('always has at least one page', () => {
    assert.equal(clampCount(0), 1);
    assert.equal(clampCount(-5), 1);
    assert.equal(clampCount('nope'), 1);
    assert.equal(clampCount(12), 12);
  });

  it('clamps a page into range rather than refusing it', () => {
    assert.equal(clampPage(0, 10), 1);
    assert.equal(clampPage(99, 10), 10);
    assert.equal(clampPage('4', 10), 4);
    assert.equal(clampPage(undefined, 10), 1);
  });
});

describe('buildRange', () => {
  it('shows every page when they all fit', () => {
    assert.deepEqual(buildRange({ page: 2, count: 4 }), [1, 2, 3, 4]);
  });

  it('collapses on the far side only, at the start', () => {
    assert.deepEqual(buildRange({ page: 1, count: 10 }), [1, 2, 3, 4, 5, ELLIPSIS_END, 10]);
  });

  it('collapses on both sides in the middle', () => {
    assert.deepEqual(buildRange({ page: 6, count: 24 }), [
      1,
      ELLIPSIS_START,
      5,
      6,
      7,
      ELLIPSIS_END,
      24,
    ]);
  });

  it('honours the sibling count', () => {
    assert.deepEqual(buildRange({ page: 10, count: 24, siblingCount: 2 }), [
      1,
      ELLIPSIS_START,
      8,
      9,
      10,
      11,
      12,
      ELLIPSIS_END,
      24,
    ]);

    assert.deepEqual(buildRange({ page: 10, count: 24, siblingCount: 0 }), [
      1,
      ELLIPSIS_START,
      10,
      ELLIPSIS_END,
      24,
    ]);
  });

  it('honours the boundary count', () => {
    assert.deepEqual(buildRange({ page: 10, count: 24, boundaryCount: 2 }), [
      1,
      2,
      ELLIPSIS_START,
      9,
      10,
      11,
      ELLIPSIS_END,
      23,
      24,
    ]);
  });

  it('shows the page rather than an ellipsis standing for one page', () => {
    // A mark in place of a single number is the same width and one fewer thing anyone can
    // reach, so page 8 stays put here.
    assert.deepEqual(buildRange({ page: 7, count: 9 }), [1, ELLIPSIS_START, 5, 6, 7, 8, 9]);
  });

  it('clamps a page outside the range instead of producing a broken list', () => {
    assert.deepEqual(buildRange({ page: 99, count: 3 }), [1, 2, 3]);
    assert.deepEqual(buildRange({ page: 0, count: 3 }), [1, 2, 3]);
  });

  it('survives being asked about nothing', () => {
    assert.deepEqual(buildRange(), [1]);
    assert.deepEqual(buildRange({ count: 1 }), [1]);
  });
});

describe('pageSlice', () => {
  it('reports the rows a page covers, one-based and inclusive', () => {
    assert.deepEqual(pageSlice({ page: 1, pageSize: 5, total: 26 }), {
      start: 1,
      end: 5,
      count: 6,
    });
    assert.deepEqual(pageSlice({ page: 3, pageSize: 5, total: 26 }), {
      start: 11,
      end: 15,
      count: 6,
    });
  });

  it('stops the last page at the last row', () => {
    assert.deepEqual(pageSlice({ page: 6, pageSize: 5, total: 26 }), {
      start: 26,
      end: 26,
      count: 6,
    });
  });

  it('has nothing to slice for an empty list', () => {
    assert.deepEqual(pageSlice({ page: 1, pageSize: 5, total: 0 }), {
      start: 0,
      end: 0,
      count: 1,
    });
  });
});

describe('pageAnnouncement', () => {
  it('states the position when that is all it knows', () => {
    assert.equal(pageAnnouncement({ page: 3, count: 10 }), 'Page 3 of 10');
  });

  it('adds the row range when it has one, because that is worth more', () => {
    assert.equal(
      pageAnnouncement({ page: 3, count: 6, pageSize: 5, total: 26 }),
      'Page 3 of 6, showing 11 to 15 of 26',
    );
  });

  it('falls back to the position when the totals are not usable', () => {
    assert.equal(pageAnnouncement({ page: 2, count: 4, pageSize: 0, total: 26 }), 'Page 2 of 4');
    assert.equal(pageAnnouncement({ page: 2, count: 4, pageSize: 5, total: 0 }), 'Page 2 of 4');
  });

  it('lets an author replace the wording', () => {
    assert.equal(
      pageAnnouncement({ page: 2, count: 4, labels: { announce: '{page}/{count}' } }),
      '2/4',
    );
  });
});

describe('fillLabel', () => {
  it('substitutes and tidies the result', () => {
    assert.equal(fillLabel('Go to page {page}', { page: 7 }), 'Go to page 7');
  });

  it('survives a template that is not a string', () => {
    assert.equal(fillLabel(null, { page: 1 }), '');
  });
});
