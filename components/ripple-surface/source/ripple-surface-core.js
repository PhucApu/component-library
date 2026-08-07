/**
 * The rules the surface ripples by, kept away from the DOM and the canvas so they can be
 * read and tested without a browser.
 *
 * Every ripple is the same shape of record — a birth, a life, a place and a reach — and the
 * three curves below are the whole of how one looks at any moment in it. A drop is a full
 * circle and a wake mark is an arc, and nothing else about them differs.
 */

export const DEFAULT_RINGS = 3;
export const MAX_RINGS = 6;

/** How far the pointer travels between one wake mark and the next. */
export const DEFAULT_SPACING = 14;

export const DEFAULT_DROP_DURATION = 1400;
export const DEFAULT_WAKE_DURATION = 700;
export const DEFAULT_MAX_RIPPLES = 60;

/** The gap between one ring of a drop and the next, which is what makes it read as rings. */
export const RING_STAGGER = 140;

/** How much of the recent pointer movement counts towards the speed. */
export const VELOCITY_WINDOW = 90;

/** The arc a wake mark spans, from a crawl to a dash, in radians either side of centre. */
export const MIN_WAKE_SPREAD = 0.5;
export const MAX_WAKE_SPREAD = 1.35;

/** The speed, in pixels per millisecond, at which a wake is as open as it gets. */
export const FULL_SPREAD_SPEED = 2.2;

/** A ripple appears over this share of its life rather than arriving at full strength. */
const ATTACK = 0.08;

function finite(value, fallback) {
  const number = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/** How far through its life a ripple is, from `0` at birth to `1` when it is gone. */
export function progressOf(age, duration) {
  const life = finite(duration, 0);

  if (life <= 0) {
    return 1;
  }

  return clamp(finite(age, 0) / life, 0, 1);
}

/**
 * Water spreads quickly and then slows, so the radius eases out rather than running at a
 * constant speed. A ring that grew evenly reads as a shape being scaled, not as water.
 */
export function rippleRadius(age, duration, maxRadius) {
  const progress = progressOf(age, duration);
  const reach = Math.max(0, finite(maxRadius, 0));

  return reach * (1 - (1 - progress) ** 2);
}

/**
 * Fades out over the whole life, with a short attack so nothing appears at full strength
 * on the frame it is born.
 */
export function rippleAlpha(age, duration) {
  const progress = progressOf(age, duration);
  const attack = progress < ATTACK ? progress / ATTACK : 1;

  return clamp(attack * (1 - progress) ** 1.5, 0, 1);
}

/** The line thins as the ring grows, the way a spreading wave loses height. */
export function rippleWidth(age, duration, startWidth) {
  const progress = progressOf(age, duration);
  return Math.max(0, finite(startWidth, 0) * (1 - progress));
}

/**
 * Whether the pointer has travelled far enough for another wake mark.
 *
 * Emitting on every move event would tie the wake to how often the browser reports the
 * pointer rather than to how far it has gone, so the same gesture would look different on
 * different hardware.
 */
export function shouldEmit(from, to, spacing = DEFAULT_SPACING) {
  if (!from || !to) {
    return Boolean(to);
  }

  const gap = Math.max(1, finite(spacing, DEFAULT_SPACING));
  return Math.hypot(finite(to.x, 0) - finite(from.x, 0), finite(to.y, 0) - finite(from.y, 0)) >= gap;
}

/** The direction from one point to another, in radians. */
export function angleBetween(from, to) {
  if (!from || !to) {
    return 0;
  }

  return Math.atan2(finite(to.y, 0) - finite(from.y, 0), finite(to.x, 0) - finite(from.x, 0));
}

/** How fast the pointer is going, in pixels per millisecond, over the samples given. */
export function pointerSpeed(samples = []) {
  if (!Array.isArray(samples) || samples.length < 2) {
    return 0;
  }

  const first = samples[0];
  const last = samples[samples.length - 1];
  const time = finite(last.time, 0) - finite(first.time, 0);

  if (time <= 0) {
    return 0;
  }

  return Math.hypot(finite(last.x, 0) - finite(first.x, 0), finite(last.y, 0) - finite(first.y, 0)) / time;
}

/** A faster boat throws a wider wake. */
export function wakeSpread(speed) {
  const share = clamp(finite(speed, 0) / FULL_SPREAD_SPEED, 0, 1);
  return MIN_WAKE_SPREAD + (MAX_WAKE_SPREAD - MIN_WAKE_SPREAD) * share;
}

/** And throws it further. */
export function wakeRadius(speed, base = 44, gain = 26, cap = 120) {
  const reach = finite(base, 44) + finite(gain, 26) * clamp(finite(speed, 0), 0, 4);
  return clamp(reach, 0, finite(cap, 120));
}

/**
 * How far a drop reaches.
 *
 * Something past the far corner spends most of its life off the surface, where the only
 * thing it does is cost a stroke; something well inside it stops in open water for no
 * reason. Just under half the diagonal has the ring reaching the edge as it fades out.
 */
export function maxRadiusFor(width, height, share = 0.45) {
  const across = Math.max(0, finite(width, 0));
  const down = Math.max(0, finite(height, 0));

  return Math.hypot(across, down) * clamp(finite(share, 0.55), 0, 2);
}

/** When each ring of one drop starts, so they follow each other out rather than as one. */
export function ringBirths(birth, count = DEFAULT_RINGS, stagger = RING_STAGGER) {
  const rings = clampRings(count);
  const gap = Math.max(0, finite(stagger, RING_STAGGER));
  const start = finite(birth, 0);

  return Array.from({ length: rings }, (unused, index) => start + index * gap);
}

/** Ripples that still have life in them, unborn ones included. */
export function pruneRipples(ripples = [], now = 0) {
  const time = finite(now, 0);
  return ripples.filter((ripple) => time - finite(ripple?.birth, 0) < finite(ripple?.duration, 0));
}

/**
 * The newest ones, and no more than the cap.
 *
 * A pointer swept across the surface can ask for a mark every frame for as long as it
 * moves. The cap is what stands between that and a canvas redrawing thousands of arcs.
 */
export function capRipples(ripples = [], max = DEFAULT_MAX_RIPPLES) {
  const limit = clampMaxRipples(max);
  return ripples.length <= limit ? ripples : ripples.slice(ripples.length - limit);
}

export function clampRings(value) {
  return Math.round(clamp(finite(value, DEFAULT_RINGS), 1, MAX_RINGS));
}

export function clampSpacing(value) {
  return clamp(finite(value, DEFAULT_SPACING), 4, 200);
}

export function clampDuration(value, fallback = DEFAULT_DROP_DURATION) {
  return clamp(finite(value, fallback), 120, 6000);
}

export function clampMaxRipples(value) {
  return Math.round(clamp(finite(value, DEFAULT_MAX_RIPPLES), 1, 400));
}
