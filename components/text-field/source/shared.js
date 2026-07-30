import {
  counterAnnouncement,
  counterState,
  describedBy,
  normalizeAppearance,
  normalizeSize,
  resolveErrorMessage,
  revealLabel,
  shouldShowError,
} from './text-field-core.js';

const LABEL_PACK = Object.freeze({
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  charactersLeft: '{count} characters left',
  limitReached: 'Character limit reached',
});

const EYE_ICON = `
  <svg class="text-field__icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
`;

const EYE_OFF_ICON = `
  <svg class="text-field__icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2 12s3.5-6 10-6c2 0 3.7.6 5.1 1.4M22 12s-3.5 6-10 6c-2 0-3.7-.6-5.1-1.4"></path>
    <path d="m3 3 18 18"></path>
  </svg>
`;

let textFieldId = 0;

/**
 * Frames a native text input rather than replacing it.
 *
 * Typing, selection, input methods, autofill, undo, form submission, the right mobile
 * keyboard, and constraint validation all come from `input` and `textarea`. Rebuilding
 * any of that would be a downgrade, so this element adds the frame, wires the hint and
 * error text, and decides when an error is worth showing.
 */
export class UiTextField extends HTMLElement {
  static get observedAttributes() {
    return ['appearance', 'size', 'error', 'counter', 'reveal'];
  }

  constructor() {
    super();
    textFieldId += 1;
    this._instanceId = this.id || `ui-text-field-${textFieldId}`;
    this._connected = false;
    this._touched = false;
    this._revealed = false;
    this._lastAnnouncement = '';
    this._labelOverrides = {};

    this._handleBlur = this._handleBlur.bind(this);
    this._handleInvalid = this._handleInvalid.bind(this);
    this._handleInput = this._handleInput.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this.addEventListener('blur', this._handleBlur, true);
    this.addEventListener('invalid', this._handleInvalid, true);
    this.addEventListener('input', this._handleInput);
    this._sync();
  }

