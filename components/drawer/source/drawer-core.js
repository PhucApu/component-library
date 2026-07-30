export const ANCHORS = Object.freeze(['start', 'end', 'top', 'bottom']);
export const CLOSE_REASONS = Object.freeze(['api', 'close', 'escape', 'backdrop']);

export const DEFAULT_LABELS = Object.freeze({
  close: 'Close',
});

export function normalizeAnchor(value) {
  return ANCHORS.includes(value) ? value : 'start';
}

/**
 * Which behaviour the panel gets, decided by what the author actually wrote.
 *
 * A dialog traps focus, takes Escape, and inerts the page behind it. A navigation panel
 * that is always there is none of those things, and calling it a dialog would tell
 * assistive technology it interrupts something when it does not. Reading the element
 * rather than a `mode` attribute means the two can never disagree.
 */
export function isModalPanel(tagName) {
  return typeof tagName === 'string' && tagName.toUpperCase() === 'DIALOG';
}

export function normalizeReason(value) {
  return CLOSE_REASONS.includes(value) ? value : 'api';
}

/** Whether a point falls inside a rectangle, edges counted as inside. */
export function pointInBox(point, rect) {
  if (!point || !rect) {
    return false;
  }

  const { x, y } = point;

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }

  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Decides whether a press on a `dialog` landed on its backdrop.
 *
 * The backdrop is not an element, so a press on it arrives with the dialog itself as the
 * target and coordinates outside the dialog's own box. A keyboard activation reports a
 * detail of zero and no useful coordinates, so it is never a backdrop press.
 */
export function isBackdropPress({ target, panel, point, detail } = {}) {
  if (!target || !panel || target !== panel) {
    return false;
  }

  if (detail === 0) {
    return false;
  }

  return !pointInBox(point, panel.getBoundingClientRect?.() ?? null);
}
