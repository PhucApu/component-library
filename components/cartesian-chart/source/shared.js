import {
  DEFAULT_LABELS,
  SERIES_LIMIT,
  areaPath,
  colourFor,
  bandFor,
  barPath,
  extentValues,
  fillLabel,
  foldSeries,
  formatNumber,
  labelStride,
  linePath,
  linearScale,
  markerIndices,
  parseValue,
  scaleFor,
  slotFor,
  stackValues,
  visibleLabels,
} from './cartesian-chart-core.js';

const SVG = 'http://www.w3.org/2000/svg';

/** Bars are capped rather than filling their slot: the leftover band is the air around them. */
const MAX_BAR = 24;

/** Room a category label needs before its neighbour has to give way. */
const MIN_LABEL_SPACE = 52;

let sequence = 0;

function uniqueId(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

/** Where a series stops, which is where its label goes. `-1` when it never started. */
function lastPresent(values = []) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (Number.isFinite(values[index])) {
      return index;
    }
  }

  return -1;
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

/**
 * A chart drawn from a table that stays a table.
 *
 * The markup an author writes is an ordinary `<table>`, and that is the whole data contract.
 * It buys three things at once that are usually three separate pieces of work:
 *
 * - **A fallback.** With no script the page is a readable table of numbers rather than an
 *   empty box where a chart was going to be.
 * - **The accessible twin.** Every chart is supposed to have a table equivalent; here it is
 *   not a copy that can drift, it is the source.
 * - **The contrast relief.** Three of the eight light-theme series colours sit below 3:1 on
 *   white by design. That is allowed only where the values are also readable without colour,
 *   which is exactly what the table is. So the table cannot be turned off.
 *
 * ```html
 * <ui-cartesian-chart type="line">
 *   <table>
 *     <caption>Revenue by month</caption>
 *     <thead><tr><th>Month</th><th>Online</th><th>Retail</th></tr></thead>
 *     <tbody><tr><th>Jan</th><td data-value="4200">$4,200</td><td>3,100</td></tr></tbody>
 *   </table>
 * </ui-cartesian-chart>
 * ```
 *
 * **There is no second value axis and no way to ask for one.** Two scales on one plot invent a
 * correlation that is not in the data — the alignment between them is arbitrary, so the reader
 * sees a relationship the author chose rather than one the numbers have. Two measures of
 * different size are two charts, or one chart with both indexed to a common base.
 */
export class UiCartesianChart extends HTMLElement {
  static get observedAttributes() {
    return [
      'type',
      'stacked',
      'y-min',
      'y-max',
      'x-label',
      'y-label',
      'no-legend',
      'no-labels',
      'fold-others',
      'loading',
      'error',
    ];
  }

  constructor() {
    super();
    this._connected = false;
    this._labelOverrides = {};
    this._categories = [];
    this._series = [];
    this._hidden = new Set();
    this._readIndex = -1;
    this._tableOpen = false;

    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerLeave = this._handlePointerLeave.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleLegendClick = this._handleLegendClick.bind(this);
    this._handleToggleTable = this._handleToggleTable.bind(this);
    this._handleBlur = this._handleBlur.bind(this);
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

    // Redrawn at the size it is actually given rather than scaled by a viewBox: scaling an
    // SVG stretches its text with it, and an axis label squeezed to 82% of its width is the
    // clearest sign nobody looked at the chart on a narrow screen.
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

    if (name !== 'loading' && name !== 'error') {
      this._read();
    }

    this._render();
  }

  /* ---- What the page can ask ---------------------------------------------------------- */

  get categories() {
    return [...this._categories];
  }

  get series() {
    return this._series.map((entry) => ({ ...entry, values: [...entry.values] }));
  }

  /** The series currently drawn, in the order they were written. */
  get visible() {
    return this._series.filter((entry) => !this._hidden.has(entry.index));
  }

  get type() {
    const asked = (this.getAttribute('type') ?? '').trim().toLowerCase();
    return ['line', 'area', 'column', 'bar'].includes(asked) ? asked : 'line';
  }

  get stacked() {
    return this.hasAttribute('stacked') && this.type !== 'line';
  }

  get labels() {
    return { ...DEFAULT_LABELS, ...this._labelOverrides };
  }

  set labels(value) {
    this._labelOverrides = value && typeof value === 'object' ? { ...value } : {};
    this._render();
  }

  showSeries(index) {
    this._hidden.delete(index);
    this._render();
    this._reportToggle(index, false);
  }

  hideSeries(index) {
    // The last one standing is not allowed to go: an empty plot with a full legend reads as
    // broken rather than as a choice.
    if (this.visible.length <= 1 && !this._hidden.has(index)) {
      return;
    }

    this._hidden.add(index);
    this._render();
    this._reportToggle(index, true);
  }

  /* ---- Reading the markup ------------------------------------------------------------- */

