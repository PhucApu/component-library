import {
  addDays,
  addMonths,
  addYears,
  buildCalendarGrid,
  buildMinuteOptions,
  compareTemporalParts,
  dayOfWeek,
  daysInMonth,
  isValidDateParts,
  isValidTemporalParts,
  isWithinRange,
  normalizeMinuteStep,
  normalizeMode,
  pad,
  parseTemporalValue,
  serializeTemporalValue,
  validateTemporalContract,
} from './temporal-picker-core.js';

const LABEL_PACKS = Object.freeze({
  en: {
    apply: 'Apply',
    clear: 'Clear',
    close: 'Close',
    currentDate: 'Today',
    currentMonth: 'Current month',
    currentTime: 'Current time',
    currentYear: 'Current year',
    dialog: 'Choose a temporal value',
    hour: 'Hour',
    invalidConfig: 'The minimum and maximum configuration is invalid.',
    invalidValue: 'The current value is invalid or outside the allowed range.',
    minute: 'Minute',
    noTimeResults: 'No match',
    nextMonth: 'Next month',
    nextYear: 'Next year',
    nextYearGroup: 'Next group of years',
    previousMonth: 'Previous month',
    previousYear: 'Previous year',
    previousYearGroup: 'Previous group of years',
    selectHour: 'Select hour',
    selectMinute: 'Select minute',
    selectSecond: 'Select second',
    selectMonth: 'Select month',
    selectYear: 'Select year',
    second: 'Second',
    selected: 'Selected',
    timeResult: '1 result',
    timeResultCount: '{count} results',
    triggerDate: 'Choose date',
    triggerDatetime: 'Choose date and time',
    triggerMonth: 'Choose month',
    triggerTime: 'Choose time',
    triggerYear: 'Choose year',
    unavailable: 'Unavailable',
    valueChanged: 'Selected value',
    placeholders: {
      date: 'Choose a date',
      datetime: 'Choose date and time',
      month: 'Choose a month',
      time: 'Choose a time',
      year: 'Choose a year',
    },
  },
});

const TRIGGER_LABEL_KEYS = Object.freeze({
  date: 'triggerDate',
  datetime: 'triggerDatetime',
  month: 'triggerMonth',
  time: 'triggerTime',
  year: 'triggerYear',
});

const CALENDAR_ICON = `
  <svg class="temporal-picker__icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 2v4M16 2v4M3 10h18"></path>
    <rect x="3" y="4" width="18" height="17" rx="2"></rect>
  </svg>
`;

const CLOCK_ICON = `
  <svg class="temporal-picker__icon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9"></circle>
    <path d="M12 7v5l3 2"></path>
  </svg>
`;

const CHEVRON_ICON = `
  <svg class="temporal-picker__chevron" viewBox="0 0 24 24" aria-hidden="true">
    <path d="m7 10 5 5 5-5"></path>
  </svg>
`;

const THEME_PROPERTIES = Object.freeze([
  '--temporal-surface',
  '--temporal-surface-subtle',
  '--temporal-text',
  '--temporal-muted',
  '--temporal-border',
  '--temporal-accent',
  '--temporal-accent-strong',
  '--temporal-focus',
  '--temporal-danger',
  '--temporal-current',
  '--temporal-scrollbar-track',
  '--temporal-scrollbar-thumb',
  '--temporal-scrollbar-thumb-hover',
  '--temporal-radius',
  '--temporal-shadow',
]);

let temporalPickerId = 0;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toDisplayDate(parts) {
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(parts.year, (parts.month ?? 1) - 1, parts.day ?? 1);
  return date;
}

