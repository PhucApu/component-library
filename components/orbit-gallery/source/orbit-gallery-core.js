/**
 * The rules the orbit gallery turns by, kept away from the DOM so they can be read and
 * tested without a browser.
 *
 * One number describes the whole ring: `angle`, measured in item space. The item at the
 * front is `angle / step`, so a whole turn is `total` steps and the ring never has to be
 * wrapped to stay correct. The DOM rotation is the negative of it, which is where the
 * signs in this file come from.
 */

/** Degrees per second the ring drifts when nothing is holding it. */
export const DEFAULT_SPEED = 12;
export const MAX_SPEED = 120;

/** How far the ring turns when a drag crosses the full width of the stage. */
export const DRAG_TURN = 180;

/** Per 16ms frame. Slow enough to coast, fast enough to settle inside a second. */
export const FRICTION = 0.94;

/** Below this, in degrees per millisecond, a throw is over rather than crawling. */
export const REST_VELOCITY = 0.002;

/** How long the ring takes to travel one step for a key press or a settle. */
export const STEP_DURATION = 320;

/**
 * How far from dead centre still counts as facing the viewer.
 *
 * A settle lands exactly on a picture, so this is not what the drag path relies on. It is
 * for a ring stopped by hand somewhere else: only a picture that genuinely reads as centred
 * should be the one singled out, and a step is 45 degrees wide at eight pictures.
 */
export const CENTRE_TOLERANCE = 6;

export const DIRECTIONS = Object.freeze(['forward', 'reverse']);

export const DEFAULT_LABELS = Object.freeze({
  gallery: 'Orbit gallery',
  position: 'Picture {index} of {total}',
  described: 'Picture {index} of {total}: {label}',
  unavailable: 'Picture unavailable',
  previous: 'Previous picture',
  next: 'Next picture',
});

function finite(value, fallback) {
  const number = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(number) ? number : fallback;
}

function count(total) {
  return Math.max(0, Math.floor(finite(total, 0)));
}

/** The angle between two neighbours. */
export function itemStep(total) {
  const items = count(total);
  return items === 0 ? 0 : 360 / items;
}

/** Where one item sits on the ring, before the ring itself is turned. */
export function itemAngle(index, total) {
  const items = count(total);

  if (items === 0) {
    return 0;
  }

  return wrapAngle(Math.floor(finite(index, 0)) * itemStep(items));
}

/**
 * The radius that keeps neighbours from overlapping.
 *
 * Each item occupies a chord of the circle, so the radius follows from how many of them
 * have to fit around it. Asking for it rather than hard-coding one is what lets the same
 * element hold five pictures or twelve without the author measuring anything.
 */
export function autoRadius({ total, itemWidth, gap = 0 } = {}) {
  const items = count(total);
  const width = Math.max(0, finite(itemWidth, 0));
  const spacing = Math.max(0, finite(gap, 0));

  if (items < 2 || width === 0) {
    return 0;
  }

  return (width + spacing) / 2 / Math.tan(Math.PI / items);
}

/** Brings any angle back into `[0, 360)`. */
export function wrapAngle(degrees) {
  const value = finite(degrees, 0);
  return ((value % 360) + 360) % 360;
}

/** The shortest signed distance from an item to the front of the ring, in degrees. */
export function offsetFromFront(index, angle, total) {
  const items = count(total);

  if (items === 0) {
    return 0;
  }

  const offset = wrapAngle(itemAngle(index, items) - finite(angle, 0));
  return offset > 180 ? offset - 360 : offset;
}

/**
 * How much of an item is turned towards the viewer, and what that costs it.
 *
 * Perspective already makes the far side of the ring smaller, so depth only has to take
 * light out of it. `facing` is `1` head-on and `0` edge-on, and it is also what decides
 * whether an item can be pointed at: the far half is hidden by `backface-visibility`, and
 * a hidden picture that still answered the pointer would stop the ring from nowhere.
 */
