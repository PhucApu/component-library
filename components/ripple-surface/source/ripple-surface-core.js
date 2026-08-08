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

/** How far the pointer travels between one point of the trail and the next. */
export const DEFAULT_SPACING = 8;

export const DEFAULT_DROP_DURATION = 1400;
export const DEFAULT_WAKE_DURATION = 900;
export const DEFAULT_MAX_RIPPLES = 90;

/** The gap between one ring of a drop and the next, which is what makes it read as rings. */
export const RING_STAGGER = 140;

/** How much of the recent pointer movement counts towards the speed. */
export const VELOCITY_WINDOW = 90;

/**
 * Half the angle the wake opens at, as a slope.
 *
 * It is a constant, and deliberately not a function of speed: a real wake holds the same
 * angle however fast the hull is going, and a V that swelled and collapsed with every
 * change of pace would read as the shape breathing rather than as water being pushed
 * aside. Speed decides how strongly the wake draws, not what shape it is.
 */
export const WAKE_SLOPE = Math.tan((20 * Math.PI) / 180);

/** How fast the wake keeps opening once the pointer has stopped, in pixels a millisecond. */
export const WAKE_DRIFT = 0.014;

/** However long the trail is, the two sides never part further than this. */
export const MAX_WAKE_OFFSET = 150;

/** How far behind the pointer the wake has faded to nothing, in pixels of path. */
export const WAKE_REACH = 420;

/** The swell running along each side: how far it wanders, how long it is, how fast it moves. */
export const WAVE_AMPLITUDE = 3.6;
export const WAVE_LENGTH = 10;
export const WAVE_PERIOD = 190;

/** The point itself does not wobble; the swell comes in over this distance behind it. */
export const WAVE_RAMP = 70;

/** How far a single point of the trail wanders off its own strand. */
export const JITTER = 1.5;

/**
 * Each side of the wake is more than one line.
 *
 * One stroke a side is a drawing of a wake. Water disturbed by something passing through it
 * is a band of crests at slightly different distances, out of step with one another, and
 * three strands is the fewest that reads as a band rather than as a line with an outline.
 * They share the point at the pointer, where every offset is zero.
 */
export const WAKE_STRANDS = Object.freeze([
  { scale: 0.62, alpha: 0.42, width: 0.7, phase: 1.9 },
  { scale: 1, alpha: 1, width: 1, phase: 0 },
  { scale: 1.34, alpha: 0.36, width: 0.66, phase: 3.4 },
]);

/** The speed, in pixels per millisecond, at which the wake draws at full strength. */
export const FULL_WAKE_SPEED = 1.6;

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

/**
 * How far one side of the wake stands off the path.
 *
 * `along` is the distance back along the trail from the pointer, so the offset is zero at
 * the pointer itself: the two sides meet there in a point, which is the prow. Everything
 * behind it has been pushed further aside the longer ago it was passed.
 *
 * The second term is time rather than distance, and it is what a wake does after the boat
 * has gone: it keeps opening slowly instead of freezing in place while it fades.
 */
export function wakeOffset(along, age, slope = WAKE_SLOPE, drift = WAKE_DRIFT) {
  const distance = Math.max(0, finite(along, 0));
  const time = Math.max(0, finite(age, 0));
  const raw = distance * finite(slope, WAKE_SLOPE) + time * finite(drift, WAKE_DRIFT);

  // Eased into the limit rather than cut off at it. A hard limit puts a visible corner in
  // both sides of the wake at the moment they reach it, on an otherwise straight run.
  return MAX_WAKE_OFFSET * (1 - Math.exp(-raw / MAX_WAKE_OFFSET));
}

/**
 * How much of the wake is left this far behind the pointer.
 *
 * Age alone is not enough. A pointer thrown across the surface lays a very long trail in
 * very little time, and every point of it would still be young — so the whole shape would
 * arrive at full strength and read as an outline drawn round the path rather than as water
 * being left behind.
 */
export function alongFade(along, reach = WAKE_REACH) {
  const distance = Math.max(0, finite(along, 0));
  const limit = Math.max(1, finite(reach, WAKE_REACH));

  return clamp(1 - distance / limit, 0, 1) ** 0.9;
}

/** A wake fades from the moment it is made; the prow is the only part at full strength. */
export function wakeAlpha(age, duration) {
  return clamp((1 - progressOf(age, duration)) ** 1.4, 0, 1);
}