  disconnectedCallback() {
    this.removeEventListener('blur', this._handleBlur, true);
    this.removeEventListener('invalid', this._handleInvalid, true);
    this.removeEventListener('input', this._handleInput);
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this._connected && oldValue !== newValue) {
      this._sync();
    }
  }

  get control() {
    return this.querySelector('input, textarea');
  }

  get labelElement() {
    return this.querySelector('label');
  }

  get appearance() {
    return normalizeAppearance(this.getAttribute('appearance'));
  }

  get size() {
    return normalizeSize(this.getAttribute('size'));
  }

  get value() {
    return this.control?.value ?? '';
  }

  set value(next) {
    const control = this.control;

    if (control) {
      control.value = String(next ?? '');
      this._sync();
    }
  }

  get valid() {
    // `validity.valid` reads the state; `checkValidity()` also fires an `invalid` event,
    // which this element listens for, so calling it here would recurse forever.
    return this.control?.validity.valid ?? true;
  }

  get validationMessage() {
    return this.control?.validationMessage ?? '';
  }

  get labels() {
    return { ...LABEL_PACK, ...this._labelOverrides };
  }

  set labels(next) {
    this._labelOverrides = next && typeof next === 'object' ? { ...next } : {};

    if (this._connected) {
      this._sync();
    }
  }

  /** Forces the error into view, which is what a form needs on submit. */
  validate() {
    this._touched = true;
    this._sync();
    return this.valid;
  }

  reset() {
    this._touched = false;
    this._lastAnnouncement = '';
    this._sync();
  }

  /**
   * Links the label to the control. Authors are asked to write `for` and `id` so the
   * pairing survives with no script; this only fills a gap left behind.
   */
  _ensureLabelAssociation() {
    const control = this.control;
    const label = this.labelElement;

    if (!control || !label) {
      return;
    }

    if (!control.id) {
      control.id = `${this._instanceId}-control`;
    }

    if (!label.getAttribute('for')) {
      label.setAttribute('for', control.id);
    }

    label.classList.add('text-field__label');
    this.querySelector('.text-field__hint')?.setAttribute(
      'id',
      `${this._instanceId}-hint`,
    );
  }

  _ensureErrorElement(message) {
    if (!this._error) {
      this._error = document.createElement('p');
      this._error.className = 'text-field__error';
      this._error.id = `${this._instanceId}-error`;
      this._error.setAttribute('role', 'alert');
    }

    this._error.textContent = message;

    if (!message) {
      this._error.remove();
      return null;
    }

    if (this._error.parentElement !== this) {
      this.append(this._error);
    }

    return this._error.id;
  }

  _ensureRevealButton() {
    const control = this.control;
    const wants = this.hasAttribute('reveal') && control?.tagName === 'INPUT';

    if (!wants) {
      this._revealButton?.remove();
      this._revealButton = null;
      return;
    }

    if (!this._revealButton) {
      this._revealButton = document.createElement('button');
      this._revealButton.type = 'button';
      this._revealButton.className = 'text-field__reveal';
      this._revealButton.addEventListener('click', () => {
        this._revealed = !this._revealed;
        this._sync();
        this.control?.focus();
      });
    }

    const frame = this.querySelector('.text-field__control');

    if (frame && this._revealButton.parentElement !== frame) {
      frame.append(this._revealButton);
    }

    const nextType = this._revealed ? 'text' : 'password';
    if (control.type !== nextType) {
      control.type = nextType;
    }

    // Only redraw the icon when it actually changes. Rewriting innerHTML on every sync
    // destroys the path the pointer pressed down on, and a click whose mousedown target
    // no longer exists never reaches this button at all.
    const state = String(this._revealed);
    if (this._revealButton.dataset.state !== state) {
      this._revealButton.dataset.state = state;
      this._revealButton.innerHTML = this._revealed ? EYE_OFF_ICON : EYE_ICON;
    }

    this._revealButton.setAttribute('aria-label', revealLabel(this.labels, this._revealed));
    this._revealButton.disabled = control.disabled;
  }

  _ensureCounter(control) {
    const maxLength = Number(control.getAttribute('maxlength'));
    const wants = this.hasAttribute('counter') && Number.isFinite(maxLength) && maxLength > 0;

    if (!wants) {
      this._counter?.remove();
      this._counter = null;
      this._counterLive?.remove();
      this._counterLive = null;
      return;
    }

    if (!this._counter) {
      this._counter = document.createElement('span');
      this._counter.className = 'text-field__counter';
      // Decorative: the same number lives in the live region below, announced only when
      // it starts to matter. A live counter would read out on every keystroke.
      this._counter.setAttribute('aria-hidden', 'true');

      this._counterLive = document.createElement('span');
      this._counterLive.className = 'text-field__sr-only';
      this._counterLive.setAttribute('aria-live', 'polite');
    }

    if (this._counter.parentElement !== this) {
      this.append(this._counter, this._counterLive);
    }

    const state = counterState(control.value.length, maxLength);
    this._counter.textContent = state.text;
    this._counter.classList.toggle('is-near-limit', state.nearLimit);

    const announcement = counterAnnouncement(state, this.labels);
    if (announcement !== this._lastAnnouncement) {
      this._lastAnnouncement = announcement;
      this._counterLive.textContent = announcement;
    }
  }

  _sync() {
    const control = this.control;

    this.dataset.appearance = this.appearance;
    this.dataset.size = this.size;

    if (!control) {
      return;
    }

    this._ensureLabelAssociation();
    this._ensureRevealButton();
    this._ensureCounter(control);

    control.classList.add('text-field__input');

    const valid = control.validity.valid;
    const showError = shouldShowError({ touched: this._touched, valid });
    const message = showError
      ? resolveErrorMessage({
          valid,
          customMessage: this.getAttribute('error'),
          validationMessage: control.validationMessage,
        })
      : '';

    const errorId = this._ensureErrorElement(message);
    const hintId = this.querySelector('.text-field__hint')?.id ?? '';
    const description = describedBy(hintId, errorId);

    if (description) {
      control.setAttribute('aria-describedby', description);
    } else {
      control.removeAttribute('aria-describedby');
    }

    // Only after the person has interacted. Announcing an error on an untouched empty
    // field would tell a screen reader user they made a mistake before they started.
    control.toggleAttribute('aria-invalid', showError);
    this.toggleAttribute('data-invalid', showError);
    this.toggleAttribute('data-disabled', control.disabled);
    this.toggleAttribute('data-readonly', control.readOnly);
  }

  _markTouched() {
    if (this._touched) {
      return false;
    }

    this._touched = true;
    return true;
  }

  _handleBlur() {
    this._markTouched();
    this._sync();
    this._emitValidity();
  }

  _handleInvalid() {
    this._markTouched();
    this._sync();
  }

  _handleInput() {
    // Re-check while typing only once the field has already reported a problem, so an
    // error can clear as it is fixed without appearing mid-word the first time.
    this._sync();
  }

  _emitValidity() {
    this.dispatchEvent(
      new CustomEvent('text-field-validity', {
        detail: { valid: this.valid, message: this.validationMessage },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-text-field')) {
  customElements.define('ui-text-field', UiTextField);
}
