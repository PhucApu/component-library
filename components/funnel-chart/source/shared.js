import {
  DEFAULT_LABELS,
  STAGE_LIMIT,
  colourFor,
  fillLabel,
  formatNumber,
  formatRate,
  overallRate,
  parseValue,
  risingStages,
  stageMetrics,
  usableStages,
  worstDropIndex,
} from './funnel-chart-core.js';

let sequence = 0;

function uniqueId(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

/**
 * An ordered set of stages, drawn as bars from a common baseline.
 *
 * ```html
 * <ui-funnel-chart>
 *   <table>
 *     <caption>Checkout funnel</caption>
 *     <thead><tr><th scope="col">Stage</th><th scope="col">People</th></tr></thead>
 *     <tbody>
 *       <tr><th scope="row">Viewed product</th><td data-value="18400">18,400</td></tr>
 *     </tbody>
 *   </table>
 * </ui-funnel-chart>
 * ```
 *
 * **Not a trapezoid.** The tapering shape everyone recognises encodes the value as a width but
 * gives the eye an *area* to read, and the area of a trapezoid is not proportional to the
 * number it stands for. Every drop comes out looking worse than it was. Bars from a shared
 * left edge put the value in a length, which is the one channel people read accurately.
 *
 * The row order in the table **is** the stage order. Nothing is sorted, because a funnel that
 * has been sorted by size is no longer a funnel.
 */
export class UiFunnelChart extends HTMLElement {
  static get observedAttributes() {
    return ['max', 'shade', 'rates', 'loading', 'error'];
  }

  constructor() {
    super();
    this._connected = false;
    this._labelOverrides = {};
    this._rows = [];
    this._stages = [];
    this._readAt = null;
    this._tableOpen = false;

    this._handleStageEnter = this._handleStageEnter.bind(this);
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

  /** Every stage with its two rates, its absolute loss, and its share of the track. */
  get stages() {
    return this._stages.map((stage) => ({ ...stage }));
  }

  /** First stage to last, which is the number the funnel exists to produce. */
  get overall() {
    return overallRate(this._stages);
  }

  /** The stage that lost the most people, by count. `null` when there is no drop at all. */
  get largestDrop() {
    const at = worstDropIndex(this._stages);
    return at < 0 ? null : { ...this._stages[at] };
  }

  get shade() {
    return this.getAttribute('shade') === 'stages' ? 'stages' : 'single';
  }

  get rates() {
    const value = this.getAttribute('rates');
    return value === 'step' || value === 'top' ? value : 'both';
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
      this._rows = [];
      this._extraColumns = false;
      return;
    }

    const headings = [...table.querySelectorAll('thead th')];
    const body = [...table.querySelectorAll('tbody tr')];

    this._caption = table.querySelector('caption')?.textContent.trim() ?? '';
    this._measure = headings[1]?.textContent.trim() ?? '';
    // A funnel has one number per stage. A second value column is somebody's extra metric and
    // is left alone rather than silently plotted as a stage.
    this._extraColumns = headings.length > 2;

    this._rows = body.map((row) => {
      const cells = [...row.children];
      const cell = cells[1];

      return {
        name: cells[0]?.textContent.trim() ?? '',
        value: parseValue(cell?.textContent, cell?.dataset?.value),
        text: cell?.textContent.trim() ?? '',
      };
    });
  }

  /* ---- The furniture ------------------------------------------------------------------ */

  _build() {
    if (this._frame) {
      return;
    }

    const labels = this.labels;

    // Visible rather than screen-reader-only. The overall rate and the worst step are the two
    // findings the chart exists to deliver, and a sighted reader should not have to derive
    // them from the bars any more than anyone else should.
    this._summary = document.createElement('p');
    this._summary.className = 'funnel__summary';

    this._frame = document.createElement('div');
    this._frame.className = 'funnel__frame';
    this._frame.tabIndex = 0;
    this._frame.setAttribute('role', 'group');

    this._list = document.createElement('ol');
    this._list.className = 'funnel__list';

    this._empty = document.createElement('p');
    this._empty.className = 'funnel__empty';
    this._empty.hidden = true;

    this._frame.append(this._list, this._empty);

    this._note = document.createElement('p');
    this._note.className = 'funnel__note';
    this._note.hidden = true;

    this._toggle = document.createElement('button');
    this._toggle.type = 'button';
    this._toggle.className = 'funnel__table-toggle';
    this._toggle.textContent = labels.showTable;
    this._toggle.setAttribute('aria-expanded', 'false');

    this._status = document.createElement('span');
    this._status.className = 'funnel__sr-only';
    this._status.setAttribute('role', 'status');

    const front = document.createDocumentFragment();
    front.append(this._summary, this._frame, this._note, this._toggle);

    if (this._table) {
      this._table.id = this._table.id || uniqueId('funnel-table');
      this._toggle.setAttribute('aria-controls', this._table.id);

      this._tableWrap = document.createElement('div');
      this._tableWrap.className = 'funnel__table-wrap';
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
    const { usable, dropped } = usableStages(this._rows);

    this._dropped = dropped;
    this._stages = stageMetrics(usable, {
      max: Number.parseFloat(this.getAttribute('max') ?? ''),
    });

    const nothing = this._stages.length === 0;

    this._empty.hidden = !nothing && !error;
    this._empty.textContent = error || labels.empty;
    this._list.hidden = nothing || Boolean(error);
    this._summary.hidden = nothing || Boolean(error) || this._stages.length < 2;

    this._frame.setAttribute(
      'aria-label',
      [this._caption, nothing ? labels.empty : ''].filter(Boolean).join(', '),
    );

    if (nothing || error) {
      this._list.replaceChildren();
      this._summary.textContent = '';
      this._renderNote();
      return;
    }

    this._worstAt = worstDropIndex(this._stages);

    this._renderSummary();
    this._renderStages();
    this._renderNote();
  }

  /**
   * The two findings, in a sentence, before the picture.
   *
   * A funnel is read for two things: what fraction survived end to end, and which step is
   * costing the most. Both are computed here rather than in the reader's head.
   */
  _renderSummary() {
    const labels = this.labels;
    const parts = [];
    const rate = overallRate(this._stages);

    if (rate !== null) {
      parts.push(
        fillLabel(labels.overall, {
          first: formatNumber(this._stages[0].value),
          last: formatNumber(this._stages[this._stages.length - 1].value),
          rate: formatRate(rate),
        }),
      );
    }

    if (this._worstAt >= 0) {
      const worst = this._stages[this._worstAt];

      parts.push(
        fillLabel(labels.worstNote, {
          name: worst.name,
          count: formatNumber(worst.drop),
          rate: worst.stepRate === null ? '' : formatRate(worst.stepRate),
        }),
      );
    }

    this._summary.textContent = parts.join('. ');
    this._summary.hidden = parts.length === 0;
  }

  /**
   * One row per stage: a name, a figure, a bar, and the rates beside it.
   *
   * The whole list carries `aria-hidden`. Every word in it is either already in the table or
   * already in the summary above, so exposing it would read the funnel twice — and the table
   * is the better of the two readings because it is the data rather than a picture of it.
   */
  _renderStages() {
    const labels = this.labels;
    const shade = this.shade;
    // Past the ramp's length there is no seventh step that stays apart from the sixth, so every
    // stage takes one colour. Said in a note rather than left to be noticed.
    const ramped = shade === 'stages' && this._stages.length <= STAGE_LIMIT;

    this._list.setAttribute('aria-hidden', 'true');

    this._items = this._stages.map((stage, index) => {
      const item = document.createElement('li');
      item.className = 'funnel__stage';
      item.dataset.index = String(index);

      if (index === this._worstAt) {
        item.toggleAttribute('data-worst', true);
      }

      if (stage.rising) {
        item.toggleAttribute('data-rising', true);
      }

      const head = document.createElement('p');
      head.className = 'funnel__head';

      const name = document.createElement('span');
      name.className = 'funnel__name';
      // Stage names come out of somebody's spreadsheet, so they go in as text, never as markup.
      name.textContent = stage.name;

      const value = document.createElement('span');
      value.className = 'funnel__value';
      value.textContent = stage.text || formatNumber(stage.value);

      head.append(name, value);

      const track = document.createElement('span');
      track.className = 'funnel__track';

      const bar = document.createElement('span');
      bar.className = 'funnel__bar';
      bar.style.inlineSize = `${stage.fraction * 100}%`;
      bar.style.setProperty('--bar-colour', colourFor(index, { shade: ramped ? 'stages' : 'single' }));

      track.append(bar);

      // The piece that fell off, drawn where it fell off: starting exactly where this bar ends
      // and running back to where the previous one did. The loss is the one quantity a funnel
      // is drawn to show and it usually gets no ink at all.
      if (stage.dropFraction > 0) {
        const drop = document.createElement('span');
        drop.className = 'funnel__drop';
        drop.style.insetInlineStart = `${stage.fraction * 100}%`;
        drop.style.inlineSize = `${stage.dropFraction * 100}%`;
        track.append(drop);
      }

      item.append(head, track, this._renderRates(stage, index, labels));
      item.addEventListener('pointerenter', this._handleStageEnter);
      return item;
    });

    this._list.replaceChildren(...this._items);
  }

  _renderRates(stage, index, labels) {
    const rates = document.createElement('p');
    rates.className = 'funnel__rates';
    const wanted = this.rates;
    const parts = [];

    // "Of previous" finds the broken step, because it is not dragged down by the losses above
    // it. "Of the top" is the number that goes in the report. Printing only one is the
    // commonest fault in the form, so both are on by default.
    if (stage.stepRate !== null && wanted !== 'top') {
      parts.push(['funnel__rate', fillLabel(labels.ofPrevious, { rate: formatRate(stage.stepRate) })]);
    }

    // Skipped on the second stage as well as the first. There the previous stage *is* the top,
    // so the two rates are the same number printed twice, which reads as a mistake.
    if (stage.topRate !== null && index > 1 && wanted !== 'step') {
      parts.push(['funnel__rate', fillLabel(labels.ofTop, { rate: formatRate(stage.topRate) })]);
    }

    // A rate is something a reader has to turn back into people before it can be argued about.
    // The count already is the sentence.
    if (stage.drop !== null && stage.drop > 0) {
      parts.push(['funnel__loss', fillLabel(labels.lost, { count: formatNumber(stage.drop) })]);
    }

    parts.forEach(([className, text]) => {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      rates.append(span);
    });

    // The marking is a word as well as a colour. Nothing here is carried by the fill alone.
    if (index === this._worstAt) {
      const flag = document.createElement('span');
      flag.className = 'funnel__flag';
      flag.textContent = labels.largestDrop;
      rates.append(flag);
    }

    return rates;
  }

  /**
   * What the chart had to leave out, or could not draw honestly.
   *
   * A stage larger than the one before it is not a funnel. Rather than drawing a shape that
   * cannot exist, it is named — the cause is nearly always stages measured over different
   * windows, or people joining part-way through, and both are worth knowing.
   */
  _renderNote() {
    const labels = this.labels;
    const notes = [];
    const rising = risingStages(this._stages);

    if (rising.length > 0) {
      notes.push(
        fillLabel(labels.risingNote, { names: rising.map((stage) => stage.name).join(', ') }),
      );
    }

    if (this.shade === 'stages' && this._stages.length > STAGE_LIMIT) {
      notes.push(fillLabel(labels.rampNote, { limit: STAGE_LIMIT }));
    }

    if (this._dropped > 0) {
      notes.push(fillLabel(labels.negatives, { count: this._dropped }));
    }

    if (this._extraColumns) {
      notes.push(labels.ignoredColumns);
    }

    this._note.hidden = notes.length === 0;
    this._note.textContent = notes.join(' ');
  }

  _syncTable() {
    if (!this._table) {
      return;
    }

    this._tableWrap?.classList.toggle('funnel__sr-only', !this._tableOpen);
    this._toggle.textContent = this._tableOpen ? this.labels.hideTable : this.labels.showTable;
    this._toggle.setAttribute('aria-expanded', String(this._tableOpen));
  }

  _handleToggleTable() {
    this._tableOpen = !this._tableOpen;
    this._syncTable();
  }

  /* ---- Reading a stage ----------------------------------------------------------------- */

  _handleStageEnter(event) {
    this._readAt = Number.parseInt(event.currentTarget.dataset.index, 10);
    this._mark();
  }

  _handleLeave() {
    this._readAt = null;
    this._mark();
  }

  _mark({ announce = false } = {}) {
    this._items?.forEach((item, index) =>
      item.toggleAttribute('data-active', index === this._readAt),
    );

    if (!announce || this._readAt === null) {
      return;
    }

    const labels = this.labels;
    const stage = this._stages[this._readAt];

    // Assembled from the parts that exist rather than poured into a template carrying its own
    // punctuation. A template that writes the commas announces "Received, 4,820, ," on the
    // first stage, where there is no rate to put between them.
    const said = [
      fillLabel(labels.stage, { name: stage.name, value: stage.text || formatNumber(stage.value) }),
      stage.stepRate === null
        ? ''
        : fillLabel(labels.ofPrevious, { rate: formatRate(stage.stepRate) }),
      // Skipped on the second stage as well as the first: there the previous stage is the top,
      // so the two rates are the same figure read out twice.
      stage.topRate === null || this._readAt < 2
        ? ''
        : fillLabel(labels.ofTop, { rate: formatRate(stage.topRate) }),
      stage.drop === null || stage.drop <= 0
        ? ''
        : fillLabel(labels.lost, { count: formatNumber(stage.drop) }),
      this._readAt === this._worstAt ? labels.largestDrop : '',
    ];

    this._status.textContent = said.filter(Boolean).join(', ');
  }

  /**
   * Up and down, because a funnel has one direction.
   *
   * The heatmap needed four arrows for a grid; this is a list, and offering left and right
   * would invite a reader to look for something sideways that is not there.
   */
  _handleKeyDown(event) {
    if (!this._stages.length) {
      return;
    }

    if (event.key === 'Escape') {
      this._handleLeave();
      return;
    }

    const last = this._stages.length - 1;
    const moves = { ArrowDown: 1, ArrowUp: -1 };

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      this._readAt = event.key === 'Home' ? 0 : last;
      this._mark({ announce: true });
      return;
    }

    const step = moves[event.key];

    if (step === undefined) {
      return;
    }

    // Cancelled, or the arrows scroll the page as well as walking the funnel.
    event.preventDefault();

    const at = this._readAt === null ? (step > 0 ? -1 : last + 1) : this._readAt;
    const next = at + step;

    if (next < 0 || next > last) {
      return;
    }

    this._readAt = next;
    this._mark({ announce: true });
  }
}

if (!customElements.get('ui-funnel-chart')) {
  customElements.define('ui-funnel-chart', UiFunnelChart);
}

export { STAGE_LIMIT };
