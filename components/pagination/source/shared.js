import {
  DEFAULT_LABELS,
  ELLIPSIS_END,
  ELLIPSIS_START,
  buildRange,
  clampCount,
  clampPage,
  fillLabel,
  normalizeSize,
  pageAnnouncement,
  pageSlice,
} from './pagination-core.js';

const ARROWS = Object.freeze({
  first: 'M18 6 12 12l6 6M11 6v12',
  previous: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  last: 'M6 6l6 6-6 6M13 6v12',
});

let paginationId = 0;

/**
 * A list of pages, and the one thing a page change does not do on its own: say so.
 *
 * HTML has no pagination primitive, so unlike the form controls in this collection there
 * is nothing here to enhance. The element builds its own controls, the same call made by
 * Autocomplete, Temporal Picker, and Snackbar.
 */
export class UiPagination extends HTMLElement {
  static get observedAttributes() {
    return [
      'page',
      'count',
      'sibling-count',
      'boundary-count',
      'size',
      'disabled',
      'compact',
      'show-first',
      'show-last',
      'hide-prev',
      'hide-next',
      'page-size',
      'total',
    ];
  }

  constructor() {
    super();
    paginationId += 1;
    this._instanceId = this.id || `ui-pagination-${paginationId}`;
    this._connected = false;
    this._labelOverrides = {};
    this._lastAnnouncement = '';
    this._handleClick = this._handleClick.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this.addEventListener('click', this._handleClick);
    this._build();
    this._render();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._handleClick);
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this._connected && oldValue !== newValue) {
      this._render();
    }
  }

  get nav() {
    return this.querySelector('nav');
  }

  get count() {
    if (this.hasAttribute('total') && this.hasAttribute('page-size')) {
      return pageSlice({ page: 1, pageSize: this.pageSize, total: this.total }).count;
    }

    return clampCount(this.getAttribute('count'));
  }

  get page() {
    return clampPage(this.getAttribute('page'), this.count);
  }

  set page(next) {
    this.setAttribute('page', String(clampPage(next, this.count)));
  }

  get pageSize() {
    return Number.parseInt(this.getAttribute('page-size') ?? '', 10) || 0;
  }

  get total() {
    return Number.parseInt(this.getAttribute('total') ?? '', 10) || 0;
  }

  /** The rows this page covers, or `null` when the component was not told the total. */
  get range() {
    if (!this.total || !this.pageSize) {
      return null;
    }

    const slice = pageSlice({ page: this.page, pageSize: this.pageSize, total: this.total });
    return { start: slice.start, end: slice.end, total: this.total };
  }

  get size() {
    return normalizeSize(this.getAttribute('size'));
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  get labels() {
    return { ...DEFAULT_LABELS, ...this._labelOverrides };
  }

  set labels(next) {
    this._labelOverrides = next && typeof next === 'object' ? { ...next } : {};

    if (this._connected) {
      this._render();
    }
  }

  _number(attribute, fallback) {
    const parsed = Number.parseInt(this.getAttribute(attribute) ?? '', 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  _build() {
    if (!this.nav) {
      const nav = document.createElement('nav');
      this.append(nav);
    }

    this.nav.classList.add('pagination__nav');

    if (!this.nav.getAttribute('aria-label')) {
      this.nav.setAttribute('aria-label', 'Pagination');
    }

    // Present and empty from the start. A region created together with its first message
    // is routinely never announced.
    if (!this._status) {
      this._status = document.createElement('span');
      this._status.className = 'pagination__sr-only';
      this._status.setAttribute('role', 'status');
      this.append(this._status);
    }
  }

  _button({ key, label, current, disabled, text, icon }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pagination__button';
    button.dataset.key = String(key);
    button.disabled = Boolean(disabled) || this.disabled;

    if (current) {
      // The state of the page, not of the control: this is where the person is.
      button.setAttribute('aria-current', 'page');
      button.classList.add('is-current');
    }

    if (icon) {
      button.classList.add('pagination__button--edge');
      button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icon}"></path></svg>`;
      button.setAttribute('aria-label', label);
    } else {
      button.textContent = text;
      // "3" alone is not a destination. The name says where pressing it goes.
      button.setAttribute('aria-label', label);
    }

    return button;
  }

  _edge(key, disabled) {
    return this._button({ key, label: this.labels[key], disabled, icon: ARROWS[key] });
  }

  _render() {
    if (!this.nav) {
      return;
    }

    const count = this.count;
    const page = this.page;
    const labels = this.labels;

    // Whatever had focus is about to be replaced, so remember which control it was.
    const focusedKey =
      this.contains(document.activeElement) && document.activeElement.dataset?.key
        ? document.activeElement.dataset.key
        : null;

    this.dataset.size = this.size;
    this.toggleAttribute('data-compact', this.hasAttribute('compact'));

    const list = document.createElement('ul');
    list.className = 'pagination__list';

    const add = (element) => {
      const item = document.createElement('li');
      item.append(element);
      list.append(item);
    };

    if (this.hasAttribute('show-first')) {
      add(this._edge('first', page <= 1));
    }

    if (!this.hasAttribute('hide-prev')) {
      add(this._edge('previous', page <= 1));
    }

    if (this.hasAttribute('compact')) {
      const status = document.createElement('span');
      status.className = 'pagination__compact';
      status.textContent = fillLabel(labels.compact, { page, count });
      add(status);
    } else {
      for (const entry of buildRange({
        page,
        count,
        siblingCount: this._number('sibling-count', 1),
        boundaryCount: this._number('boundary-count', 1),
      })) {
        if (entry === ELLIPSIS_START || entry === ELLIPSIS_END) {
          const gap = document.createElement('span');
          gap.className = 'pagination__ellipsis';
          // Not a control. The pages it stands for are still reachable through the
          // neighbouring numbers and the previous and next buttons, so a button here would
          // add a tab stop that leads nowhere new.
          gap.setAttribute('aria-hidden', 'true');
          gap.textContent = '…';
          add(gap);
          continue;
        }

        const current = entry === page;
        add(
          this._button({
            key: entry,
            text: String(entry),
            current,
            label: fillLabel(current ? labels.current : labels.page, { page: entry }),
          }),
        );
      }
    }

    if (!this.hasAttribute('hide-next')) {
      add(this._edge('next', page >= count));
    }

    if (this.hasAttribute('show-last')) {
      add(this._edge('last', page >= count));
    }

    this.nav.replaceChildren(list);
    this._restoreFocus(focusedKey);
    this._invalidateAnnouncement();
  }

  /**
   * Drops a message that has stopped being true.
   *
   * Changing the rows per page moves both the page and the count underneath a statement
   * like "Page 3 of 6, showing 11 to 15 of 26", and leaving it there means the region
   * describes a state that no longer exists. It is emptied rather than rewritten: the
   * component knows a page moved, but only the application knows why its own numbers
   * changed, so announcing that is the application's to do.
   */
  _invalidateAnnouncement() {
    if (!this._lastAnnouncement || !this._status) {
      return;
    }

    const message = pageAnnouncement({
      page: this.page,
      count: this.count,
      pageSize: this.pageSize,
      total: this.total,
      labels: this.labels,
    });

    if (message === this._lastAnnouncement) {
      return;
    }

    this._lastAnnouncement = '';
    this._status.textContent = '';
  }

  /**
   * Puts focus back after the list is rebuilt.
   *
   * Two ways it would otherwise be lost: the control that was pressed may no longer be in
   * the list, and the one that was pressed to reach the last page is now disabled. A
   * disabled element cannot hold focus, so either way the person is dropped to the top of
   * the document mid-task.
   */
  _restoreFocus(key) {
    if (!key) {
      return;
    }

    const same = this.querySelector(`.pagination__button[data-key="${key}"]`);

    if (same && !same.disabled) {
      same.focus();
      return;
    }

    this.querySelector('.pagination__button.is-current')?.focus();
  }

  _announce() {
    const message = pageAnnouncement({
      page: this.page,
      count: this.count,
      pageSize: this.pageSize,
      total: this.total,
      labels: this.labels,
    });

    if (message === this._lastAnnouncement) {
      return;
    }

    this._lastAnnouncement = message;
    this._status.textContent = message;
  }

  /** Moves to a page and reports it. Out-of-range values are clamped, never refused. */
  goTo(next) {
    const target = clampPage(next, this.count);
    const previous = this.page;

    if (target === previous) {
      return false;
    }

    this.page = target;
    this._announce();
    this.dispatchEvent(
      new CustomEvent('pagination-change', {
        detail: { page: target, previous, count: this.count, range: this.range },
        bubbles: true,
        composed: true,
      }),
    );

    return true;
  }

  _handleClick(event) {
    const button = event.target.closest('.pagination__button');

    if (!button || !this.contains(button) || button.disabled) {
      return;
    }

    const key = button.dataset.key;
    const moves = {
      first: 1,
      previous: this.page - 1,
      next: this.page + 1,
      last: this.count,
    };

    this.goTo(key in moves ? moves[key] : Number.parseInt(key, 10));
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-pagination')) {
  customElements.define('ui-pagination', UiPagination);
}
