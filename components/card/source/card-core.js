/**
 * The rules the card decides by, kept away from the DOM so they can be read and tested
 * without a browser.
 *
 * There is less here than in most of this collection, and that is the point: a card is
 * nearly all CSS. What is left is the arithmetic behind the pointer-following treatments and
 * the small amount of tidying the markup needs.
 */

export const EFFECTS = Object.freeze(['none', 'lift', 'zoom', 'reveal', 'border', 'spotlight']);

/** The treatments that need to know where the pointer is. */
export const TRACKING_EFFECTS = Object.freeze(['spotlight']);

export const MIN_CLAMP = 1;
export const MAX_CLAMP = 10;

export const DEFAULT_LABELS = Object.freeze({
  loading: 'Loading',
});

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function whole(value, fallback) {
  return Math.floor(finite(typeof value === 'string' ? Number.parseFloat(value) : value, fallback));
}

export function resolveEffect(value) {
  return EFFECTS.includes(value) ? value : 'lift';
}

export function tracksPointer(effect) {
  return TRACKING_EFFECTS.includes(resolveEffect(effect));
}

export function resolveOrientation(value) {
  return value === 'horizontal' ? 'horizontal' : 'vertical';
}

/**
 * How many lines of description to keep.
 *
 * Returns `null` rather than a number when nothing was asked for, because "no limit" and
 * "one line" are different answers and a fallback of `1` would quietly hide most of a card.
 */
export function clampLines(value, { min = MIN_CLAMP, max = MAX_CLAMP } = {}) {
  const lines = whole(value, Number.NaN);

  if (!Number.isFinite(lines) || lines <= 0) {
    return null;
  }

  return Math.min(Math.max(lines, whole(min, MIN_CLAMP)), whole(max, MAX_CLAMP));
}

/**
 * A picture shape, as CSS will take it.
 *
 * Anything unreadable falls back rather than being passed through: an invalid
 * `aspect-ratio` is ignored by the browser, and a card whose pictures are suddenly their
 * natural size breaks every row it sits in.
 */
export function resolveRatio(value, { fallback = '16 / 9' } = {}) {
  const text = String(value ?? '').trim();

  if (!text) {
    return fallback;
  }

  const parts = text.split('/').map((part) => Number.parseFloat(part.trim()));

  if (parts.length === 1 && Number.isFinite(parts[0]) && parts[0] > 0) {
    return String(parts[0]);
  }

  if (parts.length === 2 && parts.every((part) => Number.isFinite(part) && part > 0)) {
    return `${parts[0]} / ${parts[1]}`;
  }

  return fallback;
}

/**
 * Where the pointer is inside the card, as percentages.
 *
 * Clamped, because a pointer can be over the card's shadow or a lifted control that sticks
 * out, and a spotlight that runs off the edge looks like a bug rather than an effect.
 */
export function pointerPosition({ point, rect } = {}) {
  const width = Math.max(1, finite(rect?.width, 1));
  const height = Math.max(1, finite(rect?.height, 1));
  const x = (finite(point?.x, 0) - finite(rect?.left, 0)) / width;
  const y = (finite(point?.y, 0) - finite(rect?.top, 0)) / height;

  return {
    x: Math.round(Math.min(Math.max(x, 0), 1) * 1000) / 10,
    y: Math.round(Math.min(Math.max(y, 0), 1) * 1000) / 10,
  };
}

/**
 * What a card in this state should say about itself.
 *
 * `aria-disabled` rather than anything that removes the link from the tab order: a control
 * nobody can reach is a control nobody can discover is unavailable, and a disabled element
 * cannot hold focus at all.
 */
export function stateAttributes({ loading = false, disabled = false, current = false } = {}) {
  return {
    'aria-busy': loading ? 'true' : null,
    'aria-disabled': disabled ? 'true' : null,
    'aria-current': current ? 'true' : null,
  };
}
