import {
  DEFAULT_LABELS,
  collapseModel,
  expandLabel,
  normalizeSeparator,
  normalizeSize,
} from './breadcrumbs-core.js';

/**
 * Styles a trail of links without taking it over.
 *
 * `nav` and `ol` already carry the landmark and the ordering, and the links already
 * navigate, so the trail works with no script at all. This element adds the sizing hooks
 * and the one thing CSS cannot do: putting the middle of a long trail behind a button.
 */
export class UiBreadcrumbs extends HTMLElement {
  static get observedAttributes() {
    return ['size', 'separator', 'max-items', 'items-before-collapse', 'items-after-collapse'];
  }

  constructor() {
    super();
    this._connected = false;
    this._expanded = false;
    this._labelOverrides = {};
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this._sync();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this._connected && oldValue !== newValue) {
      this._sync();
    }
  }

  get list() {
    return this.querySelector('ol');
  }

  get items() {
    return [...this.querySelectorAll('ol > li')].filter((item) => !item.dataset.breadcrumbsExpand);
  }

  get size() {
    return normalizeSize(this.getAttribute('size'));
  }

  get separator() {
    return normalizeSeparator(this.getAttribute('separator'));
  }

  get expanded() {
    return this._expanded;
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

  /** Reveals every level that was put away. */
  expand() {
    if (this._expanded) {
      return;
    }

    this._expanded = true;
    this._sync();
    this.dispatchEvent(
      new CustomEvent('breadcrumbs-expand', { bubbles: true, composed: true }),
    );
  }

  collapse() {
    this._expanded = false;
    this._sync();
  }

  _number(attribute, fallback) {
    const parsed = Number.parseInt(this.getAttribute(attribute) ?? '', 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  /**
   * The last level is where the person is now. Authors are asked to mark it, and this
   * fills the gap so the trail never leaves the current page unannounced.
   */
  _ensureCurrent(items) {
    const last = items.at(-1);

    if (!last) {
      return;
    }

    const marked = items.some((item) => item.querySelector('[aria-current]'));

    if (marked) {
      return;
    }

    const target = last.querySelector('a') ?? last.firstElementChild ?? last;
    target.setAttribute('aria-current', 'page');
  }

  _ensureExpandButton() {
    if (!this._expandItem) {
      this._expandItem = document.createElement('li');
      this._expandItem.className = 'breadcrumbs__collapsed';
      this._expandItem.dataset.breadcrumbsExpand = 'true';

      this._expandButton = document.createElement('button');
      this._expandButton.type = 'button';
      this._expandButton.className = 'breadcrumbs__expand';
      // A static ellipsis would leave the levels behind it unreachable by any means.
      this._expandButton.textContent = '…';
      this._expandButton.addEventListener('click', () => this.expand());
      this._expandItem.append(this._expandButton);
    }

    return this._expandItem;
  }

  _sync() {
    this.dataset.size = this.size;
    this.dataset.separator = this.separator;

    const list = this.list;

    if (!list) {
      return;
    }

    list.classList.add('breadcrumbs__list');

    const items = this.items;
    items.forEach((item) => item.classList.add('breadcrumbs__item'));
    this._ensureCurrent(items);

    const model = this._expanded
      ? { collapsed: false, hidden: [] }
      : collapseModel({
          count: items.length,
          maxItems: this._number('max-items', 0),
          itemsBeforeCollapse: this._number('items-before-collapse', 1),
          itemsAfterCollapse: this._number('items-after-collapse', 1),
        });

    items.forEach((item, index) => {
      item.toggleAttribute('hidden', model.hidden.includes(index));
    });

    if (!model.collapsed) {
      this._expandItem?.remove();
      this.toggleAttribute('data-collapsed', false);
      return;
    }

    const button = this._ensureExpandButton();
    this._expandButton.setAttribute('aria-label', expandLabel(model.hidden.length, this.labels));
    items[model.hidden[0]].before(button);
    this.toggleAttribute('data-collapsed', true);
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-breadcrumbs')) {
  customElements.define('ui-breadcrumbs', UiBreadcrumbs);
}
