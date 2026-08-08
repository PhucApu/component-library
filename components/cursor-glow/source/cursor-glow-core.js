/**
 * The rules the glow follows, kept away from the DOM so they can be read and tested
 * without a browser.
 *
 * There is very little here, and that is the point: the whole effect is two numbers handed
 * to a gradient. What the numbers are, and when there should be no numbers at all, is the
 * part worth writing down.
 */

/** The diameter of the glow, in pixels. */
export const DEFAULT_SIZE = 320;
export const MIN_SIZE = 40;
export const MAX_SIZE = 1200;

/** How long it takes to come up and to go out, in milliseconds. */
export const DEFAULT_FADE = 260;
export const MIN_FADE = 0;
export const MAX_FADE = 2000;

/**
 * The pointers that light anything.
 *
 * A touch screen has no hover: a finger is either pressing or absent. A glow left sitting
 * where a finger last touched is not a light following anybody — it is a smudge.
 */
export const GLOWING_POINTERS = Object.freeze(['mouse', 'pen']);

function finite(value, fallback) {
  const number = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/**
 * Where the pointer is inside the region, in the region's own pixels.
 *
 * Clamped to the edges: a pointer captured during a drag can report from outside the box,
 * and a light that followed it there would be a light on nothing.
 */
export function positionIn(rect, point) {
  const width = Math.max(0, finite(rect?.width, 0));
  const height = Math.max(0, finite(rect?.height, 0));

  return {
    x: clamp(finite(point?.x, 0) - finite(rect?.left, 0), 0, width),
    y: clamp(finite(point?.y, 0) - finite(rect?.top, 0), 0, height),
  };
}

export function shouldGlowFor(pointerType) {
  return GLOWING_POINTERS.includes(pointerType);
}

export function clampSize(value) {
  return clamp(finite(value, DEFAULT_SIZE), MIN_SIZE, MAX_SIZE);
}

export function clampFade(value) {
  return clamp(finite(value, DEFAULT_FADE), MIN_FADE, MAX_FADE);
}

/** The two numbers the gradient reads, as the custom properties that carry them. */
export function glowVariables(x, y) {
  return {
    '--cursor-glow-x': `${Math.round(finite(x, 0) * 100) / 100}px`,
    '--cursor-glow-y': `${Math.round(finite(y, 0) * 100) / 100}px`,
  };
}
