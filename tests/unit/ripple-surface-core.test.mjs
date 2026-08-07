import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_MAX_RIPPLES,
  DEFAULT_RINGS,
  DEFAULT_SPACING,
  FULL_SPREAD_SPEED,
  MAX_RINGS,
  MAX_WAKE_SPREAD,
  MIN_WAKE_SPREAD,
  RING_STAGGER,
  angleBetween,
  capRipples,
  clampDuration,
  clampMaxRipples,
  clampRings,
  clampSpacing,
  maxRadiusFor,
  pointerSpeed,
  progressOf,
  pruneRipples,
  rippleAlpha,
  rippleRadius,
  rippleWidth,
  ringBirths,
  shouldEmit,
  wakeRadius,
  wakeSpread,
} from '../../components/ripple-surface/source/ripple-surface-core.js';

describe('progressOf', () => {
  it('runs from birth to gone', () => {
    assert.equal(progressOf(0, 1000), 0);
    assert.equal(progressOf(500, 1000), 0.5);
    assert.equal(progressOf(1000, 1000), 1);
  });

  it('never leaves the life it was given', () => {
    assert.equal(progressOf(4000, 1000), 1);
    assert.equal(progressOf(-40, 1000), 0);
  });

  it('treats a ripple with no life as already over', () => {
    assert.equal(progressOf(10, 0), 1);
    assert.equal(progressOf(10, 'x'), 1);
  });
});

describe('rippleRadius', () => {
  it('reaches its full reach exactly as it dies', () => {
    assert.equal(rippleRadius(0, 1000, 400), 0);
    assert.equal(rippleRadius(1000, 1000, 400), 400);
  });

  // Water spreads quickly and then slows; a ring that grew evenly reads as a shape being
  // scaled rather than as water.
  it('covers more than half the distance in the first half of its life', () => {
    assert.ok(rippleRadius(500, 1000, 400) > 200);
  });

  it('only ever grows', () => {
    let previous = -1;

    for (let age = 0; age <= 1000; age += 100) {
      const radius = rippleRadius(age, 1000, 400);
      assert.ok(radius >= previous);
      previous = radius;
    }
  });
});

describe('rippleAlpha', () => {
  it('arrives rather than appearing at full strength', () => {
    assert.ok(rippleAlpha(0, 1000) < 0.05);
    assert.ok(rippleAlpha(80, 1000) > 0.7);
  });

  it('is gone by the end', () => {
    assert.equal(rippleAlpha(1000, 1000), 0);
    assert.equal(rippleAlpha(2000, 1000), 0);
  });

  it('fades once it is up', () => {
    assert.ok(rippleAlpha(300, 1000) > rippleAlpha(700, 1000));
  });
});

describe('rippleWidth', () => {
  it('thins as the ripple widens', () => {
    assert.equal(rippleWidth(0, 1000, 3), 3);
    assert.equal(rippleWidth(500, 1000, 3), 1.5);
    assert.equal(rippleWidth(1000, 1000, 3), 0);
  });

  it('never goes negative', () => {
    assert.equal(rippleWidth(9000, 1000, 3), 0);
    assert.equal(rippleWidth(10, 1000, 'x'), 0);
  });
});

describe('shouldEmit', () => {
  // Tying a mark to distance rather than to events is what makes the same gesture look the
  // same on a slow machine and a fast one.
  it('waits until the pointer has travelled far enough', () => {
    assert.equal(shouldEmit({ x: 0, y: 0 }, { x: 10, y: 0 }, 14), false);
    assert.equal(shouldEmit({ x: 0, y: 0 }, { x: 14, y: 0 }, 14), true);
    assert.equal(shouldEmit({ x: 0, y: 0 }, { x: 10, y: 10 }, 14), true);
  });

  it('always emits the first mark of a crossing', () => {
    assert.equal(shouldEmit(null, { x: 4, y: 4 }, 14), true);
    assert.equal(shouldEmit(null, null, 14), false);
  });
});