export function depthAt(offsetDegrees) {
  const radians = (finite(offsetDegrees, 0) * Math.PI) / 180;
  const facing = Math.cos(radians);
  const clamped = Math.max(0, facing);

  return {
    facing: Number(facing.toFixed(4)),
    opacity: Number((0.28 + 0.72 * clamped).toFixed(4)),
    interactive: facing > 0.15,
  };
}

/** Which picture is at the front right now. */
export function nearestIndex(angle, total) {
  const items = count(total);

  if (items === 0) {
    return -1;
  }

  return ((Math.round(finite(angle, 0) / itemStep(items)) % items) + items) % items;
}

/**
 * The angle one keyboard step away.
 *
 * It snaps to the nearest picture first, so a key pressed while the ring is drifting
 * between two of them lands on a picture rather than carrying the drift along forever.
 * The result stays continuous with the current angle, which is what keeps the travel
 * short instead of unwinding a whole turn.
 */
export function stepAngle(angle, delta, total) {
  const items = count(total);

  if (items === 0) {
    return 0;
  }

  const step = itemStep(items);
  const nearest = Math.round(finite(angle, 0) / step);

  return (nearest + Math.round(finite(delta, 0))) * step;
}

/**
 * The nearest angle that puts a picture squarely at the front.
 *
 * A throw stops wherever friction leaves it, which is almost never on a picture. The ring
 * goes the rest of the way itself rather than asking the reader to land it by hand.
 */
export function snapAngle(angle, total) {
  return stepAngle(angle, 0, total);
}

/**
 * Whether a picture is facing the viewer.
 *
 * One picture is never "centred": it has no ring to be brought round to, so singling it
 * out would mean showing it enlarged and never showing it any other way.
 */
export function isCentred(angle, total, tolerance = CENTRE_TOLERANCE) {
  const items = count(total);

  if (items < 2) {
    return false;
  }

  return Math.abs(offsetFromFront(nearestIndex(angle, items), angle, items)) <= tolerance;
}

/** The nearest angle that brings one particular picture to the front. */
export function angleForIndex(index, angle, total) {
  const items = count(total);

  if (items === 0) {
    return 0;
  }

  const step = itemStep(items);
  const target = ((Math.floor(finite(index, 0)) % items) + items) % items;
  const turns = Math.round((finite(angle, 0) / step - target) / items);

  return (target + turns * items) * step;
}

/**
 * The change in angle a drag asks for.
 *
 * Negative for a rightward drag: the ring is drawn at the negative of this angle, so the
 * picture at the front follows the pointer rather than running away from it.
 */
export function dragToAngle(deltaX, width, turn = DRAG_TURN) {
  const distance = finite(deltaX, 0);
  const across = finite(width, 0);

  if (across <= 0) {
    return 0;
  }

  return -(distance / across) * finite(turn, DRAG_TURN);
}

/** What is left of a throw after some time has passed. */
export function decayVelocity(velocity, elapsed, friction = FRICTION) {
  const speed = finite(velocity, 0);
  const time = Math.max(0, finite(elapsed, 0));
  const decayed = speed * finite(friction, FRICTION) ** (time / 16);

  return Math.abs(decayed) < REST_VELOCITY ? 0 : decayed;
}

export function clampSpeed(value, fallback = DEFAULT_SPEED) {
  const speed = finite(value, fallback);
  return Math.min(MAX_SPEED, Math.max(0, speed));
}

export function resolveDirection(value) {
  return DIRECTIONS.includes(value) ? value : 'forward';
}

/** How far the ring drifts on its own between two frames. */
export function autoDelta({ speed = DEFAULT_SPEED, direction = 'forward', elapsed = 0 } = {}) {
  const degreesPerMs = clampSpeed(speed) / 1000;
  const sign = resolveDirection(direction) === 'reverse' ? -1 : 1;

  return degreesPerMs * Math.max(0, finite(elapsed, 0)) * sign;
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
