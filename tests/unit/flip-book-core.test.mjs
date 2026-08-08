import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COMMIT_PROGRESS,
  DEFAULT_DURATION,
  FLICK_VELOCITY,
  MAX_DURATION,
  MAX_SHADE,
  MAX_STACK_DEPTH,
  MIN_DURATION,
  STACK_STEP,
  canTurn,
  clampDuration,
  clampPage,
  clampTurned,
  commitTurn,
  dragProgress,
  easeInOut,
  fillLabel,
  leafCount,
  leavesFrom,
  pageForTurned,
  shadeAt,
  spreadOf,
  stackOffset,
  turnAngle,
  turnedForPage,
  zIndexFor,
} from '../../components/flip-book/source/flip-book-core.js';

describe('leafCount and leavesFrom', () => {
  it('puts two pages on every leaf', () => {
    assert.equal(leafCount(8), 4);
    assert.deepEqual(leavesFrom(4), [
      { front: 0, back: 1 },
      { front: 2, back: 3 },
    ]);
  });

  // A book with an odd page count ends on a blank, and dropping the leaf would take the
  // page in front of it with it.
  it('ends an odd book on a blank back', () => {
    assert.equal(leafCount(5), 3);
    assert.deepEqual(leavesFrom(5).at(-1), { front: 4, back: null });
  });

  it('survives a book with nothing in it', () => {
    assert.equal(leafCount(0), 0);
    assert.deepEqual(leavesFrom(0), []);
    assert.deepEqual(leavesFrom('x'), []);
  });
});

describe('spreadOf', () => {
  // The book opens closed: everything on the right, nothing on the left.
  it('starts with one page and no facing page', () => {
    assert.deepEqual(spreadOf(0, 8), { left: null, right: 1 });
  });

  it('reads two pages once it is open', () => {
    assert.deepEqual(spreadOf(1, 8), { left: 2, right: 3 });
    assert.deepEqual(spreadOf(3, 8), { left: 6, right: 7 });
  });

  it('ends with one page and nothing to its right', () => {
    assert.deepEqual(spreadOf(4, 8), { left: 8, right: null });
  });

  it('has nothing to show for an empty book', () => {
    assert.deepEqual(spreadOf(0, 0), { left: null, right: null });
  });
});

describe('pageForTurned and turnedForPage', () => {
  it('names the first page a reader can see', () => {
    assert.equal(pageForTurned(0, 8), 1);
    assert.equal(pageForTurned(1, 8), 3);
    assert.equal(pageForTurned(4, 8), 8);
  });

  it('finds the leaf count that puts a page in view', () => {
    assert.equal(turnedForPage(1, 8), 0);
    // Page two is the back of the first leaf, so it takes one turn to reach.
    assert.equal(turnedForPage(2, 8), 1);
    assert.equal(turnedForPage(3, 8), 1);
    assert.equal(turnedForPage(8, 8), 4);
  });

  it('keeps a page and a turn count inside the book', () => {
    assert.equal(clampPage(99, 8), 8);
    assert.equal(clampPage(-4, 8), 1);
    assert.equal(clampPage(3, 0), 0);
    assert.equal(clampTurned(99, 8), 4);
    assert.equal(clampTurned(-2, 8), 0);
  });
});

describe('canTurn', () => {
  it('will not turn back from the front of the book', () => {
    assert.equal(canTurn(0, 8, -1), false);
    assert.equal(canTurn(1, 8, -1), true);
  });

  it('turns forward while there is a page still to reach', () => {
    assert.equal(canTurn(0, 8, 1), true);
    assert.equal(canTurn(3, 8, 1), true);
    assert.equal(canTurn(4, 8, 1), false);
  });

  // One page is a leaf with a blank back: turning it would be a page turn showing nothing.
  it('refuses to turn a book of one page', () => {
    assert.equal(canTurn(0, 1, 1), false);
    assert.equal(canTurn(0, 2, 1), true);
  });
});

