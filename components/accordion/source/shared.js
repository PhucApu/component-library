import {
  DEFAULT_HEADING_LEVEL,
  DEFAULT_LABELS,
  clampHeadingLevel,
  expandedAfter,
  expansionDiff,
  fillLabel,
  nextHeaderIndex,
  normaliseExpanded,
  panelDuration,
  shouldExposeRegion,
} from './accordion-core.js';

const MARKER = 'M8 10.5 12 14.5 16 10.5';

let sequence = 0;

function uniqueId(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A group of disclosure panels.
 *
 * The widget itself is `details` and `summary`, which already carry the semantics, the
 * keyboard, the open state, and — through `name` — one panel open at a time, all without a
 * script. What the element adds is the part the platform has no answer for: an animated
 * open and close, a heading and a region for every panel, arrow keys between the headers,
 * and a panel that can be turned off.
 */
export class UiAccordion extends HTMLElement {
  static get observedAttributes() {
    return ['exclusive', 'heading-level', 'icon-placement', 'duration'];
  }

  constructor() {
    super();
    this._connected = false;
    this._labelOverrides = {};
    this._running = new WeakMap();

    this._handleClick = this._handleClick.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this._build();
    this._adopt();

    this.addEventListener('click', this._handleClick);
    this.addEventListener('keydown', this._handleKeyDown);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._handleClick);
    this.removeEventListener('keydown', this._handleKeyDown);
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this._connected && oldValue !== newValue) {
      this._adopt();
    }
  }

  /** The panels, in the order they appear. */
  get items() {
    return [...this.querySelectorAll(':scope > details')];
  }

  /**
   * Whether only one panel may be open.
   *
   * A `name` on the panels counts as well as the attribute on the group. That is not two
   * ways of saying the same thing: `name` is what the browser obeys before this script
   * arrives, so markup that carries it is already exclusive, and it would be a trap for the
   * behaviour to change the moment the script loaded.
   */
  get exclusive() {
    return this.hasAttribute('exclusive') || this._named === true;
  }

  set exclusive(value) {
    this.toggleAttribute('exclusive', Boolean(value));
  }

  get headingLevel() {
    return clampHeadingLevel(this.getAttribute('heading-level'), { fallback: DEFAULT_HEADING_LEVEL });
  }

  get iconPlacement() {
    return this.getAttribute('icon-placement') === 'start' ? 'start' : 'end';
  }

  /** An override in milliseconds; without one the length follows the height of the panel. */
  get duration() {
    const parsed = Number.parseFloat(this.getAttribute('duration') ?? '');
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  get labels() {
    return { ...DEFAULT_LABELS, ...this._labelOverrides };
  }

  set labels(value) {
    this._labelOverrides = value && typeof value === 'object' ? { ...value } : {};
  }

  /** Which panels are open, by position. */
  get expanded() {
    return this.items.reduce((open, item, index) => (item.open ? [...open, index] : open), []);
  }

  set expanded(value) {
    this._apply(Array.isArray(value) ? value : [], { reason: 'api' });
  }

  _build() {
    if (this._status) {
      return;
    }

    // Present and empty before there is anything to say. A region written into the page at
    // the moment it gains text is a region nothing announces.
    this._status = document.createElement('span');
    this._status.className = 'accordion__sr-only';
    this._status.setAttribute('role', 'status');
    this.append(this._status);
  }

  /**
   * Brings whatever markup the author wrote up to the shape the element works with.
   *
   * Everything here is repairable rather than required: a panel with no wrapper gets one, a
   * summary with no heading gets one, a summary with no marker gets one. What the author
   * supplied is always left alone, because a supplied heading or icon was supplied for a
   * reason.
   */
  _adopt() {
    const items = this.items;
    const level = this.headingLevel;
    const region = shouldExposeRegion(items.length);

    if (this._named === undefined) {
      this._named = items.some((item) => item.hasAttribute('name'));
    }

    this.toggleAttribute('data-exclusive', this.exclusive);
    this.setAttribute('data-icon-placement', this.iconPlacement);

    items.forEach((item) => {
      item.classList.add('accordion__item');

      // The browser closes a named sibling itself, the instant the other opens, and there is
      // no event to hang an animation off. Taking the name away hands that job over; until
      // this line runs, the browser was doing it, which is exactly what should happen.
      item.removeAttribute('name');

      const summary = item.querySelector(':scope > summary');

      if (!summary) {
        return;
      }

      summary.classList.add('accordion__summary');

      // Both of these come out before the heading is built, because building it sweeps up
      // whatever is left in the summary. A marker left in would end up inside the heading,
      // where the check for one no longer finds it and a second is drawn beside it; the
      // secondary text would become part of the heading, and therefore part of the name of
      // the panel it labels.
      const marker = summary.querySelector('.accordion__marker');
      const meta = summary.querySelector('.accordion__meta');
      marker?.remove();
      meta?.remove();

      const heading = this._ensureHeading(summary, level);
      const panel = this._ensurePanel(item, summary);

      if (meta) {
        summary.append(meta);
      }

      const mark = marker ?? this._marker();
      mark.setAttribute('aria-hidden', 'true');
      summary.append(mark);

      if (region) {
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-labelledby', heading.id);
      } else {
        panel.removeAttribute('role');
        panel.removeAttribute('aria-labelledby');
      }

      const off = item.hasAttribute('data-disabled');
      // `aria-disabled` rather than anything that takes the summary out of the tab order. A
      // control nobody can reach is a control nobody can find out is unavailable, and a
      // disabled element cannot hold focus, so turning one off under the finger drops focus
      // to the body and takes the keyboard with it.
      summary.setAttribute('aria-disabled', String(off));
    });
  }

  _ensureHeading(summary, level) {
    const existing = summary.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');

    if (existing) {
      existing.classList.add('accordion__title');
      existing.id ||= uniqueId('accordion-title');
      return existing;
    }

    // A summary is a button to the accessibility tree and nothing more. Without a heading
    // the panels cannot be jumped between, which is how most people using a screen reader
    // move through a page of them.
    const heading = document.createElement(`h${level}`);
    heading.className = 'accordion__title';
    heading.id = uniqueId('accordion-title');
    heading.append(...summary.childNodes);
    summary.append(heading);

    return heading;
  }

  /**
   * Gives the panel the two boxes the animation needs: an outer one whose height moves, and
   * an inner one that keeps its natural height so there is something to move towards.
   *
   * The inner box is created even when the author supplied the outer one. Measuring the
   * first child instead would be right only for a panel with exactly one child, and wrong
   * quietly — the panel would open to the height of its first paragraph.
   */
  _ensurePanel(item, summary) {
    let panel = item.querySelector(':scope > .accordion__panel');

    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'accordion__panel';
      panel.append(...[...item.childNodes].filter((node) => node !== summary));
      item.append(panel);
    }

    panel.id ||= uniqueId('accordion-panel');

    let content = panel.querySelector(':scope > .accordion__content');

    if (!content) {
      content = document.createElement('div');
      content.className = 'accordion__content';
      content.append(...panel.childNodes);
      panel.append(content);
    }

    return panel;
  }

  _marker() {
    const marker = document.createElement('span');
    marker.className = 'accordion__marker';
    marker.setAttribute('aria-hidden', 'true');
    marker.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${MARKER}"></path></svg>`;
    return marker;
  }

  expand(index) {
    return this._toggle(index, true, 'api');
  }

  collapse(index) {
    return this._toggle(index, false, 'api');
  }

  toggle(index) {
    const item = this.items[index];
    return item ? this._toggle(index, !item.open, 'api') : false;
  }

  expandAll() {
    // Exclusive means exclusive, whoever asked. Opening them all here would leave the group
    // in a state its own rules forbid, and the next press would look like it did nothing.
    const all = this.exclusive ? [0] : this.items.map((item, index) => index);
    this._apply(all, { reason: 'api' });
  }

  collapseAll() {
    this._apply([], { reason: 'api' });
  }

  _toggle(index, open, reason) {
    const items = this.items;
    const item = items[index];

    if (!item || item.hasAttribute('data-disabled') || item.open === open) {
      return false;
    }

    this._apply(
      expandedAfter({
        expanded: this.expanded,
        index,
        open,
        exclusive: this.exclusive,
        total: items.length,
      }),
      { reason, index },
    );

    return true;
  }

  _apply(next, { reason = 'api', index = null } = {}) {
    const items = this.items;
    const before = this.expanded;
    const after = normaliseExpanded({
      expanded: next,
      total: items.length,
      exclusive: this.exclusive,
    });
    const { opening, closing } = expansionDiff(before, after, { total: items.length });

    if (opening.length === 0 && closing.length === 0) {
      return;
    }

    // A disabled panel does not move, whoever asked it to, so it is taken out before
    // anything is animated rather than checked again inside each branch.
    const allowed = (position) => !items[position].hasAttribute('data-disabled');
    const grow = opening.filter(allowed);
    const shrink = closing.filter(allowed);

    grow.forEach((position) => this._animate(items[position], true));
    shrink.forEach((position) => this._animate(items[position], false));

    // Only what the person did not ask for. Closing the panel you just pressed needs no
    // telling; the panel that closed itself somewhere else on the page does.
    const collateral = shrink.filter((position) => position !== index);

    if (collateral.length > 0) {
      this._announce(collateral.map((position) => this._titleOf(items[position])));
    }

    [...grow, ...shrink].forEach((position) => {
      this.dispatchEvent(
        new CustomEvent('accordion-toggle', {
          detail: { index: position, expanded: grow.includes(position), reason },
          bubbles: true,
          composed: true,
        }),
      );
    });

    // What was decided, not what the DOM says at this instant. A panel on its way out keeps
    // `open` until its animation ends, so reading the elements here would report a panel as
    // still open for the whole of the time it spends closing.
    const settled = normaliseExpanded({
      expanded: [...before.filter((position) => !shrink.includes(position)), ...grow],
      total: items.length,
      exclusive: this.exclusive,
    });

    this.dispatchEvent(
      new CustomEvent('accordion-change', {
        detail: { expanded: settled, reason },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _titleOf(item) {
    return item.querySelector('.accordion__title')?.textContent?.trim() ?? '';
  }

  _announce(titles) {
    this._status.textContent = titles
      .map((title) => fillLabel(this.labels.replaced, { title }))
      .join('. ');
  }

  /**
   * Opens or closes one panel, with the height doing the moving.
   *
   * Closing has to keep the panel open until the animation is over: a closed `details` does
   * not render its content, and nothing that is not rendered can be animated. The `toggle`
   * event is no use for this either — it cannot be cancelled and it arrives after `open` has
   * already changed — which is why the press is intercepted instead.
   */
  _animate(item, open) {
    const panel = item.querySelector(':scope > .accordion__panel');

    if (!panel) {
      item.open = open;
      return;
    }

    this._cancel(item);

    if (prefersReducedMotion()) {
      item.open = open;
      panel.style.blockSize = '';
      panel.style.transitionDuration = '';
      return;
    }

    const from = item.open ? panel.getBoundingClientRect().height : 0;

    if (open) {
      item.open = true;
    }

    const content = panel.querySelector(':scope > .accordion__content');
    const to = open ? (content?.getBoundingClientRect().height ?? 0) : 0;
    const ms = this.duration ?? panelDuration(Math.max(from, to));

    // Two steps: put the panel where it starts with the transition switched off, let the
    // layout settle, then switch it back on and send it to where it ends.
    panel.style.transitionDuration = '0ms';
    panel.style.blockSize = `${from}px`;
    void panel.offsetHeight;
    panel.style.transitionDuration = `${ms}ms`;
    panel.style.blockSize = `${to}px`;

    const finish = () => {
      this._cancel(item);

      if (!open) {
        item.open = false;
      }

      panel.style.blockSize = '';
      panel.style.transitionDuration = '';
    };

    // The timer rather than `transitionend` alone: a transition that never starts — a panel
    // of zero height, a tab in the background — never ends either, and the panel would be
    // left frozen at an inline height.
    const timer = setTimeout(finish, ms + 80);
    const onEnd = (event) => {
      if (event.target === panel && event.propertyName.includes('size')) {
        finish();
      }
    };

    panel.addEventListener('transitionend', onEnd);
    this._running.set(item, { timer, onEnd, panel });
  }

  _cancel(item) {
    const running = this._running.get(item);

    if (!running) {
      return;
    }

    clearTimeout(running.timer);
    running.panel.removeEventListener('transitionend', running.onEnd);
    this._running.delete(item);
  }

  _indexOfSummary(target) {
    const summary = target.closest?.('summary');
    const item = summary?.parentElement;

    return item && item.parentElement === this ? this.items.indexOf(item) : -1;
  }

  _handleClick(event) {
    const index = this._indexOfSummary(event.target);

    if (index < 0) {
      return;
    }

    // The press is where the animation hangs, because `details` offers nothing later that
    // can be refused: `toggle` is not cancellable and there is no `beforetoggle` on it.
    event.preventDefault();

    const item = this.items[index];

    if (item.hasAttribute('data-disabled')) {
      return;
    }

    this._toggle(index, !item.open, 'pointer');
  }

  _handleKeyDown(event) {
    const index = this._indexOfSummary(event.target);

    if (index < 0 || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const total = this.items.length;
    const moves = {
      ArrowDown: () => nextHeaderIndex({ current: index, total, delta: 1 }),
      ArrowUp: () => nextHeaderIndex({ current: index, total, delta: -1 }),
      Home: () => 0,
      End: () => total - 1,
    };

    const move = moves[event.key];

    if (!move) {
      return;
    }

    event.preventDefault();
    this.items[move()]?.querySelector(':scope > summary')?.focus();
  }
}

if (!customElements.get('ui-accordion')) {
  customElements.define('ui-accordion', UiAccordion);
}
