import {
  DEFAULT_LABELS,
  SERIES_VARS,
  SLICE_LIMIT,
  arcPath,
  fillLabel,
  foldSlices,
  formatNumber,
  formatShare,
  gapRadians,
  midAngle,
  parseValue,
  sliceAngles,
  usableSlices,
} from './donut-chart-core.js';

const SVG = 'http://www.w3.org/2000/svg';

/** The hole, as a share of the outer radius. Big enough to hold a total, small enough to
    leave the ring readable. */
const HOLE = 0.62;

/** How far the wedge being read comes out of the ring, and the room kept for it. */
const LIFT = 7;

let sequence = 0;

function uniqueId(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function svgNode(name, attributes = {}) {
  const node = document.createElementNS(SVG, name);

  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      node.setAttribute(key, String(value));
    }
  });

  return node;
}

function colourFor(slot) {
  const position = Number.isInteger(slot) && slot >= 0 ? slot : 0;
  return SERIES_VARS[position % SERIES_VARS.length];
}

/**
 * Part-to-whole, drawn as a ring and read from a legend.
 *
 * A ring answers "how does this total divide" at a glance and answers "which of these two is
 * bigger" badly — people read length well and angle poorly. So this component is built as if
 * that were true, because it is:
 *
 * - **Six wedges at most**, and the seventh onward is summed into one. Folding is the default
 *   here, the opposite of the line chart, because a ninth line is still a line and a ninth
 *   wedge is a sliver.
 * - **The legend always carries the number and the share.** Nobody has to estimate an angle.
 * - **The table is the source**, so every value is readable without the ring at all.
 *
 * ```html
 * <ui-donut-chart>
 *   <table>
 *     <caption>Traffic by source</caption>
 *     <thead><tr><th>Source</th><th>Sessions</th></tr></thead>
 *     <tbody><tr><th>Organic</th><td data-value="18400">18,400</td></tr></tbody>
 *   </table>
 * </ui-donut-chart>
 * ```
 */
export class UiDonutChart extends HTMLElement {
  static get observedAttributes() {
    return ['center-label', 'no-legend', 'loading', 'error'];
  }

  constructor() {
    super();
    this._connected = false;
    this._labelOverrides = {};
    this._rows = [];
    this._hidden = new Set();
    this._readSlot = -1;
    this._tableOpen = false;

    this._handleSliceEnter = this._handleSliceEnter.bind(this);
    this._handleLeave = this._handleLeave.bind(this);
    this._handleLegendBlur = this._handleLegendBlur.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleLegendClick = this._handleLegendClick.bind(this);
    this._handleToggleTable = this._handleToggleTable.bind(this);
    this._schedule = this._schedule.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this._read();
    this._build();
    this._render();

    if (typeof ResizeObserver === 'function') {
      this._observer = new ResizeObserver(this._schedule);
      this._observer.observe(this._frame);
    }
  }

  disconnectedCallback() {
    this._observer?.disconnect();
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._connected || oldValue === newValue) {
      return;
    }

