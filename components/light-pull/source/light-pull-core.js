/**
 * The rules the cord hangs and swings by, kept away from the DOM so they can be read and
 * tested without a browser.
 *
 * The cord is a row of points, each one remembering where it was on the step before. That
 * memory is its velocity, which is the whole of Verlet integration: move each point by the
 * distance it moved last time, add gravity, then pull the points back to a fixed spacing
 * from one another. Nothing here knows what a pixel is for.
 */

/** Enough joints for a cord to curve rather than to bend at a knee. */
export const SEGMENTS = 14;
export const MIN_SEGMENTS = 4;
export const MAX_SEGMENTS = 40;

export const DEFAULT_LENGTH = 180;
export const MIN_LENGTH = 60;
export const MAX_LENGTH = 520;

/** Per fixed step, in pixels. The simulation runs on a fixed step so it cannot judder. */
export const GRAVITY = 0.5;

/**
 * How much of last step's movement a point keeps. The rest is what makes a swing die.
 *
 * Higher and the cord swings for an uncomfortably long time after a shove; lower and it
 * stops as though it were being held. This was settled by watching it, not by reasoning.
 */
export const DAMPING = 0.982;

/** Relaxation passes per step. More is stiffer rope, and slower. */
export const ITERATIONS = 6;

/**
 * How much further than its own length the cord can be drawn down.
 *
 * A cord does not stretch; the switch it is fastened to travels, and this is that travel.
 * It has to be comfortably more than the threshold below, or the cord reaches the end of
 * what it will give before it reaches the catch and the switch can never work at all.
 */
export const PULL_TRAVEL = 48;

/**
 * How far the handle has to be pulled below its resting place to work the switch.
 *
 * Kept well under the travel above. The cord has no spring in it — what looks like stretch
 * is the constraint solver being overruled by the hand — so every pixel of over-stretch
 * comes back as recoil the moment the hand opens. A long travel made the cord leap.
 */
export const PULL_THRESHOLD = 30;

/**
 * Below this much movement in a step, the cord has stopped.
 *
 * Loose enough and the loop gives up while the cord is still drifting back, leaving it
 * hanging visibly off plumb. It is cheaper to run a few more frames than to leave a cord
 * that never quite hangs straight.
 */
export const SETTLE_TOLERANCE = 0.02;

/** How far from the cord a press still counts as taking hold of it. */
export const GRAB_RADIUS = 44;

export const DEFAULT_LABELS = Object.freeze({
  light: 'Light',
  on: 'on',
  off: 'off',
});

