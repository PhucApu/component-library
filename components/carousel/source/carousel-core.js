/**
 * The rules the carousel decides by, kept away from the DOM so they can be read and tested
 * without a browser.
 */

/** How far a drag has to travel, as a share of one slide, before it counts. */
export const DRAG_THRESHOLD = 0.2;

/** How fast a drag has to be moving, in pixels per millisecond, to count however short. */
export const FLICK_VELOCITY = 0.5;

export const MIN_AUTOPLAY = 1500;
export const MAX_AUTOPLAY = 30000;
export const DEFAULT_AUTOPLAY = 5000;

export const EFFECTS = Object.freeze(['slide', 'fade', 'zoom', 'cover']);

/** The effects that stack the slides instead of laying them along a track. */
export const LAYERED_EFFECTS = Object.freeze(['fade', 'zoom', 'cover']);

export const DEFAULT_LABELS = Object.freeze({
  carousel: 'carousel',
  slide: 'slide',
  track: 'Pictures',
  previous: 'Previous picture',
  next: 'Next picture',
  goTo: 'Go to picture {index} of {total}',
  position: '{index} of {total}',
  play: 'Start the slideshow',
  pause: 'Pause the slideshow',
});

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function whole(value, fallback) {
  return Math.floor(finite(typeof value === 'string' ? Number.parseFloat(value) : value, fallback));
}

/** How many slides stand in the frame at once. */
export function clampPerView(value, total) {
  const count = Math.max(0, whole(total, 0));
  const asked = whole(value, 1);
  const wanted = Number.isFinite(asked) && asked >= 1 ? asked : 1;

  return count === 0 ? 1 : Math.min(wanted, count);
}

/**
 * The last position the track can stop at.
 *
 * With more than one slide in the frame the track runs out before the slides do: showing two
 * of six, the sixth is already on screen when the fifth is at the edge, and a control that
 * offered a sixth position would scroll to somewhere the track cannot reach.
 */
export function lastIndex({ total, perView = 1 } = {}) {
  const count = Math.max(0, whole(total, 0));

  if (count === 0) {
    return -1;
  }

  return Math.max(0, count - clampPerView(perView, count));
}

/** How many positions there are, which is also how many dots. */
export function pageCount({ total, perView = 1 } = {}) {
  const last = lastIndex({ total, perView });
  return last < 0 ? 0 : last + 1;
}

/**
 * Steps through the positions.
 *
 * Without `loop` the ends are real ends, so the control that took you there can be turned off
 * and the position means something.
 */
export function nextIndex({ current, total, delta, perView = 1, loop = false } = {}) {
  const last = lastIndex({ total, perView });

  if (last < 0) {
    return -1;
  }

  const from = Math.min(Math.max(whole(current, 0), 0), last);
  const target = from + whole(delta, 0);
  const span = last + 1;

  if (loop) {
    return ((target % span) + span) % span;
  }

  return Math.min(Math.max(target, 0), last);
}

export function clampIndex({ index, total, perView = 1 } = {}) {
  const last = lastIndex({ total, perView });
  return last < 0 ? -1 : Math.min(Math.max(whole(index, 0), 0), last);
}

/**
 * Which slide the track has settled on, worked out from how far it has scrolled.
 *
 * Rounding rather than flooring, so a track a pixel short of a snap point reports the slide
 * it is about to rest on rather than the one it has almost left.
 */
export function indexFromScroll({ scrollLeft, slideSize, gap = 0, total, perView = 1 } = {}) {
  const step = Math.max(1, finite(slideSize, 0) + Math.max(0, finite(gap, 0)));
  const position = Math.round(Math.max(0, finite(scrollLeft, 0)) / step);

  return clampIndex({ index: position, total, perView });
}

/**
 * Whether a drag moved the carousel, and which way.
 *
 * Distance alone is the wrong rule: a short quick flick is how most people move a carousel on
 * a touch screen, and it would be thrown away. Speed alone is wrong too, because a slow
 * deliberate drag most of the way across plainly means to move. Either is enough.
 *
 * `delta` is how far the pointer travelled: positive is rightwards, which reveals what is on
 * the left, which is the previous slide.
 */
export function commitDrag({
  delta,
  size,
  velocity = 0,
  threshold = DRAG_THRESHOLD,
  flick = FLICK_VELOCITY,
} = {}) {
  const travelled = finite(delta, 0);
  const width = Math.max(1, finite(size, 1));
  const speed = finite(velocity, 0);
  const limit = Math.max(0, finite(flick, FLICK_VELOCITY));

  if (limit > 0 && Math.abs(speed) >= limit) {
    return speed > 0 ? -1 : 1;
  }

  if (Math.abs(travelled) >= width * Math.max(0, finite(threshold, DRAG_THRESHOLD))) {
    return travelled > 0 ? -1 : 1;
  }

  return 0;
}

/** Whether the pointer has moved far enough that this is a drag rather than a press. */
export function isDrag(delta, { slop = 6 } = {}) {
  return Math.abs(finite(delta, 0)) > Math.max(0, finite(slop, 6));
}

export function resolveEffect(value) {
  return EFFECTS.includes(value) ? value : 'slide';
}

export function isLayered(effect) {
  return LAYERED_EFFECTS.includes(resolveEffect(effect));
}

/** How long between slides, kept inside something a person can actually read. */
export function autoplayDelay(value, { min = MIN_AUTOPLAY, max = MAX_AUTOPLAY } = {}) {
  const parsed = finite(typeof value === 'string' ? Number.parseFloat(value) : value, Number.NaN);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_AUTOPLAY;
  }

  const low = Math.max(0, finite(min, MIN_AUTOPLAY));
  const high = Math.max(low, finite(max, MAX_AUTOPLAY));

  return Math.round(Math.min(Math.max(parsed, low), high));
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