describe('dragProgress, turnAngle and commitTurn', () => {
  it('measures the drag against the width of a page', () => {
    assert.equal(dragProgress(50, 200), 0.25);
    assert.equal(dragProgress(400, 200), 1);
    assert.equal(dragProgress(-40, 200), 0);
    assert.equal(dragProgress(40, 0), 0);
  });

  it('takes the leaf all the way over', () => {
    assert.equal(turnAngle(0), -0);
    assert.equal(turnAngle(0.5), -90);
    assert.equal(turnAngle(1), -180);
    assert.equal(turnAngle(9), -180);
  });

  it('commits past half way', () => {
    assert.equal(commitTurn({ progress: COMMIT_PROGRESS }), true);
    assert.equal(commitTurn({ progress: 0.2 }), false);
  });

  // Distance alone would throw away the short flick that is how most people turn a page.
  it('commits a short throw that is still moving', () => {
    assert.equal(commitTurn({ progress: 0.2, velocity: FLICK_VELOCITY }), true);
    assert.equal(commitTurn({ progress: 0.2, velocity: FLICK_VELOCITY / 4 }), false);
    assert.equal(commitTurn(), false);
  });
});

describe('easeInOut', () => {
  it('starts and ends where it should', () => {
    assert.equal(easeInOut(0), 0);
    assert.equal(easeInOut(1), 1);
    assert.equal(easeInOut(0.5), 0.5);
  });

  it('is slow at both ends and quick in the middle', () => {
    assert.ok(easeInOut(0.15) < 0.15);
    assert.ok(easeInOut(0.85) > 0.85);
  });

  it('only ever goes forwards', () => {
    let previous = -1;

    for (let time = 0; time <= 1; time += 0.05) {
      const eased = easeInOut(time);
      assert.ok(eased >= previous);
      previous = eased;
    }
  });
});

describe('stackOffset and shadeAt', () => {
  it('gives the pile a thickness and stops paying for what cannot be seen', () => {
    assert.equal(stackOffset(0), 0);
    assert.equal(stackOffset(2), STACK_STEP * 2);
    assert.equal(stackOffset(99), STACK_STEP * MAX_STACK_DEPTH);
  });

  it('darkens a leaf most where it stands upright', () => {
    assert.equal(shadeAt(0), 0);
    assert.equal(shadeAt(-90), MAX_SHADE);
    assert.ok(shadeAt(-180) < 0.001);
    assert.ok(shadeAt(-45) > 0);
  });
});

describe('zIndexFor', () => {
  it('puts the top of each pile above the rest of it', () => {
    // Two turned, two not: the last turned leaf is on top of its pile, and the first
    // unturned one is on top of the book.
    const turned = [0, 1].map((index) => zIndexFor(index, 2, 8));
    const unturned = [2, 3].map((index) => zIndexFor(index, 2, 8));

    assert.ok(turned[1] > turned[0]);
    assert.ok(unturned[0] > unturned[1]);
  });

  // A leaf in the air crosses both piles, and anything it can tie with it can pass through.
  it('keeps the two piles apart and the turning leaf above both', () => {
    const all = [0, 1, 2, 3].map((index) => zIndexFor(index, 2, 8));
    const turning = zIndexFor(1, 2, 8, true);

    assert.equal(new Set(all).size, all.length);
    assert.ok(all.every((value) => turning > value));
  });
});

describe('clampDuration and fillLabel', () => {
  it('keeps a turn inside what can be watched', () => {
    assert.equal(clampDuration(520), 520);
    assert.equal(clampDuration('220'), 220);
    assert.equal(clampDuration(10), MIN_DURATION);
    assert.equal(clampDuration(99999), MAX_DURATION);
    assert.equal(clampDuration('abc'), DEFAULT_DURATION);
  });

  it('puts the spread into the announcement', () => {
    assert.equal(
      fillLabel('Pages {left} and {right} of {total}', { left: 2, right: 3, total: 8 }),
      'Pages 2 and 3 of 8',
    );
    assert.equal(fillLabel(undefined, { page: 1 }), '');
  });
});