function formatTemporalDisplay(mode, parts, locale) {
  if (!parts) {
    return '';
  }

  if (mode === 'year') {
    return String(parts.year).padStart(4, '0');
  }

  if (mode === 'time') {
    return `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
  }

  const date = toDisplayDate(parts);

  if (mode === 'month') {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  const formattedDate = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);

  return mode === 'datetime'
    ? `${formattedDate} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`
    : formattedDate;
}

function formatMonthName(year, month, locale, includeYear = false) {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    ...(includeYear ? { year: 'numeric' } : {}),
  }).format(toDisplayDate({ year, month, day: 1 }));
}

function formatFullDate(parts, locale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
  }).format(toDisplayDate(parts));
}

function getWeekdayLabels(locale, weekStartsOn) {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const sunday = new Date(2024, 0, 7, 12);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + ((weekStartsOn + index) % 7));
    return formatter.format(date);
  });
}

function sameDate(left, right) {
  return Boolean(
    left &&
      right &&
      left.year === right.year &&
      left.month === right.month &&
      left.day === right.day,
  );
}

function getLocalNow() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
  };
}

export class TemporalPicker extends HTMLElement {
  static get observedAttributes() {
    return [
      'aria-label',
      'current-indicator',
      'disabled',
      'locale',
      'max',
      'min',
      'minute-step',
      'mode',
      'placeholder',
      'placement',
      'value',
      'week-starts-on',
    ];
  }

  constructor() {
    super();
    temporalPickerId += 1;
    this._instanceId = this.id || `temporal-picker-${temporalPickerId}`;
    this._connected = false;
    this._activeTimePart = null;
    this._activeTimeValue = null;
    this._draft = null;
    this._focusedDate = null;
    this._labelOverrides = {};
    this._open = false;
    this._selectedParts = null;
    this._timeOptionsOpen = false;
    this._timeQuery = null;
    this._seededTimeQuery = false;
    this._view = 'day';
    this._viewMonth = 1;
    this._viewYear = 1;

    this._handleDocumentPointerDown = this._handleDocumentPointerDown.bind(this);
    this._handleViewportScroll = this._handleViewportScroll.bind(this);
    this._positionPanel = this._positionPanel.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._renderStructure();
    this._connected = true;
    this._syncDraftFromValue();
    this._renderTrigger();
  }

  disconnectedCallback() {
    this._hideTimeOptions();
    document.removeEventListener('pointerdown', this._handleDocumentPointerDown, true);
    window.removeEventListener('resize', this._positionPanel);
    window.removeEventListener('scroll', this._handleViewportScroll, true);
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._connected || oldValue === newValue) {
      return;
    }

    this._syncDraftFromValue();
    this._renderTrigger();

    if (this._open) {
      this._renderPanel();
      requestAnimationFrame(this._positionPanel);
    }
  }

  get mode() {
    return normalizeMode(this.getAttribute('mode') || 'date');
  }

  set mode(value) {
    this.setAttribute('mode', normalizeMode(value));
  }

  get value() {
    return this.getAttribute('value') || '';
  }

  set value(value) {
    this.setAttribute('value', value == null ? '' : String(value));
  }

  get min() {
    return this.getAttribute('min') || '';
  }

  set min(value) {
    this.setAttribute('min', value == null ? '' : String(value));
  }

  get max() {
    return this.getAttribute('max') || '';
  }

  set max(value) {
    this.setAttribute('max', value == null ? '' : String(value));
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  set disabled(value) {
    this.toggleAttribute('disabled', Boolean(value));
  }

  get minuteStep() {
    return normalizeMinuteStep(this.getAttribute('minute-step') || 1);
  }

  set minuteStep(value) {
    this.setAttribute('minute-step', String(value));
  }

  get currentIndicator() {
    return this.getAttribute('current-indicator') === 'off' ? 'off' : 'auto';
  }

  set currentIndicator(value) {
    this.setAttribute('current-indicator', value === 'off' ? 'off' : 'auto');
  }

  get weekStartsOn() {
    return this._getWeekStartsOn();
  }

  set weekStartsOn(value) {
    if (value == null || value === '') {
      this.removeAttribute('week-starts-on');
    } else {
      this.setAttribute('week-starts-on', String(value));
    }
  }

  get locale() {
    return (
      this.getAttribute('locale') ||
      document.documentElement.lang ||
      navigator.language ||
      'en-US'
    );
  }

  set locale(value) {
    this.setAttribute('locale', value || 'en-US');
  }

  get placement() {
    const placement = this.getAttribute('placement');
    return ['auto', 'bottom', 'top'].includes(placement) ? placement : 'auto';
  }

  set placement(value) {
    this.setAttribute('placement', ['bottom', 'top'].includes(value) ? value : 'auto');
  }

  get placeholder() {
    return this.getAttribute('placeholder') || '';
  }

  set placeholder(value) {
    if (value == null || value === '') {
      this.removeAttribute('placeholder');
    } else {
      this.setAttribute('placeholder', String(value));
    }
  }

  get labels() {
    return { ...this._labelOverrides };
  }

  set labels(value) {
    this._labelOverrides =
      value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};

    if (this._connected) {
      this._renderTrigger();
      if (this._open) {
        this._renderPanel();
      }
    }
  }

  open() {
    this._openPanel();
  }

  close({ restoreFocus = false } = {}) {
    this._closePanel({ restoreFocus });
  }

  _renderStructure() {
    const panelId = `${this._instanceId}-panel`;
    const validationId = `${this._instanceId}-validation`;
    const listboxId = `${this._instanceId}-time-options`;
    const statusId = `${this._instanceId}-time-status`;

    this.innerHTML = `
      <div class="temporal-picker__root" data-part="root">
        <button
          class="temporal-picker__trigger"
          type="button"
          data-part="trigger"
          aria-expanded="false"
          aria-haspopup="dialog"
          aria-controls="${escapeHtml(panelId)}"
        >
          <span data-part="trigger-icon"></span>
          <span class="temporal-picker__trigger-value" data-part="trigger-value"></span>
          ${CHEVRON_ICON}
        </button>
        <span
          class="temporal-picker__sr-only"
          id="${escapeHtml(validationId)}"
          data-part="validation"
        ></span>
        <div
          class="temporal-picker__panel"
          id="${escapeHtml(panelId)}"
          data-part="panel"
          role="dialog"
          popover="manual"
        >
          <div class="temporal-picker__sr-only" aria-live="polite" data-part="live"></div>
          <div data-part="panel-content"></div>
        </div>
        <div
          class="temporal-picker__time-options"
          data-part="time-options"
          popover="manual"
        >
          <div
            class="temporal-picker__time-status temporal-picker__sr-only"
            id="${escapeHtml(statusId)}"
            role="status"
            aria-live="polite"
          ></div>
          <div
            class="temporal-picker__time-listbox"
            id="${escapeHtml(listboxId)}"
            data-part="time-listbox"
            role="listbox"
          ></div>
        </div>
      </div>
    `;

    this._root = this.querySelector('[data-part="root"]');
    this._trigger = this.querySelector('[data-part="trigger"]');
    this._triggerIcon = this.querySelector('[data-part="trigger-icon"]');
    this._triggerValue = this.querySelector('[data-part="trigger-value"]');
    this._validation = this.querySelector('[data-part="validation"]');
    this._panel = this.querySelector('[data-part="panel"]');
    this._panelContent = this.querySelector('[data-part="panel-content"]');
    this._live = this.querySelector('[data-part="live"]');
    this._timeOptions = this.querySelector('[data-part="time-options"]');
    this._timeStatus = this.querySelector('[data-part="time-options"] [role="status"]');
    this._timeListbox = this.querySelector('[data-part="time-listbox"]');
    this._supportsPopover = typeof this._panel.showPopover === 'function';

    if (!this._supportsPopover) {
      this._panel.removeAttribute('popover');
      this._panel.hidden = true;
      this._timeOptions.removeAttribute('popover');
      this._timeOptions.hidden = true;
    }

    this._trigger.addEventListener('click', () => {
      if (this._open) {
        this._closePanel({ restoreFocus: true });
      } else {
        this._openPanel();
      }
    });
    this._panel.addEventListener('click', (event) => this._handlePanelClick(event));
    this._panel.addEventListener('input', (event) => this._handlePanelInput(event));
    this._panel.addEventListener('keydown', (event) => this._handlePanelKeydown(event));
    // The dropdown renders in the top layer outside the panel, so it needs its own
    // delegation. Pointer focus stays on the combobox input that owns the listbox.
    this._timeOptions.addEventListener('click', (event) => this._handlePanelClick(event));
    this._timeOptions.addEventListener('pointerdown', (event) => event.preventDefault());
  }

  _getLabels() {
    const pack = LABEL_PACKS.en;
    return {
      ...pack,
      ...this._labelOverrides,
      placeholders: {
        ...pack.placeholders,
        ...(this._labelOverrides.placeholders || {}),
      },
    };
  }

  _getWeekStartsOn() {
    const configured = Number(this.getAttribute('week-starts-on'));
    if (
      this.hasAttribute('week-starts-on') &&
      Number.isInteger(configured) &&
      configured >= 0 &&
      configured <= 6
    ) {
      return configured;
    }

    try {
      const locale = new Intl.Locale(this.locale);
      const weekInfo = locale.weekInfo || locale.getWeekInfo?.();
      if (weekInfo?.firstDay) {
        return weekInfo.firstDay === 7 ? 0 : weekInfo.firstDay;
      }
    } catch {
      // The deterministic language fallback below covers invalid or unsupported locales.
    }

    return 0;
  }

  _getContractState() {
    return validateTemporalContract(this.mode, {
      value: this.value,
      min: this.min,
      max: this.max,
    });
  }

  _syncDraftFromValue() {
    this._activeTimePart = null;
    this._activeTimeValue = null;
    this._timeQuery = null;
    this._seededTimeQuery = false;
    this._contractState = this._getContractState();
    this._selectedParts = this._contractState.valueParts
      ? { ...this._contractState.valueParts }
      : null;

    const now = getLocalNow();
    this._viewYear = this._selectedParts?.year ?? now.year;
    this._viewMonth = this._selectedParts?.month ?? now.month;

    if (this.mode === 'year') {
      this._view = 'year';
      this._draft = this._selectedParts ? { ...this._selectedParts } : { year: null };
    } else if (this.mode === 'month') {
      this._view = 'month';
      this._draft = this._selectedParts
        ? { ...this._selectedParts }
        : { year: null, month: null };
    } else if (this.mode === 'time') {
      this._view = 'time';
      this._draft = this._selectedParts
        ? { ...this._selectedParts }
        : { hour: null, minute: null, second: null };
    } else if (this.mode === 'datetime') {
      this._view = 'day';
      this._draft = this._selectedParts
        ? { ...this._selectedParts }
        : {
            year: null,
            month: null,
            day: null,
            hour: null,
            minute: null,
            second: null,
          };
    } else {
      this._view = 'day';
      this._draft = this._selectedParts
        ? { ...this._selectedParts }
        : { year: null, month: null, day: null };
    }

    if (['date', 'datetime'].includes(this.mode)) {
      const preferred = this._selectedParts
        ? {
            year: this._selectedParts.year,
            month: this._selectedParts.month,
            day: this._selectedParts.day,
          }
        : { year: now.year, month: now.month, day: now.day };
      this._focusedDate = this._getNearestEnabledDate(preferred);
    }
  }

  _renderTrigger() {
    this._contractState = this._getContractState();
    const labels = this._getLabels();
    const mode = this.mode;
    const validParts = this._contractState.valueValid
      ? this._contractState.valueParts
      : null;
    const placeholder =
      this.getAttribute('placeholder') || labels.placeholders[mode] || labels.dialog;
    const displayValue = validParts
      ? formatTemporalDisplay(mode, validParts, this.locale)
      : this.value || placeholder;
    const invalid =
      !this._contractState.configValid ||
      (this.value.length > 0 && !this._contractState.valueValid);
    const validationMessage = !this._contractState.configValid
      ? labels.invalidConfig
      : invalid
        ? labels.invalidValue
        : '';
    const accessiblePrefix =
      this.getAttribute('aria-label') || labels[TRIGGER_LABEL_KEYS[mode]] || labels.dialog;

    this.dataset.mode = mode;
    this._root.dataset.mode = mode;
    this._triggerValue.textContent = displayValue;
    this._triggerValue.dataset.empty = String(!this.value);
    this._triggerIcon.innerHTML = ['time'].includes(mode) ? CLOCK_ICON : CALENDAR_ICON;
    this._trigger.disabled = this.disabled;
    this._trigger.setAttribute('aria-expanded', String(this._open));
    this._trigger.setAttribute('aria-label', `${accessiblePrefix}: ${displayValue}`);
    this._trigger.toggleAttribute('aria-invalid', invalid);
    this._validation.textContent = validationMessage;

    if (invalid) {
      this._trigger.setAttribute('aria-describedby', this._validation.id);
    } else {
      this._trigger.removeAttribute('aria-describedby');
    }
  }

  _openPanel() {
    if (this.disabled || this._open) {
      return;
    }

    this._syncDraftFromValue();
    this._renderPanel();
    this._open = true;
    this._panel.style.visibility = 'hidden';

    if (this._supportsPopover) {
      this._panel.showPopover();
    } else {
      const hostStyles = getComputedStyle(this);
      for (const property of THEME_PROPERTIES) {
        this._panel.style.setProperty(property, hostStyles.getPropertyValue(property));
      }
      this._panel.hidden = false;
      this._panel.classList.add('is-open');
      document.body.append(this._panel);
    }

    this._renderTrigger();
    document.addEventListener('pointerdown', this._handleDocumentPointerDown, true);
    window.addEventListener('resize', this._positionPanel);
    window.addEventListener('scroll', this._handleViewportScroll, true);

    requestAnimationFrame(() => {
      this._positionPanel();
      this._panel.style.visibility = '';
      this._focusInitialPanelControl();
    });
  }

  _closePanel({ restoreFocus = false } = {}) {
    if (!this._open) {
      return;
    }

    this._open = false;
    this._activeTimePart = null;
    this._activeTimeValue = null;
    this._timeQuery = null;
    this._seededTimeQuery = false;
    this._hideTimeOptions();
    document.removeEventListener('pointerdown', this._handleDocumentPointerDown, true);
    window.removeEventListener('resize', this._positionPanel);
    window.removeEventListener('scroll', this._handleViewportScroll, true);

    if (this._supportsPopover) {
      if (this._panel.matches(':popover-open')) {
        this._panel.hidePopover();
      }
    } else {
      this._panel.hidden = true;
      this._panel.classList.remove('is-open');
      this._root.append(this._panel);
    }

    this._renderTrigger();

    if (restoreFocus) {
      this._trigger.focus();
    }
  }

  _handleDocumentPointerDown(event) {
    if (!this._open) {
      return;
    }

    const target = event.target;

    // The dropdown lives outside the panel, so a click inside the panel is still
    // "outside" as far as the dropdown is concerned. Another time input is exempt:
    // the click handler switches the dropdown over to it without a close/open flash.
    if (
      this._timeOptionsOpen &&
      !this._timeOptions.contains(target) &&
      !(target instanceof Element && target.closest('input[data-time-part]'))
    ) {
      this._dismissTimeListboxInPlace(
        this._panel.querySelector(
          `input[data-time-part="${this._activeTimePart}"]`,
        ),
      );
    }

    if (
      this.contains(target) ||
      this._panel.contains(target) ||
      this._timeOptions.contains(target)
    ) {
      return;
    }

    this._closePanel({ restoreFocus: false });
  }

  _handleViewportScroll(event) {
    const target = event.target;

    // Scrolling inside the dropdown must not move either surface.
    if (target instanceof Node && this._timeOptions?.contains(target)) {
      return;
    }

    // Scrolling the panel keeps the panel anchored to the trigger, but the dropdown
    // has to follow the input it is anchored to.
    if (target instanceof Node && this._panel?.contains(target)) {
      this._positionTimeOptions();
      return;
    }

    this._positionPanel();
  }

  _positionPanel() {
    if (!this._open) {
      return;
    }

    const viewportPadding = 12;
    const gap = 8;
    const triggerRect = this._trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const naturalHeight = this._panel.scrollHeight;
    const panelWidth = this._panel.offsetWidth;
    const availableBelow = viewportHeight - triggerRect.bottom - gap - viewportPadding;
    const availableAbove = triggerRect.top - gap - viewportPadding;
    const placeAbove =
      this.placement === 'top' ||
      (this.placement === 'auto' &&
        availableBelow < naturalHeight &&
        availableAbove > availableBelow);
    const availableHeight = Math.max(
      160,
      placeAbove ? availableAbove : availableBelow,
    );
    const panelHeight = Math.min(naturalHeight, availableHeight);
    const top = placeAbove
      ? Math.max(viewportPadding, triggerRect.top - gap - panelHeight)
      : Math.min(
          viewportHeight - viewportPadding - panelHeight,
          triggerRect.bottom + gap,
        );
    const left = Math.min(
      viewportWidth - viewportPadding - panelWidth,
      Math.max(viewportPadding, triggerRect.left),
    );

    this._panel.style.left = `${Math.max(viewportPadding, left)}px`;
    this._panel.style.top = `${Math.max(viewportPadding, top)}px`;
    this._panel.style.maxHeight = `${availableHeight}px`;
    this._panel.dataset.placement = placeAbove ? 'top' : 'bottom';
    this._positionTimeOptions();
  }

  _renderPanel() {
    this._contractState = this._getContractState();
    const labels = this._getLabels();
    this._panel.dataset.mode = this.mode;
    this._panel.setAttribute(
      'aria-label',
      this.getAttribute('aria-label') || labels[TRIGGER_LABEL_KEYS[this.mode]] || labels.dialog,
    );

    if (!this._contractState.configValid) {
      this._panelContent.innerHTML = `
        <div class="temporal-picker__error" role="alert">
          <strong>${escapeHtml(labels.invalidConfig)}</strong>
          <button class="temporal-picker__button" type="button" data-action="close">
            ${escapeHtml(labels.close)}
          </button>
        </div>
      `;
      this._announce(labels.invalidConfig);
      this._hideTimeOptions();
      return;
    }

    const valueNotice =
      this.value && !this._contractState.valueValid
        ? `<p class="temporal-picker__notice" role="status">${escapeHtml(
            labels.invalidValue,
          )}</p>`
        : '';
    let body;

    if (this._view === 'year') {
      body = this._renderYearView();
    } else if (this._view === 'month') {
      body = this._renderMonthView();
    } else if (this.mode === 'time') {
      body = this._renderTimeView();
    } else {
      body = this._renderDayView();
    }

    this._panelContent.innerHTML = `${valueNotice}${body}${this._renderActions()}`;
    this._syncTimeOptions();
  }

  _renderDayView() {
    const labels = this._getLabels();
    const weekStartsOn = this._getWeekStartsOn();
    const weekdayLabels = getWeekdayLabels(this.locale, weekStartsOn);
    const days = buildCalendarGrid(this._viewYear, this._viewMonth, weekStartsOn);
    const today = getLocalNow();
    const selected =
      this.mode === 'datetime' && isValidDateParts(this._draft)
        ? this._draft
        : this._selectedParts;

    if (
      !this._focusedDate ||
      !days.some((date) => sameDate(date, this._focusedDate) && this._isDateEnabled(date))
    ) {
      this._focusedDate =
        days.find((date) => sameDate(date, selected) && this._isDateEnabled(date)) ||
        days.find((date) => sameDate(date, today) && this._isDateEnabled(date)) ||
        days.find((date) => this._isDateEnabled(date)) ||
        null;
    }

    const dayCells = days
      .map((date) => {
        const value = serializeTemporalValue('date', date);
        const isSelected = sameDate(date, selected);
        const isCurrent =
          this.currentIndicator === 'auto' && sameDate(date, today);
        const disabled = !this._isDateEnabled(date);
        const tabbable = sameDate(date, this._focusedDate) && !disabled;
        const classes = [
          'temporal-picker__day',
          date.inCurrentMonth ? '' : 'is-outside',
          isSelected ? 'is-selected' : '',
          isCurrent ? 'is-current' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return `
          <div role="gridcell" class="temporal-picker__day-cell">
            <button
              class="${classes}"
              type="button"
              data-day="${value}"
              data-value="${value}"
              aria-label="${escapeHtml(
                `${formatFullDate(date, this.locale)}${
                  isCurrent ? `, ${labels.currentDate}` : ''
                }`,
              )}"
              aria-selected="${String(isSelected)}"
              ${isCurrent ? 'aria-current="date"' : ''}
              tabindex="${tabbable ? '0' : '-1'}"
              ${disabled ? 'disabled' : ''}
            >
              ${date.day}
            </button>
          </div>
        `;
      })
      .join('');

    const timeControls =
      this.mode === 'datetime'
        ? `<div class="temporal-picker__datetime-time">${this._renderTimeControls()}</div>`
        : '';
    const monthLabel = formatMonthName(
      this._viewYear,
      this._viewMonth,
      this.locale,
    );

    return `
      <div class="temporal-picker__calendar">
        <div class="temporal-picker__calendar-header">
          <button
            class="temporal-picker__icon-button"
            type="button"
            data-action="previous-month"
            aria-label="${escapeHtml(labels.previousMonth)}"
            ${this._canNavigateMonth(-1) ? '' : 'disabled'}
          >‹</button>
          <div class="temporal-picker__calendar-title">
            <button type="button" data-action="month-view">
              ${escapeHtml(monthLabel)}
            </button>
            <button type="button" data-action="year-view">
              ${String(this._viewYear).padStart(4, '0')}
            </button>
          </div>
          <button
            class="temporal-picker__icon-button"
            type="button"
            data-action="next-month"
            aria-label="${escapeHtml(labels.nextMonth)}"
            ${this._canNavigateMonth(1) ? '' : 'disabled'}
          >›</button>
        </div>
        <div class="temporal-picker__weekdays" aria-hidden="true">
          ${weekdayLabels
            .map((label) => `<span>${escapeHtml(label)}</span>`)
            .join('')}
        </div>
        <div
          class="temporal-picker__day-grid"
          role="grid"
          aria-label="${escapeHtml(monthLabel)}"
        >
          ${dayCells}
        </div>
        ${timeControls}
      </div>
    `;
  }

  _renderMonthView() {
    const labels = this._getLabels();
    const current = getLocalNow();
    const selected = this._selectedParts || this._draft;
    const months = Array.from({ length: 12 }, (_, index) => index + 1);
    const enabledMonths = months.filter((month) =>
      this._isMonthEnabled(this._viewYear, month),
    );
    const tabbableMonth =
      enabledMonths.find(
        (month) =>
          selected?.year === this._viewYear && selected?.month === month,
      ) ?? enabledMonths[0];

    return `
      <div class="temporal-picker__selection-view">
        <div class="temporal-picker__calendar-header">
          <button
            class="temporal-picker__icon-button"
            type="button"
            data-action="previous-year"
            aria-label="${escapeHtml(labels.previousYear)}"
            ${this._isYearEnabled(this._viewYear - 1) ? '' : 'disabled'}
          >‹</button>
          <button
            class="temporal-picker__view-title"
            type="button"
            data-action="year-view"
          >
            ${String(this._viewYear).padStart(4, '0')}
          </button>
          <button
            class="temporal-picker__icon-button"
            type="button"
            data-action="next-year"
            aria-label="${escapeHtml(labels.nextYear)}"
            ${this._isYearEnabled(this._viewYear + 1) ? '' : 'disabled'}
          >›</button>
        </div>
        <div
          class="temporal-picker__choice-grid"
          role="grid"
          aria-label="${escapeHtml(labels.selectMonth)}"
        >
          ${months
            .map((month) => {
              const enabled = this._isMonthEnabled(this._viewYear, month);
              const isSelected =
                selected?.year === this._viewYear && selected?.month === month;
              const isCurrent =
                this.currentIndicator === 'auto' &&
                current.year === this._viewYear &&
                current.month === month;
              const label = formatMonthName(
                this._viewYear,
                month,
                this.locale,
                true,
              );

              return `
                <div role="gridcell">
                  <button
                    class="temporal-picker__choice${isSelected ? ' is-selected' : ''}${
                      isCurrent ? ' is-current' : ''
                    }"
                    type="button"
                    data-month="${month}"
                    data-grid-kind="month"
                    aria-label="${escapeHtml(
                      `${label}${isCurrent ? `, ${labels.currentMonth}` : ''}`,
                    )}"
                    aria-selected="${String(isSelected)}"
                    ${isCurrent ? 'aria-current="true"' : ''}
                    tabindex="${enabled && month === tabbableMonth ? '0' : '-1'}"
                    ${enabled ? '' : 'disabled'}
                  >
                    ${escapeHtml(formatMonthName(this._viewYear, month, this.locale))}
                  </button>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  _renderYearView() {
    const labels = this._getLabels();
    const current = getLocalNow();
    const groupStart = Math.floor((this._viewYear - 1) / 12) * 12 + 1;
    const groupEnd = Math.min(9999, groupStart + 11);
    const years = Array.from(
      { length: groupEnd - groupStart + 1 },
      (_, index) => groupStart + index,
    );
    const selectedYear = this._selectedParts?.year ?? this._draft?.year;
    const enabledYears = years.filter((year) => this._isYearEnabled(year));
    const tabbableYear =
      enabledYears.find((year) => year === selectedYear) ??
      enabledYears.find((year) => year === this._viewYear) ??
      enabledYears[0];

    return `
      <div class="temporal-picker__selection-view">
        <div class="temporal-picker__calendar-header">
          <button
            class="temporal-picker__icon-button"
            type="button"
            data-action="previous-year-group"
            aria-label="${escapeHtml(labels.previousYearGroup)}"
            ${groupStart > 1 ? '' : 'disabled'}
          >‹</button>
          <span class="temporal-picker__view-title">
            ${String(groupStart).padStart(4, '0')}–${String(groupEnd).padStart(4, '0')}
          </span>
          <button
            class="temporal-picker__icon-button"
            type="button"
            data-action="next-year-group"
            aria-label="${escapeHtml(labels.nextYearGroup)}"
            ${groupEnd < 9999 ? '' : 'disabled'}
          >›</button>
        </div>
        <div
          class="temporal-picker__choice-grid"
          role="grid"
          aria-label="${escapeHtml(labels.selectYear)}"
        >
          ${years
            .map((year) => {
              const enabled = this._isYearEnabled(year);
              const isSelected = year === selectedYear;
              const isCurrent =
                this.currentIndicator === 'auto' && year === current.year;
              return `
                <div role="gridcell">
                  <button
                    class="temporal-picker__choice${isSelected ? ' is-selected' : ''}${
                      isCurrent ? ' is-current' : ''
                    }"
                    type="button"
                    data-year="${year}"
                    data-grid-kind="year"
                    aria-label="${escapeHtml(
                      `${String(year).padStart(4, '0')}${
                        isCurrent ? `, ${labels.currentYear}` : ''
                      }`,
                    )}"
                    aria-selected="${String(isSelected)}"
                    ${isCurrent ? 'aria-current="true"' : ''}
                    tabindex="${enabled && year === tabbableYear ? '0' : '-1'}"
                    ${enabled ? '' : 'disabled'}
                  >
                    ${String(year).padStart(4, '0')}
                  </button>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  _renderTimeView() {
    return `
      <div class="temporal-picker__time-view">
        ${this._renderTimeControls()}
      </div>
    `;
  }

  _getRawTimeValues(part) {
    if (part === 'hour') {
      return Array.from({ length: 24 }, (_, value) => value);
    }

    if (part === 'minute') {
      const controlledMinute = this._draft?.minute ?? this._selectedParts?.minute;
      return buildMinuteOptions(this.minuteStep, controlledMinute);
    }

    return Array.from({ length: 60 }, (_, value) => value);
  }

  _buildTimeCandidate(hour, minute, second) {
    const time = { hour, minute, second };

    if (this.mode === 'time') {
      return time;
    }

    if (
      this.mode === 'datetime' &&
      isValidDateParts({
        year: this._draft?.year,
        month: this._draft?.month,
        day: this._draft?.day,
      })
    ) {
      return {
        year: this._draft.year,
        month: this._draft.month,
        day: this._draft.day,
        ...time,
      };
    }

    return null;
  }

  _timeIntervalOverlaps(hour, minute, firstSecond = 0, lastSecond = 59) {
    const start = this._buildTimeCandidate(hour, minute, firstSecond);
    const end = this._buildTimeCandidate(hour, minute, lastSecond);

    if (!start || !end) {
      return true;
    }

    return this._intervalOverlaps(this.mode, start, end);
  }

  _isTimeOptionEnabled(part, value) {
    if (!this._contractState.configValid) {
      return false;
    }

    if (!this._contractState.minParts && !this._contractState.maxParts) {
      return true;
    }

    if (part === 'hour') {
      return this._getRawTimeValues('minute').some((minute) =>
        this._timeIntervalOverlaps(value, minute),
      );
    }

    if (part === 'minute') {
      if (Number.isInteger(this._draft?.hour)) {
        return this._timeIntervalOverlaps(this._draft.hour, value);
      }

      return this._getRawTimeValues('hour').some((hour) =>
        this._timeIntervalOverlaps(hour, value),
      );
    }

    if (
      Number.isInteger(this._draft?.hour) &&
      Number.isInteger(this._draft?.minute)
    ) {
      const candidate = this._buildTimeCandidate(
        this._draft.hour,
        this._draft.minute,
        value,
      );
      return candidate ? this._isCandidateWithinRange(candidate) : true;
    }

    return true;
  }

  _getTimeOptions(part) {
    return this._getRawTimeValues(part).map((value) => ({
      enabled: this._isTimeOptionEnabled(part, value),
      label: pad(value),
      value,
    }));
  }

  _getFilteredTimeOptions(part) {
    const query = this._timeQuery ?? '';
    return this._getTimeOptions(part).filter(({ label, value }) => {
      if (!query) {
        return true;
      }

      return label.startsWith(query) || String(value).startsWith(query);
    });
  }

  _getTimePartLabel(part, labels) {
    return {
      hour: labels.selectHour,
      minute: labels.selectMinute,
      second: labels.selectSecond,
    }[part];
  }

  _renderTimeField(part, labels) {
    const expanded = this._activeTimePart === part;
    const selectedValue = Number.isInteger(this._draft?.[part])
      ? this._draft[part]
      : null;
    const inputValue =
      expanded && this._timeQuery !== null
        ? this._timeQuery
        : selectedValue === null
          ? ''
          : pad(selectedValue);
    const listboxId = `${this._instanceId}-time-options`;
    const statusId = `${this._instanceId}-time-status`;
    const activeDescendant =
      expanded && Number.isInteger(this._activeTimeValue)
        ? `${this._instanceId}-${part}-${this._activeTimeValue}`
        : '';

    return `
      <label class="temporal-picker__field">
        <span>${escapeHtml(labels[part])}</span>
        <input
          class="temporal-picker__time-input"
          type="text"
          role="combobox"
          inputmode="numeric"
          autocomplete="off"
          maxlength="2"
          placeholder="--"
          value="${escapeHtml(inputValue)}"
          data-time-part="${part}"
          aria-label="${escapeHtml(this._getTimePartLabel(part, labels))}"
          aria-autocomplete="list"
          aria-expanded="${String(expanded)}"
          aria-controls="${escapeHtml(listboxId)}"
          aria-describedby="${escapeHtml(statusId)}"
          ${activeDescendant ? `aria-activedescendant="${escapeHtml(activeDescendant)}"` : ''}
        />
      </label>
    `;
  }

  _syncTimeOptions() {
    const part = this._activeTimePart;

    if (!part) {
      this._hideTimeOptions();
      return;
    }

    const labels = this._getLabels();
    const options = this._getFilteredTimeOptions(part);
    const enabledOptions = options.filter(({ enabled }) => enabled);
    const selectedValue = this._draft?.[part];

    if (!enabledOptions.some(({ value }) => value === this._activeTimeValue)) {
      this._activeTimeValue =
        enabledOptions.find(({ value }) => value === selectedValue)?.value ??
        enabledOptions[0]?.value ??
        null;
    }

    const status = options.length
      ? options.length === 1
        ? labels.timeResult
        : labels.timeResultCount.replace('{count}', String(options.length))
      : labels.noTimeResults;

    this._timeStatus.textContent = status;
    this._timeListbox.setAttribute(
      'aria-label',
      this._getTimePartLabel(part, labels),
    );
    this._timeListbox.innerHTML = options.length
      ? options
          .map(({ enabled, label, value }) => {
            const selected = value === selectedValue;
            const active = enabled && value === this._activeTimeValue;
            const stateLabel = selected
              ? enabled
                ? labels.selected
                : `${labels.selected}, ${labels.unavailable.toLowerCase()}`
              : enabled
                ? ''
                : labels.unavailable;

            return `
              <button
                class="temporal-picker__time-option${active ? ' is-active' : ''}${
                  selected ? ' is-selected' : ''
                }"
                id="${escapeHtml(`${this._instanceId}-${part}-${value}`)}"
                type="button"
                role="option"
                data-time-option="${part}"
                data-value="${value}"
                aria-selected="${String(selected)}"
                aria-disabled="${String(!enabled)}"
                ${enabled ? '' : 'disabled'}
              >
                <span class="temporal-picker__time-option-value">${label}</span>
                ${
                  selected
                    ? '<span class="temporal-picker__time-option-check" aria-hidden="true">&#10003;</span>'
                    : ''
                }
                <span class="temporal-picker__sr-only">${escapeHtml(stateLabel)}</span>
              </button>
            `;
          })
          .join('')
      : `<p class="temporal-picker__time-empty">${escapeHtml(
          labels.noTimeResults,
        )}</p>`;

    this._showTimeOptions();
  }

  _showTimeOptions() {
    if (!this._timeOptionsOpen) {
      this._timeOptionsOpen = true;

      if (this._supportsPopover) {
        if (!this._timeOptions.matches(':popover-open')) {
          this._timeOptions.showPopover();
        }
      } else {
        const hostStyles = getComputedStyle(this);
        for (const property of THEME_PROPERTIES) {
          this._timeOptions.style.setProperty(
            property,
            hostStyles.getPropertyValue(property),
          );
        }
        this._timeOptions.hidden = false;
        this._timeOptions.classList.add('is-open');
        document.body.append(this._timeOptions);
      }
    }

    this._positionTimeOptions();
  }

  _hideTimeOptions() {
    if (!this._timeOptionsOpen) {
      return;
    }

    this._timeOptionsOpen = false;

    if (this._supportsPopover) {
      if (this._timeOptions.matches(':popover-open')) {
        this._timeOptions.hidePopover();
      }
    } else {
      this._timeOptions.hidden = true;
      this._timeOptions.classList.remove('is-open');
      this._root.append(this._timeOptions);
    }
  }

  _positionTimeOptions() {
    if (!this._timeOptionsOpen || !this._activeTimePart) {
      return;
    }

    const input = this._panel.querySelector(
      `input[data-time-part="${this._activeTimePart}"]`,
    );

    if (!input) {
      return;
    }

    const viewportPadding = 12;
    const gap = 4;
    const maxListHeight = 168;
    const minListHeight = 96;
    const inputRect = input.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const availableBelow = viewportHeight - inputRect.bottom - gap - viewportPadding;
    const availableAbove = inputRect.top - gap - viewportPadding;
    // Flip only when the space below cannot hold a usable list. Flipping merely because
    // the ideal height does not fit would cover the calendar for no gain.
    const placeAbove =
      availableBelow < minListHeight && availableAbove > availableBelow;
    const available = Math.max(
      minListHeight,
      placeAbove ? availableAbove : availableBelow,
    );

    this._timeOptions.style.inlineSize = `${inputRect.width}px`;
    this._timeListbox.style.maxBlockSize = `${Math.min(maxListHeight, available)}px`;

    const height = this._timeOptions.offsetHeight;
    const top = placeAbove ? inputRect.top - gap - height : inputRect.bottom + gap;
    const left = Math.min(
      Math.max(viewportPadding, inputRect.left),
      Math.max(viewportPadding, viewportWidth - inputRect.width - viewportPadding),
    );

    this._timeOptions.style.left = `${left}px`;
    this._timeOptions.style.top = `${Math.max(viewportPadding, top)}px`;
    this._timeOptions.dataset.placement = placeAbove ? 'top' : 'bottom';
  }

  _renderTimeControls() {
    const labels = this._getLabels();

    return `
      <div class="temporal-picker__time-controls">
        ${this._renderTimeField('hour', labels)}
        <span class="temporal-picker__time-separator" aria-hidden="true">:</span>
        ${this._renderTimeField('minute', labels)}
        <span class="temporal-picker__time-separator" aria-hidden="true">:</span>
        ${this._renderTimeField('second', labels)}
      </div>
    `;
  }

  _renderActions() {
    const labels = this._getLabels();
    const currentLabel = {
      date: labels.currentDate,
      datetime: labels.currentDate,
      month: labels.currentMonth,
      time: labels.currentTime,
      year: labels.currentYear,
    }[this.mode];
    const needsApply = ['time', 'datetime'].includes(this.mode);

    return `
      <div class="temporal-picker__actions">
        <button
          class="temporal-picker__button"
          type="button"
          data-action="current"
          ${this._isCurrentEnabled() ? '' : 'disabled'}
        >
          ${escapeHtml(currentLabel)}
        </button>
        <span class="temporal-picker__actions-spacer"></span>
        <button
          class="temporal-picker__button"
          type="button"
          data-action="clear"
        >
          ${escapeHtml(labels.clear)}
        </button>
        ${
          needsApply
            ? `
              <button
                class="temporal-picker__button temporal-picker__button--primary"
                type="button"
                data-action="apply"
                ${this._canApply() ? '' : 'disabled'}
              >
                ${escapeHtml(labels.apply)}
              </button>
            `
            : ''
        }
      </div>
    `;
  }

  _openTimeCombobox(part) {
    if (!['hour', 'minute', 'second'].includes(part)) {
      return;
    }

    this._activeTimePart = part;
    const selectedValue = this._draft?.[part];

    // Open filtered to the value the field already holds, but only when that value is
    // still selectable. Seeding an out-of-range value would show a single disabled row
    // and hide every option the user can actually pick. The flag records that the query
    // was seeded rather than typed, so the first arrow key can drop it and give keyboard
    // users the full list back.
    const seedable =
      Number.isInteger(selectedValue) &&
      this._getTimeOptions(part).some(
        ({ enabled, value }) => value === selectedValue && enabled,
      );
    this._timeQuery = seedable ? pad(selectedValue) : null;
    this._seededTimeQuery = seedable;

    const options = this._getFilteredTimeOptions(part).filter(({ enabled }) => enabled);
    this._activeTimeValue =
      options.find(({ value }) => value === selectedValue)?.value ??
      options[0]?.value ??
      null;
    this._renderPanel();
    this._focusAfterRender(`input[data-time-part="${part}"]`, { select: true });
  }

  _revealFullTimeList(part) {
    if (!this._seededTimeQuery) {
      return false;
    }

    this._seededTimeQuery = false;
    this._timeQuery = null;
    this._renderPanel();
    this._focusAfterRender(`input[data-time-part="${part}"]`, { cursorToEnd: true });
    this._scrollActiveTimeOptionIntoView(part);
    return true;
  }

  _scrollActiveTimeOptionIntoView(part) {
    if (!Number.isInteger(this._activeTimeValue)) {
      return;
    }

    const optionId = `${this._instanceId}-${part}-${this._activeTimeValue}`;
    requestAnimationFrame(() => {
      this._timeListbox
        .querySelector(`#${CSS.escape(optionId)}`)
        ?.scrollIntoView({ block: 'center' });
    });
  }

  _selectTimeOption(part, value) {
    const option = this._getTimeOptions(part).find(
      (candidate) => candidate.value === value,
    );

    if (!option?.enabled) {
      return;
    }

    this._draft[part] = value;
    this._activeTimePart = null;
    this._activeTimeValue = null;
    this._timeQuery = null;
    this._seededTimeQuery = false;
    this._renderPanel();
    this._focusAfterRender(`input[data-time-part="${part}"]`);
  }

  _dismissTimeListboxInPlace(input) {
    const part = this._activeTimePart;
    this._activeTimePart = null;
    this._activeTimeValue = null;
    this._timeQuery = null;
    this._seededTimeQuery = false;

    for (const combobox of this._panel.querySelectorAll('input[data-time-part]')) {
      combobox.setAttribute('aria-expanded', 'false');
      combobox.removeAttribute('aria-activedescendant');
    }

    this._hideTimeOptions();

    if (part && input) {
      input.value = Number.isInteger(this._draft?.[part])
        ? pad(this._draft[part])
        : '';
    }
  }

  _closeTimeCombobox(part) {
    // Dismiss in place instead of re-rendering the panel. A re-render would detach the
    // focused input and leave focus on document.body until the next frame, so a second
    // Escape pressed straight after would never reach the panel.
    const input = this._panel.querySelector(`input[data-time-part="${part}"]`);
    this._dismissTimeListboxInPlace(input);
    input?.focus();
  }

  _moveTimeOption(part, direction) {
    // The first navigation key only lifts the seeded filter and holds the current
    // value, so the list appears before the caller starts stepping through it.
    if (this._revealFullTimeList(part)) {
      return;
    }

    const options = this._getFilteredTimeOptions(part).filter(({ enabled }) => enabled);
    if (!options.length) {
      return;
    }

    const currentIndex = options.findIndex(
      ({ value }) => value === this._activeTimeValue,
    );
    let nextIndex;

    if (direction === 'first') {
      nextIndex = 0;
    } else if (direction === 'last') {
      nextIndex = options.length - 1;
    } else {
      const baseIndex = currentIndex < 0 ? 0 : currentIndex;
      nextIndex = Math.min(
        options.length - 1,
        Math.max(0, baseIndex + direction),
      );
    }

    this._activeTimeValue = options[nextIndex].value;
    this._renderPanel();
    this._focusAfterRender(`input[data-time-part="${part}"]`, {
      cursorToEnd: true,
    });

    requestAnimationFrame(() => {
      this._timeListbox
        .querySelector(`#${CSS.escape(`${this._instanceId}-${part}-${this._activeTimeValue}`)}`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  }

  _handleTimeInputKeydown(event, input) {
    const part = input.dataset.timePart;

    if (event.key === 'Tab') {
      if (this._activeTimePart) {
        this._dismissTimeListboxInPlace(input);
      }
      return;
    }

    if (event.key === 'Escape' && this._activeTimePart === part) {
      event.preventDefault();
      event.stopPropagation();
      this._closeTimeCombobox(part);
      return;
    }

    if (
      ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) &&
      this._activeTimePart !== part
    ) {
      event.preventDefault();
      this._openTimeCombobox(part);
      return;
    }

    if (this._activeTimePart !== part) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this._moveTimeOption(part, 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this._moveTimeOption(part, -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this._moveTimeOption(part, 'first');
    } else if (event.key === 'End') {
      event.preventDefault();
      this._moveTimeOption(part, 'last');
    } else if (event.key === 'Enter' && Number.isInteger(this._activeTimeValue)) {
      event.preventDefault();
      this._selectTimeOption(part, this._activeTimeValue);
    }
  }

  _handlePanelClick(event) {
    const timeInput = event.target.closest('input[data-time-part]');
    if (timeInput) {
      this._openTimeCombobox(timeInput.dataset.timePart);
      return;
    }

    const timeOption = event.target.closest('[data-time-option]');
    if (timeOption && !timeOption.disabled) {
      this._selectTimeOption(
        timeOption.dataset.timeOption,
        Number(timeOption.dataset.value),
      );
      return;
    }

    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      this._handleAction(actionButton.dataset.action);
      return;
    }

    const dayButton = event.target.closest('[data-day]');
    if (dayButton && !dayButton.disabled) {
      const date = parseTemporalValue('date', dayButton.dataset.day);
      if (date) {
        this._selectDate(date);
      }
      return;
    }

    const monthButton = event.target.closest('[data-month]');
    if (monthButton && !monthButton.disabled) {
      this._selectMonth(Number(monthButton.dataset.month));
      return;
    }

    const yearButton = event.target.closest('[data-year]');
    if (yearButton && !yearButton.disabled) {
      this._selectYear(Number(yearButton.dataset.year));
    }
  }

  _handleAction(action) {
    const labels = this._getLabels();

    switch (action) {
      case 'close':
        this._closePanel({ restoreFocus: true });
        break;
      case 'previous-month':
      case 'next-month': {
        const next = addMonths(
          { year: this._viewYear, month: this._viewMonth, day: 1 },
          action === 'previous-month' ? -1 : 1,
        );
        this._viewYear = next.year;
        this._viewMonth = next.month;
        this._focusedDate = this._getNearestEnabledDate(next);
        this._renderPanel();
        this._announce(formatMonthName(next.year, next.month, this.locale, true));
        this._focusAfterRender(`[data-day="${serializeTemporalValue('date', this._focusedDate)}"]`);
        break;
      }
      case 'previous-year':
      case 'next-year':
        this._viewYear += action === 'previous-year' ? -1 : 1;
        this._renderPanel();
        this._announce(String(this._viewYear).padStart(4, '0'));
        this._focusAfterRender('[data-grid-kind="month"][tabindex="0"]');
        break;
      case 'previous-year-group':
      case 'next-year-group':
        this._viewYear = Math.min(
          9999,
          Math.max(1, this._viewYear + (action === 'previous-year-group' ? -12 : 12)),
        );
        this._renderPanel();
        this._announce(String(this._viewYear).padStart(4, '0'));
        this._focusAfterRender('[data-grid-kind="year"][tabindex="0"]');
        break;
      case 'month-view':
        this._view = 'month';
        this._renderPanel();
        this._focusAfterRender('[data-grid-kind="month"][tabindex="0"]');
        break;
      case 'year-view':
        this._view = 'year';
        this._renderPanel();
        this._focusAfterRender('[data-grid-kind="year"][tabindex="0"]');
        break;
      case 'current':
        this._selectCurrent();
        break;
      case 'clear':
        this._emitCommit('');
        break;
      case 'apply': {
        if (!this._canApply()) {
          this._announce(labels.invalidValue);
          return;
        }
        const value = serializeTemporalValue(this.mode, this._draft);
        if (value) {
          this._emitCommit(value);
        }
        break;
      }
      default:
        break;
    }
  }

  _handlePanelInput(event) {
    if (!event.target.matches('input[data-time-part]')) {
      return;
    }

    const part = event.target.dataset.timePart;
    this._activeTimePart = part;
    this._seededTimeQuery = false;
    this._timeQuery = event.target.value.replace(/\D/g, '').slice(0, 2);
    this._activeTimeValue =
      this._getFilteredTimeOptions(part).find(({ enabled }) => enabled)?.value ?? null;
    this._renderPanel();
    this._focusAfterRender(`input[data-time-part="${part}"]`, { cursorToEnd: true });
  }

  _handlePanelKeydown(event) {
    const timeInput = event.target.closest('input[data-time-part]');
    if (timeInput) {
      const listWasOpen = this._activeTimePart === timeInput.dataset.timePart;
      this._handleTimeInputKeydown(event, timeInput);
      if (event.key !== 'Escape' || listWasOpen) {
        return;
      }
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this._closePanel({ restoreFocus: true });
      return;
    }

    const dayButton = event.target.closest('[data-day]');
    if (dayButton) {
      this._handleDayKeydown(event, dayButton);
      return;
    }

    const gridButton = event.target.closest('[data-grid-kind]');
    if (gridButton) {
      this._handleChoiceGridKeydown(event, gridButton);
    }
  }

  _handleDayKeydown(event, button) {
    const current = parseTemporalValue('date', button.dataset.day);
    let target = null;
    const weekStartsOn = this._getWeekStartsOn();

    if (event.key === 'ArrowLeft') {
      target = addDays(current, -1);
    } else if (event.key === 'ArrowRight') {
      target = addDays(current, 1);
    } else if (event.key === 'ArrowUp') {
      target = addDays(current, -7);
    } else if (event.key === 'ArrowDown') {
      target = addDays(current, 7);
    } else if (event.key === 'Home') {
      const offset = (dayOfWeek(current.year, current.month, current.day) - weekStartsOn + 7) % 7;
      target = addDays(current, -offset);
    } else if (event.key === 'End') {
      const offset = (dayOfWeek(current.year, current.month, current.day) - weekStartsOn + 7) % 7;
      target = addDays(current, 6 - offset);
    } else if (event.key === 'PageUp') {
      target = event.shiftKey ? addYears(current, -1) : addMonths(current, -1);
    } else if (event.key === 'PageDown') {
      target = event.shiftKey ? addYears(current, 1) : addMonths(current, 1);
    }

    if (!target) {
      return;
    }

    event.preventDefault();
    const enabledTarget = this._getNearestEnabledDate(target);
    if (!enabledTarget) {
      return;
    }

    this._focusedDate = enabledTarget;
    this._viewYear = enabledTarget.year;
    this._viewMonth = enabledTarget.month;
    this._renderPanel();
    this._focusAfterRender(
      `[data-day="${serializeTemporalValue('date', enabledTarget)}"]`,
    );
  }

  _handleChoiceGridKeydown(event, button) {
    const offsets = {
      ArrowDown: 3,
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -3,
    };
    const offset = offsets[event.key];

    if (!offset) {
      return;
    }

    event.preventDefault();
    const kind = button.dataset.gridKind;
    const buttons = [...this._panel.querySelectorAll(`[data-grid-kind="${kind}"]:not(:disabled)`)];
    const currentIndex = buttons.indexOf(button);
    const nextIndex = Math.min(buttons.length - 1, Math.max(0, currentIndex + offset));
    buttons[nextIndex]?.focus();
  }

  _selectDate(date) {
    this._focusedDate = date;
    this._viewYear = date.year;
    this._viewMonth = date.month;

    if (this.mode === 'date') {
      this._emitCommit(serializeTemporalValue('date', date));
      return;
    }

    this._draft = {
      ...this._draft,
      year: date.year,
      month: date.month,
      day: date.day,
    };
    this._renderPanel();
    this._focusAfterRender(`[data-day="${serializeTemporalValue('date', date)}"]`);
  }

  _selectMonth(month) {
    if (this.mode === 'month') {
      this._emitCommit(
        serializeTemporalValue('month', { year: this._viewYear, month }),
      );
      return;
    }

    this._viewMonth = month;
    this._view = 'day';
    const preferred = this._getNearestEnabledDate({
      year: this._viewYear,
      month,
      day: Math.min(this._draft?.day || 1, daysInMonth(this._viewYear, month)),
    });
    this._focusedDate = preferred;
    this._renderPanel();
    this._announce(formatMonthName(this._viewYear, month, this.locale, true));
    this._focusAfterRender(
      preferred
        ? `[data-day="${serializeTemporalValue('date', preferred)}"]`
        : '[data-day]:not(:disabled)',
    );
  }

  _selectYear(year) {
    this._viewYear = year;

    if (this.mode === 'year') {
      this._emitCommit(serializeTemporalValue('year', { year }));
      return;
    }

    this._view = 'month';
    this._renderPanel();
    this._announce(String(year).padStart(4, '0'));
    this._focusAfterRender('[data-grid-kind="month"][tabindex="0"]');
  }

  _selectCurrent() {
    const now = getLocalNow();
    const candidate = this._candidateForMode(now);
    if (!candidate || !this._isCandidateWithinRange(candidate)) {
      return;
    }

    if (['time', 'datetime'].includes(this.mode)) {
      this._draft = { ...candidate };
      if (this.mode === 'datetime') {
        this._view = 'day';
        this._viewYear = candidate.year;
        this._viewMonth = candidate.month;
        this._focusedDate = {
          year: candidate.year,
          month: candidate.month,
          day: candidate.day,
        };
      }
      this._renderPanel();
      this._focusAfterRender(
        this.mode === 'time'
          ? 'input[data-time-part="hour"]'
          : `[data-day="${serializeTemporalValue('date', candidate)}"]`,
      );
      return;
    }

    this._emitCommit(serializeTemporalValue(this.mode, candidate));
  }

  _emitCommit(value) {
    this.dispatchEvent(
      new CustomEvent('temporal-change', {
        detail: { value, mode: this.mode },
        bubbles: true,
        composed: true,
      }),
    );
    this._closePanel({ restoreFocus: true });
  }

  _candidateForMode(parts) {
    switch (this.mode) {
      case 'year':
        return { year: parts.year };
      case 'month':
        return { year: parts.year, month: parts.month };
      case 'date':
        return { year: parts.year, month: parts.month, day: parts.day };
      case 'time':
        return { hour: parts.hour, minute: parts.minute, second: parts.second };
      case 'datetime':
        return {
          year: parts.year,
          month: parts.month,
          day: parts.day,
          hour: parts.hour,
          minute: parts.minute,
          second: parts.second,
        };
      default:
        return null;
    }
  }

  _isCandidateWithinRange(candidate) {
    return (
      this._contractState.configValid &&
      isWithinRange(
        this.mode,
        candidate,
        this._contractState.minParts,
        this._contractState.maxParts,
      )
    );
  }

  _isCurrentEnabled() {
    if (!this._contractState.configValid) {
      return false;
    }
    return this._isCandidateWithinRange(this._candidateForMode(getLocalNow()));
  }

  _canApply() {
    return (
      this._contractState.configValid &&
      isValidTemporalParts(this.mode, this._draft) &&
      this._isCandidateWithinRange(this._draft)
    );
  }

  _intervalOverlaps(mode, start, end) {
    const { minParts, maxParts } = this._contractState;
    return !(
      (minParts && compareTemporalParts(mode, end, minParts) < 0) ||
      (maxParts && compareTemporalParts(mode, start, maxParts) > 0)
    );
  }

  _isYearEnabled(year) {
    if (!Number.isInteger(year) || year < 1 || year > 9999) {
      return false;
    }

    switch (this.mode) {
      case 'year':
        return this._isCandidateWithinRange({ year });
      case 'month':
        return this._intervalOverlaps(
          'month',
          { year, month: 1 },
          { year, month: 12 },
        );
      case 'date':
        return this._intervalOverlaps(
          'date',
          { year, month: 1, day: 1 },
          { year, month: 12, day: 31 },
        );
      case 'datetime':
        return this._intervalOverlaps(
          'datetime',
          { year, month: 1, day: 1, hour: 0, minute: 0, second: 0 },
          {
            year,
            month: 12,
            day: 31,
            hour: 23,
            minute: 59,
            second: 59,
          },
        );
      default:
        return true;
    }
  }

  _isMonthEnabled(year, month) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return false;
    }

    switch (this.mode) {
      case 'month':
        return this._isCandidateWithinRange({ year, month });
      case 'date':
        return this._intervalOverlaps(
          'date',
          { year, month, day: 1 },
          { year, month, day: daysInMonth(year, month) },
        );
      case 'datetime':
        return this._intervalOverlaps(
          'datetime',
          { year, month, day: 1, hour: 0, minute: 0, second: 0 },
          {
            year,
            month,
            day: daysInMonth(year, month),
            hour: 23,
            minute: 59,
            second: 59,
          },
        );
      default:
        return true;
    }
  }

  _isDateEnabled(date) {
    if (!isValidDateParts(date)) {
      return false;
    }

    if (this.mode === 'date') {
      return this._isCandidateWithinRange(date);
    }

    if (this.mode === 'datetime') {
      return this._intervalOverlaps(
        'datetime',
        { ...date, hour: 0, minute: 0, second: 0 },
        { ...date, hour: 23, minute: 59, second: 59 },
      );
    }

    return true;
  }

  _getNearestEnabledDate(candidate) {
    if (!candidate || !isValidDateParts(candidate)) {
      return null;
    }

    if (this._isDateEnabled(candidate)) {
      return { year: candidate.year, month: candidate.month, day: candidate.day };
    }

    const min = this._contractState?.minParts;
    const max = this._contractState?.maxParts;
    const candidateDate = {
      year: candidate.year,
      month: candidate.month,
      day: candidate.day,
    };

    if (min?.year && compareTemporalParts('date', candidateDate, min) < 0) {
      return { year: min.year, month: min.month, day: min.day };
    }

    if (max?.year && compareTemporalParts('date', candidateDate, max) > 0) {
      return { year: max.year, month: max.month, day: max.day };
    }

    return null;
  }

  _canNavigateMonth(direction) {
    const target = addMonths(
      { year: this._viewYear, month: this._viewMonth, day: 1 },
      direction,
    );
    return (
      target.year !== this._viewYear ||
      target.month !== this._viewMonth
    ) && this._isMonthEnabled(target.year, target.month);
  }

  _focusInitialPanelControl() {
    let selector;

    if (!this._contractState.configValid) {
      selector = '[data-action="close"]';
    } else if (this._view === 'year') {
      selector = '[data-grid-kind="year"][tabindex="0"]';
    } else if (this._view === 'month') {
      selector = '[data-grid-kind="month"][tabindex="0"]';
    } else if (this.mode === 'time') {
      selector = 'input[data-time-part="hour"]';
    } else if (this._focusedDate) {
      selector = `[data-day="${serializeTemporalValue('date', this._focusedDate)}"]`;
    }

    (selector ? this._panel.querySelector(selector) : null)?.focus();
  }

  _focusAfterRender(selector, { cursorToEnd = false, select = false } = {}) {
    requestAnimationFrame(() => {
      const element = this._panel.querySelector(selector);
      const active = this._panel.contains(document.activeElement)
        ? document.activeElement
        : null;

      // A re-render detaches the focused control, so focus normally sits on the body by
      // the time this frame runs. If it already moved to another control in the panel,
      // the user got there first (Tab, for example) and must keep it.
      if (active && active !== element) {
        this._positionPanel();
        return;
      }

      element?.focus();
      if (select && typeof element?.select === 'function') {
        element.select();
      } else if (
        cursorToEnd &&
        typeof element?.setSelectionRange === 'function'
      ) {
        const end = element.value.length;
        element.setSelectionRange(end, end);
      }
      this._positionPanel();
    });
  }

  _announce(message) {
    if (!this._live) {
      return;
    }

    this._live.textContent = '';
    requestAnimationFrame(() => {
      this._live.textContent = message;
    });
  }
}

if (!customElements.get('temporal-picker')) {
  customElements.define('temporal-picker', TemporalPicker);
}