    this._render();
  }

  /* ---- What the page can ask ---------------------------------------------------------- */

  get rows() {
    return this._rows.map((row) => ({ ...row }));
  }

  /** What is actually drawn: at most six, with the tail folded. */
  get slices() {
    return this._plotted.map((slice) => ({ ...slice }));
  }

  get total() {
    return this._total ?? 0;
  }

  get labels() {
    return { ...DEFAULT_LABELS, ...this._labelOverrides };
  }

  set labels(value) {
    this._labelOverrides = value && typeof value === 'object' ? { ...value } : {};
    this._render();
  }

  refresh() {
    this._read();
    this._render();
  }

  /* ---- Reading the markup ------------------------------------------------------------- */

  /**
   * One value column, and it says so when there are more.
   *
   * A ring divides one total. A table with three value columns is three rings, or a bar
   * chart; silently plotting the first would let somebody believe the others were in there.
   */
  _read() {
    const table = this.querySelector('table');
    this._table = table ?? null;

    if (!table) {
      this._rows = [];
      this._extraColumns = 0;
      return;
    }

    const headings = [...table.querySelectorAll('thead th')];
    const rows = [...table.querySelectorAll('tbody tr')];

    this._caption = table.querySelector('caption')?.textContent.trim() ?? '';
    this._extraColumns = Math.max(0, headings.length - 2);

    this._rows = rows.map((row, index) => {
      const cells = [...row.children];
      const cell = cells[1];

      return {
        name: cells[0]?.textContent.trim() ?? '',
        value: parseValue(cell?.textContent, cell?.dataset?.value),
        text: cell?.textContent.trim() ?? '',
        index,
      };
    });

    this._hidden = new Set([...this._hidden].filter((slot) => slot < SLICE_LIMIT));
  }

  /* ---- The furniture ------------------------------------------------------------------ */

  _build() {
    if (this._frame) {
      return;
    }

    const labels = this.labels;

    this._frame = document.createElement('div');
    this._frame.className = 'donut__frame';
    this._frame.tabIndex = 0;
    this._frame.setAttribute('role', 'group');

    this._canvas = svgNode('svg', { class: 'donut__canvas' });

    this._centre = document.createElement('div');
    this._centre.className = 'donut__centre';
    this._centreLabel = document.createElement('p');
    this._centreLabel.className = 'donut__centre-label';
    this._centreValue = document.createElement('p');
    this._centreValue.className = 'donut__centre-value';
    this._centreShare = document.createElement('p');
    this._centreShare.className = 'donut__centre-share';
    this._centreShare.hidden = true;
    this._centre.append(this._centreLabel, this._centreValue, this._centreShare);

    this._empty = document.createElement('p');
    this._empty.className = 'donut__empty';
    this._empty.hidden = true;

    this._frame.append(this._canvas, this._centre, this._empty);

    this._legend = document.createElement('ul');
    this._legend.className = 'donut__legend';

    this._note = document.createElement('p');
    this._note.className = 'donut__note';
    this._note.hidden = true;

    this._toggle = document.createElement('button');
    this._toggle.type = 'button';
    this._toggle.className = 'donut__table-toggle';
    this._toggle.textContent = labels.showTable;
    this._toggle.setAttribute('aria-expanded', 'false');

    this._status = document.createElement('span');
    this._status.className = 'donut__sr-only';
    this._status.setAttribute('role', 'status');

    const front = document.createDocumentFragment();
    front.append(this._frame, this._legend, this._note, this._toggle);

    if (this._table) {
      this._table.id = this._table.id || uniqueId('donut-table');
      this._toggle.setAttribute('aria-controls', this._table.id);

      this._tableWrap = document.createElement('div');
      this._tableWrap.className = 'donut__table-wrap';
      this._table.before(this._tableWrap);
      this._tableWrap.append(this._table);
      this._tableWrap.before(front);
    } else {
      this.prepend(front);
    }

    this.append(this._status);

    this._frame.addEventListener('pointerleave', this._handleLeave);
    this._frame.addEventListener('keydown', this._handleKeyDown);
    this._frame.addEventListener('blur', this._handleLeave);
    this._legend.addEventListener('click', this._handleLegendClick);
    this._legend.addEventListener('pointerleave', this._handleLeave);
    this._legend.addEventListener('focusout', this._handleLegendBlur);
    this._toggle.addEventListener('click', this._handleToggleTable);

    this._syncTable();
  }

  _schedule() {
    if (this._pending) {
      return;
    }

    this._pending = requestAnimationFrame(() => {
      this._pending = null;
      this._render();
    });
  }

  /* ---- Drawing ------------------------------------------------------------------------ */

  _render() {
    if (!this._frame) {
      return;
    }

    const labels = this.labels;
    const { usable, dropped } = usableSlices(this._rows);
    const { shown, folded } = foldSlices(usable, { limit: SLICE_LIMIT, name: labels.other });

    this._plotted = shown;
    this._renderLegend(shown);
    this._renderTableKeys();
    this._renderNote({ folded, dropped, labels });

    const drawable = shown.filter((slice) => !this._hidden.has(slice.slot));
    const total = drawable
      .filter((slice) => Number.isFinite(slice.value) && slice.value > 0)
      .reduce((sum, slice) => sum + slice.value, 0);

    this._total = total;

    const rect = this._frame.getBoundingClientRect();
    const size = Math.max(0, Math.min(Math.round(rect.width), Math.round(rect.height)));
    const error = this.getAttribute('error');
    const nothing = total <= 0;

    this._empty.hidden = !nothing && !error;
    this._empty.textContent = error || labels.empty;
    this._centre.hidden = nothing || Boolean(error);

    this._frame.setAttribute(
      'aria-label',
      [this._caption, nothing ? labels.empty : ''].filter(Boolean).join(', '),
    );

    this._canvas.replaceChildren();
    this._canvas.setAttribute('width', String(Math.round(rect.width)));
    this._canvas.setAttribute('height', String(Math.round(rect.height)));

    if (nothing || error || size === 0) {
      this._readSlot = -1;
      this._writeCentre();
      return;
    }

    // Room kept for the wedge that comes out. Sized to the ring without it, a lifted wedge
    // would be clipped by the edge of the canvas at exactly the moment it is being read.
    const outer = size / 2 - LIFT - 3;
    const inner = outer * HOLE;
    const cx = Math.round(rect.width) / 2;
    const cy = Math.round(rect.height) / 2;

    // The gap is worked out in pixels and turned into an angle, so it is the same width on a
    // small ring as on a large one.
    const { slices: spaced } = sliceAngles(
      drawable.map((slice) => slice.value),
      { gap: gapRadians(2, outer, inner) },
    );

    this._wedges = spaced.map((slice, position) => {
      const entry = drawable[position];
      const wedge = svgNode('path', {
        class: 'donut__slice',
        d: arcPath({ cx, cy, outer, inner, from: slice.from, to: slice.to }),
        'data-slot': entry.slot,
        tabindex: '-1',
        role: 'img',
      });

      wedge.style.setProperty('--mark-colour', colourFor(entry.slot));

      // Out along the wedge's own middle, so it leaves the ring rather than sliding sideways
      // out of it.
      const middle = midAngle(slice);
      wedge.style.setProperty('--lift-x', `${Math.round(Math.cos(middle) * LIFT * 100) / 100}px`);
      wedge.style.setProperty('--lift-y', `${Math.round(Math.sin(middle) * LIFT * 100) / 100}px`);

      wedge.setAttribute(
        'aria-label',
        fillLabel(labels.slice, {
          name: entry.name,
          value: entry.text || formatNumber(entry.value),
          share: formatShare(slice.share),
        }),
      );

      wedge.addEventListener('pointerenter', this._handleSliceEnter);
      wedge.addEventListener('focus', this._handleSliceEnter);
      this._canvas.append(wedge);

      return { wedge, entry, slice };
    });

    this._writeCentre();
  }

  _renderNote({ folded, dropped, labels }) {
    const lines = [];

    if (folded > 0) {
      lines.push(fillLabel(labels.folded, { count: folded, name: labels.other }));
    }

    if (dropped > 0) {
      lines.push(fillLabel(labels.negatives, { count: dropped }));
    }

    if (this._extraColumns > 0) {
      lines.push(labels.ignoredColumns);
    }

    this._note.hidden = lines.length === 0;
    this._note.textContent = lines.join('. ');
  }

  /**
   * The hole, holding the total — or the wedge being read.
   *
   * The hole is the whole reason to draw a ring rather than a pie: it is the one place a
   * part-to-whole chart can put the number the parts are parts of.
   */
  _writeCentre() {
    const labels = this.labels;
    const reading = this._wedges?.find((wedge) => wedge.entry.slot === this._readSlot);

    if (reading) {
      this._centreLabel.textContent = reading.entry.name;
      this._centreValue.textContent = reading.entry.text || formatNumber(reading.entry.value);
      this._centreShare.textContent = formatShare(reading.slice.share);
      this._centreShare.hidden = false;
      return;
    }

    this._centreLabel.textContent = this.getAttribute('center-label') ?? labels.total;
    this._centreValue.textContent = formatNumber(this._total ?? 0);
    this._centreShare.hidden = true;
  }

  /**
   * The legend, and it is not a colour key.
   *
   * A ring is read by angle and nobody reads angle accurately, so the number and the share
   * live here rather than being left to the shape. This is the part somebody actually reads.
   */
  _renderLegend(shown) {
    const wanted = shown.length > 0 && !this.hasAttribute('no-legend');
    this._legend.hidden = !wanted;

    if (!wanted) {
      this._legend.replaceChildren();
      return;
    }

    const labels = this.labels;
    const total = shown
      .filter((slice) => !this._hidden.has(slice.slot))
      .reduce((sum, slice) => sum + slice.value, 0);

    this._legend.replaceChildren(
      ...shown.map((slice) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'donut__legend-button';
        button.dataset.slot = String(slice.slot);
        button.setAttribute('aria-pressed', String(!this._hidden.has(slice.slot)));

        const swatch = document.createElement('span');
        swatch.className = 'donut__legend-swatch';
        // Bound to the row it was written in, so hiding one never repaints the others.
        swatch.style.setProperty('--mark-colour', colourFor(slice.slot));

        const name = document.createElement('span');
        name.textContent = slice.name;

        const value = document.createElement('span');
        value.className = 'donut__legend-value';
        value.textContent = slice.text || formatNumber(slice.value);

        const share = document.createElement('span');
        share.className = 'donut__legend-share';
        share.textContent =
          total > 0 && !this._hidden.has(slice.slot) ? formatShare(slice.value / total) : '';

        // The legend row and its wedge are the same thing said twice, so pointing at either
        // lifts the wedge and fills the hole. A reader looking down a list of numbers should
        // not have to go back to the ring to find which one is which.
        button.addEventListener('pointerenter', this._handleSliceEnter);
        button.addEventListener('focus', this._handleSliceEnter);

        button.append(swatch, name, value, share);
        item.append(button);
        return item;
      }),
    );
  }

  _renderTableKeys() {
    if (!this._table) {
      return;
    }

    const { usable } = usableSlices(this._rows);

    [...this._table.querySelectorAll('tbody tr')].forEach((row, index) => {
      const position = usable.findIndex((entry) => entry.index === index);

      if (position < 0 || position >= SLICE_LIMIT) {
        return;
      }

      const cell = row.querySelector('th, td');
      const existing = cell?.querySelector('.donut__table-key');
      const key = existing ?? document.createElement('span');
      key.className = 'donut__table-key';
      key.setAttribute('aria-hidden', 'true');
      key.style.setProperty('--mark-colour', colourFor(position));

      if (!existing) {
        cell?.prepend(key);
      }
    });
  }

  _syncTable() {
    if (!this._table) {
      return;
    }

    this._tableWrap?.classList.toggle('donut__sr-only', !this._tableOpen);
    this._toggle.textContent = this._tableOpen ? this.labels.hideTable : this.labels.showTable;
    this._toggle.setAttribute('aria-expanded', String(this._tableOpen));
  }

  _handleToggleTable() {
    this._tableOpen = !this._tableOpen;
    this._syncTable();
  }

  _handleLegendClick(event) {
    const button = event.target.closest('[data-slot]');

    if (!button) {
      return;
    }

    const slot = Number.parseInt(button.dataset.slot, 10);
    const showing = this._plotted.filter((slice) => !this._hidden.has(slice.slot));

    // The last wedge standing is not allowed to go: an empty ring under a full legend reads
    // as broken rather than as a choice.
    if (this._hidden.has(slot)) {
      this._hidden.delete(slot);
    } else if (showing.length > 1) {
      this._hidden.add(slot);
    } else {
      return;
    }

    this._render();
  }

  /* ---- Reading a wedge ---------------------------------------------------------------- */

  _handleSliceEnter(event) {
    const slot = Number.parseInt(event.currentTarget.dataset.slot, 10);

    // A hidden row has no wedge to lift and nothing to put in the hole.
    this._readSlot = Number.isInteger(slot) && !this._hidden.has(slot) ? slot : -1;
    this._markActive();
    this._writeCentre();
  }

  _handleLeave() {
    this._readSlot = -1;
    this._markActive();
    this._writeCentre();
  }

  /** Only when focus has actually left the legend, not while it moves between two rows. */
  _handleLegendBlur(event) {
    if (!this._legend.contains(event.relatedTarget)) {
      this._handleLeave();
    }
  }

  /**
   * One wedge forward, the rest back.
   *
   * The flag lives on the frame rather than on each wedge, so the dimming is one rule about
   * "something is being read" instead of a class written onto every wedge that is not it.
   */
  _markActive() {
    this._frame.toggleAttribute('data-reading', this._readSlot >= 0);

    this._wedges?.forEach(({ wedge, entry }) =>
      wedge.toggleAttribute('data-active', entry.slot === this._readSlot),
    );

    this._legend.querySelectorAll('[data-slot]').forEach((button) => {
      button.toggleAttribute(
        'data-active',
        Number.parseInt(button.dataset.slot, 10) === this._readSlot,
      );
    });
  }

  /**
   * The keyboard walks the wedges and lands on the same reading the pointer does.
   *
   * The wedges carry `tabindex="-1"` rather than `0`: the frame is the one tab stop, and the
   * arrows move within it. A ring of six wedges that each take a tab press is six presses
   * somebody has to make to get past one chart.
   */
  _handleKeyDown(event) {
    const wedges = this._wedges ?? [];

    if (wedges.length === 0) {
      return;
    }

    const current = wedges.findIndex((wedge) => wedge.entry.slot === this._readSlot);
    const last = wedges.length - 1;

    const moves = {
      ArrowRight: () => (current < 0 ? 0 : Math.min(last, current + 1)),
      ArrowDown: () => (current < 0 ? 0 : Math.min(last, current + 1)),
      ArrowLeft: () => (current < 0 ? last : Math.max(0, current - 1)),
      ArrowUp: () => (current < 0 ? last : Math.max(0, current - 1)),
      Home: () => 0,
      End: () => last,
    };

    if (event.key === 'Escape') {
      this._handleLeave();
      return;
    }

    const move = moves[event.key];

    if (!move) {
      return;
    }

    // Cancelled, or the arrows scroll the page as well as walking the ring.
    event.preventDefault();

    const next = wedges[move()];
    this._readSlot = next.entry.slot;
    this._markActive();
    this._writeCentre();
    this._status.textContent = next.wedge.getAttribute('aria-label');
  }
}

if (!customElements.get('ui-donut-chart')) {
  customElements.define('ui-donut-chart', UiDonutChart);
}
