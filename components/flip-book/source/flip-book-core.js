/**
 * The rules the book turns by, kept away from the DOM so they can be read and tested
 * without a browser.
 *
 * One number describes the whole book: how many leaves have been turned. Everything else —
 * which pages are readable, where each leaf sits in the stack, which way a half-finished
 * turn should fall — is worked out from that and from the angle of the leaf in the air.
 */

export const DEFAULT_DURATION = 520;
export const MIN_DURATION = 120;
export const MAX_DURATION = 2000;

/** Past half way, a turn wants to finish. */
export const COMMIT_PROGRESS = 0.5;

/** However short the drag, this much speed still commits it, in progress per millisecond. */
export const FLICK_VELOCITY = 0.0012;

/** How far each leaf below the top one shows, and how many of them bother showing. */
export const STACK_STEP = 2.6;
export const MAX_STACK_DEPTH = 6;

/** How dark a leaf goes at the top of its arc. */
export const MAX_SHADE = 0.42;

export const DEFAULT_LABELS = Object.freeze({
  book: 'Flip book',
  previous: 'Previous page',
  next: 'Next page',
  spread: 'Pages {left} and {right} of {total}',
  single: 'Page {page} of {total}',
});

function finite(value, fallback) {
  const number = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function count(value) {
  return Math.max(0, Math.floor(finite(value, 0)));
}

/** How many leaves a given number of pages makes. A leaf carries two of them. */
export function leafCount(pages) {
  return Math.ceil(count(pages) / 2);
}

/**
 * The pages each leaf carries, front and back.
 *
 * An odd number of pages leaves the last back empty rather than dropping the leaf: a book
 * with an odd page count ends on a blank, and pretending otherwise would lose a page.
 */
export function leavesFrom(pages) {
  const total = count(pages);

  return Array.from({ length: leafCount(total) }, (unused, index) => ({
    front: index * 2,
    back: index * 2 + 1 < total ? index * 2 + 1 : null,
  }));
}

export function clampTurned(turned, pages) {
  return clamp(Math.round(finite(turned, 0)), 0, leafCount(pages));
}

export function clampPage(page, pages) {
  const total = count(pages);
  return total === 0 ? 0 : clamp(Math.round(finite(page, 1)), 1, total);
}

/**
 * Which pages are readable with this many leaves turned.
 *
 * The book opens closed: nothing on the left, the first page on the right. It ends the
 * other way round. Everywhere in between both sides carry a page, which is what a spread is.
 */
export function spreadOf(turned, pages) {
  const total = count(pages);
  const leaves = clampTurned(turned, total);

  if (total === 0) {
    return { left: null, right: null };
  }

  const left = leaves === 0 ? null : Math.min(total, leaves * 2);
  const right = leaves * 2 + 1 <= total ? leaves * 2 + 1 : null;

  return { left, right };
}

/** The first page a reader can see at this point in the book. */
export function pageForTurned(turned, pages) {
  const spread = spreadOf(turned, pages);
  return spread.right ?? spread.left ?? 0;
}

/** How many leaves have to be turned for a page to be readable. */
export function turnedForPage(page, pages) {
  const total = count(pages);

  if (total === 0) {
    return 0;
  }

  return clampTurned(Math.floor(clampPage(page, total) / 2), total);
}

/**
 * Whether there is anywhere to turn.
 *
 * Forwards, that means a page the reader has not reached yet — not merely a leaf that
 * could physically be lifted. A book of one page has a leaf with a blank back, and turning
 * it over would be a page turn that showed nothing, so the control that would do it says
 * so by being disabled instead.
 */
export function canTurn(turned, pages, direction = 1) {
  const now = clampTurned(turned, pages);

  if (finite(direction, 1) < 0) {
    return now > 0;
  }

  return now < leafCount(pages) && pageForTurned(now + 1, pages) > pageForTurned(now, pages);
}

/** How far through its turn a drag has taken the leaf, from nothing to all the way over. */
export function dragProgress(distance, width) {
  const across = finite(width, 0);

  if (across <= 0) {
    return 0;
  }

  return clamp(finite(distance, 0) / across, 0, 1);
}

/** Where the leaf stands, in degrees, at that point in the turn. */
export function turnAngle(progress) {
  return -180 * clamp(finite(progress, 0), 0, 1);
}

/**
 * Whether a released leaf falls over or falls back.
 *
 * Distance alone would throw away the short flick that is how most people turn a page, so
 * either being past half way or still moving quickly is enough.
 */
export function commitTurn({ progress = 0, velocity = 0 } = {}) {
  return (
    clamp(finite(progress, 0), 0, 1) >= COMMIT_PROGRESS ||
    finite(velocity, 0) >= FLICK_VELOCITY
  );
}

/** Slow at both ends, quick in the middle: a page under a hand, not on a motor. */
export function easeInOut(progress) {
  const time = clamp(finite(progress, 0), 0, 1);
  return time < 0.5 ? 4 * time ** 3 : 1 - (-2 * time + 2) ** 3 / 2;
}

/** How far a leaf sits from the top of its pile, so the stack has a visible thickness. */
export function stackOffset(depth, step = STACK_STEP) {
  const below = clamp(Math.round(finite(depth, 0)), 0, MAX_STACK_DEPTH);
  return below * finite(step, STACK_STEP);
}

/**
 * How dark a leaf is at that angle.
 *
 * Nothing at either end and most at the top of the arc, which is where a real page has
 * turned away from the light. It is the only cue that the leaf has thickness at all.
 */
export function shadeAt(angle) {
  const radians = (finite(angle, 0) * Math.PI) / 180;
  return MAX_SHADE * Math.abs(Math.sin(radians));
}

/**
 * Where a leaf sits in the pile.
 *
 * The two piles grow in opposite directions: the unturned ones are highest at the top of
 * the book, the turned ones are highest at the end of what has been read. The two ranges
 * are kept apart rather than allowed to meet, because a leaf in the air crosses both piles
 * and anything it can tie with is something it can pass through.
 */
export function zIndexFor(index, turned, pages, turning = false) {
  const leaves = leafCount(pages);
  const leaf = clamp(Math.round(finite(index, 0)), 0, Math.max(0, leaves - 1));

  if (turning) {
    return leaves * 2 + 2;
  }

  return leaf < clampTurned(turned, pages) ? leaf + 1 : leaves * 2 - leaf;
}

export function clampDuration(value) {
  return clamp(finite(value, DEFAULT_DURATION), MIN_DURATION, MAX_DURATION);
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
