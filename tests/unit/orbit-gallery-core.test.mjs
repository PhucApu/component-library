import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CENTRE_TOLERANCE,
  DEFAULT_SPEED,
  DRAG_TURN,
  MAX_SPEED,
  REST_VELOCITY,
  angleForIndex,
  autoDelta,
  autoRadius,
  clampSpeed,
  decayVelocity,
  depthAt,
  dragToAngle,
  fillLabel,
  isCentred,
  itemAngle,
  itemStep,
  nearestIndex,
  offsetFromFront,
  resolveDirection,
  snapAngle,
  stepAngle,
  wrapAngle,
} from '../../components/orbit-gallery/source/orbit-gallery-core.js';

describe('itemStep and itemAngle', () => {
  it('divides the circle by the pictures on it', () => {
    assert.equal(itemStep(8), 45);
    assert.equal(itemStep(5), 72);
  });

  it('places each picture a step further round', () => {
    assert.equal(itemAngle(0, 8), 0);
    assert.equal(itemAngle(2, 8), 90);
    assert.equal(itemAngle(8, 8), 0);
  });

  it('survives a ring with nothing on it', () => {
    assert.equal(itemStep(0), 0);
    assert.equal(itemAngle(3, 0), 0);
    assert.equal(itemAngle('x', 4), 0);
  });
});

describe('autoRadius', () => {
  it('widens the ring as pictures are added to it', () => {
    const five = autoRadius({ total: 5, itemWidth: 200, gap: 20 });
    const twelve = autoRadius({ total: 12, itemWidth: 200, gap: 20 });

    assert.ok(twelve > five);
    // (200 + 20) / 2 / tan(pi / 8)
    assert.equal(Math.round(autoRadius({ total: 8, itemWidth: 200, gap: 20 })), 266);
  });

  it('keeps the gap in the answer', () => {
    assert.ok(
      autoRadius({ total: 6, itemWidth: 200, gap: 40 }) >
        autoRadius({ total: 6, itemWidth: 200, gap: 0 }),
    );
  });

  it('has no radius for one picture or no width', () => {
    assert.equal(autoRadius({ total: 1, itemWidth: 200, gap: 20 }), 0);
    assert.equal(autoRadius({ total: 8, itemWidth: 0, gap: 20 }), 0);
    assert.equal(autoRadius(), 0);
  });
});

describe('wrapAngle and offsetFromFront', () => {
  it('brings any angle back into one turn', () => {
    assert.equal(wrapAngle(370), 10);
    assert.equal(wrapAngle(-90), 270);
    assert.equal(wrapAngle('nonsense'), 0);
  });

  it('measures the shortest way to the front, with a sign', () => {
    assert.equal(offsetFromFront(0, 0, 8), 0);
    assert.equal(offsetFromFront(1, 0, 8), 45);
    // Seven steps on is one step back, and the sign has to say which.
    assert.equal(offsetFromFront(7, 0, 8), -45);
    assert.equal(offsetFromFront(0, 45, 8), -45);
  });
});

describe('depthAt', () => {
  it('keeps all the light head-on and takes most of it edge-on', () => {
    assert.equal(depthAt(0).opacity, 1);
    assert.equal(depthAt(90).opacity, 0.28);
    assert.equal(depthAt(180).opacity, 0.28);
  });

  it('treats both sides of the ring alike', () => {
    assert.equal(depthAt(50).opacity, depthAt(-50).opacity);
  });

  // A hidden picture that still answered the pointer would stop the ring from nowhere.
  it('takes the far half beyond the reach of the pointer', () => {
    assert.equal(depthAt(0).interactive, true);
    assert.equal(depthAt(60).interactive, true);
    assert.equal(depthAt(95).interactive, false);
    assert.equal(depthAt(180).interactive, false);
  });
});

describe('nearestIndex', () => {
  it('names the picture at the front', () => {
    assert.equal(nearestIndex(0, 8), 0);
    assert.equal(nearestIndex(45, 8), 1);
    assert.equal(nearestIndex(50, 8), 1);
    assert.equal(nearestIndex(360, 8), 0);
  });

  it('counts backwards round the ring rather than off the end of it', () => {
    assert.equal(nearestIndex(-45, 8), 7);
    assert.equal(nearestIndex(-405, 8), 7);
  });

  it('has nothing to name on an empty ring', () => {
    assert.equal(nearestIndex(90, 0), -1);
  });
});

describe('stepAngle', () => {
  it('snaps to a picture before stepping, so a drifting ring lands on one', () => {
    assert.equal(stepAngle(50, 1, 8), 90);
    assert.equal(stepAngle(50, -1, 8), 0);
  });

  it('stays next to the angle it was given rather than unwinding a turn', () => {
    assert.equal(stepAngle(720, 1, 8), 765);
    assert.equal(stepAngle(-45, 1, 8), 0);
  });

  it('survives an empty ring', () => {
    assert.equal(stepAngle(90, 1, 0), 0);
  });
});