  /**
   * Reads the table, and leaves it exactly as it was.
   *
   * A cell is written for a person — `$4,200` — and plotted as a number. `data-value` wins
   * when it is present, which is the way out for anything the parser cannot be sure about.
   * The text is kept as well, so the read-out can show the value the way the author wrote it
   * rather than a reformatted version of the same number.
   */
  _read() {
    const table = this.querySelector('table');
    this._table = table ?? null;

    if (!table) {
      this._categories = [];
      this._series = [];
      return;
    }

    const headings = [...table.querySelectorAll('thead th')];
    const rows = [...table.querySelectorAll('tbody tr')];

    this._caption = table.querySelector('caption')?.textContent.trim() ?? '';
    this._categories = rows.map((row) => row.querySelector('th, td')?.textContent.trim() ?? '');

    const names = headings.slice(1).map((heading) => heading.textContent.trim());

    this._series = names.map((name, column) => {
      const cells = rows.map((row) => [...row.children][column + 1]);

      return {
        name,
        index: column,
        values: cells.map((cell) => parseValue(cell?.textContent, cell?.dataset?.value)),
        texts: cells.map((cell) => cell?.textContent.trim() ?? ''),
      };
    });

    // A series the author has switched off should stay off across a re-read; one that no
    // longer exists should not keep a slot in the set for ever.
    this._hidden = new Set([...this._hidden].filter((index) => index < this._series.length));
  }

  /* ---- The furniture ------------------------------------------------------------------ */

  _build() {
    if (this._frame) {
      return;
    }

    const labels = this.labels;

    this._frame = document.createElement('div');
    this._frame.className = 'chart__frame';
    this._frame.tabIndex = 0;
    this._frame.setAttribute('role', 'group');

    this._canvas = svgNode('svg', { class: 'chart__canvas', 'aria-hidden': 'true' });
    this._measure = svgNode('text', {
      class: 'chart__measure',
      x: -9999,
      y: -9999,
      'aria-hidden': 'true',
    });
    this._canvas.append(this._measure);

    this._empty = document.createElement('p');
    this._empty.className = 'chart__empty';
    this._empty.hidden = true;

    this._readout = document.createElement('div');
    this._readout.className = 'chart__readout';
    this._readout.hidden = true;

    this._frame.append(this._canvas, this._empty, this._readout);

    this._legend = document.createElement('ul');
    this._legend.className = 'chart__legend';

    this._note = document.createElement('p');
    this._note.className = 'chart__note';
    this._note.hidden = true;

    this._toggle = document.createElement('button');
    this._toggle.type = 'button';
    this._toggle.className = 'chart__table-toggle';
    this._toggle.textContent = labels.showTable;
    this._toggle.setAttribute('aria-expanded', 'false');

    // Present and empty before there is anything to say. A live region written into the page
    // at the moment it gains text is a region nothing announces.
    this._status = document.createElement('span');
    this._status.className = 'chart__sr-only';
    this._status.setAttribute('role', 'status');

    const front = document.createDocumentFragment();
    front.append(this._frame, this._legend, this._note, this._toggle);

    if (this._table) {
      this._table.id = this._table.id || uniqueId('chart-table');
      this._toggle.setAttribute('aria-controls', this._table.id);

      // Wrapped rather than hidden directly. A table cannot be squeezed below its own
      // min-content width, so `inline-size: 1px` on the table itself leaves an eleven-column
      // grid sticking 800 pixels out of a 360-pixel page — clipped invisibly, and still
      // pushing a horizontal scrollbar onto the document. A block wrapper clips properly,
      // and when the table is shown it is what scrolls instead of the page.
      this._tableWrap = document.createElement('div');
      this._tableWrap.className = 'chart__table-wrap';
      this._table.before(this._tableWrap);
      this._tableWrap.append(this._table);
      this._tableWrap.before(front);
    } else {
      this.prepend(front);
    }

    this.append(this._status);

    this._frame.addEventListener('pointermove', this._handlePointerMove);
    this._frame.addEventListener('pointerleave', this._handlePointerLeave);
    this._frame.addEventListener('keydown', this._handleKeyDown);
    this._frame.addEventListener('blur', this._handleBlur);
    this._legend.addEventListener('click', this._handleLegendClick);
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
    const { shown, hidden } = foldSeries(this._series, {
      fold: this.hasAttribute('fold-others'),
    });

    this._plotted = shown;
    this._renderLegend(shown);
    this._renderTableKeys();

    this._note.hidden = hidden.length === 0;
    this._note.textContent = hidden.length
      ? fillLabel(labels.hiddenSeries, { count: hidden.length })
      : '';

    const drawable = shown.filter((entry) => !this._hidden.has(entry.index));
    const rect = this._frame.getBoundingClientRect();
    const width = Math.max(0, Math.round(rect.width));
    const height = Math.max(0, Math.round(rect.height));

    this._canvas.replaceChildren(this._measure);
    this._canvas.setAttribute('width', String(width));
    this._canvas.setAttribute('height', String(height));

    const error = this.getAttribute('error');
    const nothing = this._categories.length === 0 || drawable.length === 0;

    this._empty.hidden = !nothing && !error;
    this._empty.textContent = error || labels.empty;

    this._frame.setAttribute(
      'aria-label',
      [this._caption, this.type, nothing ? labels.empty : ''].filter(Boolean).join(', '),
    );

    if (nothing || error || width === 0 || height === 0) {
      this._hideReadout();
      return;
    }

    const geometry = this._geometry({ width, height, drawable });
    this._lastGeometry = geometry;

    this._renderAxes(geometry);
    this._renderMarks(geometry, drawable);

    // Only the first paint animates. Re-running it on every resize would make dragging a
    // window edge look like a fault.
    this._drawn = true;

    if (this._readIndex >= 0) {
      // The canvas was replaced, so the crosshair and the panel have to be put back — at the
      // new geometry, not the old one.
      this._showReadout(this._readIndex);
    }
  }

