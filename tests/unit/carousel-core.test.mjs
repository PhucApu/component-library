import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_AUTOPLAY,
  DRAG_THRESHOLD,
  FLICK_VELOCITY,
  MAX_AUTOPLAY,
  MIN_AUTOPLAY,
  autoplayDelay,
  clampIndex,
  clampPerView,
  commitDrag,
  fillLabel,
  indexFromScroll,
  isDrag,
  isLayered,
  lastIndex,
  nextIndex,
  pageCount,
  resolveEffect,
} from '../../components/carousel/source/carousel-core.js';

describe('clampPerView', () => {
  it('shows what was asked for when there is enough to show', () => {
    assert.equal(clampPerView(2, 6), 2);
    assert.equal(clampPerView('3', 6), 3);
  });

  it('never asks for more pictures than there are', () => {
    assert.equal(clampPerView(9, 4), 4);
  });

  it('falls back to one for anything unusable', () => {
    assert.equal(clampPerView(0, 6), 1);
    assert.equal(clampPerView(-2, 6), 1);
    assert.equal(clampPerView('abc', 6), 1);
    assert.equal(clampPerView(undefined, 6), 1);
  });

  it('survives an empty carousel', () => {
    assert.equal(clampPerView(3, 0), 1);
  });
});

describe('lastIndex and pageCount', () => {
  it('stops where the track stops, not where the pictures do', () => {
    // Showing two of six, the sixth is already on screen when the fifth is at the edge, so a
    // sixth position would scroll to somewhere the track cannot reach.
    assert.equal(lastIndex({ total: 6, perView: 1 }), 5);
    assert.equal(lastIndex({ total: 6, perView: 2 }), 4);
    assert.equal(lastIndex({ total: 6, perView: 3 }), 3);
    assert.equal(pageCount({ total: 6, perView: 2 }), 5);
  });

  it('has one position when everything is already on screen', () => {
    assert.equal(lastIndex({ total: 3, perView: 3 }), 0);
    assert.equal(pageCount({ total: 3, perView: 5 }), 1);
  });

  it('reports nothing for an empty carousel', () => {
    assert.equal(lastIndex({ total: 0 }), -1);
    assert.equal(pageCount({ total: 0 }), 0);
    assert.equal(lastIndex(), -1);
  });
});

describe('nextIndex', () => {
  it('steps through the positions', () => {
    assert.equal(nextIndex({ current: 0, total: 6, delta: 1 }), 1);
    assert.equal(nextIndex({ current: 3, total: 6, delta: -1 }), 2);
  });

  it('stops at real ends', () => {
    assert.equal(nextIndex({ current: 5, total: 6, delta: 1 }), 5);
    assert.equal(nextIndex({ current: 0, total: 6, delta: -1 }), 0);
  });

  it('joins the ends up when told to loop', () => {
    assert.equal(nextIndex({ current: 5, total: 6, delta: 1, loop: true }), 0);
    assert.equal(nextIndex({ current: 0, total: 6, delta: -1, loop: true }), 5);
  });

  it('loops around the positions, not the pictures', () => {
    // Two of six leaves five positions, so the last one leads back to the first.
    assert.equal(nextIndex({ current: 4, total: 6, delta: 1, perView: 2, loop: true }), 0);
    assert.equal(nextIndex({ current: 4, total: 6, delta: 1, perView: 2 }), 4);
  });

  it('survives an empty carousel and rubbish input', () => {
    assert.equal(nextIndex({ current: 0, total: 0, delta: 1 }), -1);
    assert.equal(nextIndex(), -1);
    assert.equal(clampIndex({ index: 99, total: 4 }), 3);
    assert.equal(clampIndex({ index: -5, total: 4 }), 0);
    assert.equal(clampIndex({ index: 0, total: 0 }), -1);
  });
});

describe('indexFromScroll', () => {
  it('reads the position off the scroll', () => {
    assert.equal(indexFromScroll({ scrollLeft: 0, slideSize: 300, gap: 12, total: 5 }), 0);
    assert.equal(indexFromScroll({ scrollLeft: 312, slideSize: 300, gap: 12, total: 5 }), 1);
    assert.equal(indexFromScroll({ scrollLeft: 936, slideSize: 300, gap: 12, total: 5 }), 3);
  });

  it('reports the slide it is about to rest on', () => {
    // Rounding rather than flooring: a pixel short of a snap point is the slide arriving,
    // not the one almost left behind.
    assert.equal(indexFromScroll({ scrollLeft: 310, slideSize: 300, gap: 12, total: 5 }), 1);
    assert.equal(indexFromScroll({ scrollLeft: 200, slideSize: 300, gap: 12, total: 5 }), 1);
    assert.equal(indexFromScroll({ scrollLeft: 100, slideSize: 300, gap: 12, total: 5 }), 0);
  });

  it('never reports a position the track cannot stop at', () => {
    assert.equal(indexFromScroll({ scrollLeft: 99999, slideSize: 300, gap: 12, total: 6, perView: 2 }), 4);
  });

  it('survives nonsense', () => {
    assert.equal(indexFromScroll({ scrollLeft: Number.NaN, slideSize: 0, total: 4 }), 0);
    assert.equal(indexFromScroll(), -1);
  });
});

