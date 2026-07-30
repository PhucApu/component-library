import {
  DEFAULT_LABELS,
  composeAnnouncement,
  createQueue,
  normalizePlacement,
  normalizeSeverity,
  politenessFor,
  resolveDuration,
  shouldPreempt,
} from './snackbar-core.js';

/**
 * A live region that already holds the text it is given announces nothing, and two writes
 * in the same frame collapse into one. Clearing, yielding, then writing is what makes a
 * second message audible after a first.
 */
const ANNOUNCE_GAP_MS = 60;

/** Covers the 170ms exit transition in the stylesheet, with a little slack. */
const EXIT_MS = 200;

const ICONS = Object.freeze({
  info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path>',
  success: '<circle cx="12" cy="12" r="9"></circle><path d="m8.5 12.5 2.5 2.5 4.5-5"></path>',
  warning: '<path d="M12 4 2.5 20h19L12 4Z"></path><path d="M12 10v4M12 17h.01"></path>',
  error: '<circle cx="12" cy="12" r="9"></circle><path d="m9 9 6 6M15 9l-6 6"></path>',
});

let snackbarId = 0;

/**
 * Reports what just happened, without taking the person away from what they are doing.
 *
 * Nothing here is a control the author writes into the page. The element is placed once as
 * a host and the application calls `show()`; the message, its urgency, and its lifetime
 * are decided per call.
 */
export class UiSnackbar extends HTMLElement {
  static get observedAttributes() {
    return ['placement'];
  }

  constructor() {
    super();
    this._connected = false;
    this._queue = createQueue();
    this._current = null;
    this._timer = null;
    this._remaining = null;
    this._startedAt = 0;
    this._announceTimer = null;
    this._exitTimer = null;
    this._labelOverrides = {};

    this._handlePointerEnter = this._pauseTimer.bind(this);
    this._handlePointerLeave = this._resumeTimer.bind(this);
    this._handleFocusIn = this._pauseTimer.bind(this);
    this._handleFocusOut = this._handleFocusOut.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleVisibility = this._handleVisibility.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this._build();
    this._sync();
    document.addEventListener('visibilitychange', this._handleVisibility);
  }