  /**
   * Where the plot actually starts.
   *
   * The insets are measured, not guessed: the widest tick label decides the left edge, and the
   * category labels decide the bottom. Guessing is how an axis ends up clipped at one size and
   * swimming in space at another.
   */
  _geometry({ width, height, drawable }) {
    const horizontal = this.type === 'bar';
    const includeZero = this.type === 'column' || this.type === 'bar';
    const stacked = this.stacked;

    const scale = linearScale({
      values: extentValues({ series: drawable, stacked }),
      includeZero,
      min: Number.parseFloat(this.getAttribute('y-min') ?? ''),
      max: Number.parseFloat(this.getAttribute('y-max') ?? ''),
      tickCount: horizontal ? 4 : 5,
    });

    const tickTexts = scale.ticks.map((tick) => formatNumber(tick, { step: scale.step }));
    const valueRoom = Math.max(...tickTexts.map((text) => this._textWidth(text)), 0);
    const categoryRoom = Math.max(
      ...this._categories.map((text) => this._textWidth(text)),
      0,
    );

    const axisTitleRoom = 16;
    // Room for the labels that ride the end of each line, measured before the plot is sized.
    // Sizing the plot first and then discovering the label does not fit is how a chart ends
    // up with its most useful number quietly missing.
    const endRoom = this._endLabelRoom(drawable, horizontal);

    // A y-axis title sits above the plot, so the plot has to start below it. Sharing the row
    // with the topmost tick is how the two ended up printed on top of each other.
    // Measured, not guessed: a 12px label reports a 16px line box, so a baseline at 12 puts
    // its top one pixel above the frame. 14 clears it, and the plot starts below all of it.
    const titleRoom = this.getAttribute('y-label') ? 20 : 0;

    const inset = horizontal
      ? {
          top: 10 + titleRoom,
          right: Math.max(14, endRoom),
          bottom: 22 + (this.getAttribute('x-label') ? axisTitleRoom : 0),
          left: Math.min(categoryRoom + 12, Math.round(width * 0.4)),
        }
      : {
          top: 12 + titleRoom,
          right: Math.max(14, endRoom),
          bottom: 24 + (this.getAttribute('x-label') ? axisTitleRoom : 0),
          left: valueRoom + 12,
        };

    const plot = {
      left: inset.left,
      right: width - inset.right,
      top: inset.top,
      bottom: height - inset.bottom,
    };

    plot.width = Math.max(1, plot.right - plot.left);
    plot.height = Math.max(1, plot.bottom - plot.top);

    const valueScale = horizontal
      ? scaleFor({ min: scale.min, max: scale.max, from: plot.left, to: plot.right })
      : scaleFor({ min: scale.min, max: scale.max, from: plot.bottom, to: plot.top });

    return { horizontal, stacked, plot, scale, valueScale, tickTexts, width, height };
  }

  /**
   * How much of the right edge the end-of-line labels need.
   *
   * Zero unless labels are actually going to be drawn — an inset reserved for something that
   * never appears is just a plot that stops short of its own frame.
   */
  _endLabelRoom(drawable, horizontal) {
    const labelled =
      !this.hasAttribute('no-labels') &&
      ((['line', 'area'].includes(this.type) && drawable.length <= 4) ||
        (horizontal && drawable.length === 1 && !this.stacked));

    if (!labelled || drawable.length === 0) {
      return 0;
    }

    const widest = drawable.reduce((most, entry) => {
      // A horizontal bar labels every bar; a line labels only where it ends.
      const texts = horizontal ? entry.texts : [entry.texts[lastPresent(entry.values)] ?? ''];

      return texts.reduce((widestSoFar, text) => Math.max(widestSoFar, this._textWidth(text)), most);
    }, 0);

    return widest > 0 ? widest + 14 : 0;
  }