describe('snapAngle and isCentred', () => {
  it('finishes the turn onto the picture the ring stopped nearest', () => {
    assert.equal(snapAngle(50, 8), 45);
    assert.equal(snapAngle(-20, 8), 0);
    // Friction leaves the ring anywhere; the answer stays in the turn it was already in.
    assert.equal(snapAngle(750, 8), 765);
    assert.equal(snapAngle(742, 8), 720);
  });

  it('counts a picture as centred only when it is squarely at the front', () => {
    assert.equal(isCentred(0, 8), true);
    assert.equal(isCentred(45, 8), true);
    assert.equal(isCentred(45 + CENTRE_TOLERANCE - 1, 8), true);
    assert.equal(isCentred(45 + CENTRE_TOLERANCE + 1, 8), false);
    assert.equal(isCentred(22.5, 8), false);
  });

  it('is never true for a ring with one picture or none', () => {
    // One picture has no ring to be brought round, so singling it out would mean showing
    // it enlarged and never showing it any other way.
    assert.equal(isCentred(0, 1), false);
    assert.equal(isCentred(0, 0), false);
  });
});

describe('angleForIndex', () => {
  it('takes the shortest way round to a picture', () => {
    assert.equal(angleForIndex(1, 0, 8), 45);
    // From picture seven, picture zero is one step on rather than seven steps back.
    assert.equal(angleForIndex(0, 315, 8), 360);
  });

  it('answers in the turn the ring is already in', () => {
    assert.equal(angleForIndex(2, 720, 8), 810);
  });

  it('accepts an index from outside the ring', () => {
    assert.equal(angleForIndex(9, 0, 8), 45);
    // Picture eight is picture zero; one before it is the last one, one step back.
    assert.equal(angleForIndex(-1, 0, 8), -45);
  });
});

describe('dragToAngle', () => {
  // The ring is drawn at the negative of the angle, so a rightward drag has to lower it
  // for the picture at the front to follow the pointer instead of running from it.
  it('turns a rightward drag into a fall in the angle', () => {
    assert.ok(dragToAngle(100, 800) < 0);
    assert.ok(dragToAngle(-100, 800) > 0);
  });

  it('turns the ring half a way round across the whole width', () => {
    assert.equal(dragToAngle(-800, 800), DRAG_TURN);
  });

  it('does not divide by a stage that has no width', () => {
    assert.equal(dragToAngle(100, 0), 0);
    assert.equal(dragToAngle(100, -50), 0);
  });
});

describe('decayVelocity', () => {
  it('takes speed out of a throw as time passes', () => {
    const slower = decayVelocity(1, 16);

    assert.ok(slower < 1);
    assert.ok(slower > 0.9);
    assert.ok(decayVelocity(1, 160) < slower);
  });

  it('declares a throw over rather than letting it crawl', () => {
    assert.equal(decayVelocity(REST_VELOCITY / 2, 16), 0);
    assert.equal(decayVelocity(1, 100000), 0);
  });

  it('keeps the direction of the throw', () => {
    assert.ok(decayVelocity(-1, 16) < 0);
  });
});

describe('clampSpeed, resolveDirection and autoDelta', () => {
  it('keeps a speed inside what can be read', () => {
    assert.equal(clampSpeed(12), 12);
    assert.equal(clampSpeed('36'), 36);
    assert.equal(clampSpeed(-4), 0);
    assert.equal(clampSpeed(9000), MAX_SPEED);
    assert.equal(clampSpeed('abc'), DEFAULT_SPEED);
  });

  it('only knows two directions', () => {
    assert.equal(resolveDirection('reverse'), 'reverse');
    assert.equal(resolveDirection('sideways'), 'forward');
    assert.equal(resolveDirection(null), 'forward');
  });

  it('drifts by speed over time, and back again in reverse', () => {
    assert.equal(autoDelta({ speed: 12, elapsed: 1000 }), 12);
    assert.equal(autoDelta({ speed: 12, direction: 'reverse', elapsed: 1000 }), -12);
    assert.equal(autoDelta({ speed: 0, elapsed: 1000 }), 0);
  });

  it('never drifts backwards through a frame that took no time', () => {
    assert.equal(autoDelta({ speed: 12, elapsed: -50 }), 0);
    assert.equal(autoDelta(), 0);
  });
});

describe('fillLabel', () => {
  it('puts the picture into the announcement', () => {
    assert.equal(
      fillLabel('Picture {index} of {total}: {label}', {
        index: 3,
        total: 8,
        label: 'A still lake',
      }),
      'Picture 3 of 8: A still lake',
    );
  });

  it('leaves nothing ragged when a value is missing', () => {
    assert.equal(fillLabel('Picture {index} of {total}', { index: 1 }), 'Picture 1 of {total}');
    assert.equal(fillLabel(undefined, { index: 1 }), '');
  });
});