function finite(value, fallback) {
  const number = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

export function clampSegments(value) {
  return Math.round(clamp(finite(value, SEGMENTS), MIN_SEGMENTS, MAX_SEGMENTS));
}

export function clampLength(value) {
  return clamp(finite(value, DEFAULT_LENGTH), MIN_LENGTH, MAX_LENGTH);
}

/** The gap between two joints. */
export function spacingFor(length, segments) {
  return clampLength(length) / clampSegments(segments);
}

/** The cord at rest: straight down from where it is nailed up. */
export function restRope(anchor, { segments = SEGMENTS, length = DEFAULT_LENGTH } = {}) {
  const joints = clampSegments(segments);
  const spacing = spacingFor(length, joints);
  const x = finite(anchor?.x, 0);
  const y = finite(anchor?.y, 0);

  return Array.from({ length: joints + 1 }, (unused, index) => {
    const point = { x, y: y + index * spacing };
    return { ...point, px: point.x, py: point.y };
  });
}

/**
 * Pulls the joints back to their proper spacing.
 *
 * A pinned joint does not move, so its neighbour takes the whole correction — which is what
 * makes a cord hang from its nail rather than drift off it, and what makes the part below
 * your hand swing free while the part above it stays put.
 */
export function constrainRope(points, { anchor, held = null, spacing, iterations = ITERATIONS } = {}) {
  const next = points.map((point) => ({ ...point }));
  const gap = Math.max(0.001, finite(spacing, 1));
  const pinned = (index) => index === 0 || (held !== null && held.index === index);

  for (let pass = 0; pass < Math.max(1, Math.round(finite(iterations, ITERATIONS))); pass += 1) {
    for (let index = 0; index < next.length - 1; index += 1) {
      const a = next[index];
      const b = next[index + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 0.0001;
      const share = ((distance - gap) / distance) * 0.5;
      const shiftX = dx * share;
      const shiftY = dy * share;
      const aPinned = pinned(index);
      const bPinned = pinned(index + 1);

      if (aPinned && bPinned) {
        continue;
      }

      if (!aPinned && !bPinned) {
        a.x += shiftX;
        a.y += shiftY;
        b.x -= shiftX;
        b.y -= shiftY;
      } else if (aPinned) {
        b.x -= shiftX * 2;
        b.y -= shiftY * 2;
      } else {
        a.x += shiftX * 2;
        a.y += shiftY * 2;
      }
    }

    next[0].x = finite(anchor?.x, next[0].x);
    next[0].y = finite(anchor?.y, next[0].y);

    if (held !== null && next[held.index]) {
      next[held.index].x = held.x;
      next[held.index].y = held.y;
    }
  }

  return next;
}

/** One fixed step of the whole cord. */
export function stepRope(points, options = {}) {
  const {
    anchor,
    held = null,
    gravity = GRAVITY,
    damping = DAMPING,
    iterations = ITERATIONS,
    spacing,
  } = options;

  const moved = points.map((point, index) => {
    if (index === 0) {
      const x = finite(anchor?.x, point.x);
      const y = finite(anchor?.y, point.y);
      return { x, y, px: x, py: y };
    }

    if (held !== null && held.index === index) {
      // A held joint has no memory of moving: it is where the hand is, and it arrived
      // there by being carried rather than by swinging.
      return { x: held.x, y: held.y, px: held.x, py: held.y };
    }

    const vx = (point.x - point.px) * finite(damping, DAMPING);
    const vy = (point.y - point.py) * finite(damping, DAMPING);

    return {
      x: point.x + vx,
      y: point.y + vy + finite(gravity, GRAVITY),
      px: point.x,
      py: point.y,
    };
  });

  return constrainRope(moved, { anchor, held, spacing, iterations });
}

/**
 * How far from the nail a joint may be taken.
 *
 * Its own share of the cord, plus its own share of the travel: take hold half way up and
 * you get half the pull, because the cord below your hand is not being pulled at all.
 */
export function reachFor(index, spacing, segments = SEGMENTS, travel = PULL_TRAVEL) {
  const joints = clampSegments(segments);
  const share = clamp(finite(index, 0) / Math.max(1, joints), 0, 1);

  return finite(index, 0) * finite(spacing, 0) + finite(travel, PULL_TRAVEL) * share;
}

/**
 * How far the handle has been pulled below a line.
 *
 * The line is where the cord was when the hand took hold of it, not where it ideally
 * hangs. A relaxed cord settles a little below its ideal rest — the constraint passes
 * leave a residual sag under gravity — and measuring against the ideal counts that sag as
 * part of every pull, so a short tug on a cord that has been used once already works the
 * switch when the same tug on a fresh one does not.
 */
export function pullFrom(points, baseline) {
  const handle = points?.at?.(-1);

  if (!handle) {
    return 0;
  }

  return Math.max(0, finite(handle.y, 0) - finite(baseline, 0));
}

/** How far the handle has been pulled below where the cord ideally hangs. */
export function pullDistance(points, rest) {
  const handle = points?.at?.(-1);
  const resting = rest?.at?.(-1);

  if (!handle || !resting) {
    return 0;
  }

  return Math.max(0, finite(handle.y, 0) - finite(resting.y, 0));
}

/** Whether that is far enough to work the switch. */
export function armedFrom(pull, threshold = PULL_THRESHOLD) {
  return finite(pull, 0) >= finite(threshold, PULL_THRESHOLD);
}

/**
 * The joint a press takes hold of.
 *
 * Taking hold anywhere rather than only at the handle is most of what makes it read as a
 * cord: grab it half way up and the part below your hand hangs free.
 */
export function nearestPoint(points, target, radius = GRAB_RADIUS) {
  let index = -1;
  let best = Number.POSITIVE_INFINITY;

  points?.forEach?.((point, position) => {
    if (position === 0) {
      return;
    }

    const distance = Math.hypot(
      finite(point.x, 0) - finite(target?.x, 0),
      finite(point.y, 0) - finite(target?.y, 0),
    );

    if (distance < best) {
      best = distance;
      index = position;
    }
  });

  return best <= finite(radius, GRAB_RADIUS) ? index : -1;
}

/** Whether the cord has stopped moving, and the loop can stop with it. */
export function isSettled(points, tolerance = SETTLE_TOLERANCE) {
  const limit = finite(tolerance, SETTLE_TOLERANCE);

  return (points ?? []).every(
    (point) =>
      Math.abs(finite(point.x, 0) - finite(point.px, 0)) < limit &&
      Math.abs(finite(point.y, 0) - finite(point.py, 0)) < limit,
  );
}

/** Which way the last length of cord is pointing, so the handle can hang along it. */
export function handleAngle(points) {
  const handle = points?.at?.(-1);
  const above = points?.at?.(-2);

  if (!handle || !above) {
    return 0;
  }

  return (Math.atan2(handle.y - above.y, handle.x - above.x) * 180) / Math.PI - 90;
}

/** Gives the free end a shove, which is what a press of the button looks like. */
export function tugged(points, force = 26) {
  const next = points.map((point) => ({ ...point }));
  const handle = next.at(-1);

  if (handle) {
    handle.py = handle.y - finite(force, 26);
  }

  return next;
}

export function fillLabel(template, values = {}) {
  return Object.entries(values)
    .reduce(
      (text, [key, value]) => text.replaceAll(`{${key}}`, String(value ?? '')),
      typeof template === 'string' ? template : '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}