  /** Width of a string in the tick font, measured rather than approximated from its length. */
  _textWidth(text) {
    this._measure.textContent = String(text ?? '');

    try {
      const measured = this._measure.getComputedTextLength();

      if (measured > 0) {
        return measured;
      }
    } catch {
      // Not laid out yet — fall through to the estimate.
    }

    return String(text ?? '').length * 7;
  }

  _renderAxes({ horizontal, plot, scale, valueScale, tickTexts }) {
    const grid = svgNode('g');
    const marks = svgNode('g');

    scale.ticks.forEach((tick, index) => {
      const at = valueScale(tick);

      grid.append(
        svgNode('line', {
          class: 'chart__grid-line',
          x1: horizontal ? at : plot.left,
          x2: horizontal ? at : plot.right,
          y1: horizontal ? plot.top : at,
          y2: horizontal ? plot.bottom : at,
        }),
      );

      const label = svgNode('text', {
        class: 'chart__tick',
        x: horizontal ? at : plot.left - 8,
        y: horizontal ? plot.bottom + 16 : at + 4,
        'text-anchor': horizontal ? 'middle' : 'end',
      });
      label.textContent = tickTexts[index];
      marks.append(label);
    });

    // The baseline is the axis a bar grows from, so it is drawn a shade stronger than the grid.
    const zero = scale.min <= 0 && scale.max >= 0 ? valueScale(0) : null;

    if (zero !== null) {
      marks.append(
        svgNode('line', {
          class: 'chart__axis-line',
          x1: horizontal ? zero : plot.left,
          x2: horizontal ? zero : plot.right,
          y1: horizontal ? plot.top : zero,
          y2: horizontal ? plot.bottom : zero,
        }),
      );
    }

    const count = this._categories.length;
    const room = horizontal ? plot.height : plot.width;
    const stride = horizontal ? 1 : labelStride(count, room, MIN_LABEL_SPACE);

    visibleLabels(count, stride).forEach((index) => {
      const band = bandFor({
        index,
        count,
        from: horizontal ? plot.top : plot.left,
        to: horizontal ? plot.bottom : plot.right,
      });

      const label = svgNode('text', {
        class: 'chart__category',
        x: horizontal ? plot.left - 8 : band.centre,
        y: horizontal ? band.centre + 4 : plot.bottom + 18,
        'text-anchor': horizontal ? 'end' : 'middle',
      });
      label.textContent = this._categories[index];
      marks.append(label);
    });

    this._renderAxisTitles({ horizontal, plot, marks });
    this._canvas.append(grid, marks);
  }

  _renderAxisTitles({ plot, marks }) {
    const x = this.getAttribute('x-label');
    const y = this.getAttribute('y-label');

    if (x) {
      const title = svgNode('text', {
        class: 'chart__axis-title',
        x: plot.left + plot.width / 2,
        y: plot.bottom + 36,
        'text-anchor': 'middle',
      });
      title.textContent = x;
      marks.append(title);
    }

    if (y) {
      // Along the top rather than turned on its side. A rotated axis title is slower to read
      // and buys back a few pixels the plot did not need.
      const title = svgNode('text', { class: 'chart__axis-title', x: 2, y: 14 });
      title.textContent = y;
      marks.append(title);
    }
  }

  _renderMarks(geometry, drawable) {
    const layer = svgNode('g');
    this._linePoints = [];

    if (this.type === 'line' || this.type === 'area') {
      this._renderLines(geometry, drawable, layer);
    } else {
      this._renderBars(geometry, drawable, layer);
    }

    this._canvas.append(layer);

    // The whole read-out layer is one group that slides in x, so following the pointer is a
    // composited transform rather than a hairline redrawn at a new coordinate every frame.
    //
    // `hidden` is set as an attribute rather than as a property. `Element.hidden` is defined
    // on HTMLElement and does nothing at all on an SVG node, so assigning it left a hairline
    // parked at x=0 down the left of every chart — visible in the first screenshot, invisible
    // to every assertion that only asked whether the property was true.
    this._crosshair = svgNode('g', { class: 'chart__crosshair', hidden: '' });
    this._crosshair.append(
      svgNode('line', {
        class: 'chart__crosshair-line',
        x1: 0,
        x2: 0,
        y1: geometry.plot.top,
        y2: geometry.plot.bottom,
      }),
    );

    // One ring per series, riding the crosshair. The mark being read has to answer, or the
    // panel is the only thing that reacts and the chart itself looks inert.
    this._readMarks = this._linePoints.map(({ entry }) => {
      const mark = svgNode('circle', { class: 'chart__read-mark', cx: 0, cy: 0, r: 5 });
      mark.style.setProperty('--mark-colour', colourFor(entry.index));
      this._crosshair.append(mark);
      return mark;
    });

    this._canvas.append(this._crosshair);
  }

