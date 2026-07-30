import {
  DEFAULT_LABELS,
  ariaSortFor,
  compareValues,
  detectNumeric,
  fillLabel,
  nextSortState,
  normalizeDensity,
  selectionState,
} from './table-core.js';

/**
 * Three marks in one icon, one shown at a time. The idle pair says "this column can be
 * sorted" before anyone has pressed it; a single arrow says which way it is sorted now.
 */
const SORT_ICON = `
  <svg class="table__chevron" viewBox="0 0 24 24" aria-hidden="true">
    <path class="table__sort-idle" d="M12 5 17 10.5H7zM12 19 7 13.5h10z"></path>
    <path class="table__sort-asc" d="M12 7 17.5 15.5h-11z"></path>
    <path class="table__sort-desc" d="M12 17 6.5 8.5h11z"></path>
  </svg>
`;

/**
 * Frames a native table rather than replacing it.
 *
 * `table`, `caption`, `thead`, `th scope` and the rest already carry the structure that
 * assistive technology navigates by, and rebuilding any of it with `role` attributes would
 * be a downgrade. This element adds sorting, the third checkbox state, row detail, and the
 * one piece of scrolling that HTML does not give away for free.
 */
export class UiTable extends HTMLElement {
  static get observedAttributes() {
    return ['density', 'sortable', 'selectable', 'sticky-header'];
  }

