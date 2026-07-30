export const SIZES = Object.freeze(['md', 'sm']);
export const PLACEMENTS = Object.freeze(['end', 'start']);

export const DEFAULT_LABELS = Object.freeze({
  turningOn: 'Turning {label} on',
  turningOff: 'Turning {label} off',
  failedOn: 'Could not turn {label} on',
  failedOff: 'Could not turn {label} off',
});

function normalizeFrom(allowed, value, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function normalizeSize(value) {
  return normalizeFrom(SIZES, value, 'md');
}

export function normalizePlacement(value) {
  return normalizeFrom(PLACEMENTS, value, 'end');
}

/**
 * Decides whether a toggle attempt should be dropped.
 *
 * A switch takes effect immediately, so a second toggle while the first is still in
 * flight would send a request nobody can reason about. The block is applied by cancelling
 * the click rather than by disabling the control: a disabled element loses focus, which
 * would drop a keyboard user back at the top of the document mid-task.
 */
export function shouldBlockToggle({ pending, disabled } = {}) {
  return Boolean(pending) || Boolean(disabled);
}

function pick(value, fallback) {
  return typeof value === 'string' && value.trim().length ? value : fallback;
}

/**
 * Fills the label into a template. An unlabelled switch would otherwise leave a gap in
 * the middle of the sentence, so the whitespace is collapsed afterwards.
 */
export function fillTemplate(template, label) {
  const text = typeof template === 'string' ? template : '';
  const name = typeof label === 'string' ? label : '';

  return text.replace('{label}', name).replace(/\s+/g, ' ').trim();
}

/** What the status region says while the request is in flight. */
export function pendingMessage({ checked, label, labels } = {}) {
  const template = checked
    ? pick(labels?.turningOn, DEFAULT_LABELS.turningOn)
    : pick(labels?.turningOff, DEFAULT_LABELS.turningOff);

  return fillTemplate(template, label);
}

/**
 * What the status region says after a failure. `checked` is the state the person asked
 * for, not the one they have been returned to, because the failure is about the request.
 */
export function errorMessage({ checked, label, labels } = {}) {
  const template = checked
    ? pick(labels?.failedOn, DEFAULT_LABELS.failedOn)
    : pick(labels?.failedOff, DEFAULT_LABELS.failedOff);

  return fillTemplate(template, label);
}
