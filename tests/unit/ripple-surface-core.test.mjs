import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_MAX_RIPPLES,
  DEFAULT_RINGS,
  DEFAULT_SPACING,
  JITTER,
  MAX_RINGS,
  MAX_WAKE_OFFSET,
  RING_STAGGER,
  WAKE_REACH,
  WAKE_STRANDS,
  WAVE_AMPLITUDE,
  alongFade,
  alongFromHead,
  angleBetween,
  capRipples,
  clampDuration,
  clampMaxRipples,
  clampRings,
  clampSpacing,
  maxRadiusFor,
  offsetPoint,
  pointNoise,
  pointerSpeed,
  progressOf,
  pruneRipples,
  resamplePath,
  rippleAlpha,
  rippleRadius,
  rippleWidth,
  ringBirths,
  shouldEmit,
  trailAngles,
  wakeAlpha,
  wakeJitter,
  wakeOffset,
  wakeStrength,
  wakeWave,
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
    assert.equal(shouldEmit({ x: 0, y: 0 }, { x: 6, y: 0 }, 8), false);
    assert.equal(shouldEmit({ x: 0, y: 0 }, { x: 8, y: 0 }, 8), true);
    assert.equal(shouldEmit({ x: 0, y: 0 }, { x: 6, y: 6 }, 8), true);
  });

  it('always takes the first sample of a crossing', () => {
    assert.equal(shouldEmit(null, { x: 4, y: 4 }, 8), true);
    assert.equal(shouldEmit(null, null, 8), false);
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

describe('wakeOffset', () => {
  // Zero at the pointer is what makes the two sides meet there in a point, which is the
  // whole shape of a wake.
  it('is nothing at the prow and opens out behind it', () => {
    assert.equal(wakeOffset(0, 0), 0);
    assert.ok(wakeOffset(100, 0) > wakeOffset(40, 0));
  });

  it('keeps opening after the pointer has stopped', () => {
    assert.ok(wakeOffset(100, 400) > wakeOffset(100, 0));
  });

  it('eases into its limit rather than being cut off at it', () => {
    const near = wakeOffset(2000, 0);
    const far = wakeOffset(6000, 0);

    assert.ok(near < MAX_WAKE_OFFSET);
    assert.ok(far < MAX_WAKE_OFFSET);
    // Still creeping outwards at the far end: a hard limit would put a corner in both
    // sides of the wake at the moment they reached it.
    assert.ok(far > near);
  });
});

describe('wakeWave, pointNoise and wakeJitter', () => {
  it('holds the swell back at the point of the wake and lets it in behind', () => {
    assert.equal(wakeWave(0, 0), 0);
    assert.ok(Math.abs(wakeWave(120, 0)) > 0);
  });

  it('keeps the swell within its amplitude and moves it as it ages', () => {
    for (let along = 0; along <= 400; along += 17) {
      assert.ok(Math.abs(wakeWave(along, 0)) <= WAVE_AMPLITUDE);
    }

    assert.notEqual(wakeWave(120, 0), wakeWave(120, 300));
  });

  // One sine repeats visibly along a long trail and the eye reads the repeat as a pattern.
  it('never quite comes round to the same shape', () => {
    const first = wakeWave(100, 0);
    const later = wakeWave(100 + 2 * Math.PI * 10, 0);

    assert.notEqual(Number(first.toFixed(3)), Number(later.toFixed(3)));
  });

  it('puts each strand out of step with the others', () => {
    assert.notEqual(wakeWave(120, 0, 0), wakeWave(120, 0, 1.9));
  });

  // Fixed per point, or noise redrawn every frame makes the whole wake crawl.
  it('gives every point its own wobble and keeps it', () => {
    assert.equal(pointNoise(1234.5), pointNoise(1234.5));
    assert.notEqual(pointNoise(1234.5), pointNoise(1235.5));

    for (let seed = 0; seed < 200; seed += 7) {
      assert.ok(Math.abs(pointNoise(seed)) <= 1);
    }
  });

  it('holds the wobble back at the point of the wake too', () => {
    // Through Math.abs because a negative wobble ramped to nothing lands on -0, and
    // strict equality tells that apart from 0.
    assert.equal(Math.abs(wakeJitter(0, 99)), 0);
    assert.ok(Math.abs(wakeJitter(200, 99)) > 0);
    assert.ok(Math.abs(wakeJitter(200, 99)) <= JITTER);
  });
});

describe('wakeAlpha, alongFade and wakeStrength', () => {
  it('fades the trail out over its life', () => {
    assert.equal(wakeAlpha(0, 900), 1);
    assert.ok(wakeAlpha(300, 900) > wakeAlpha(700, 900));
    assert.equal(wakeAlpha(900, 900), 0);
  });

  // Age alone is not enough: a pointer thrown across the surface lays a long trail whose
  // every point is still young.
  it('fades it out with distance behind the pointer as well', () => {
    assert.equal(alongFade(0), 1);
    assert.ok(alongFade(200) < 1);
    assert.equal(alongFade(WAKE_REACH), 0);
    assert.equal(alongFade(9999), 0);
  });

  it('draws harder the faster the pointer went, without changing the shape', () => {
    assert.equal(wakeStrength(0), 0.35);
    assert.equal(wakeStrength(99), 1);
    assert.ok(wakeStrength(1) > wakeStrength(0.3));
  });
});

describe('offsetPoint, alongFromHead and trailAngles', () => {
  it('moves a point in a direction', () => {
    const moved = offsetPoint({ x: 10, y: 10 }, Math.PI / 2, 5);

    assert.equal(Math.round(moved.x), 10);
    assert.equal(Math.round(moved.y), 15);
    assert.deepEqual(offsetPoint(null, 0, 0), { x: 0, y: 0 });
  });

  it('measures how far back along the trail each point is', () => {
    const along = alongFromHead([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 40, y: 0 },
    ]);

    assert.deepEqual(along, [40, 10, 0]);
    assert.deepEqual(alongFromHead([]), []);
  });

  it('reads the direction of travel at each point', () => {
    const angles = trailAngles([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);

    assert.equal(angles[0], 0);
    assert.equal(angles[1], 0);
    assert.equal(angles[2], Math.PI / 2);
  });
});

describe('resamplePath', () => {
  // A quick gesture is reported in long jumps, and a trail built from those alone is a run
  // of straight lines with a corner at every report.
  it('walks a long jump at the spacing it was given', () => {
    const filled = resamplePath({ x: 0, y: 0, time: 0 }, { x: 80, y: 0, time: 80 }, 8);

    assert.equal(filled.length, 10);
    assert.equal(filled[0].x, 8);
    assert.equal(filled.at(-1).x, 80);
    // Times are walked with the path, so the trail fades evenly rather than in steps.
    assert.equal(filled[0].time, 8);
  });

  it('leaves a short move as one point', () => {
    assert.equal(resamplePath({ x: 0, y: 0, time: 0 }, { x: 5, y: 0, time: 5 }, 8).length, 1);
  });

  it('refuses to fill in more than the cap allows', () => {
    assert.equal(
      resamplePath({ x: 0, y: 0, time: 0 }, { x: 5000, y: 0, time: 50 }, 8, 24).length,
      24,
    );
  });

  it('survives a first point that does not exist yet', () => {
    assert.deepEqual(resamplePath(null, { x: 3, y: 4, time: 1 }), [{ x: 3, y: 4, time: 1 }]);
    assert.deepEqual(resamplePath({ x: 0, y: 0 }, null), []);
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

describe('WAKE_STRANDS', () => {
  it('is a band rather than a line with an outline', () => {
    assert.ok(WAKE_STRANDS.length >= 3);
    // One strand carries the shape and the others sit either side of it, quieter.
    const carrying = WAKE_STRANDS.filter((strand) => strand.alpha === 1);
    assert.equal(carrying.length, 1);
    assert.ok(WAKE_STRANDS.some((strand) => strand.scale < 1));
    assert.ok(WAKE_STRANDS.some((strand) => strand.scale > 1));
  });

  it('puts every strand out of step with the rest', () => {
    const phases = new Set(WAKE_STRANDS.map((strand) => strand.phase));
    assert.equal(phases.size, WAKE_STRANDS.length);
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