  _renderLines({ plot, valueScale, stacked }, drawable, layer) {
    const bands = stacked ? stackValues(drawable) : null;
    const count = this._categories.length;

    drawable.forEach((entry, position) => {
      const group = this._seriesGroup(entry);

      const points = this._categories.map((unused, index) => {
        const value = stacked ? bands[position][index]?.to : entry.values[index];

        if (!Number.isFinite(value)) {
          return null;
        }

        const band = bandFor({ index, count, from: plot.left, to: plot.right });

        return { x: band.centre, y: valueScale(value), index, value };
      });

      if (this.type === 'area') {
        group.append(
          svgNode('path', { class: 'chart__area', d: areaPath(points, plot.bottom) }),
        );
      }

      group.append(svgNode('path', { class: 'chart__line', d: linePath(points) }));

      markerIndices(points.map((point) => (point ? point.value : null))).forEach((index) => {
        const point = points[index];

        if (point) {
          group.append(
            svgNode('circle', { class: 'chart__marker', cx: point.x, cy: point.y, r: 4 }),
          );
        }
      });

      this._renderEndLabel({ group, points, entry, edge: this._lastGeometry.width });
      this._linePoints.push({ entry, points });
      layer.append(group);
    });
  }

  /** One group per series, carrying the colour its position earned and nothing else. */
  _seriesGroup(entry) {
    const group = svgNode('g', {
      class: `chart__series${this._drawn ? '' : ' chart__series--enter'}`,
      'data-series': entry.index,
    });

    group.style.setProperty('--mark-colour', colourFor(entry.index));

    return group;
  }

  /**
   * One label per series, at the end of its line.
   *
   * Selective on purpose: a number beside every point is chaos and goes unread. It is also
   * dropped entirely once the lines converge — nudging labels apart to fit detaches them from
   * the lines they name, which reads as noise. The legend and the read-out carry it instead.
   */
  _renderEndLabel({ group, points, entry, edge }) {
    if (this.hasAttribute('no-labels') || this.visible.length > 4) {
      return;
    }

    const last = [...points].reverse().find(Boolean);

    if (!last) {
      return;
    }

    const text = entry.texts[last.index] || formatNumber(last.value);
    const width = this._textWidth(text);

    // Measured against the edge of the frame, not the edge of the plot: the right inset was
    // widened for exactly this label, so refusing to let it sit there would reserve the space
    // and then leave it empty. Still never clipped — if it will not fit even there, it is
    // dropped and the read-out and the table carry the number instead.
    if (last.x + 8 + width > edge - 4) {
      return;
    }

    const label = svgNode('text', {
      class: 'chart__value-label',
      x: last.x + 8,
      y: last.y + 4,
    });
    label.textContent = text;
    group.append(label);
  }

  _renderBars({ horizontal, plot, valueScale, stacked }, drawable, layer) {
    const bands = stacked ? stackValues(drawable) : null;
    const count = this._categories.length;
    const groups = stacked ? 1 : drawable.length;
    // Columns and bars always include zero, so the baseline is always on the plot.
    const zero = valueScale(0);
    const gap = 2;

    // Only the segment furthest from the baseline gets the rounded end. Rounding every one of
    // them turns a stack into a column of separate pills, and the ones in the middle are not
    // where the value ends anyway.
    const outermost = stacked
      ? this._categories.map((unused, index) => {
          const positive = [];
          const negative = [];

          drawable.forEach((entry, position) => {
            const value = entry.values[index];

            if (Number.isFinite(value)) {
              (value < 0 ? negative : positive).push(position);
            }
          });

          return { positive: positive.at(-1) ?? -1, negative: negative.at(-1) ?? -1 };
        })
      : null;

    drawable.forEach((entry, position) => {
      const group = this._seriesGroup(entry);

      this._categories.forEach((unused, index) => {
        const band = bandFor({
          index,
          count,
          from: horizontal ? plot.top : plot.left,
          to: horizontal ? plot.bottom : plot.right,
          groups,
          group: stacked ? 0 : position,
        });

        const value = stacked ? bands[position][index] : entry.values[index];

        if (value === null || value === undefined || (!stacked && !Number.isFinite(value))) {
          return;
        }

        const from = stacked ? valueScale(value.from) : zero;
        const to = stacked ? valueScale(value.to) : valueScale(value);

        // The surface gap is taken out of the mark rather than drawn on top of it, so a
        // stacked segment and two adjacent bars are separated the same way and by the same
        // amount. A stroke around the mark would be data-weight ink doing a spacer's job.
        const between = stacked || groups > 1 ? gap : 0;
        const thickness = Math.min(MAX_BAR, Math.max(1, band.size - (groups > 1 ? gap : 0)));
        const offset = band.start + (band.size - thickness) / 2;

        const low = Math.min(from, to);
        const high = Math.max(from, to);
        const length = Math.max(0, high - low - (stacked ? between : 0));
        // The gap belongs on the far side, between this segment and the next one out.
        const start = stacked && to === low ? low + between : low;

        const size = stacked ? value.value : value;
        const negative = size < 0;
        const outer = stacked
          ? position === outermost[index][negative ? 'negative' : 'positive']
          : true;

        // Rounded at the data end, square at the foot. Rounding the foot as well would lift
        // the bar off the very zero it is measured from.
        const bar = svgNode('path', {
          class: 'chart__bar',
          'data-index': index,
          'data-series': entry.index,
          d: barPath({
            x: horizontal ? start : offset,
            y: horizontal ? offset : start,
            width: horizontal ? length : thickness,
            height: horizontal ? thickness : length,
            radius: outer ? 4 : 0,
            end: horizontal ? (negative ? 'left' : 'right') : negative ? 'bottom' : 'top',
          }),
        });

        group.append(bar);
      });

      this._renderBarLabels({
        group,
        entry,
        plot,
        valueScale,
        horizontal,
        count,
        groups,
        position,
        edge: this._lastGeometry.width,
      });
      layer.append(group);
    });
  }

