import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_LENGTH,
  GRAB_RADIUS,
  MAX_LENGTH,
  MAX_SEGMENTS,
  MIN_LENGTH,
  MIN_SEGMENTS,
  PULL_THRESHOLD,
  PULL_TRAVEL,
  SEGMENTS,
  armedFrom,
  clampLength,
  clampSegments,
  constrainRope,
  fillLabel,
  handleAngle,
  isSettled,
  nearestPoint,
  pullDistance,
  pullFrom,
  reachFor,
  restRope,
  spacingFor,
  stepRope,
  tugged,
} from '../../components/light-pull/source/light-pull-core.js';

const ANCHOR = { x: 100, y: 0 };
const OPTIONS = {
  anchor: ANCHOR,
  spacing: spacingFor(DEFAULT_LENGTH, SEGMENTS),
};

function run(points, steps, options = {}) {
  let current = points;

  for (let step = 0; step < steps; step += 1) {
    current = stepRope(current, { ...OPTIONS, ...options });
  }

  return current;
}

describe('restRope and the clamps', () => {
  it('hangs straight down from the nail, its whole length', () => {
    const rope = restRope(ANCHOR, { segments: 10, length: 200 });

    assert.equal(rope.length, 11);
    assert.deepEqual({ x: rope[0].x, y: rope[0].y }, { x: 100, y: 0 });
    assert.deepEqual({ x: rope.at(-1).x, y: rope.at(-1).y }, { x: 100, y: 200 });
    assert.ok(rope.every((point) => point.x === point.px && point.y === point.py));
  });

  it('keeps a cord and its joints inside what can be drawn', () => {
    assert.equal(clampLength(180), 180);
    assert.equal(clampLength(2), MIN_LENGTH);
    assert.equal(clampLength(9999), MAX_LENGTH);
    assert.equal(clampLength('abc'), DEFAULT_LENGTH);

    assert.equal(clampSegments(14), 14);
    assert.equal(clampSegments(1), MIN_SEGMENTS);
    assert.equal(clampSegments(999), MAX_SEGMENTS);
    assert.equal(clampSegments('abc'), SEGMENTS);
  });
});

describe('stepRope', () => {
  it('leaves the nail exactly where it was', () => {
    const settled = run(restRope(ANCHOR), 30);

    assert.equal(settled[0].x, ANCHOR.x);
    assert.equal(settled[0].y, ANCHOR.y);
  });

  it('falls when it is shoved sideways, and comes to rest under the nail', () => {
    const rope = restRope(ANCHOR).map((point, index) =>
      index === 0 ? point : { ...point, x: point.x + 90 },
    );
    const swung = run(rope, 4);
    const settled = run(rope, 900);

    // It moves at all...
    assert.notEqual(Math.round(swung.at(-1).x), Math.round(rope.at(-1).x));
    // ...and it ends up hanging.
    assert.ok(Math.abs(settled.at(-1).x - ANCHOR.x) < 4);
    assert.ok(isSettled(settled));
  });

  it('does not stretch: every joint keeps its spacing', () => {
    const settled = run(restRope(ANCHOR), 200);

    for (let index = 0; index < settled.length - 1; index += 1) {
      const gap = Math.hypot(
        settled[index + 1].x - settled[index].x,
        settled[index + 1].y - settled[index].y,
      );
      assert.ok(Math.abs(gap - OPTIONS.spacing) < 1.2, `joint ${index} kept its spacing`);
    }
  });

  it('holds a held joint exactly where the hand is', () => {
    const held = { index: 7, x: 220, y: 60 };
    const moved = run(restRope(ANCHOR), 8, { held });

    assert.equal(moved[7].x, 220);
    assert.equal(moved[7].y, 60);
    // The nail still holds too, so the cord between them is taut rather than dragged off.
    assert.equal(moved[0].x, ANCHOR.x);
  });

  it('lets the cord below a held joint hang free', () => {
    const held = { index: 7, x: 240, y: 40 };
    const moved = run(restRope(ANCHOR), 40, { held });

    // Below the hand it falls away rather than following the pull.
    assert.ok(moved.at(-1).y > moved[7].y);
  });

  it('survives being handed nonsense', () => {
    const rope = restRope(ANCHOR, { segments: 'x', length: 'y' });
    assert.equal(rope.length, SEGMENTS + 1);
    assert.doesNotThrow(() => stepRope(rope, { anchor: null, spacing: undefined }));
  });
});

describe('constrainRope', () => {
  const widestGap = (points) =>
    Math.max(
      ...points.slice(0, -1).map((point, index) =>
        Math.hypot(points[index + 1].x - point.x, points[index + 1].y - point.y),
      ),
    );

  it('pulls a stretched cord back towards its spacing, pass by pass', () => {
    const stretched = restRope(ANCHOR).map((point) => ({
      ...point,
      y: point.y * 1.2,
      py: point.y * 1.2,
    }));

    const few = widestGap(constrainRope(stretched, { ...OPTIONS, iterations: 6 }));
    const many = widestGap(constrainRope(stretched, { ...OPTIONS, iterations: 60 }));
    const settled = widestGap(constrainRope(stretched, { ...OPTIONS, iterations: 800 }));

    // Only the nail is pinned, so the whole cord has to travel up: each pass takes a bite
    // out of the stretch rather than removing it, which is why the element runs passes
    // every step rather than once.
    assert.ok(many < few);
    assert.ok(settled < OPTIONS.spacing * 1.01, 'given passes enough, no joint is stretched');
  });
});

