import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DRAG_THRESHOLD,
  autoScrollStep,
  blockedBy,
  clampIndex,
  dropIndex,
  fillLabel,
  moveItem,
  nextIndex,
  offsetTo,
  segmentFor,
  shiftFor,
} from '../../components/sortable-list/source/sortable-list-core.js';

/** Rows of one height, the easy case every formula gets right. */
const EVEN = [
  { top: 0, height: 40 },
  { top: 48, height: 40 },
  { top: 96, height: 40 },
  { top: 144, height: 40 },
];

/** Rows of four different heights, which is what a real table looks like. */
const RAGGED = [
  { top: 0, height: 20 },
  { top: 28, height: 60 },
  { top: 96, height: 30 },
  { top: 134, height: 80 },
];

describe('moveItem', () => {
  it('slides everything between the two positions along', () => {
    assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
    assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 3, 1), ['a', 'd', 'b', 'c']);
  });

  it('leaves the list alone when nothing moved', () => {
    assert.deepEqual(moveItem(['a', 'b', 'c'], 1, 1), ['a', 'b', 'c']);
  });

  it('never mutates what it was given', () => {
    const original = ['a', 'b', 'c'];
    moveItem(original, 0, 2);
    assert.deepEqual(original, ['a', 'b', 'c']);
  });

  it('refuses an index that is not in the list rather than dropping an entry', () => {
    assert.deepEqual(moveItem(['a', 'b'], 5, 0), ['a', 'b']);
    assert.deepEqual(moveItem(['a', 'b'], -1, 0), ['a', 'b']);
  });
});

describe('clampIndex', () => {
  it('keeps an index inside the list', () => {
    assert.equal(clampIndex(9, 4), 3);
    assert.equal(clampIndex(-2, 4), 0);
    assert.equal(clampIndex(2, 4), 2);
  });

  it('has nowhere to land in an empty list', () => {
    assert.equal(clampIndex(3, 0), 0);
  });
});

describe('dropIndex', () => {
  it('holds its place until the row is halfway to the next slot', () => {
    // Pitch is 48. Nothing happens at 23, the swap lands at 24.
    assert.equal(dropIndex({ boxes: EVEN, from: 0, delta: 23 }), 0);
    assert.equal(dropIndex({ boxes: EVEN, from: 0, delta: 24 }), 1);
  });

  it('walks as far as the drag went', () => {
    assert.equal(dropIndex({ boxes: EVEN, from: 0, delta: 72 }), 2);
    assert.equal(dropIndex({ boxes: EVEN, from: 0, delta: 500 }), 3);
  });

  it('works the same way upward', () => {
    assert.equal(dropIndex({ boxes: EVEN, from: 3, delta: -23 }), 3);
    assert.equal(dropIndex({ boxes: EVEN, from: 3, delta: -24 }), 2);
    assert.equal(dropIndex({ boxes: EVEN, from: 3, delta: -500 }), 0);
  });

  it('measures the neighbour it is passing, not itself', () => {
    // The short first row swapping with the 60px second row travels 60 + 8 = 68, so the
    // halfway mark is 34 — nowhere near its own 20px height. A formula built on the dragged
    // row's own size fires at 14 here and drops a place early.
    assert.equal(dropIndex({ boxes: RAGGED, from: 0, delta: 33 }), 0);
    assert.equal(dropIndex({ boxes: RAGGED, from: 0, delta: 34 }), 1);
  });

  it('measures each neighbour separately on the way down a ragged list', () => {
    // Past row 1 costs 68; past row 2 then costs 30 + 8 = 38, so the second swap lands at
    // 68 + 19 = 87 rather than at another 34.
    assert.equal(dropIndex({ boxes: RAGGED, from: 0, delta: 86 }), 1);
    assert.equal(dropIndex({ boxes: RAGGED, from: 0, delta: 87 }), 2);
  });

  it('measures the neighbour on the way up a ragged list too', () => {
    // Row 3 rising past row 2 travels 30 + 8 = 38, halfway 19.
    assert.equal(dropIndex({ boxes: RAGGED, from: 3, delta: -18 }), 3);
    assert.equal(dropIndex({ boxes: RAGGED, from: 3, delta: -19 }), 2);
  });

  it('stays put when nothing has moved', () => {
    assert.equal(dropIndex({ boxes: RAGGED, from: 2, delta: 0 }), 2);
  });

  it('has no opinion about an empty list', () => {
    assert.equal(dropIndex({ boxes: [], from: 0, delta: 100 }), 0);
  });
});

