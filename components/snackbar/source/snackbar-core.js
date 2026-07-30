export const SEVERITIES = Object.freeze(['info', 'success', 'warning', 'error']);

export const PLACEMENTS = Object.freeze([
  'top-start',
  'top-center',
  'top-end',
  'bottom-start',
  'bottom-center',
  'bottom-end',
]);

/** How long a message with nothing to act on stays on screen. */
export const DEFAULT_DURATION = 5000;

/**
 * Severities that interrupt. A message about something that went wrong is worthless if
 * the person hears it after it has already gone.
 */
export const ASSERTIVE_SEVERITIES = Object.freeze(['warning', 'error']);

export const DEFAULT_LABELS = Object.freeze({
  dismiss: 'Dismiss',
  withAction: '{message}, {action} available',
});

function normalizeFrom(allowed, value, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function normalizeSeverity(value) {
  return normalizeFrom(SEVERITIES, value, 'info');
}

export function normalizePlacement(value) {
  return normalizeFrom(PLACEMENTS, value, 'bottom-center');
}

/**
 * Politeness follows the severity rather than being set separately. Two ways to say the
 * same thing is two ways to disagree with yourself.
 */
export function politenessFor(severity) {
  return ASSERTIVE_SEVERITIES.includes(normalizeSeverity(severity)) ? 'assertive' : 'polite';
}

/**
 * Works out how long the message may stay, where `null` means "until dismissed".
 *
 * A message carrying an action never runs a timer. A control that disappears on a clock
 * loses the race against anyone reading the sentence before reaching for the button.
 */
export function resolveDuration({ duration, hasAction } = {}) {
  if (hasAction) {
    return null;
  }

  if (duration === 0) {
    return null;
  }

  if (Number.isFinite(duration) && duration > 0) {
    return duration;
  }

  return DEFAULT_DURATION;
}

/**
 * Builds the sentence read aloud. The visible action button is reachable by keyboard, but
 * nothing would tell the person it is there, so the announcement names it.
 */
export function composeAnnouncement({ message, actionLabel, labels } = {}) {
  const text = typeof message === 'string' ? message.trim() : '';

  if (!text) {
    return '';
  }

  const action = typeof actionLabel === 'string' ? actionLabel.trim() : '';

  if (!action) {
    return text;
  }

  const template =
    typeof labels?.withAction === 'string' && labels.withAction.trim().length
      ? labels.withAction
      : DEFAULT_LABELS.withAction;

  return template.replace('{message}', text).replace('{action}', action);
}

/**
 * Decides whether an arriving message should displace the one on screen.
 *
 * Without this the severity system contradicts itself: marking a failure assertive says
 * it interrupts, while a plain queue would leave it waiting out the full life of the
 * "Saved" message in front of it. Only an urgent message displaces, and only a calm one
 * is displaced.
 */
export function shouldPreempt({ incomingSeverity, currentSeverity } = {}) {
  if (currentSeverity === undefined || currentSeverity === null) {
    return false;
  }

  return (
    politenessFor(incomingSeverity) === 'assertive' &&
    politenessFor(currentSeverity) === 'polite'
  );
}

/**
 * A first-in first-out queue of pending messages. Kept free of the DOM so the ordering
 * rules can be tested on their own.
 */
export function createQueue() {
  const items = [];

  return {
    push(item) {
      items.push(item);
      return items.length;
    },
    /** Used only by an urgent message, which does not wait its turn. */
    unshift(item) {
      items.unshift(item);
      return items.length;
    },
    shift() {
      return items.shift() ?? null;
    },
    peek() {
      return items[0] ?? null;
    },
    remove(id) {
      const index = items.findIndex((item) => item.id === id);

      if (index === -1) {
        return false;
      }

      items.splice(index, 1);
      return true;
    },
    clear() {
      const removed = items.length;
      items.length = 0;
      return removed;
    },
    get size() {
      return items.length;
    },
  };
}