describe('reachFor, pullDistance and armedFrom', () => {
  // The first build had these the wrong way round: the cord reached the end of what it
  // would give before it reached the catch, and the switch could not be worked at all.
  it('gives more travel than the switch needs to be worked', () => {
    const spacing = spacingFor(DEFAULT_LENGTH, SEGMENTS);
    const reach = reachFor(SEGMENTS, spacing, SEGMENTS);

    assert.ok(reach - DEFAULT_LENGTH > PULL_THRESHOLD);
    assert.equal(Math.round(reach), Math.round(DEFAULT_LENGTH + PULL_TRAVEL));
  });

  it('gives a joint half way up half the pull', () => {
    const spacing = spacingFor(DEFAULT_LENGTH, SEGMENTS);
    const half = reachFor(SEGMENTS / 2, spacing, SEGMENTS);

    assert.equal(Math.round(half), Math.round(DEFAULT_LENGTH / 2 + PULL_TRAVEL / 2));
  });

  // A used cord hangs a little below its ideal rest, and counting that sag as part of the
  // pull works the switch on a shorter tug than it should.
  it('measures the pull from the line the hand took hold at', () => {
    const rest = restRope(ANCHOR);
    const sagged = rest.map((point, index) =>
      index === rest.length - 1 ? { ...point, y: point.y + 9 } : point,
    );
    const pulled = sagged.map((point, index) =>
      index === sagged.length - 1 ? { ...point, y: point.y + 20 } : point,
    );

    assert.equal(pullFrom(pulled, sagged.at(-1).y), 20);
    assert.equal(armedFrom(pullFrom(pulled, sagged.at(-1).y)), false);
    // Against the ideal rest the same tug would have counted the sag as well.
    assert.equal(pullDistance(pulled, rest), 29);
  });

  it('measures the pull from where the handle hangs', () => {
    const rest = restRope(ANCHOR);
    const pulled = rest.map((point, index) =>
      index === rest.length - 1 ? { ...point, y: point.y + 70 } : point,
    );

    assert.equal(pullDistance(pulled, rest), 70);
    assert.equal(pullDistance(rest, rest), 0);
    // A cord pushed up is not a cord pulled down.
    assert.equal(pullDistance(rest, pulled), 0);
  });

  it('works the switch only past the catch', () => {
    assert.equal(armedFrom(PULL_THRESHOLD), true);
    assert.equal(armedFrom(PULL_THRESHOLD - 1), false);
    assert.equal(armedFrom('x'), false);
  });
});

describe('nearestPoint', () => {
  it('takes hold of the joint under the hand', () => {
    const rope = restRope(ANCHOR);
    const spacing = OPTIONS.spacing;

    assert.equal(nearestPoint(rope, { x: 100, y: spacing * 7 }), 7);
    assert.equal(nearestPoint(rope, { x: 100, y: DEFAULT_LENGTH }), SEGMENTS);
  });

  it('never takes the nail, even when the nail is nearest', () => {
    const rope = restRope(ANCHOR);
    // Exactly on the anchor: the joint below it is taken instead, because a cord held at
    // its nail is a cord that cannot be pulled.
    assert.equal(nearestPoint(rope, { x: 100, y: 0 }), 1);
  });

  it('lets go of a press that was nowhere near it', () => {
    const rope = restRope(ANCHOR);
    assert.equal(nearestPoint(rope, { x: 100 + GRAB_RADIUS * 3, y: 90 }), -1);
  });
});

describe('isSettled, handleAngle and tugged', () => {
  it('knows a cord that has stopped from one that has not', () => {
    const rest = restRope(ANCHOR);
    assert.equal(isSettled(rest), true);

    const moving = rest.map((point) => ({ ...point, x: point.x + 5 }));
    assert.equal(isSettled(moving), false);
  });

  it('hangs the handle along the last length of cord', () => {
    const rest = restRope(ANCHOR);
    assert.equal(Math.round(handleAngle(rest)), 0);

    // A last length of cord running to the right hangs its handle a quarter turn round.
    const sideways = rest.map((point, index) =>
      index === rest.length - 1
        ? { ...point, x: point.x + 100, y: rest.at(-2).y }
        : point,
    );
    assert.equal(Math.round(handleAngle(sideways)), -90);
  });

  it('gives the free end a shove downwards', () => {
    const rest = restRope(ANCHOR);
    const shoved = tugged(rest, 30);

    // Verlet reads a point above its last position as moving down.
    assert.equal(shoved.at(-1).py, rest.at(-1).y - 30);
    assert.equal(shoved.at(-2).py, rest.at(-2).py);
  });
});

describe('fillLabel', () => {
  it('fills a template and survives one that is missing', () => {
    assert.equal(fillLabel('{light}', { light: 'Room light' }), 'Room light');
    assert.equal(fillLabel(undefined, { light: 'x' }), '');
  });
});