describe('angleBetween and pointerSpeed', () => {
  it('points from one place to another', () => {
    assert.equal(angleBetween({ x: 0, y: 0 }, { x: 10, y: 0 }), 0);
    assert.equal(angleBetween({ x: 0, y: 0 }, { x: 0, y: 10 }), Math.PI / 2);
    assert.equal(angleBetween(null, { x: 1, y: 1 }), 0);
  });

  it('measures pixels a millisecond over the samples given', () => {
    const samples = [
      { x: 0, y: 0, time: 0 },
      { x: 60, y: 80, time: 100 },
    ];

    assert.equal(pointerSpeed(samples), 1);
  });

  it('has no speed without two samples or without time passing', () => {
    assert.equal(pointerSpeed([]), 0);
    assert.equal(pointerSpeed([{ x: 0, y: 0, time: 0 }]), 0);
    assert.equal(
      pointerSpeed([
        { x: 0, y: 0, time: 5 },
        { x: 10, y: 0, time: 5 },
      ]),
      0,
    );
  });
});

describe('wakeSpread and wakeRadius', () => {
  it('opens the arc wider the faster the pointer goes', () => {
    assert.equal(wakeSpread(0), MIN_WAKE_SPREAD);
    assert.equal(wakeSpread(FULL_SPREAD_SPEED), MAX_WAKE_SPREAD);
    assert.equal(wakeSpread(99), MAX_WAKE_SPREAD);
    assert.ok(wakeSpread(1) > wakeSpread(0.2));
  });

  it('throws it further, up to a limit', () => {
    assert.ok(wakeRadius(2) > wakeRadius(0));
    assert.equal(wakeRadius(1000), 120);
    assert.equal(wakeRadius('x'), 44);
  });
});

describe('maxRadiusFor', () => {
  it('grows with the surface it is drawn on', () => {
    assert.ok(maxRadiusFor(800, 600) > maxRadiusFor(400, 300));
    assert.equal(Math.round(maxRadiusFor(800, 600)), 450);
  });

  it('has no reach on a surface with no size', () => {
    assert.equal(maxRadiusFor(0, 0), 0);
    assert.equal(maxRadiusFor(), 0);
  });
});

describe('ringBirths', () => {
  it('sends the rings out one after another', () => {
    assert.deepEqual(ringBirths(1000, 3, 100), [1000, 1100, 1200]);
  });

  it('keeps the count inside what can be read', () => {
    assert.equal(ringBirths(0, 99).length, MAX_RINGS);
    assert.equal(ringBirths(0, 0).length, 1);
    assert.equal(ringBirths(0).length, DEFAULT_RINGS);
    assert.equal(ringBirths(0, 2, RING_STAGGER)[1], RING_STAGGER);
  });
});

describe('pruneRipples and capRipples', () => {
  const ripples = [
    { birth: 0, duration: 500 },
    { birth: 400, duration: 500 },
    { birth: 900, duration: 500 },
  ];

  it('keeps the ones with life left, unborn ones included', () => {
    assert.equal(pruneRipples(ripples, 800).length, 2);
    // A ring staggered into the future has not started and is certainly not over.
    assert.equal(pruneRipples([{ birth: 900, duration: 500 }], 800).length, 1);
    assert.equal(pruneRipples(ripples, 5000).length, 0);
  });

  it('keeps the newest when there are too many', () => {
    const capped = capRipples(ripples, 2);

    assert.equal(capped.length, 2);
    assert.equal(capped[0].birth, 400);
    assert.equal(capRipples(ripples, 10).length, 3);
  });
});

describe('the clamps', () => {
  it('keep every setting inside what can be drawn', () => {
    assert.equal(clampRings(3), 3);
    assert.equal(clampRings(0), 1);
    assert.equal(clampRings(99), MAX_RINGS);
    assert.equal(clampRings('abc'), DEFAULT_RINGS);

    assert.equal(clampSpacing(40), 40);
    assert.equal(clampSpacing(0), 4);
    assert.equal(clampSpacing('abc'), DEFAULT_SPACING);

    assert.equal(clampDuration(900), 900);
    assert.equal(clampDuration(10), 120);
    assert.equal(clampDuration(99999), 6000);
    assert.equal(clampDuration('abc', 700), 700);

    assert.equal(clampMaxRipples(8), 8);
    assert.equal(clampMaxRipples(0), 1);
    assert.equal(clampMaxRipples(99999), 400);
    assert.equal(clampMaxRipples('abc'), DEFAULT_MAX_RIPPLES);
  });
});
