export const APPEARANCES = Object.freeze(['outlined', 'filled']);
export const SIZES = Object.freeze(['md', 'sm']);

/** How close to the limit the counter starts being worth announcing. */
export const COUNTER_ANNOUNCE_THRESHOLD = 20;

function normalizeFrom(allowed, value, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function normalizeAppearance(value) {
  return normalizeFrom(APPEARANCES, value, 'outlined');
}

export function normalizeSize(value) {
  return normalizeFrom(SIZES, value, 'md');
}

/**
 * Chooses the message to show.
 *
 * The browser's own message is already translated into the user's language, so it is the
 * better default. An author-supplied message wins when there is one, because only the
 * author knows the domain rule behind a `pattern`.
 */
export function resolveErrorMessage({ valid, customMessage, validationMessage } = {}) {
  if (valid) {
    return '';
  }

  const custom = typeof customMessage === 'string' ? customMessage.trim() : '';
  if (custom.length) {
    return custom;
  }

  return typeof validationMessage === 'string' ? validationMessage : '';
}

/**
 * Decides whether the field should be showing its error yet.
 *
 * An empty required field is invalid from the moment it renders, so reacting to validity
 * alone paints a whole form red before anyone has typed. The error only belongs on
 * screen once the person has left the field or tried to submit.
 */
export function shouldShowError({ touched, valid } = {}) {
  return Boolean(touched) && !valid;
}

export function counterState(length, maxLength, threshold = COUNTER_ANNOUNCE_THRESHOLD) {
  const limit = Number.isFinite(maxLength) && maxLength > 0 ? Math.floor(maxLength) : null;
  const used = Number.isFinite(length) && length > 0 ? Math.floor(length) : 0;

  if (limit === null) {
    return { text: '', remaining: null, nearLimit: false, atLimit: false };
  }

  const remaining = limit - used;

  return {
    text: `${used} / ${limit}`,
    remaining,
    nearLimit: remaining <= threshold,
    atLimit: remaining <= 0,
  };
}

/**
 * The counter is decorative and updates on every keystroke, so announcing it constantly
 * would bury everything else. Only the approach to the limit is worth saying, and only
 * once per step.
 */
export function counterAnnouncement(state, labels = {}) {
  if (!state || state.remaining === null || !state.nearLimit) {
    return '';
  }

  if (state.atLimit) {
    return typeof labels.limitReached === 'string' ? labels.limitReached : 'Character limit reached';
  }

  const template =
    typeof labels.charactersLeft === 'string' ? labels.charactersLeft : '{count} characters left';

  return template.replace('{count}', String(state.remaining));
}

/** Joins the ids that describe a field, dropping the ones that are not present. */
export function describedBy(...ids) {
  const list = ids.filter((id) => typeof id === 'string' && id.trim().length);
  return list.length ? list.join(' ') : '';
}

export function revealLabel(labels, revealed) {
  const shown = typeof labels?.hidePassword === 'string' ? labels.hidePassword : 'Hide password';
  const hidden = typeof labels?.showPassword === 'string' ? labels.showPassword : 'Show password';
  // The name states the action the button performs next, not the state it is in.
  return revealed ? shown : hidden;
}