  constructor() {
    super();
    this._connected = false;
    this._labelOverrides = {};
    this._sorted = null;
    this._handleHeaderClick = this._handleHeaderClick.bind(this);
    this._handleChange = this._handleChange.bind(this);
    this._handleToggleClick = this._handleToggleClick.bind(this);
    this._measureOverflow = this._measureOverflow.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this.addEventListener('click', this._handleHeaderClick);
    this.addEventListener('click', this._handleToggleClick);
    this.addEventListener('change', this._handleChange);
    this._recordSourceOrder();
    this._sync();

    if (typeof ResizeObserver === 'function') {
      this._observer = new ResizeObserver(this._measureOverflow);
      this._observer.observe(this);

      if (this.scroller) {
        this._observer.observe(this.scroller);
      }
    }
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._handleHeaderClick);
    this.removeEventListener('click', this._handleToggleClick);
    this.removeEventListener('change', this._handleChange);
    this._observer?.disconnect();
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this._connected && oldValue !== newValue) {
      this._sync();
    }
  }

  get table() {
    return this.querySelector('table');
  }

  get scroller() {
    return this.querySelector('.table__scroll');
  }

  get body() {
    return this.table?.tBodies[0] ?? null;
  }

  get density() {
    return normalizeDensity(this.getAttribute('density'));
  }

  get labels() {
    return { ...DEFAULT_LABELS, ...this._labelOverrides };
  }

  set labels(next) {
    this._labelOverrides = next && typeof next === 'object' ? { ...next } : {};

    if (this._connected) {
      this._sync();
    }
  }

  /** Every row that carries a key, in the order they are shown. */
  get rows() {
    return [...(this.body?.rows ?? [])].filter((row) => row.dataset.key !== undefined);
  }

  /** Every checked row, including one the author locked in the selection. */
  get selected() {
    return this.rows
      .filter((row) => row.querySelector('input[type="checkbox"]')?.checked)
      .map((row) => row.dataset.key);
  }

  /**
   * The rows the header checkbox can actually operate.
   *
   * Counting an unavailable row against the total would leave "select all" unable to reach
   * "all": pressing it would tick every row it could, find the count short, and draw
   * itself half-on again straight away.
   */
  get selectableRows() {
    return this.rows.filter((row) => {
      const box = row.querySelector('input[type="checkbox"]');
      return Boolean(box) && !box.disabled;
    });
  }

  get sort() {
    return this._sorted ? { ...this._sorted } : null;
  }

  _recordSourceOrder() {
    // Sorting offers a way back to the order the data arrived in, which means remembering
    // it before the first comparison ever runs.
    [...(this.body?.rows ?? [])].forEach((row, index) => {
      if (row.dataset.sourceOrder === undefined) {
        row.dataset.sourceOrder = String(index);
      }
    });
  }

  /**
   * A scrollable box that cannot take focus cannot be scrolled by anyone without a
   * pointer. It also must not become a tab stop when there is nothing to scroll, so the
   * attributes come and go with the measurement.
   */
  _measureOverflow() {
    const scroller = this.scroller;

    if (!scroller) {
      return;
    }

    const overflowing = scroller.scrollWidth > scroller.clientWidth + 1;
    this.toggleAttribute('data-overflowing', overflowing);

    if (!overflowing) {
      scroller.removeAttribute('tabindex');
      scroller.removeAttribute('role');
      scroller.removeAttribute('aria-label');
      return;
    }

    const caption = this.table?.caption?.textContent?.trim() ?? '';
    scroller.setAttribute('tabindex', '0');
    scroller.setAttribute('role', 'region');
    scroller.setAttribute('aria-label', fillLabel(this.labels.scrollRegion, { caption }));
  }

  _ensureSortButtons() {
    if (!this.hasAttribute('sortable')) {
      return;
    }

    this.querySelectorAll('th[data-sortable]').forEach((header) => {
      if (!header.querySelector('.table__sort')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'table__sort';
        button.append(...header.childNodes);
        button.insertAdjacentHTML('beforeend', SORT_ICON);
        header.append(button);
      }

      // On the cell, never on the button. A sort state announced from inside the header
      // is not the header's state as far as the table is concerned.
      header.setAttribute('aria-sort', ariaSortFor(header.dataset.sortState ?? 'none'));
    });
  }

  _ensureRowToggles() {
    this.querySelectorAll('[data-expands]').forEach((trigger) => {
      const key = trigger.dataset.expands;
      const detail = this.querySelector(`[data-detail="${key}"]`);
      const expanded = trigger.getAttribute('aria-expanded') === 'true';

      if (!trigger.hasAttribute('aria-expanded')) {
        trigger.setAttribute('aria-expanded', 'false');
      }

      if (!trigger.getAttribute('aria-label')) {
        trigger.setAttribute('aria-label', this.labels.expandRow);
      }

      if (detail) {
        detail.toggleAttribute('hidden', !expanded);
      }
    });
  }

  _syncSelection() {
    const all = this.querySelector('.table__select-all');
    const rows = this.rows;
    const operable = this.selectableRows;
    const state = selectionState({
      total: operable.length,
      selected: operable.filter((row) => row.querySelector('input[type="checkbox"]').checked)
        .length,
    });

    this.dataset.selection = state;

    rows.forEach((row) => {
      const box = row.querySelector('input[type="checkbox"]');
      row.toggleAttribute('data-selected', Boolean(box?.checked));
      // A row that "select all" skips has to look like one it cannot reach. Left at full
      // strength it reads as a row that simply failed to tick.
      row.toggleAttribute('data-unavailable', Boolean(box) && box.disabled);
    });

    if (!all) {
      return;
    }

    // `indeterminate` exists only as a property. Writing it as an attribute in the markup
    // does nothing at all, which is how a partly selected table ends up looking empty.
    all.indeterminate = state === 'some';
    all.checked = state === 'all';

    if (!all.getAttribute('aria-label')) {
      all.setAttribute('aria-label', this.labels.selectAll);
    }
  }

  _sync() {
    this.dataset.density = this.density;
    this.toggleAttribute('data-sticky', this.hasAttribute('sticky-header'));

    if (!this.table) {
      return;
    }

    this.table.classList.add('table__table');
    this._ensureSortButtons();
    this._ensureRowToggles();
    this._syncSelection();
    this._measureOverflow();
  }

  /** Groups a row with any detail row belonging to it, so sorting moves them together. */
  _rowGroups() {
    const groups = [];

    for (const row of [...(this.body?.rows ?? [])]) {
      if (row.dataset.detail !== undefined && groups.length) {
        groups.at(-1).push(row);
        continue;
      }

      groups.push([row]);
    }

    return groups;
  }

  sortBy(header, state) {
    const body = this.body;

    if (!body || !header) {
      return;
    }

    const index = [...header.parentElement.children].indexOf(header);
    const groups = this._rowGroups();

    if (state === 'none') {
      groups.sort(
        (a, b) => Number(a[0].dataset.sourceOrder ?? 0) - Number(b[0].dataset.sourceOrder ?? 0),
      );
    } else {
      const valueOf = (row) => {
        const cell = row[0].cells[index];
        return cell?.dataset.sortValue ?? cell?.textContent ?? '';
      };
      const numeric = detectNumeric(groups.map(valueOf));

      groups.sort((a, b) =>
        compareValues(valueOf(a), valueOf(b), { numeric, direction: state }),
      );
    }

    body.append(...groups.flat());

    this.querySelectorAll('th[data-sortable]').forEach((other) => {
      const active = other === header && state !== 'none';
      other.dataset.sortState = active ? state : 'none';
      other.setAttribute('aria-sort', ariaSortFor(other.dataset.sortState));
      other.toggleAttribute('data-sorted', active);
    });

    this._sorted = state === 'none' ? null : { column: header.dataset.column ?? '', state };

    this.dispatchEvent(
      new CustomEvent('table-sort', {
        detail: { column: header.dataset.column ?? '', state },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _handleHeaderClick(event) {
    const button = event.target.closest('.table__sort');

    if (!button || !this.contains(button)) {
      return;
    }

    const header = button.closest('th');
    this.sortBy(header, nextSortState(header.dataset.sortState ?? 'none'));
  }

  _handleToggleClick(event) {
    const trigger = event.target.closest('[data-expands]');

    if (!trigger || !this.contains(trigger)) {
      return;
    }

    const key = trigger.dataset.expands;
    const detail = this.querySelector(`[data-detail="${key}"]`);
    const expanded = trigger.getAttribute('aria-expanded') !== 'true';

    trigger.setAttribute('aria-expanded', String(expanded));
    trigger.setAttribute('aria-label', expanded ? this.labels.collapseRow : this.labels.expandRow);
    detail?.toggleAttribute('hidden', !expanded);

    this.dispatchEvent(
      new CustomEvent('table-row-toggle', {
        detail: { key, expanded },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _handleChange(event) {
    const checkbox = event.target;

    if (checkbox?.type !== 'checkbox') {
      return;
    }

    if (checkbox.classList.contains('table__select-all')) {
      this.rows.forEach((row) => {
        const box = row.querySelector('input[type="checkbox"]');

        if (box && !box.disabled) {
          box.checked = checkbox.checked;
        }
      });
    }

    this._syncSelection();

    this.dispatchEvent(
      new CustomEvent('table-selection-change', {
        detail: { selected: this.selected, state: this.dataset.selection },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-table')) {
  customElements.define('ui-table', UiTable);
}
