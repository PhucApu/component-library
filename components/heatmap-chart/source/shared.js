import {
  BIN_COUNT,
  DEFAULT_LABELS,
  binFor,
  binThresholds,
  colourFor,
  fillLabel,
  formatNumber,
  parseValue,
  stepRanges,
} from './heatmap-chart-core.js';

let sequence = 0;

function uniqueId(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

/**
 * A grid where colour carries magnitude.
 *
 * The other charts in this collection use colour for **identity** — which series is which.
 * Here it carries **size**, and the rules are almost the opposite: one hue rather than eight,
 * light to dark rather than a fixed order, and a scale legend that is never optional. A
 * colour meaning "a lot" says nothing until the reader is told how much a lot is.
 *
 * ```html
 * <ui-heatmap-chart>
 *   <table>
 *     <caption>Sessions by hour</caption>
 *     <thead><tr><th></th><th>00</th><th>01</th></tr></thead>
 *     <tbody><tr><th>Mon</th><td data-value="12">12</td><td></td></tr></tbody>
 *   </table>
 * </ui-heatmap-chart>
 * ```
 *
 * **An empty cell and a zero are different things.** Empty is outside the range — a day that
 * has not happened — and gets no square at all. A written `0` was measured and had nothing in
 * it, and gets the quietest square on the scale. Collapsing them is the fault that makes an
 * activity calendar say "nobody worked" about a month nobody has reached yet.
 */
export class UiHeatmapChart extends HTMLElement {
  static get observedAttributes() {
    return ['scale', 'max', 'cell', 'loading', 'error'];
  }

  constructor() {
    super();
    this._connected = false;
    this._labelOverrides = {};
    this._columns = [];
    this._rows = [];
    this._readAt = null;
    this._tableOpen = false;

    this._handleCellEnter = this._handleCellEnter.bind(this);
    this._handleLeave = this._handleLeave.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleToggleTable = this._handleToggleTable.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this._read();
    this._build();
    this._render();
  }

  disconnectedCallback() {
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._connected || oldValue === newValue) {
      return;
    }

    if (name !== 'loading') {
      this._read();
    }

    this._render();
  }

  /* ---- What the page can ask ---------------------------------------------------------- */

  get columns() {
    return [...this._columns];
  }

  get rows() {
    return this._rows.map((row) => ({ name: row.name, values: [...row.values] }));
  }

  /** The edges between one step of the scale and the next. */
  get thresholds() {
    return [...(this._thresholds ?? [])];
  }

  get scale() {
    return this.getAttribute('scale') === 'quantile' ? 'quantile' : 'linear';
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

  _read() {
    const table = this.querySelector('table');
    this._table = table ?? null;

    if (!table) {
      this._columns = [];
      this._rows = [];
      return;
    }

    const headings = [...table.querySelectorAll('thead th')];
    const rows = [...table.querySelectorAll('tbody tr')];

    this._caption = table.querySelector('caption')?.textContent.trim() ?? '';
    // The first heading sits above the row labels and names nothing on the grid.
    this._columns = headings.slice(1).map((heading) => heading.textContent.trim());

    this._rows = rows.map((row) => {
      const cells = [...row.children];

      return {
        name: cells[0]?.textContent.trim() ?? '',
        values: this._columns.map((unused, column) => {
          const cell = cells[column + 1];
          return parseValue(cell?.textContent, cell?.dataset?.value);
        }),
        texts: this._columns.map((unused, column) => {
          const cell = cells[column + 1];
          return cell?.textContent.trim() ?? '';
        }),
      };
    });
  }

  /* ---- The furniture ------------------------------------------------------------------ */

  _build() {
    if (this._frame) {
      return;
    }

    const labels = this.labels;

    this._frame = document.createElement('div');
    this._frame.className = 'heat__frame';
    this._frame.tabIndex = 0;
    this._frame.setAttribute('role', 'group');

    this._grid = document.createElement('ul');
    this._grid.className = 'heat__grid';

    this._empty = document.createElement('p');
    this._empty.className = 'heat__empty';
    this._empty.hidden = true;

    this._readout = document.createElement('div');
    this._readout.className = 'heat__readout';
    this._readout.hidden = true;

    this._frame.append(this._grid, this._empty, this._readout);

    this._scale = document.createElement('p');
    this._scale.className = 'heat__scale';

    this._note = document.createElement('p');
    this._note.className = 'heat__note';
    this._note.hidden = true;

    this._toggle = document.createElement('button');
    this._toggle.type = 'button';
    this._toggle.className = 'heat__table-toggle';
    this._toggle.textContent = labels.showTable;
    this._toggle.setAttribute('aria-expanded', 'false');

    this._status = document.createElement('span');
    this._status.className = 'heat__sr-only';
    this._status.setAttribute('role', 'status');

    const front = document.createDocumentFragment();
    front.append(this._frame, this._scale, this._note, this._toggle);

    if (this._table) {
      this._table.id = this._table.id || uniqueId('heat-table');
      this._toggle.setAttribute('aria-controls', this._table.id);

      this._tableWrap = document.createElement('div');
      this._tableWrap.className = 'heat__table-wrap';
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
    this._toggle.addEventListener('click', this._handleToggleTable);

    this._syncTable();
  }

  /* ---- Drawing ------------------------------------------------------------------------ */

  _render() {
    if (!this._frame) {
      return;
    }

    const labels = this.labels;
    const error = this.getAttribute('error');
    const values = this._rows.flatMap((row) => row.values);
    const nothing = this._columns.length === 0 || this._rows.length === 0;

    this._thresholds = binThresholds({
      values,
      scale: this.scale,
      max: Number.parseFloat(this.getAttribute('max') ?? ''),
    });

    const cell = this.getAttribute('cell');

    if (cell) {
      this.style.setProperty('--heat-cell', cell);
    }

    this._empty.hidden = !nothing && !error;
    this._empty.textContent = error || labels.empty;
    this._grid.hidden = nothing || Boolean(error);
    this._scale.hidden = nothing || Boolean(error) || this._thresholds.length === 0;

    this._frame.setAttribute(
      'aria-label',
      [this._caption, nothing ? labels.empty : ''].filter(Boolean).join(', '),
    );

    if (nothing || error) {
      this._grid.replaceChildren();
      this._hideReadout();
      return;
    }

    this._renderGrid();
    this._renderScale();
    this._renderNote();
  }

  /**
   * One row of labels along the top, one label and a run of cells per row.
   *
   * Built as a grid of list items rather than a second table: the real table is already in the
   * page, and duplicating it in the accessibility tree would make a screen reader read every
   * figure twice — once as a grid of buttons and once as the table it came from.
   */
  _renderGrid() {
    const labels = this.labels;
    const columns = this._columns.length;

    this._grid.style.gridTemplateColumns = `auto repeat(${columns}, var(--heat-cell))`;

    // The whole grid is a picture of the table, so it stays out of the accessibility tree.
    // Exposing the cells as well would read every figure twice — once as a grid and once as
    // the table it was drawn from — and the table is the better of the two readings.
    this._grid.setAttribute('aria-hidden', 'true');

    const parts = [document.createElement('li')];
    parts[0].className = 'heat__corner';

    this._columns.forEach((name) => {
      const label = document.createElement('li');
      label.className = 'heat__column-label';
      label.setAttribute('aria-hidden', 'true');
      label.textContent = name;
      parts.push(label);
    });

    this._cells = [];

    this._rows.forEach((row, rowIndex) => {
      const label = document.createElement('li');
      label.className = 'heat__row-label';
      label.setAttribute('aria-hidden', 'true');
      label.textContent = row.name;
      parts.push(label);

      row.values.forEach((value, columnIndex) => {
        const item = document.createElement('li');
        const bin = binFor(value, this._thresholds);

        // A span rather than a button: nothing here is focusable, because the frame is the
        // one tab stop and the arrows move within it. A focusable element inside an
        // aria-hidden subtree is a trap for anyone arriving by keyboard.
        const square = document.createElement('span');
        square.className = 'heat__cell';
        square.dataset.row = String(rowIndex);
        square.dataset.column = String(columnIndex);
        square.style.setProperty('--cell-colour', colourFor(bin ?? 0));

        if (bin === null) {
          // No square at all. A day that has not happened is not a day with no activity.
          square.toggleAttribute('data-outside', true);
        } else {
          square.addEventListener('pointerenter', this._handleCellEnter);
        }

        item.append(square);
        parts.push(item);
        this._cells.push({ square, row: rowIndex, column: columnIndex, value, bin });
      });
    });

    this._grid.replaceChildren(...parts);
  }

  /**
   * The scale legend, which is not optional here.
   *
   * With identity a legend can sometimes be dropped — one series needs no key. With magnitude
   * it never can: a colour that means "a lot" says nothing until the reader is told how much.
   */
  _renderScale() {
    const labels = this.labels;
    const ranges = stepRanges(this._thresholds, labels);

    const less = document.createElement('span');
    less.textContent = labels.less;

    const more = document.createElement('span');
    more.textContent = labels.more;

    const swatches = ranges.map((range, index) => {
      const swatch = document.createElement('span');
      swatch.className = 'heat__scale-swatch';
      swatch.style.setProperty('--cell-colour', colourFor(index + 1));
      swatch.setAttribute('role', 'img');
      swatch.setAttribute('aria-label', range);
      return swatch;
    });

    const zero = document.createElement('span');
    zero.className = 'heat__scale-swatch';
    zero.style.setProperty('--cell-colour', colourFor(0));
    zero.setAttribute('role', 'img');
    zero.setAttribute('aria-label', labels.zero);

    this._scale.replaceChildren(less, zero, ...swatches, more);
  }

  /**
   * Says when the colour has stopped meaning a fixed amount.
   *
   * A linear scale needs no explanation: the same colour is the same quantity wherever it
   * appears. A rank-based one is not — two cells of the same colour may be ten apart or ten
   * thousand — and a reader who assumes otherwise reads the grid backwards. So it says so.
   */
  _renderNote() {
    const quantile = this.scale === 'quantile' && this._thresholds.length > 0;

    this._note.hidden = !quantile;
    this._note.textContent = quantile ? this.labels.quantileNote : '';
  }

  _syncTable() {
    if (!this._table) {
      return;
    }

    this._tableWrap?.classList.toggle('heat__sr-only', !this._tableOpen);
    this._toggle.textContent = this._tableOpen ? this.labels.hideTable : this.labels.showTable;
    this._toggle.setAttribute('aria-expanded', String(this._tableOpen));
  }

  _handleToggleTable() {
    this._tableOpen = !this._tableOpen;
    this._syncTable();
  }

  /* ---- Reading a cell ------------------------------------------------------------------ */

  _handleCellEnter(event) {
    const { row, column } = event.currentTarget.dataset;
    this._readAt = { row: Number.parseInt(row, 10), column: Number.parseInt(column, 10) };
    this._showReadout();
  }

  _handleLeave() {
    this._readAt = null;
    this._hideReadout();
  }

  _showReadout({ announce = false } = {}) {
    const found = this._cells?.find(
      (cell) => cell.row === this._readAt?.row && cell.column === this._readAt?.column,
    );

    if (!found || found.bin === null) {
      this._hideReadout();
      return;
    }

    const labels = this.labels;
    const row = this._rows[found.row];
    const shown = row.texts[found.column] || formatNumber(found.value);

    this._readout.replaceChildren();

    const value = document.createElement('span');
    value.className = 'heat__readout-value';
    value.textContent = shown;

    const where = document.createElement('span');
    where.className = 'heat__readout-where';
    // Names come out of somebody's spreadsheet, so they go in as text and never as markup.
    where.textContent = ` ${row.name}, ${this._columns[found.column]}`;

    this._readout.append(value, where);
    this._readout.hidden = false;

    this._cells.forEach((cell) => cell.square.toggleAttribute('data-active', cell === found));

    this._position(found);

    if (announce) {
      this._status.textContent = fillLabel(labels.cell, {
        row: row.name,
        column: this._columns[found.column],
        value: shown,
      });
    }
  }

  _position(found) {
    const frame = this._frame.getBoundingClientRect();
    const box = found.square.getBoundingClientRect();
    const size = { width: this._readout.offsetWidth, height: this._readout.offsetHeight };

    // Above the cell, and flipped below when there is no room above.
    const top = box.top - frame.top + this._frame.scrollTop - size.height - 8;
    const left = Math.min(
      Math.max(box.left - frame.left + this._frame.scrollLeft - size.width / 2 + box.width / 2, 4),
      Math.max(4, this._frame.scrollWidth - size.width - 4),
    );

    this._readout.style.insetBlockStart = `${top < 4 ? box.bottom - frame.top + this._frame.scrollTop + 8 : top}px`;
    this._readout.style.insetInlineStart = `${left}px`;
  }

  _hideReadout() {
    this._readout.hidden = true;
    this._cells?.forEach((cell) => cell.square.removeAttribute('data-active'));
  }

  /**
   * Four arrows, because a grid has two directions.
   *
   * The frame is the single tab stop and the arrows move inside it. Cells that are outside the
   * range are stepped over rather than landed on — there is nothing to read there, and a
   * keyboard that stops on holes is a keyboard that feels broken.
   */
  _handleKeyDown(event) {
    if (!this._cells?.length) {
      return;
    }

    const readable = this._cells.filter((cell) => cell.bin !== null);

    if (readable.length === 0) {
      return;
    }

    if (event.key === 'Escape') {
      this._handleLeave();
      return;
    }

    const at = this._readAt ?? { row: readable[0].row, column: readable[0].column - 1 };
    const moves = {
      ArrowRight: { row: 0, column: 1 },
      ArrowLeft: { row: 0, column: -1 },
      ArrowDown: { row: 1, column: 0 },
      ArrowUp: { row: -1, column: 0 },
    };

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const edge = event.key === 'Home' ? readable[0] : readable[readable.length - 1];
      this._readAt = { row: edge.row, column: edge.column };
      this._showReadout({ announce: true });
      return;
    }

    const step = moves[event.key];

    if (!step) {
      return;
    }

    // Cancelled, or the arrows scroll the frame as well as walking the grid.
    event.preventDefault();

    let next = { row: at.row + step.row, column: at.column + step.column };

    // Step over the holes rather than stopping on them.
    while (
      next.row >= 0 &&
      next.row < this._rows.length &&
      next.column >= 0 &&
      next.column < this._columns.length
    ) {
      const found = this._cells.find(
        (cell) => cell.row === next.row && cell.column === next.column,
      );

      if (found && found.bin !== null) {
        this._readAt = next;
        this._showReadout({ announce: true });
        return;
      }

      next = { row: next.row + step.row, column: next.column + step.column };
    }
  }
}

if (!customElements.get('ui-heatmap-chart')) {
  customElements.define('ui-heatmap-chart', UiHeatmapChart);
}

export { BIN_COUNT };
