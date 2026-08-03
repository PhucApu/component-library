import {
  buildOptionModel,
  filterOptions,
  findUnknownValues,
  groupOptions,
  highlightSegments,
  nextActiveIndex,
  normalizeMode,
  parseValue,
  serializeValue,
} from './autocomplete-core.js';

const LABEL_PACK = Object.freeze({
  clear: 'Clear',
  toggle: 'Show suggestions',
  loading: 'Loading suggestions',
  noResults: 'No match',
  empty: 'No suggestions available',
  invalidValue: 'The current value is invalid or unavailable.',
  remove: 'Remove {label}',
  resultCount: '{count} results',
  resultOne: '1 result',
  selected: 'Selected',
  unavailable: 'Unavailable',
});

const CLEAR_ICON = `
  <svg class="autocomplete__icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="m6 6 12 12M18 6 6 18"></path>
  </svg>
`;

const CHEVRON_ICON = `
  <svg class="autocomplete__icon autocomplete__chevron" viewBox="0 0 24 24" aria-hidden="true">
    <path d="m6 9 6 6 6-6"></path>
  </svg>
`;

const THEME_PROPERTIES = Object.freeze([
  /* Copied first, and not a custom property. Every colour below is a `light-dark()` pair,
     and a pair is resolved by the colour scheme in force where it is *used*. The list is
     moved to the end of the body, so without carrying the host's scheme across it the
     portalled copy would answer to the document instead of to the field it belongs to. */
  'color-scheme',
  '--autocomplete-surface',
  '--autocomplete-surface-subtle',
  '--autocomplete-text',
  '--autocomplete-muted',
  '--autocomplete-border',
  '--autocomplete-border-strong',
  '--autocomplete-accent',
  '--autocomplete-focus',
  '--autocomplete-danger',
  '--autocomplete-chip',
  '--autocomplete-mark',
  '--autocomplete-mark-text',
  '--autocomplete-scrollbar-track',
  '--autocomplete-scrollbar-thumb',
  '--autocomplete-radius',
  '--autocomplete-shadow',
]);

let autocompleteId = 0;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Renders a label with the matched run marked.
 *
 * Every segment is escaped before any markup is added, so an option label containing
 * angle brackets is shown as text instead of being parsed.
 */
function renderLabel(label, query) {
  return highlightSegments(label, query)
    .map(({ match, text }) =>
      match ? `<mark class="autocomplete__mark">${escapeHtml(text)}</mark>` : escapeHtml(text),
    )
    .join('');
}

export class UiAutocomplete extends HTMLElement {
  static get observedAttributes() {
    return [
      'mode',
      'value',
      'free-text',
      'disabled',
      'readonly',
      'placeholder',
      'loading',
      'error',
      'min-chars',
      'max-tags',
      'aria-label',
    ];
  }

  constructor() {
    super();
    autocompleteId += 1;
    this._instanceId = this.id || `ui-autocomplete-${autocompleteId}`;
    this._connected = false;
    this._declaredOptions = [];
    this._optionsOverride = null;
    this._selected = [];
    this._query = '';
    this._open = false;
    this._activeIndex = null;
    this._invalid = false;
    this._labelOverrides = {};

    this._handleDocumentPointerDown = this._handleDocumentPointerDown.bind(this);
    this._handleViewportScroll = this._handleViewportScroll.bind(this);
    this._positionList = this._positionList.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._readDeclaredOptions();
    this._renderStructure();
    this._connected = true;
    this._syncSelectionFromValue();
    this._renderField();
  }

  disconnectedCallback() {
    this._closeList();
    document.removeEventListener('pointerdown', this._handleDocumentPointerDown, true);
    window.removeEventListener('resize', this._positionList);
    window.removeEventListener('scroll', this._handleViewportScroll, true);
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._connected || oldValue === newValue) {
      return;
    }

    if (name === 'value' || name === 'mode' || name === 'free-text') {
      this._syncSelectionFromValue();
    }

    this._renderField();