describe('shiftFor', () => {
  it('lifts every row the dragged one passed on the way down', () => {
    // The space vacated is the dragged row's height plus the gap it leaves behind: 40 + 8.
    assert.equal(shiftFor({ boxes: EVEN, from: 0, to: 2, index: 1 }), -48);
    assert.equal(shiftFor({ boxes: EVEN, from: 0, to: 2, index: 2 }), -48);
  });

  it('pushes down every row the dragged one passed on the way up', () => {
    assert.equal(shiftFor({ boxes: EVEN, from: 3, to: 1, index: 1 }), 48);
    assert.equal(shiftFor({ boxes: EVEN, from: 3, to: 1, index: 2 }), 48);
  });

  it('leaves alone the rows the drag never reached', () => {
    assert.equal(shiftFor({ boxes: EVEN, from: 0, to: 2, index: 3 }), 0);
    assert.equal(shiftFor({ boxes: EVEN, from: 3, to: 1, index: 0 }), 0);
  });

  it('never shifts the row being dragged', () => {
    assert.equal(shiftFor({ boxes: EVEN, from: 0, to: 3, index: 0 }), 0);
  });

  it('shifts by the dragged row, whatever the displaced rows measure', () => {
    // Row 3 is 80 tall; rows 1 and 2 are 60 and 30. All of them move by the same 88 the
    // dragged row vacates, not by anything of their own.
    assert.equal(shiftFor({ boxes: RAGGED, from: 3, to: 1, index: 1 }), 88);
    assert.equal(shiftFor({ boxes: RAGGED, from: 3, to: 1, index: 2 }), 88);
  });

  it('has nothing to shift when the row did not move', () => {
    assert.equal(shiftFor({ boxes: EVEN, from: 1, to: 1, index: 2 }), 0);
  });
});

describe('offsetTo', () => {
  it('lands the row exactly where a pointer drop would have put it', () => {
    // A moving to index 2 in a 48-pitch list ends up 96 lower, which is where dropIndex's
    // own thresholds are measured from. The two paths have to agree on one number.
    assert.equal(offsetTo({ boxes: EVEN, from: 0, to: 2 }), 96);
    assert.equal(offsetTo({ boxes: EVEN, from: 3, to: 1 }), -96);
  });

  it('crosses a ragged list by the heights it actually passes', () => {
    // Down past a 60 and a 30 with 8px gaps: 68 + 38.
    assert.equal(offsetTo({ boxes: RAGGED, from: 0, to: 2 }), 106);
    // Up past a 30 and a 60: 38 + 68.
    assert.equal(offsetTo({ boxes: RAGGED, from: 3, to: 1 }), -106);
  });

  it('agrees with dropIndex at the point a drag would have committed', () => {
    // Drag row 0 far enough to land on index 2, then ask how far row 0 had to go. Reading
    // that offset back through dropIndex must give index 2 again, or the keyboard and the
    // pointer disagree about where a row is.
    for (const boxes of [EVEN, RAGGED]) {
      for (let to = 0; to < boxes.length; to += 1) {
        const delta = offsetTo({ boxes, from: 1, to });
        assert.equal(dropIndex({ boxes, from: 1, delta }), to);
      }
    }
  });

  it('has nowhere to go when the row did not move', () => {
    assert.equal(offsetTo({ boxes: EVEN, from: 2, to: 2 }), 0);
    assert.equal(offsetTo({ boxes: [], from: 0, to: 1 }), 0);
  });
});

describe('segmentFor', () => {
  it('gives the whole list when nothing is locked', () => {
    assert.deepEqual(segmentFor(2, { locked: new Set(), count: 6 }), { start: 0, end: 5 });
  });

  it('treats a locked row as a wall rather than merely an unpickable one', () => {
    // Rows 0-2 reorder among themselves and 4-6 among themselves; nothing crosses row 3.
    // A locked row that only refused to be picked up would let everything else slide under
    // it, which changes its position without anyone having moved it.
    const locked = new Set([3]);

    assert.deepEqual(segmentFor(1, { locked, count: 7 }), { start: 0, end: 2 });
    assert.deepEqual(segmentFor(5, { locked, count: 7 }), { start: 4, end: 6 });
  });

  it('narrows to a single slot between two adjacent walls', () => {
    assert.deepEqual(segmentFor(2, { locked: new Set([1, 3]), count: 5 }), { start: 2, end: 2 });
  });
});

