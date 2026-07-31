/**
 * The rules the accordion decides by, kept away from the DOM so they can be read and tested
 * without a browser.
 */

export const MIN_HEADING_LEVEL = 2;
export const MAX_HEADING_LEVEL = 6;
export const DEFAULT_HEADING_LEVEL = 3;

/**
 * How many panels an accordion may have before its panels stop being landmarks.
 *
 * WAI-ARIA Authoring Practices asks for `role="region"` on a panel so it can be jumped to,
 * then warns against using it where it would breed landmarks — "more than approximately six"
 * is the number it gives. Both halves of that advice matter, so the count decides.
 */
export const REGION_LIMIT = 6;

export const MIN_DURATION = 120;
export const MAX_DURATION = 420;
export const DURATION_PER_PIXEL = 0.6;

export const DEFAULT_LABELS = Object.freeze({
  /**
   * Said politely when opening one panel shuts another.
   *
   * Nothing else here is announced, because a native `summary` already reports its own name
   * and whether it is open. This one is different: it is a change the person did not ask
   * for and cannot see if it happened above the fold.
   */
  replaced: '{title} collapsed',
});

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function whole(value, fallback) {
  return Math.floor(finite(typeof value === 'string' ? Number.parseFloat(value) : value, fallback));
}

/** Keeps a supplied heading level inside the range that can actually be rendered. */
export function clampHeadingLevel(value, { fallback = DEFAULT_HEADING_LEVEL } = {}) {
  const level = whole(value, fallback);

  if (!Number.isFinite(level)) {
    return fallback;
  }

  return Math.min(Math.max(level, MIN_HEADING_LEVEL), MAX_HEADING_LEVEL);
}

/** Whether panels in a group of this size should be landmarks. */
export function shouldExposeRegion(count, { limit = REGION_LIMIT } = {}) {
  const total = whole(count, 0);
  return total > 0 && total <= Math.max(0, whole(limit, REGION_LIMIT));
}

/**
 * How long a panel of this height should take.
 *
 * A single speed for every panel is wrong at both ends: a two-line panel crawls and a long
 * one drags. Proportional with a floor and a ceiling keeps short ones snappy and stops a
 * very long one from feeling broken.
 */
export function panelDuration(
  height,
  { min = MIN_DURATION, max = MAX_DURATION, perPixel = DURATION_PER_PIXEL } = {},
) {
  const size = Math.max(0, finite(height, 0));
  const low = Math.max(0, finite(min, MIN_DURATION));
  const high = Math.max(low, finite(max, MAX_DURATION));

  return Math.round(Math.min(Math.max(size * Math.max(0, finite(perPixel, DURATION_PER_PIXEL)), low), high));
}

/**
 * The next header the arrow keys should land on.
 *
 * It wraps, which is what the Authoring Practices suggest for an accordion, and it does not
 * step over a disabled header. A disabled control nobody can reach is a control nobody can
 * discover is disabled, and skipping it would also hide it from anyone counting their way
 * down the list.
 */
export function nextHeaderIndex({ current, total, delta, loop = true } = {}) {
  const count = Math.max(0, whole(total, 0));

  if (count === 0) {
    return -1;
  }

  const from = Math.min(Math.max(whole(current, 0), 0), count - 1);
  const target = from + whole(delta, 0);

  if (loop) {
    return ((target % count) + count) % count;
  }

  return Math.min(Math.max(target, 0), count - 1);
}

function usable(list, total) {
  const count = Math.max(0, whole(total, Number.POSITIVE_INFINITY));

  return [
    ...new Set(
      (Array.isArray(list) ? list : [])
        .map((value) => whole(value, Number.NaN))
        .filter((value) => Number.isFinite(value) && value >= 0 && value < count),
    ),
  ].sort((a, b) => a - b);
}

/**
 * Which panels are open once one of them is toggled.
 *
 * Exclusive mode is a replacement rather than an addition, which is the whole of the
 * difference between the two modes and the reason it lives here rather than in three places
 * in the element.
 */
export function expandedAfter({ expanded, index, open, exclusive = false, total } = {}) {
  const count = Math.max(0, whole(total, Number.POSITIVE_INFINITY));
  const target = whole(index, -1);
  const current = usable(expanded, count);

  if (!Number.isFinite(target) || target < 0 || target >= count) {
    return current;
  }

  if (!open) {
    return current.filter((value) => value !== target);
  }

  if (exclusive) {
    return [target];
  }

  return usable([...current, target], count);
}

/**
 * Cleans up a set of panels somebody asked to be open.
 *
 * Anything out of range or repeated goes, and in exclusive mode everything after the first
 * goes with it: a request the group's own rules forbid has to be answered with a state it
 * allows, or the next press looks as though it did nothing.
 */
export function normaliseExpanded({ expanded, total, exclusive = false } = {}) {
  const list = usable(expanded, total);
  return exclusive ? list.slice(0, 1) : list;
}

/** Which panels have to move to get from one open set to another. */
export function expansionDiff(before, after, { total } = {}) {
  const from = new Set(usable(before, total));
  const to = new Set(usable(after, total));

  return {
    opening: [...to].filter((index) => !from.has(index)),
    closing: [...from].filter((index) => !to.has(index)),
  };
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