describe('commitDrag', () => {
  it('moves on when the drag went far enough', () => {
    assert.equal(commitDrag({ delta: -120, size: 400 }), 1);
    assert.equal(commitDrag({ delta: 120, size: 400 }), -1);
  });

  it('falls back when it did not', () => {
    assert.equal(commitDrag({ delta: -40, size: 400 }), 0);
    assert.equal(commitDrag({ delta: 40, size: 400 }), 0);
  });

  it('takes a short flick, because that is how a carousel is really moved', () => {
    // Distance alone would throw this away, and it is the commonest gesture there is.
    assert.equal(commitDrag({ delta: -20, size: 400, velocity: -0.9 }), 1);
    assert.equal(commitDrag({ delta: 20, size: 400, velocity: 0.9 }), -1);
  });

  it('takes a slow deliberate drag too, because speed alone is the other half', () => {
    assert.equal(commitDrag({ delta: -300, size: 400, velocity: 0.01 }), 1);
  });

  it('holds the thresholds it says it holds', () => {
    const size = 500;
    assert.equal(commitDrag({ delta: -(size * DRAG_THRESHOLD), size }), 1);
    assert.equal(commitDrag({ delta: -(size * DRAG_THRESHOLD) + 1, size }), 0);
    assert.equal(commitDrag({ delta: 0, size, velocity: -FLICK_VELOCITY }), 1);
  });

  it('survives being handed nothing', () => {
    assert.equal(commitDrag(), 0);
    assert.equal(commitDrag({ delta: Number.NaN, size: Number.NaN }), 0);
  });
});

describe('isDrag', () => {
  it('tells a drag from a press', () => {
    // A press that has not moved is a click on whatever is under it, and a slide can hold a
    // link.
    assert.equal(isDrag(0), false);
    assert.equal(isDrag(4), false);
    assert.equal(isDrag(-40), true);
  });
});

describe('effects', () => {
  it('knows the four it has', () => {
    assert.equal(resolveEffect('fade'), 'fade');
    assert.equal(resolveEffect('cover'), 'cover');
    assert.equal(resolveEffect('nonsense'), 'slide');
    assert.equal(resolveEffect(undefined), 'slide');
  });

  it('knows which ones stop the track scrolling', () => {
    // Sliding is the track moving; the rest need the pictures stacked, which is a different
    // layout and the reason the two are told apart at all.
    assert.equal(isLayered('slide'), false);
    assert.equal(isLayered('fade'), true);
    assert.equal(isLayered('zoom'), true);
    assert.equal(isLayered('cover'), true);
    assert.equal(isLayered('nonsense'), false);
  });
});

describe('autoplayDelay', () => {
  it('takes a readable interval as written', () => {
    assert.equal(autoplayDelay(3000), 3000);
    assert.equal(autoplayDelay('4500'), 4500);
  });

  it('refuses one too quick to read or so slow it looks broken', () => {
    assert.equal(autoplayDelay(200), MIN_AUTOPLAY);
    assert.equal(autoplayDelay(600000), MAX_AUTOPLAY);
  });

  it('falls back rather than guessing', () => {
    assert.equal(autoplayDelay(''), DEFAULT_AUTOPLAY);
    assert.equal(autoplayDelay('abc'), DEFAULT_AUTOPLAY);
    assert.equal(autoplayDelay(0), DEFAULT_AUTOPLAY);
    assert.equal(autoplayDelay(undefined), DEFAULT_AUTOPLAY);
  });
});

describe('fillLabel', () => {
  it('puts the position into the label', () => {
    assert.equal(fillLabel('{index} of {total}', { index: 3, total: 6 }), '3 of 6');
  });

  it('leaves nothing ragged when a value is missing', () => {
    assert.equal(fillLabel('{index} of {total}', { index: '', total: 6 }), 'of 6');
    assert.equal(fillLabel(undefined, { index: 1 }), '');
  });
});
