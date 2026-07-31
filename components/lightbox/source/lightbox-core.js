export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 0.25;

/** How many thumbnails stand on the strip at once. The rest wait out of sight. */
export const STRIP_WINDOW = 6;

export const DEFAULT_LABELS = Object.freeze({
  panel: 'Image viewer',
  zoomLevel: 'Zoom level, per cent',
  showStrip: 'Show thumbnails',
  hideStrip: 'Hide thumbnails',
  counter: '{index} of {total}',
  announce: '{index} of {total}: {alt}',
  previous: 'Previous image',
  next: 'Next image',
  close: 'Close viewer',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  zoomReset: 'Reset zoom',
  thumb: 'Show image {index} of {total}: {alt}',
  stripPrevious: 'Previous thumbnail',
  stripNext: 'Next thumbnail',
});

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function clampZoom(value, { min = MIN_ZOOM, max = MAX_ZOOM } = {}) {
  const low = finite(min, MIN_ZOOM);
  const high = Math.max(low, finite(max, MAX_ZOOM));
  return Math.min(Math.max(finite(value, low), low), high);
}

/**
 * Steps through the set.
 *
 * Without `loop` the ends are real ends, so the control that took you there can be turned
 * off and the counter means something.
 */
export function nextIndex(current, total, delta, { loop = false } = {}) {
  const count = Math.max(0, Math.floor(finite(total, 0)));

  if (count === 0) {
    return -1;
  }

  const from = Math.min(Math.max(Math.floor(finite(current, 0)), 0), count - 1);
  const target = from + Math.floor(finite(delta, 0));

  if (loop) {
    return ((target % count) + count) % count;
  }

  return Math.min(Math.max(target, 0), count - 1);
}

/**
 * Where the image has to sit so the point under the pointer stays under the pointer.
 *
 * Zooming about the centre is the easy version and the wrong one: the detail someone is
 * pointing at slides away from them exactly when they are trying to look at it closer.
 *
 * Coordinates are measured from the middle of the frame, and the offset is applied before
 * the scale, which is the order both `transform: translate() scale()` and the individual
 * `translate`/`scale` properties use.
 */
export function zoomAt({ scale, nextScale, pointer, offset } = {}) {
  const from = Math.max(0.0001, finite(scale, 1));
  const to = Math.max(0.0001, finite(nextScale, from));
  const px = finite(pointer?.x, 0);
  const py = finite(pointer?.y, 0);
  const ox = finite(offset?.x, 0);
  const oy = finite(offset?.y, 0);

  return {
    x: px - ((px - ox) / from) * to,
    y: py - ((py - oy) / from) * to,
  };
}

/**
 * Keeps the image from being dragged away from the frame.
 *
 * An image smaller than the frame in one axis cannot move in that axis at all, which is
 * why the limit is floored at zero rather than allowed to go negative.
 */
export function clampOffset({ offset, scale, frame, image } = {}) {
  const factor = Math.max(0.0001, finite(scale, 1));
  const limitX = Math.max(0, (finite(image?.width, 0) * factor - finite(frame?.width, 0)) / 2);
  const limitY = Math.max(0, (finite(image?.height, 0) * factor - finite(frame?.height, 0)) / 2);

  return {
    x: Math.min(Math.max(finite(offset?.x, 0), -limitX), limitX),
    y: Math.min(Math.max(finite(offset?.y, 0), -limitY), limitY),
  };
}

/** What the zoom field shows. Whole per cent, because nobody types 137.5. */
export function formatZoomPercent(scale) {
  return Math.round(Math.max(0, finite(scale, 1)) * 100);
}

/**
 * Reads what somebody typed into the zoom field.
 *
 * Returns `null` for anything unusable rather than a guess, so the caller can leave the
 * field alone instead of overwriting a half-finished number. Clamping every keystroke is
 * what makes such a field impossible to type into: the `1` of `150` becomes `100` and the
 * rest of the number has nowhere to go.
 */
export function parseZoomPercent(text, { min = MIN_ZOOM, max = MAX_ZOOM } = {}) {
  const digits = String(text ?? '').replace(/[^\d.]/g, '');

  if (!digits) {
    return null;
  }

  const value = Number.parseFloat(digits);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return clampZoom(value / 100, { min, max });
}

/** How close to the edge of the window the current picture gets before it slides on. */
export const STRIP_LOOKAHEAD = 1;

/**
 * Which run of thumbnails is on the strip.
 *
 * The window slides before the current picture reaches the very edge rather than after, so
 * what is coming next is always already on the strip. `margin` is how much of that is kept
 * in hand; it is capped so it can never ask for more room than the window has.
 */
export function stripWindow({
  index,
  total,
  size = STRIP_WINDOW,
  start = 0,
  margin = STRIP_LOOKAHEAD,
} = {}) {
  const count = Math.max(0, Math.floor(finite(total, 0)));
  const span = Math.max(1, Math.floor(finite(size, STRIP_WINDOW)));

  if (count <= span) {
    return { start: 0, end: count };
  }

  const current = Math.min(Math.max(Math.floor(finite(index, 0)), 0), count - 1);
  const lead = Math.max(0, Math.min(Math.floor(finite(margin, 0)), Math.floor((span - 1) / 2)));
  let from = Math.min(Math.max(Math.floor(finite(start, 0)), 0), count - span);

  if (current - lead < from) {
    from = current - lead;
  } else if (current + lead > from + span - 1) {
    from = current + lead - span + 1;
  }

  from = Math.min(Math.max(from, 0), count - span);

  return { start: from, end: from + span };
}

/** Moves the window along, never past either end. */
export function shiftWindow({ start, delta, total, size = STRIP_WINDOW } = {}) {
  const count = Math.max(0, Math.floor(finite(total, 0)));
  const span = Math.max(1, Math.floor(finite(size, STRIP_WINDOW)));
  const last = Math.max(0, count - span);

  return Math.min(Math.max(Math.floor(finite(start, 0)) + Math.floor(finite(delta, 0)), 0), last);
}

/**
 * Whether a press landed on the dark surround rather than on the picture.
 *
 * The element fills the frame and `object-fit` letterboxes the picture inside it, so every
 * press within the frame arrives on the image whether or not it touched anything visible.
 * Only the drawn rectangle counts as the picture.
 */
export function pressedBeside({ point, offset, size, scale } = {}) {
  const factor = Math.max(0.0001, finite(scale, 1));
  const halfWidth = (finite(size?.width, 0) * factor) / 2;
  const halfHeight = (finite(size?.height, 0) * factor) / 2;

  return (
    Math.abs(finite(point?.x, 0) - finite(offset?.x, 0)) > halfWidth ||
    Math.abs(finite(point?.y, 0) - finite(offset?.y, 0)) > halfHeight
  );
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

/**
 * What the status region says after the image changes.
 *
 * Swapping the `src` and `alt` of an image already on the page announces nothing at all,
 * so without this a screen reader user is told only that a button was pressed.
 */
export function imageAnnouncement({ index, total, alt, labels } = {}) {
  const pack = { ...DEFAULT_LABELS, ...labels };
  const position = Math.max(1, Math.floor(finite(index, 0)) + 1);
  const count = Math.max(1, Math.floor(finite(total, 1)));
  const text = typeof alt === 'string' ? alt.trim() : '';

  return fillLabel(text ? pack.announce : pack.counter, {
    index: position,
    total: count,
    alt: text,
  });
}