  /**
   * The value on the cap of a bar, and only when there is one series and it fits.
   *
   * Two series side by side leaves no room that is not a collision, and a label that does not
   * fit is not shrunk or clipped — it is dropped, because the read-out and the table both
   * still have it.
   */
  _renderBarLabels({ group, entry, plot, valueScale, horizontal, count, groups, position, edge }) {
    if (this.hasAttribute('no-labels') || this.visible.length !== 1 || this.stacked) {
      return;
    }

    this._categories.forEach((unused, index) => {
      const value = entry.values[index];

      if (!Number.isFinite(value)) {
        return;
      }

      const band = bandFor({
        index,
        count,
        from: horizontal ? plot.top : plot.left,
        to: horizontal ? plot.bottom : plot.right,
        groups,
        group: position,
      });

      const at = valueScale(value);
      const text = entry.texts[index] || formatNumber(value);
      const width = this._textWidth(text);

      // Outside the bar end, in the room the inset reserved. Dropped rather than clipped or
      // shrunk when even that is not enough.
      if (horizontal ? at + 6 + width > edge - 4 : at - 6 < plot.top) {
        return;
      }

      const label = svgNode('text', {
        class: 'chart__value-label',
        x: horizontal ? at + 6 : band.start + band.size / 2,
        y: horizontal ? band.start + band.size / 2 + 4 : at - 6,
        'text-anchor': horizontal ? 'start' : 'middle',
      });
      label.textContent = text;
      group.append(label);
    });
  }

  /* ---- Legend and table --------------------------------------------------------------- */

