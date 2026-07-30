import {
  buildGroupName,
  buildOptionModel,
  checkedValue,
  isSelectable,
  normalizeAppearance,
  normalizeLayout,
  normalizeSize,
  resolveSelection,
} from './radio-group-core.js';

let radioGroupId = 0;

/**
 * Enhances a native radio group instead of replacing it.
 *
 * HTML already implements single selection, arrow-key movement, roving focus, and form
 * submission for radio inputs sharing a name. Rebuilding that with ARIA would be more
 * code and a worse result, so this element never rewrites its own markup: it assigns the
 * shared name, mirrors the chosen value, and reports changes. Everything the user does
 * is handled by the browser, which is also why the group keeps working with no script.
 */
export class UiRadioGroup extends HTMLElement {
  static get observedAttributes() {
    return ['value', 'name', 'layout', 'appearance', 'size', 'disabled', 'error'];
  }

  constructor() {
    super();
    radioGroupId += 1;
    this._instanceId = this.id || `ui-radio-group-${radioGroupId}`;
    this._connected = false;
    this._invalid = false;
    this._handleChange = this._handleChange.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this.addEventListener('change', this._handleChange);
    this._ensureDescription();
    this._sync();
  }

  disconnectedCallback() {
    this.removeEventListener('change', this._handleChange);
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._connected || oldValue === newValue) {
      return;
    }

    if (name === 'error') {
      this._ensureDescription();
    }

    this._sync();
  }

  get inputs() {
    return [...this.querySelectorAll('input[type="radio"]')];
  }

  get options() {
    return buildOptionModel(
      this.inputs.map((input) => ({
        value: input.getAttribute('value') ?? '',
        label: input.closest('label')?.textContent.trim() ?? '',
        disabled: input.disabled,
      })),
    );
  }

  get value() {
    return this.getAttribute('value') ?? '';
  }

  set value(next) {
    this.setAttribute('value', String(next ?? ''));
  }

  get name() {
    return buildGroupName(this._instanceId, this.getAttribute('name'));
  }

  set name(next) {
    this.setAttribute('name', String(next ?? ''));
  }

  get layout() {
    return normalizeLayout(this.getAttribute('layout'));
  }

  get appearance() {
    return normalizeAppearance(this.getAttribute('appearance'));
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

  get valid() {
    return !this._invalid;
  }

  /**
   * Keeps a single element for the error message and ties the fieldset to it. Created
   * once and reused: recreating it would break the reference held by aria-describedby.
   */
  _ensureDescription() {
    const message = this.getAttribute('error') ?? '';
    const fieldset = this.querySelector('fieldset');

    if (!this._description) {
      this._description = document.createElement('p');
      this._description.className = 'radio-group__error';
      this._description.id = `${this._instanceId}-error`;
      this._description.setAttribute('role', 'alert');
    }

    this._description.textContent = message;

    if (!message) {
      this._description.remove();
      fieldset?.removeAttribute('aria-describedby');
      return;
    }

    if (fieldset && !fieldset.contains(this._description)) {
      fieldset.append(this._description);
      fieldset.setAttribute('aria-describedby', this._description.id);
    }
  }

  _sync() {
    const options = this.options;
    const selection = resolveSelection(options, this.value);
    this._invalid = !selection.valid || this.hasAttribute('error');

    this.dataset.layout = this.layout;
    this.dataset.appearance = this.appearance;
    this.dataset.size = this.size;
    this.toggleAttribute('data-invalid', this._invalid);

    const groupName = this.name;

    for (const input of this.inputs) {
      // Radios only act as one group when they share a name, so fill in any that the
      // author left off rather than letting them behave as separate groups.
      if (input.getAttribute('name') !== groupName) {
        input.setAttribute('name', groupName);
      }

      if (this.disabled) {
        input.disabled = true;
      }

      const shouldCheck = input.getAttribute('value') === selection.value;
      if (input.checked !== shouldCheck) {
        input.checked = shouldCheck;
      }

      input.toggleAttribute('aria-invalid', this._invalid);
      input.closest('label')?.classList.toggle('is-checked', shouldCheck);
      input.closest('label')?.classList.toggle('is-disabled', input.disabled);
    }
  }

  _handleChange(event) {
    const input = event.target;

    if (!(input instanceof HTMLInputElement) || input.type !== 'radio') {
      return;
    }

    const next = input.getAttribute('value') ?? '';

    // The browser has already moved the selection. Following the platform rather than
    // reverting it keeps the control honest; a consumer that wants to veto simply
    // assigns value back in this handler.
    if (this.value !== next) {
      this.setAttribute('value', next);
    } else {
      this._sync();
    }

    this.dispatchEvent(
      new CustomEvent('radio-group-change', {
        detail: { value: next, name: this.name },
        bubbles: true,
        composed: true,
      }),
    );
  }

  select(value) {
    if (!isSelectable(this.options, value)) {
      return false;
    }

    this.value = value;
    return true;
  }

  get checkedValue() {
    return checkedValue(
      this.options,
      this.inputs.filter((input) => input.checked).map((input) => input.getAttribute('value')),
    );
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-radio-group')) {
  customElements.define('ui-radio-group', UiRadioGroup);
}