    if (this._open) {
      this._renderListbox();
      this._positionList();
    }
  }

  get mode() {
    return normalizeMode(this.getAttribute('mode'));
  }

  set mode(value) {
    this.setAttribute('mode', normalizeMode(value));
  }

  get value() {
    return this.getAttribute('value') ?? '';
  }

  set value(next) {
    this.setAttribute('value', String(next ?? ''));
  }

  get freeText() {
    return this.hasAttribute('free-text');
  }

  set freeText(next) {
    this.toggleAttribute('free-text', Boolean(next));
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  set disabled(next) {
    this.toggleAttribute('disabled', Boolean(next));
  }

  get readOnly() {
    return this.hasAttribute('readonly');
  }

  set readOnly(next) {
    this.toggleAttribute('readonly', Boolean(next));
  }

  get loading() {
    return this.hasAttribute('loading');
  }

  set loading(next) {
    this.toggleAttribute('loading', Boolean(next));
  }

  get options() {
    return this._optionsOverride ?? this._declaredOptions;
  }

  set options(next) {
    this._optionsOverride = Array.isArray(next) ? buildOptionModel(next) : null;

    if (this._connected) {
      this._syncSelectionFromValue();
      this._renderField();

      if (this._open) {
        this._renderListbox();
        this._positionList();
      }
    }
  }

  get labels() {
    return { ...LABEL_PACK, ...this._labelOverrides };
  }

  set labels(next) {
    this._labelOverrides = next && typeof next === 'object' ? { ...next } : {};

    if (this._connected) {
      this._renderField();
    }
  }

  get selectedOptions() {
    const byValue = new Map(this.options.map((option) => [option.value, option]));
    return this._selected.map(
      (value) => byValue.get(value) ?? { value, label: value, group: '', disabled: false },
    );
  }

  open() {
    this._openList();
  }

  close() {
    this._closeList();
  }

  /**
   * Reads declarative options once, before the element replaces its own markup.
   *
   * `option` and `optgroup` are the primitives HTML already has for this, so a consumer
   * can declare a list statically and see it in the source rather than only in script.
   */
  _readDeclaredOptions() {
    const collected = [];

    for (const element of this.querySelectorAll('option')) {
      const group = element.closest('optgroup')?.getAttribute('label') ?? '';
      collected.push({
        value: element.getAttribute('value') ?? element.textContent.trim(),
        label: element.getAttribute('label') ?? element.textContent.trim(),
        group,
        disabled: element.hasAttribute('disabled'),
      });
    }

    this._declaredOptions = buildOptionModel(collected);
  }

  _renderStructure() {
    const listboxId = `${this._instanceId}-listbox`;
    const statusId = `${this._instanceId}-status`;
    const validationId = `${this._instanceId}-validation`;

    this.innerHTML = `
      <div class="autocomplete__root" data-part="root">
        <div class="autocomplete__field" data-part="field">
          <div class="autocomplete__entry" data-part="entry">
            <ul class="autocomplete__chips" data-part="chips"></ul>
            <input
              class="autocomplete__input"
              data-part="input"
              type="text"
              role="combobox"
              autocomplete="off"
              aria-autocomplete="list"
              aria-expanded="false"
              aria-controls="${escapeHtml(listboxId)}"
              aria-describedby="${escapeHtml(statusId)} ${escapeHtml(validationId)}"
            />
          </div>
          <div class="autocomplete__actions">
            <button
              class="autocomplete__button"
              data-action="clear"
              type="button"
              tabindex="-1"
            >${CLEAR_ICON}</button>
            <button
              class="autocomplete__button"
              data-action="toggle"
              type="button"
              tabindex="-1"
            >${CHEVRON_ICON}</button>
          </div>
        </div>
        <span
          class="autocomplete__sr-only"
          id="${escapeHtml(statusId)}"
          data-part="status"
          role="status"
          aria-live="polite"
        ></span>
        <span
          class="autocomplete__sr-only"
          id="${escapeHtml(validationId)}"
          data-part="validation"
        ></span>
        <div
          class="autocomplete__listbox"
          id="${escapeHtml(listboxId)}"
          data-part="listbox"
          role="listbox"
          popover="manual"
        ></div>
      </div>
    `;

    this._root = this.querySelector('[data-part="root"]');
    this._field = this.querySelector('[data-part="field"]');
    this._chips = this.querySelector('[data-part="chips"]');
    this._input = this.querySelector('[data-part="input"]');
    this._status = this.querySelector('[data-part="status"]');
    this._validation = this.querySelector('[data-part="validation"]');
    this._listbox = this.querySelector('[data-part="listbox"]');
    this._supportsPopover = typeof this._listbox.showPopover === 'function';

    if (!this._supportsPopover) {
      this._listbox.removeAttribute('popover');
      this._listbox.hidden = true;
    }

    // The input is created once and never replaced. Re-rendering it would drop focus
    // and the caret on every keystroke.
    this._input.addEventListener('input', () => this._handleInput());
    this._input.addEventListener('keydown', (event) => this._handleKeydown(event));
    this._input.addEventListener('focus', () => this._field.classList.add('is-focused'));
    this._input.addEventListener('blur', () => this._field.classList.remove('is-focused'));
    this._field.addEventListener('click', (event) => this._handleFieldClick(event));
    this._listbox.addEventListener('click', (event) => this._handleListClick(event));
    this._listbox.addEventListener('pointerdown', (event) => event.preventDefault());
  }

  _syncSelectionFromValue() {
    const parsed = parseValue(this.mode, this.value);
    const unknown = findUnknownValues(parsed.values, this.options, {
      freeText: this.freeText,
    });

    this._selected = parsed.values;
    this._invalid = !parsed.valid || unknown.length > 0;
  }

  _renderField() {
    const labels = this.labels;
    const multiple = this.mode === 'multiple';
    const interactive = !this.disabled && !this.readOnly;

    this.dataset.mode = this.mode;
    this._root.dataset.mode = this.mode;
    this._field.classList.toggle('is-disabled', this.disabled);
    this._field.classList.toggle('is-readonly', this.readOnly);
    this._field.classList.toggle('is-invalid', this._invalid);

    this._input.disabled = this.disabled;
    this._input.readOnly = this.readOnly;
    this._input.placeholder = this.getAttribute('placeholder') ?? '';
    this._input.toggleAttribute('aria-invalid', this._invalid);

    const ariaLabel = this.getAttribute('aria-label');
    if (ariaLabel) {
      this._input.setAttribute('aria-label', ariaLabel);
    } else {
      this._input.removeAttribute('aria-label');
    }

    this._validation.textContent = this._invalid ? labels.invalidValue : '';

    if (multiple) {
      this._renderChips();
      this._input.value = this._query;
    } else {
      this._chips.replaceChildren();
      const [selectedOption] = this.selectedOptions;
      this._input.value = this._open ? this._query : (selectedOption?.label ?? '');
    }

    this._chips.hidden = !multiple || this._selected.length === 0;

    const clearButton = this._field.querySelector('[data-action="clear"]');
    const toggleButton = this._field.querySelector('[data-action="toggle"]');
    const hasValue = this._selected.length > 0 || this._query.length > 0;

    clearButton.hidden = !hasValue || !interactive;
    clearButton.setAttribute('aria-label', labels.clear);
    toggleButton.hidden = !interactive;
    toggleButton.setAttribute('aria-label', labels.toggle);
  }

  _renderChips() {
    const labels = this.labels;

    this._chips.replaceChildren(
      ...this.selectedOptions.map((option) => {
        const item = document.createElement('li');
        item.className = 'autocomplete__chip';

        const text = document.createElement('span');
        text.className = 'autocomplete__chip-label';
        text.textContent = option.label;

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'autocomplete__chip-remove';
        remove.dataset.removeValue = option.value;
        remove.setAttribute('aria-label', labels.remove.replace('{label}', option.label));
        remove.innerHTML = CLEAR_ICON;
        remove.disabled = this.disabled || this.readOnly;

        item.append(text, remove);
        return item;
      }),
    );
  }

  _visibleOptions() {
    return filterOptions(this.options, this._query);
  }

  _renderListbox() {
    const labels = this.labels;
    const options = this._visibleOptions();
    const selected = new Set(this._selected);

    if (!options.some((option) => option.index === this._activeIndex && !option.disabled)) {
      this._activeIndex = nextActiveIndex(options, -1, 1);
    }

    if (this.loading) {
      this._listbox.innerHTML = `<p class="autocomplete__message">${escapeHtml(labels.loading)}</p>`;
      this._announce(labels.loading);
      this._input.removeAttribute('aria-activedescendant');
      return;
    }

    const errorMessage = this.getAttribute('error');
    if (errorMessage) {
      this._listbox.innerHTML = `<p class="autocomplete__message autocomplete__message--error" role="alert">${escapeHtml(
        errorMessage,
      )}</p>`;
      this._input.removeAttribute('aria-activedescendant');
      return;
    }

    if (!options.length) {
      const message = this.options.length ? labels.noResults : labels.empty;
      this._listbox.innerHTML = `<p class="autocomplete__message">${escapeHtml(message)}</p>`;
      this._announce(message);
      this._input.removeAttribute('aria-activedescendant');
      return;
    }

    this._listbox.innerHTML = groupOptions(options)
      .map((section) => {
        const rows = section.options
          .map((option) => {
            const isSelected = selected.has(option.value);
            const isActive = option.index === this._activeIndex;
            const state = isSelected
              ? option.disabled
                ? `${labels.selected}, ${labels.unavailable.toLowerCase()}`
                : labels.selected
              : option.disabled
                ? labels.unavailable
                : '';

            return `
              <button
                class="autocomplete__option${isActive ? ' is-active' : ''}${
                  isSelected ? ' is-selected' : ''
                }"
                id="${escapeHtml(`${this._instanceId}-option-${option.index}`)}"
                type="button"
                role="option"
                data-option-value="${escapeHtml(option.value)}"
                aria-selected="${String(isSelected)}"
                aria-disabled="${String(option.disabled)}"
                ${option.disabled ? 'disabled' : ''}
              >
                <span class="autocomplete__option-label">${renderLabel(option.label, this._query)}</span>
                ${
                  isSelected
                    ? '<span class="autocomplete__check" aria-hidden="true">&#10003;</span>'
                    : ''
                }
                <span class="autocomplete__sr-only">${escapeHtml(state)}</span>
              </button>
            `;
          })
          .join('');

        if (!section.label) {
          return rows;
        }

        return `
          <div class="autocomplete__group" role="group" aria-label="${escapeHtml(section.label)}">
            <p class="autocomplete__group-label" aria-hidden="true">${escapeHtml(section.label)}</p>
            ${rows}
          </div>
        `;
      })
      .join('');

    this._announce(
      options.length === 1
        ? labels.resultOne
        : labels.resultCount.replace('{count}', String(options.length)),
    );
    this._syncActiveDescendant();
  }

  _syncActiveDescendant() {
    if (this._activeIndex === null) {
      this._input.removeAttribute('aria-activedescendant');
      return;
    }

    const id = `${this._instanceId}-option-${this._activeIndex}`;
    this._input.setAttribute('aria-activedescendant', id);
    this._listbox.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: 'nearest' });
  }

  _openList() {
    if (this._open || this.disabled || this.readOnly) {
      return;
    }

    this._open = true;
    this._input.setAttribute('aria-expanded', 'true');
    this._renderListbox();

    if (this._supportsPopover) {
      if (!this._listbox.matches(':popover-open')) {
        this._listbox.showPopover();
      }
    } else {
      const hostStyles = getComputedStyle(this);
      for (const property of THEME_PROPERTIES) {
        this._listbox.style.setProperty(property, hostStyles.getPropertyValue(property));
      }
      this._listbox.hidden = false;
      this._listbox.classList.add('is-open');
      document.body.append(this._listbox);
    }

    document.addEventListener('pointerdown', this._handleDocumentPointerDown, true);
    window.addEventListener('resize', this._positionList);
    window.addEventListener('scroll', this._handleViewportScroll, true);
    this._positionList();
  }

  _closeList() {
    if (!this._open) {
      return;
    }

    this._open = false;
    this._activeIndex = null;
    this._input.setAttribute('aria-expanded', 'false');
    this._input.removeAttribute('aria-activedescendant');
    document.removeEventListener('pointerdown', this._handleDocumentPointerDown, true);
    window.removeEventListener('resize', this._positionList);
    window.removeEventListener('scroll', this._handleViewportScroll, true);

    if (this._supportsPopover) {
      if (this._listbox.matches(':popover-open')) {
        this._listbox.hidePopover();
      }
    } else {
      this._listbox.hidden = true;
      this._listbox.classList.remove('is-open');
      this._root.append(this._listbox);
    }

    // A single-value field shows the committed label again once the query is abandoned.
    this._query = '';
    this._renderField();
  }

  _positionList() {
    if (!this._open) {
      return;
    }

    const viewportPadding = 12;
    const gap = 4;
    const maxHeight = 288;
    const minHeight = 96;
    const fieldRect = this._field.getBoundingClientRect();
    const availableBelow = window.innerHeight - fieldRect.bottom - gap - viewportPadding;
    const availableAbove = fieldRect.top - gap - viewportPadding;
    // Flip only when the space below cannot hold a usable list; flipping merely because
    // the preferred height does not fit would cover the field's own context.
    const placeAbove = availableBelow < minHeight && availableAbove > availableBelow;
    const available = Math.max(minHeight, placeAbove ? availableAbove : availableBelow);

    this._listbox.style.inlineSize = `${fieldRect.width}px`;
    this._listbox.style.maxBlockSize = `${Math.min(maxHeight, available)}px`;

    const height = this._listbox.offsetHeight;
    const top = placeAbove ? fieldRect.top - gap - height : fieldRect.bottom + gap;
    const left = Math.min(
      Math.max(viewportPadding, fieldRect.left),
      Math.max(viewportPadding, window.innerWidth - fieldRect.width - viewportPadding),
    );

    this._listbox.style.left = `${left}px`;
    this._listbox.style.top = `${Math.max(viewportPadding, top)}px`;
    this._listbox.dataset.placement = placeAbove ? 'top' : 'bottom';
  }

  _handleViewportScroll(event) {
    if (event.target instanceof Node && this._listbox.contains(event.target)) {
      return;
    }

    this._positionList();
  }

  _handleDocumentPointerDown(event) {
    if (this.contains(event.target) || this._listbox.contains(event.target)) {
      return;
    }

    this._closeList();
  }

  _handleFieldClick(event) {
    if (this.disabled || this.readOnly) {
      return;
    }

    const removeButton = event.target.closest('[data-remove-value]');
    if (removeButton) {
      this._commit(this._selected.filter((value) => value !== removeButton.dataset.removeValue));
      this._input.focus();
      return;
    }

    if (event.target.closest('[data-action="clear"]')) {
      this._query = '';
      this._commit([]);
      this._input.focus();
      return;
    }

    if (event.target.closest('[data-action="toggle"]')) {
      if (this._open) {
        this._closeList();
      } else {
        this._openList();
      }
      this._input.focus();
      return;
    }

    this._input.focus();
    this._openList();
  }

  _handleListClick(event) {
    const option = event.target.closest('[data-option-value]');

    if (option && !option.disabled) {
      this._selectValue(option.dataset.optionValue);
    }
  }

  _handleInput() {
    this._query = this._input.value;

    const minChars = Number(this.getAttribute('min-chars') ?? 0);
    if (Number.isFinite(minChars) && minChars > 0 && this._query.length < minChars) {
      this._closeList();
      return;
    }

    if (!this._open) {
      this._openList();
      return;
    }

    this._renderListbox();
    this._positionList();
    this._renderField();
  }

  _handleKeydown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();

      if (!this._open) {
        this._openList();
        return;
      }

      this._activeIndex = nextActiveIndex(
        this._visibleOptions(),
        this._activeIndex ?? -1,
        event.key === 'ArrowDown' ? 1 : -1,
      );
      this._renderListbox();
      return;
    }

    if ((event.key === 'Home' || event.key === 'End') && this._open) {
      event.preventDefault();
      this._activeIndex = nextActiveIndex(
        this._visibleOptions(),
        this._activeIndex ?? -1,
        event.key === 'Home' ? 'first' : 'last',
      );
      this._renderListbox();
      return;
    }

    if (event.key === 'Enter') {
      if (this._open && this._activeIndex !== null) {
        event.preventDefault();
        const option = this._visibleOptions().find((item) => item.index === this._activeIndex);
        if (option) {
          this._selectValue(option.value);
        }
        return;
      }

      if (this.freeText && this._query.trim().length) {
        event.preventDefault();
        this._selectValue(this._query.trim(), { freeText: true });
      }
      return;
    }

    if (event.key === 'Escape' && this._open) {
      event.preventDefault();
      event.stopPropagation();
      this._closeList();
      return;
    }

    if (event.key === 'Tab' && this._open) {
      this._closeList();
      return;
    }

    if (
      event.key === 'Backspace' &&
      this.mode === 'multiple' &&
      this._input.value.length === 0 &&
      this._selected.length
    ) {
      event.preventDefault();
      this._commit(this._selected.slice(0, -1));
    }
  }

  _selectValue(value, { freeText = false } = {}) {
    if (this.disabled || this.readOnly) {
      return;
    }

    if (!freeText) {
      const option = this.options.find((candidate) => candidate.value === value);
      if (!option || option.disabled) {
        return;
      }
    }

    if (this.mode === 'multiple') {
      const next = this._selected.includes(value)
        ? this._selected.filter((entry) => entry !== value)
        : [...this._selected, value];
      this._query = '';
      this._input.value = '';
      this._commit(next);
      this._renderListbox();
      this._positionList();
      return;
    }

    this._commit([value]);
    this._closeList();
    this._input.focus();
  }

  _commit(values) {
    const next = serializeValue(this.mode, values);
    this._selected = values;
    this._renderField();

    this.dispatchEvent(
      new CustomEvent('autocomplete-change', {
        detail: { value: next, mode: this.mode, selected: [...values] },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _announce(message) {
    if (!this._status) {
      return;
    }

    this._status.textContent = message;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-autocomplete')) {
  customElements.define('ui-autocomplete', UiAutocomplete);
}
