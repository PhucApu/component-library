/**
 * The rules the card turns by, kept away from the DOM so they can be read and tested
 * without a browser.
 *
 * There is only one piece of state — which face is showing — and the interesting decisions
 * are about what a press means and which half of the card has to disappear while it is
 * turned away.
 */

export const DEFAULT_DURATION = 620;
export const MIN_DURATION = 120;
export const MAX_DURATION = 2000;

export const FACES = Object.freeze(['front', 'back']);

export const DEFAULT_LABELS = Object.freeze({
  details: 'Details',
  back: 'Back to the front',
});

function finite(value, fallback) {
  const number = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(number) ? number : fallback;
}

export function resolveFace(value) {
  return FACES.includes(value) ? value : 'front';
}

export function otherFace(face) {
  return resolveFace(face) === 'front' ? 'back' : 'front';
}

/** Where the card stands: square on, or turned right over. */
export function panelAngle(flipped) {
  return flipped ? 180 : 0;
}

/** The face showing, and the one facing away. */
export function facingFace(flipped) {
  return flipped ? 'back' : 'front';
}

/**
 * The face that has to be taken out of the page.
 *
 * Hiding it from the eye is not enough. A face turned away still carries its links and its
 * buttons, and a reader on a keyboard would tab straight into them behind the card — the
 * classic failure of a flip card, and the reason this is a named rule rather than a line
 * of styling.
 */
export function inertFace(flipped) {
  return flipped ? 'front' : 'back';
}

/**
 * Whether a press on the card should turn it.
 *
 * The card is not a button, because its back carries real controls and a button inside a
 * button is not markup. So a press on the card's own surface turns it, and a press on
 * anything that does something of its own is left alone.
 */
export function shouldFlipFrom({ toggle = false, selecting = false, interactive = false } = {}) {
  if (toggle) {
    return true;
  }

  // Letting go of a text selection is not a press on the card.
  return !selecting && !interactive;
}

export function clampDuration(value) {
  const duration = finite(value, DEFAULT_DURATION);
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, duration));
}

export function labelFor(face) {
  return resolveFace(face) === 'front' ? DEFAULT_LABELS.details : DEFAULT_LABELS.back;
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
