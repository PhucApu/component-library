import {
  DEFAULT_LABELS,
  errorMessage,
  normalizePlacement,
  normalizeSize,
  pendingMessage,
  shouldBlockToggle,
} from './switch-core.js';

let switchId = 0;

/**
 * Turns a native checkbox into a switch without replacing it.
 *
 * The track and the thumb are drawn in CSS on the checkbox itself, so the control renders
 * and toggles with no script at all. This element only adds what CSS cannot: the `switch`
 * role, the description wiring, and the pending state around an asynchronous commit.
 */
export class UiSwitch extends HTMLElement {
  static get observedAttributes() {
    return ['size', 'placement', 'pending'];
  }

  constructor() {
    super();
    switchId += 1;
    this._instanceId = this.id || `ui-switch-${switchId}`;
    this._connected = false;
    this._commit = null;
    this._commitToken = 0;
    this._lastAnnouncement = '';
    this._labelOverrides = {};

    this._handleClick = this._handleClick.bind(this);
    this._handleChange = this._handleChange.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    // Capture, so a blocked toggle is cancelled before the checkbox acts on it. The same
    // listener catches a click on the label, whose default action is to forward
    // activation to the control.
    this.addEventListener('click', this._handleClick, true);
    this.addEventListener('change', this._handleChange);
    this._sync();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._handleClick, true);
    this.removeEventListener('change', this._handleChange);
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this._connected && oldValue !== newValue) {
      this._sync();
    }
  }

  get control() {
    return this.querySelector('input[type="checkbox"]');
  }

  get labelElement() {
    return this.querySelector('label');
  }

  get size() {
    return normalizeSize(this.getAttribute('size'));
  }

  get placement() {
    return normalizePlacement(this.getAttribute('placement'));
  }

  get checked() {
    return this.control?.checked ?? false;
  }

  set checked(next) {
    const control = this.control;

    if (control) {
      control.checked = Boolean(next);
      this._sync();
    }
  }

  get pending() {
    return this.hasAttribute('pending');
  }

  set pending(next) {
    this.toggleAttribute('pending', Boolean(next));
  }

  /**
   * An async handler run when the person toggles. Resolving keeps the new state;
   * rejecting returns the switch to where it was and reports the failure.
   */
  get commit() {
    return this._commit;
  }

  set commit(next) {
    this._commit = typeof next === 'function' ? next : null;
  }

  get labels() {
    return { ...DEFAULT_LABELS, ...this._labelOverrides };
  }

  set labels(next) {
    this._labelOverrides = next && typeof next === 'object' ? { ...next } : {};
  }

  get labelText() {
    return this.labelElement?.textContent?.trim() ?? '';
  }

  _ensureLabelAssociation() {
    const control = this.control;
    const label = this.labelElement;

    if (!control) {
      return;
    }

    if (!control.id) {
      control.id = `${this._instanceId}-control`;
    }

    if (label && !label.getAttribute('for')) {
      label.setAttribute('for', control.id);
    }

    const description = this.querySelector('.switch__description');

    if (description) {
      if (!description.id) {
        description.id = `${this._instanceId}-description`;
      }

      // Supporting text describes the switch; it does not rename it. Folding it into the
      // label would make the accessible name a paragraph long.
      control.setAttribute('aria-describedby', description.id);
    } else {
      control.removeAttribute('aria-describedby');
    }
  }

  /** A live region has to be in the document before it can announce anything. */
  _ensureStatusRegion() {
    if (!this._status) {
      this._status = document.createElement('span');
      this._status.className = 'switch__sr-only';
      this._status.setAttribute('role', 'status');
    }

    if (this._status.parentElement !== this) {
      this.append(this._status);
    }
  }

  _ensureSpinner(pending) {
    if (!pending) {
      this._spinner?.remove();
      this._spinner = null;
      return;
    }

    if (!this._spinner) {
      this._spinner = document.createElement('span');
      this._spinner.className = 'switch__spinner';
      // The status region carries the meaning; this is only a visual echo of it.
      this._spinner.setAttribute('aria-hidden', 'true');
    }

    if (this._spinner.parentElement !== this) {
      this.append(this._spinner);
    }
  }

  _announce(message) {
    if (message === this._lastAnnouncement) {
      return;
    }

    this._lastAnnouncement = message;

    if (this._status) {
      this._status.textContent = message;
    }
  }

  _sync() {
    const control = this.control;

    this.dataset.size = this.size;
    this.dataset.placement = this.placement;

    if (!control) {
      return;
    }

    // A native checkbox carrying `role="switch"` exposes its own checked state, so
    // `aria-checked` is never written here. A second copy of that state would only give
    // it somewhere to go stale.
    control.setAttribute('role', 'switch');
    control.classList.add('switch__control');

    this._ensureLabelAssociation();
    this._ensureStatusRegion();

    const pending = this.pending;
    this._ensureSpinner(pending);

    if (pending) {
      control.setAttribute('aria-disabled', 'true');
    } else {
      control.removeAttribute('aria-disabled');
    }

    this.toggleAttribute('data-checked', control.checked);
    this.toggleAttribute('data-disabled', this._isDisabled());
  }

  /**
   * `control.disabled` only reflects the attribute on the input itself. An input inside a
   * disabled `fieldset` reports `false` there while the browser still refuses to operate
   * it, so the pseudo-class is the only reading that covers both.
   */
  _isDisabled() {
    return this.control?.matches(':disabled') ?? false;
  }

  _handleClick(event) {
    const control = this.control;

    if (!control) {
      return;
    }

    if (shouldBlockToggle({ pending: this.pending, disabled: this._isDisabled() })) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  _handleChange(event) {
    if (event.target !== this.control) {
      return;
    }

    this._sync();

    if (this._commit) {
      this._runCommit(this.control.checked);
    }
  }

  async _runCommit(desired) {
    const token = (this._commitToken += 1);
    const control = this.control;

    this.pending = true;
    this._announce(pendingMessage({ checked: desired, label: this.labelText, labels: this.labels }));
    this.dispatchEvent(
      new CustomEvent('switch-pending', {
        detail: { pending: true, checked: desired },
        bubbles: true,
        composed: true,
      }),
    );

    try {
      await this._commit(desired);

      if (token !== this._commitToken) {
        return;
      }

      this._announce('');
    } catch (reason) {
      if (token !== this._commitToken) {
        return;
      }

      // Assigning `checked` does not fire `change`, so putting the switch back cannot
      // re-enter this method.
      control.checked = !desired;
      this._announce(
        errorMessage({ checked: desired, label: this.labelText, labels: this.labels }),
      );
      this.dispatchEvent(
        new CustomEvent('switch-error', {
          detail: { reason, checked: !desired, requested: desired },
          bubbles: true,
          composed: true,
        }),
      );
    } finally {
      if (token === this._commitToken) {
        // Removing the attribute runs `_sync` through `attributeChangedCallback`.
        this.pending = false;
        this.dispatchEvent(
          new CustomEvent('switch-pending', {
            detail: { pending: false, checked: this.checked },
            bubbles: true,
            composed: true,
          }),
        );
      }
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-switch')) {
  customElements.define('ui-switch', UiSwitch);
}