/** A faster pass pushes more water: the shape holds, the strength does not. */
export function wakeStrength(speed) {
  return clamp(0.35 + 0.65 * (finite(speed, 0) / FULL_WAKE_SPEED), 0.35, 1);
}

/**
 * The swell that runs along one strand of the wake.
 *
 * A straight line opening out behind a cursor is a diagram of a wake rather than water. Two
 * waves of different lengths are summed rather than one, because a single sine repeats
 * visibly along a long trail and the eye reads the repeat as a pattern; two that do not
 * divide into one another never quite come round to the same shape.
 *
 * It is held back at the point, where the two sides have to meet cleanly, and comes in over
 * the first stretch behind it.
 */
export function wakeWave(along, age, phase = 0, amplitude = WAVE_AMPLITUDE) {
  const distance = Math.max(0, finite(along, 0));
  const time = Math.max(0, finite(age, 0));
  const ramp = Math.min(1, distance / WAVE_RAMP);
  const x = distance / WAVE_LENGTH;
  const t = time / WAVE_PERIOD;
  const shift = finite(phase, 0);

  return (
    finite(amplitude, WAVE_AMPLITUDE) *
    ramp *
    (0.66 * Math.sin(x - t + shift) + 0.34 * Math.sin(1.7 * x - 1.3 * t + shift * 1.4))
  );
}

/**
 * A fixed wobble belonging to one point of the trail.
 *
 * Waves alone are still smooth, and smooth is what makes a line look drawn. This is taken
 * from the point's own birth time, so it is the same on every frame that point is alive:
 * noise chosen afresh each frame would make the whole wake crawl.
 */
export function pointNoise(seed) {
  const value = Math.sin(finite(seed, 0) * 12.9898) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

/** How far one point wanders off its strand, held back at the point of the wake. */
export function wakeJitter(along, seed, amplitude = JITTER) {
  const ramp = Math.min(1, Math.max(0, finite(along, 0)) / WAVE_RAMP);
  return pointNoise(seed) * finite(amplitude, JITTER) * ramp;
}

/** Moves a point by a distance in a direction. */
export function offsetPoint(point, angle, distance) {
  const away = finite(distance, 0);
  const heading = finite(angle, 0);

  return {
    x: finite(point?.x, 0) + Math.cos(heading) * away,
    y: finite(point?.y, 0) + Math.sin(heading) * away,
  };
}

/**
 * Fills in the gap between two pointer reports.
 *
 * A pointer moving quickly is reported in long jumps, and a trail built from those jumps
 * alone is a run of straight lines with corners at every report — which is exactly what a
 * wake must not look like. The path is walked at the same spacing whatever the hardware
 * had to say about it.
 */
export function resamplePath(from, to, spacing = DEFAULT_SPACING, cap = 24) {
  if (!to) {
    return [];
  }

  if (!from) {
    return [to];
  }

  const gap = clampSpacing(spacing);
  const distance = Math.hypot(finite(to.x, 0) - finite(from.x, 0), finite(to.y, 0) - finite(from.y, 0));
  const steps = Math.min(Math.max(1, Math.round(distance / gap)), Math.max(1, Math.round(finite(cap, 24))));

  return Array.from({ length: steps }, (unused, index) => {
    const share = (index + 1) / steps;
    return {
      ...to,
      x: finite(from.x, 0) + (finite(to.x, 0) - finite(from.x, 0)) * share,
      y: finite(from.y, 0) + (finite(to.y, 0) - finite(from.y, 0)) * share,
      time: finite(from.time, 0) + (finite(to.time, 0) - finite(from.time, 0)) * share,
    };
  });
}

/** How far back along the trail each point is, measured from the newest one. */
export function alongFromHead(points = []) {
  const along = new Array(points.length).fill(0);

  for (let index = points.length - 2; index >= 0; index -= 1) {
    const next = points[index + 1];
    const here = points[index];
    along[index] =
      along[index + 1] +
      Math.hypot(finite(next?.x, 0) - finite(here?.x, 0), finite(next?.y, 0) - finite(here?.y, 0));
  }

  return along;
}

/** Which way the trail was going at each point, in radians. */
export function trailAngles(points = []) {
  return points.map((point, index) => {
    const from = index === 0 ? point : points[index - 1];
    const to = index === 0 ? points[1] ?? point : point;
    return angleBetween(from, to);
  });
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
 * The newest ones, and no more than the cap. Rings and trail points both go through here.
 *
 * A pointer swept across the surface asks for another point every `spacing` pixels for as
 * long as it moves. The cap is what stands between that and a canvas redrawing thousands
 * of segments.
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