  disconnectedCallback() {
    document.removeEventListener('visibilitychange', this._handleVisibility);
    this._clearTimers();
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this._connected && oldValue !== newValue) {
      this._sync();
    }
  }

  get placement() {
    return normalizePlacement(this.getAttribute('placement'));
  }

  get labels() {
    return { ...DEFAULT_LABELS, ...this._labelOverrides };
  }

  set labels(next) {
    this._labelOverrides = next && typeof next === 'object' ? { ...next } : {};
  }

  /** The message on screen right now, or `null`. */
  get current() {
    return this._current ? { ...this._current } : null;
  }

  get pending() {
    return this._queue.size;
  }

  /**
   * Queues a message. Returns its id so it can be dismissed before its time.
   *
   * @param {{message: string, severity?: string, duration?: number,
   *          action?: {label: string, onSelect?: Function}}} options
   */
  show(options = {}) {
    const message = typeof options.message === 'string' ? options.message.trim() : '';

    if (!message) {
      return null;
    }

    snackbarId += 1;
    const action =
      options.action && typeof options.action.label === 'string' && options.action.label.trim()
        ? { label: options.action.label.trim(), onSelect: options.action.onSelect }
        : null;

    const item = {
      id: `snackbar-${snackbarId}`,
      message,
      severity: normalizeSeverity(options.severity),
      action,
      duration: resolveDuration({ duration: options.duration, hasAction: Boolean(action) }),
    };

    if (
      shouldPreempt({ incomingSeverity: item.severity, currentSeverity: this._current?.severity })
    ) {
      // Straight to the front, and the calm message on screen makes way. Closing it runs
      // the exit transition, whose callback pumps this one into its place.
      this._queue.unshift(item);
      this._close('preempted');
    } else {
      this._queue.push(item);
      this._pump();
    }

    return item.id;
  }

  /** Closes a message whether it is on screen or still waiting. */
  dismiss(id, reason = 'dismiss') {
    if (this._current && this._current.id === id) {
      this._close(reason);
      return true;
    }

    return this._queue.remove(id);
  }

  /** Drops everything, on screen and queued. */
  clear() {
    this._queue.clear();

    if (this._current) {
      this._close('clear');
    }
  }

  _build() {
    // Both regions exist from the start and stay empty. A live region created together
    // with its first message is routinely missed: assistive technology has to be watching
    // the node before the text arrives.
    this._status = this._region('status');
    this._alert = this._region('alert');

    this._surface = document.createElement('div');
    this._surface.className = 'snackbar__surface';
    this._surface.setAttribute('popover', 'manual');

    this._icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._icon.setAttribute('class', 'snackbar__icon');
    this._icon.setAttribute('viewBox', '0 0 24 24');
    this._icon.setAttribute('aria-hidden', 'true');

    // The text is announced through the live region above. Leaving it readable here as
    // well would say everything twice; `aria-hidden` belongs on the paragraph and never
    // on the surface, which would take the action button with it.
    this._message = document.createElement('p');
    this._message.className = 'snackbar__message';
    this._message.setAttribute('aria-hidden', 'true');

    this._action = document.createElement('button');
    this._action.type = 'button';
    this._action.className = 'snackbar__action';
    this._action.addEventListener('click', () => {
      const item = this._current;
      this._close('action');
      item?.action?.onSelect?.();
    });

    this._dismiss = document.createElement('button');
    this._dismiss.type = 'button';
    this._dismiss.className = 'snackbar__close';
    this._dismiss.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg>';
    this._dismiss.addEventListener('click', () => this._close('dismiss'));

    this._surface.append(this._icon, this._message, this._action, this._dismiss);
    this._surface.addEventListener('pointerenter', this._handlePointerEnter);
    this._surface.addEventListener('pointerleave', this._handlePointerLeave);
    this._surface.addEventListener('focusin', this._handleFocusIn);
    this._surface.addEventListener('focusout', this._handleFocusOut);
    // Only reaches here when focus is already inside, which is the point: a document-level
    // listener would take Escape away from any dialog or picker open on the same page.
    this._surface.addEventListener('keydown', this._handleKeyDown);

    this.append(this._status, this._alert, this._surface);
  }

  _region(role) {
    const region = document.createElement('div');
    region.className = 'snackbar__live';
    region.setAttribute('role', role);
    return region;
  }

  _sync() {
    this.dataset.placement = this.placement;
  }

  _pump() {
    if (this._current) {
      return;
    }

    const next = this._queue.shift();

    if (!next) {
      return;
    }

    this._present(next);
  }

  _present(item) {
    this._current = item;

    this._icon.innerHTML = ICONS[item.severity];
    this._message.textContent = item.message;

    if (item.action) {
      this._action.textContent = item.action.label;
      this._action.hidden = false;
    } else {
      this._action.textContent = '';
      this._action.hidden = true;
    }

    this._dismiss.setAttribute('aria-label', this.labels.dismiss);
    this._surface.dataset.severity = item.severity;
    this._surface.setAttribute('data-open', '');

    try {
      this._surface.showPopover?.();
    } catch {
      // Already open, or the browser has no popover support. The stylesheet keeps the
      // surface pinned either way.
    }

    // Read a layout value to flush the style change above before the next one lands.
    // Without the flush both attributes are applied in a single recalculation and the
    // transition has nothing to start from, so the message simply appears.
    // Reading a layout value flushes the style change above before the next one lands.
    // `showPopover()` happens to force the same flush, so this is redundant wherever the
    // Popover API exists; it is what keeps the arrival animating where it does not, since
    // both attributes would otherwise be applied in one recalculation and leave the
    // transition nothing to start from.
    void this._surface.offsetWidth;
    this._surface.setAttribute('data-shown', '');

    this._announce(item);

    if (item.duration !== null) {
      this._remaining = item.duration;
      this._resumeTimer();
    }

    this.dispatchEvent(
      new CustomEvent('snackbar-show', {
        detail: { id: item.id, message: item.message, severity: item.severity },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _announce(item) {
    const text = composeAnnouncement({
      message: item.message,
      actionLabel: item.action?.label,
      labels: this.labels,
    });
    const region = politenessFor(item.severity) === 'assertive' ? this._alert : this._status;

    this._status.textContent = '';
    this._alert.textContent = '';

    clearTimeout(this._announceTimer);
    this._announceTimer = setTimeout(() => {
      region.textContent = text;
    }, ANNOUNCE_GAP_MS);
  }

  _close(reason) {
    const item = this._current;

    if (!item) {
      return;
    }

    this._current = null;
    this._clearTimers();
    // Dropping `data-shown` returns the surface to the resting style, which is where the
    // exit transition runs to. `data-open` stays until it has finished.
    this._surface.removeAttribute('data-shown');
    this._status.textContent = '';
    this._alert.textContent = '';

    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._exitTimer = setTimeout(() => {
      // A message raised while this one was leaving has already taken the surface over.
      // Hiding it here would erase a message nobody ever saw.
      if (this._current) {
        return;
      }

      this._surface.removeAttribute('data-open');

      try {
        this._surface.hidePopover?.();
      } catch {
        // Not open; nothing to close.
      }

      this._pump();
    }, reduced ? 0 : EXIT_MS);

    this.dispatchEvent(
      new CustomEvent('snackbar-dismiss', {
        detail: { id: item.id, reason, severity: item.severity },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _resumeTimer() {
    if (this._remaining === null || !this._current) {
      return;
    }

    clearTimeout(this._timer);
    this._startedAt = performance.now();
    this._timer = setTimeout(() => this._close('timeout'), this._remaining);
  }

  _pauseTimer() {
    if (this._remaining === null || !this._timer) {
      return;
    }

    clearTimeout(this._timer);
    this._timer = null;
    // Charge only the time already spent, so hovering does not hand back a full window.
    this._remaining = Math.max(0, this._remaining - (performance.now() - this._startedAt));
  }

  _clearTimers() {
    clearTimeout(this._timer);
    clearTimeout(this._exitTimer);
    // A message dismissed inside the announcement gap would otherwise have its text
    // written into a region that was just emptied, and left there.
    clearTimeout(this._announceTimer);
    this._timer = null;
    this._remaining = null;
  }

  _handleFocusOut(event) {
    // Moving between the action and the close button is still inside the surface.
    if (this._surface.contains(event.relatedTarget)) {
      return;
    }

    this._resumeTimer();
  }

  _handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this._close('dismiss');
    }
  }

  _handleVisibility() {
    // A message that expires while the tab is in the background was never delivered.
    if (document.hidden) {
      this._pauseTimer();
    } else if (!this._surface.matches(':hover') && !this._surface.contains(document.activeElement)) {
      this._resumeTimer();
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-snackbar')) {
  customElements.define('ui-snackbar', UiSnackbar);
}