  /**
   * A legend for two series or more, and none at all for one.
   *
   * With one series there is one colour, and the caption already says what is plotted; a box
   * holding a single swatch restates the title and costs a line. With two or more it is the
   * dependable identity channel and is never optional — nobody should have to match colours
   * by eye against the plot.
   */
  _renderLegend(shown) {
    const wanted = shown.length > 1 && !this.hasAttribute('no-legend');
    this._legend.hidden = !wanted;

    if (!wanted) {
      this._legend.replaceChildren();
      return;
    }

    const labels = this.labels;

    this._legend.replaceChildren(
      ...shown.map((entry) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chart__legend-button';
        button.dataset.series = String(entry.index);
        button.setAttribute('aria-pressed', String(!this._hidden.has(entry.index)));
        button.setAttribute('aria-label', fillLabel(labels.toggleSeries, { name: entry.name }));

        const swatch = document.createElement('span');
        swatch.className = 'chart__legend-swatch';
        swatch.dataset.shape = this.type === 'line' ? 'line' : 'rect';
        // Bound to the position the series was written in, so hiding one never repaints the
        // others. A reader who learned "Retail is orange" keeps that.
        swatch.style.setProperty('--mark-colour', colourFor(entry.index));

        const name = document.createElement('span');
        name.textContent = entry.name;

        button.append(swatch, name);
        item.append(button);
        return item;
      }),
    );
  }

  /** A colour key beside each heading, so the table reads as this chart rather than a copy. */
  _renderTableKeys() {
    if (!this._table) {
      return;
    }

    [...this._table.querySelectorAll('thead th')].slice(1).forEach((heading, column) => {
      if (column >= SERIES_LIMIT) {
        return;
      }

      const existing = heading.querySelector('.chart__table-key');
      const key = existing ?? document.createElement('span');
      key.className = 'chart__table-key';
      key.setAttribute('aria-hidden', 'true');
      key.style.setProperty('--mark-colour', colourFor(column));

      if (!existing) {
        heading.prepend(key);
      }
    });
  }

  /**
   * The table is hidden from the eye and never from the page.
   *
   * Collapsed it is visually hidden rather than `display: none`, so a screen reader still has
   * every number while the canvas beside it stays `aria-hidden`. The toggle changes what is
   * on screen, not what exists.
   */
  _syncTable() {
    if (!this._table) {
      return;
    }

    this._tableWrap?.classList.toggle('chart__sr-only', !this._tableOpen);
    this._toggle.textContent = this._tableOpen ? this.labels.hideTable : this.labels.showTable;
    this._toggle.setAttribute('aria-expanded', String(this._tableOpen));
  }

  _handleToggleTable() {
    this._tableOpen = !this._tableOpen;
    this._syncTable();
  }

  _handleLegendClick(event) {
    const button = event.target.closest('[data-series]');

    if (!button) {
      return;
    }

    const index = Number.parseInt(button.dataset.series, 10);

    if (this._hidden.has(index)) {
      this.showSeries(index);
    } else {
      this.hideSeries(index);
    }
  }

  _reportToggle(index, hidden) {
    const entry = this._series[index];

    this.dispatchEvent(
      new CustomEvent('chart-series-toggle', {
        detail: { index, name: entry?.name ?? '', hidden },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /* ---- Reading a value ---------------------------------------------------------------- */

  _nearestIndex(point) {
    const rect = this._frame.getBoundingClientRect();
    const geometry = this._lastGeometry;

    if (!geometry || this._categories.length === 0 || !point) {
      return -1;
    }

    const along = geometry.horizontal ? point.clientY - rect.top : point.clientX - rect.left;
    const from = geometry.horizontal ? geometry.plot.top : geometry.plot.left;
    const to = geometry.horizontal ? geometry.plot.bottom : geometry.plot.right;
    const span = (to - from) / this._categories.length;
    const index = Math.floor((along - from) / span);

    return Math.min(Math.max(index, 0), this._categories.length - 1);
  }

  /**
   * Reads at most once per frame, and only when the answer has changed.
   *
   * A pointer reports a hundred times across a plot with eight categories in it. Answering
   * every one of them tore the read-out down and built it again 483 times for 8 distinct
   * values, each rebuild forcing a layout to position itself — which is what made following
   * the pointer feel like it was catching.
   */
  _handlePointerMove(event) {
    this._pointer = { clientX: event.clientX, clientY: event.clientY };

    if (this._reading) {
      return;
    }

    this._reading = requestAnimationFrame(() => {
      this._reading = null;

      const index = this._nearestIndex(this._pointer);

      // Unchanged *and* still on screen. Escape can dismiss the panel with the pointer still
      // inside the same band, and moving again has to bring it back.
      if (index < 0 || (index === this._readIndex && !this._readout.hidden)) {
        return;
      }

      this._readIndex = index;
      this._showReadout(index);
    });
  }

  _handlePointerLeave() {
    if (this._reading) {
      cancelAnimationFrame(this._reading);
      this._reading = null;
    }

    // Focus keeps its reading: leaving with the pointer should not blank a value somebody is
    // holding with the keyboard.
    if (document.activeElement !== this._frame) {
      this._readIndex = -1;
      this._hideReadout();
    }
  }

  _handleBlur() {
    this._readIndex = -1;
    this._hideReadout();
  }

  _handleKeyDown(event) {
    const last = this._categories.length - 1;

    if (last < 0) {
      return;
    }

    const moves = {
      ArrowRight: () => Math.min(last, (this._readIndex < 0 ? -1 : this._readIndex) + 1),
      ArrowLeft: () => Math.max(0, (this._readIndex < 0 ? last + 1 : this._readIndex) - 1),
      ArrowUp: () => Math.max(0, (this._readIndex < 0 ? last + 1 : this._readIndex) - 1),
      ArrowDown: () => Math.min(last, (this._readIndex < 0 ? -1 : this._readIndex) + 1),
      Home: () => 0,
      End: () => last,
    };

    if (event.key === 'Escape') {
      this._readIndex = -1;
      this._hideReadout();
      return;
    }

    const move = moves[event.key];

    if (!move) {
      return;
    }

    // Cancelled, or the frame scrolls the page as well as walking the chart.
    event.preventDefault();
    this._readIndex = move();
    this._showReadout(this._readIndex, { announce: true });
  }

  /**
   * One read-out listing every series at that position.
   *
   * The pointer never has to land on a line or inside a bar: aiming at a 2px stroke is a game,
   * and the reader is aiming at a date. Keyboard focus produces exactly the same content,
   * because a value only reachable by hover is a value half the room cannot reach.
   */
  _showReadout(index, { announce = false } = {}) {
    const geometry = this._lastGeometry;

    if (!geometry || index < 0 || index >= this._categories.length) {
      this._hideReadout();
      return;
    }

    const labels = this.labels;
    const drawable = this._plotted.filter((entry) => !this._hidden.has(entry.index));

    // The marks being read lift, so the reader can see the chart answer rather than only a
    // panel appearing somewhere near their pointer.
    this._liftBars(index);
    this._readout.replaceChildren();

    const category = document.createElement('p');
    category.className = 'chart__readout-category';
    // Names come out of somebody's spreadsheet, so they are inserted as text and never as
    // markup.
    category.textContent = this._categories[index];
    this._readout.append(category);

    const spoken = [this._categories[index]];

    drawable.forEach((entry) => {
      const value = entry.values[index];

      if (!Number.isFinite(value)) {
        return;
      }

      const row = document.createElement('p');
      row.className = 'chart__readout-row';

      const key = document.createElement('span');
      key.className = 'chart__readout-key';
      key.style.setProperty('--mark-colour', colourFor(entry.index));

      const name = document.createElement('span');
      name.className = 'chart__readout-name';
      name.textContent = entry.name;

      const shown = entry.texts[index] || formatNumber(value);
      const number = document.createElement('span');
      number.className = 'chart__readout-value';
      number.textContent = shown;

      row.append(key, name, number);
      this._readout.append(row);
      spoken.push(`${entry.name} ${shown}`);
    });

    this._readout.hidden = false;

    this._positionReadout(index, geometry);

    // A crosshair finds the X on a line; on bars each bar is its own target and a hairline
    // through them would only add ink.
    const wanted = this.type === 'line' || this.type === 'area';
    this._crosshair?.toggleAttribute('hidden', !wanted);

    if (this._crosshair && wanted) {
      const band = bandFor({
        index,
        count: this._categories.length,
        from: geometry.plot.left,
        to: geometry.plot.right,
      });

      // Translated rather than re-coordinated: a transform is composited, and it is the only
      // thing here that a transition can carry smoothly from one category to the next.
      this._crosshair.style.transform = `translate(${band.centre}px, 0px)`;

      this._readMarks?.forEach((mark, position) => {
        const point = this._linePoints[position]?.points[index];
        const hiddenSeries = this._hidden.has(this._linePoints[position]?.entry.index);

        mark.toggleAttribute('hidden', !point || hiddenSeries);

        if (point && !hiddenSeries) {
          mark.setAttribute('cx', String(point.x - band.centre));
          mark.setAttribute('cy', String(point.y));
        }
      });
    }

    if (announce) {
      this._status.textContent = spoken.join(', ');
    }

    this.dispatchEvent(
      new CustomEvent('chart-read', {
        detail: {
          index,
          category: this._categories[index],
          values: drawable.map((entry) => ({
            name: entry.name,
            value: entry.values[index],
            text: entry.texts[index],
          })),
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Moves the panel by transform rather than by `inset`.
   *
   * `inset-inline-start` is a layout property: writing it makes the browser lay the panel out
   * again, and it cannot be transitioned to the next category — so the panel jumped. A
   * translate is composited and glides.
   *
   * `offsetWidth` rather than `getBoundingClientRect`, and only when the content has just
   * changed, because both force layout and this used to run on every pointer report.
   */
  _positionReadout(index, geometry) {
    const band = bandFor({
      index,
      count: this._categories.length,
      from: geometry.horizontal ? geometry.plot.top : geometry.plot.left,
      to: geometry.horizontal ? geometry.plot.bottom : geometry.plot.right,
    });

    const size = { width: this._readout.offsetWidth, height: this._readout.offsetHeight };
    const along = band.centre;

    if (geometry.horizontal) {
      const top = Math.min(Math.max(along - size.height / 2, 4), geometry.height - size.height - 4);
      this._readout.style.setProperty('--readout-x', `${geometry.plot.left + 12}px`);
      this._readout.style.setProperty('--readout-y', `${top}px`);
      return;
    }

    // Flipped to the other side rather than pushed off the frame.
    const preferred = along + 14;
    const left =
      preferred + size.width > geometry.width - 4 ? along - size.width - 14 : preferred;

    this._readout.style.setProperty('--readout-x', `${Math.max(4, left)}px`);
    this._readout.style.setProperty('--readout-y', `${geometry.plot.top + 8}px`);
  }

  _liftBars(index) {
    this._canvas
      .querySelectorAll('.chart__bar[data-active]')
      .forEach((bar) => bar.removeAttribute('data-active'));

    if (index >= 0) {
      this._canvas
        .querySelectorAll(`.chart__bar[data-index="${index}"]`)
        .forEach((bar) => bar.setAttribute('data-active', ''));
    }
  }

  _hideReadout() {
    this._readout.hidden = true;
    this._liftBars(-1);
    this._crosshair?.setAttribute('hidden', '');
  }
}

if (!customElements.get('ui-cartesian-chart')) {
  customElements.define('ui-cartesian-chart', UiCartesianChart);
}