describe('nextIndex', () => {
  it('steps one place at a time', () => {
    assert.equal(nextIndex({ from: 2, key: 'ArrowUp', count: 5 }), 1);
    assert.equal(nextIndex({ from: 2, key: 'ArrowDown', count: 5 }), 3);
  });

  it('reaches the ends without wrapping', () => {
    assert.equal(nextIndex({ from: 2, key: 'Home', count: 5 }), 0);
    assert.equal(nextIndex({ from: 2, key: 'End', count: 5 }), 4);
    assert.equal(nextIndex({ from: 0, key: 'ArrowUp', count: 5 }), 0);
    assert.equal(nextIndex({ from: 4, key: 'ArrowDown', count: 5 }), 4);
  });

  it('stops at a wall rather than jumping over it', () => {
    const locked = new Set([3]);

    assert.equal(nextIndex({ from: 2, key: 'ArrowDown', count: 7, locked }), 2);
    assert.equal(nextIndex({ from: 4, key: 'ArrowUp', count: 7, locked }), 4);
    assert.equal(nextIndex({ from: 1, key: 'End', count: 7, locked }), 2);
    assert.equal(nextIndex({ from: 5, key: 'Home', count: 7, locked }), 4);
  });

  it('will not move a locked row at all', () => {
    assert.equal(nextIndex({ from: 3, key: 'ArrowUp', count: 7, locked: new Set([3]) }), 3);
  });

  it('ignores a key that means nothing here', () => {
    assert.equal(nextIndex({ from: 2, key: 'PageDown', count: 5 }), 2);
  });
});

describe('blockedBy', () => {
  it('names the wall a refused move ran into', () => {
    const locked = new Set([3]);

    assert.equal(blockedBy({ from: 2, key: 'ArrowDown', count: 7, locked }), 3);
    assert.equal(blockedBy({ from: 4, key: 'ArrowUp', count: 7, locked }), 3);
  });

  it('reports no wall at the ends of the list, where there is none', () => {
    // Running out of list is not the same as being stopped by something, and saying a name
    // that is not there would be worse than saying nothing.
    assert.equal(blockedBy({ from: 0, key: 'ArrowUp', count: 5 }), -1);
    assert.equal(blockedBy({ from: 4, key: 'ArrowDown', count: 5 }), -1);
  });

  it('reports no wall when the move was not refused', () => {
    assert.equal(blockedBy({ from: 1, key: 'ArrowDown', count: 7, locked: new Set([3]) }), -1);
  });
});

describe('autoScrollStep', () => {
  it('stays still while the pointer is away from both edges', () => {
    assert.equal(autoScrollStep({ pointer: 300, top: 100, bottom: 500 }), 0);
  });

  it('follows the pointer up and down, faster the closer it gets', () => {
    const near = autoScrollStep({ pointer: 130, top: 100, bottom: 500 });
    const nearer = autoScrollStep({ pointer: 105, top: 100, bottom: 500 });

    assert.ok(near < 0 && nearer < 0);
    assert.ok(nearer < near);
    assert.ok(autoScrollStep({ pointer: 495, top: 100, bottom: 500 }) > 0);
  });

  it('refuses to scroll a box too short to have two edges', () => {
    // Both edge zones would overlap, so every position counts as "near an edge" and the list
    // scrolls whatever the pointer does.
    assert.equal(autoScrollStep({ pointer: 130, top: 100, bottom: 180 }), 0);
  });
});

describe('fillLabel', () => {
  it('fills what it has and leaves nothing ragged', () => {
    assert.equal(
      fillLabel('{name}, position {position} of {total}.', { name: 'Deploy', position: 2, total: 6 }),
      'Deploy, position 2 of 6.',
    );
    assert.equal(fillLabel('{name} is locked.', {}), 'is locked.');
  });
});

describe('DRAG_THRESHOLD', () => {
  it('is big enough to swallow the wobble of a click', () => {
    // Without a threshold, pressing a button inside a row registers a one-pixel drag and the
    // click never lands.
    assert.ok(DRAG_THRESHOLD >= 3 && DRAG_THRESHOLD <= 10);
  });
});
