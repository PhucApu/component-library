import {
  buildRemoveLabel,
  disableStrategyFor,
  isRemovalKey,
  normalizeAppearance,
  normalizeIntent,
  normalizeSelected,
  normalizeSize,
  readLabelText,
} from './chip-core.js';

const LABEL_PACK = Object.freeze({
  remove: 'Remove {label}',
});

const REMOVE_ICON = `
  <svg class="chip__icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="m6 6 12 12M18 6 6 18"></path>
  </svg>
`;

let chipId = 0;

/**
 * Styles a chip without deciding what it is.
 *
 * A chip can be a label, a button, a link, or a toggle, and those are different controls
 * that only look alike. The author writes the element that matches the behavior and this
 * element adds the shell, the remove button, and the events. Nothing here rewrites the
 * author's markup, so a chip is never a button pretending to be a span.
 */
export class UiChip extends HTMLElement {
  static get observedAttributes() {
    return ['appearance', 'intent', 'size', 'disabled', 'removable', 'selected'];
  }

  constructor() {
    super();
    chipId += 1;
    this._instanceId = this.id || `ui-chip-${chipId}`;
    this._connected = false;
    this._labelOverrides = {};
    this._handleClick = this._handleClick.bind(this);
    this._handleKeydown = this._handleKeydown.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this.addEventListener('click', this._handleClick);
    this.addEventListener('keydown', this._handleKeydown);
    this._sync();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._handleClick);
    this.removeEventListener('keydown', this._handleKeydown);
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this._connected && oldValue !== newValue) {
      this._sync();
    }
  }

  get appearance() {
    return normalizeAppearance(this.getAttribute('appearance'));
  }

  get intent() {
    return normalizeIntent(this.getAttribute('intent'));
  }

  get size() {
    return normalizeSize(this.getAttribute('size'));
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  set disabled(next) {
    this.toggleAttribute('disabled', Boolean(next));
  }

  get removable() {
    return this.hasAttribute('removable');
  }

  set removable(next) {
    this.toggleAttribute('removable', Boolean(next));
  }

  get selected() {
    return normalizeSelected(this.getAttribute('selected'));
  }

  set selected(next) {
    this.toggleAttribute('selected', Boolean(next));
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

  /** The element the author wrote: the label, the button, or the link. */
  get control() {
    return this.querySelector(':scope > button, :scope > a, :scope > span, :scope > *:not(.chip__remove)');
  }

  get label() {
    const control = this.control;
    return readLabelText(control ? control.textContent : this.textContent);
  }

  _ensureRemoveButton() {
    if (!this.removable) {
      this._removeButton?.remove();
      this._removeButton = null;
      return;
    }

    if (!this._removeButton) {
      this._removeButton = document.createElement('button');
      this._removeButton.type = 'button';
      this._removeButton.className = 'chip__remove';
      this._removeButton.innerHTML = REMOVE_ICON;
    }

    // Appended as a sibling of the author's element, never inside it. A button nested in
    // a button or a link is invalid markup and assistive technology treats it
    // unpredictably, so a chip that both acts and removes is two adjacent controls.
    if (this._removeButton.parentElement !== this) {
      this.append(this._removeButton);
    }

    this._removeButton.setAttribute(
      'aria-label',
      buildRemoveLabel(this.labels.remove, this.label),
    );
    this._removeButton.disabled = this.disabled;
  }

  _sync() {
    this.dataset.appearance = this.appearance;
    this.dataset.intent = this.intent;
    this.dataset.size = this.size;
    this.toggleAttribute('data-selected', this.selected);

    this._ensureRemoveButton();

    const control = this.control;

    if (!control) {
      return;
    }

    control.classList.add('chip__control');

    if (control.hasAttribute('aria-pressed')) {
      control.setAttribute('aria-pressed', String(this.selected));
    }

    const strategy = disableStrategyFor(control.tagName);

    if (strategy === 'native') {
      control.disabled = this.disabled;
      return;
    }

    if (strategy !== 'emulated') {
      return;
    }

    // An anchor ignores `disabled`, so a link chip that only looked disabled would still
    // navigate. Removing href takes it out of the tab order and stops activation.
    if (this.disabled) {
      if (control.hasAttribute('href')) {
        control.dataset.chipHref = control.getAttribute('href');
        control.removeAttribute('href');
      }
      control.setAttribute('aria-disabled', 'true');
    } else {
      if (control.dataset.chipHref !== undefined) {
        control.setAttribute('href', control.dataset.chipHref);
        delete control.dataset.chipHref;
      }
      control.removeAttribute('aria-disabled');
    }
  }

  _handleClick(event) {
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (this._removeButton && event.target.closest('.chip__remove')) {
      this._emitRemove();
      return;
    }

    const control = this.control;

    if (control?.hasAttribute('aria-pressed') && event.target.closest('.chip__control')) {
      this.selected = !this.selected;
      this.dispatchEvent(
        new CustomEvent('chip-toggle', {
          detail: { selected: this.selected, label: this.label },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  _handleKeydown(event) {
    if (!this.removable || this.disabled || !isRemovalKey(event.key)) {
      return;
    }

    // Only while focus is inside this chip, so the key still edits text elsewhere.
    if (!this.contains(document.activeElement)) {
      return;
    }

    event.preventDefault();
    this._emitRemove();
  }

  _emitRemove() {
    this.dispatchEvent(
      new CustomEvent('chip-remove', {
        detail: { label: this.label },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-chip')) {
  customElements.define('ui-chip', UiChip);
}
