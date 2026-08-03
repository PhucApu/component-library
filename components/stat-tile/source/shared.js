import {
  DEFAULT_LABELS,
  POLARITIES,
  deltaDirection,
  deltaTone,
  fillLabel,
  formatChange,
  meterFraction,
  meterTone,
  parseValue,
  sparkPath,
} from './stat-tile-core.js';

const SVG = 'http://www.w3.org/2000/svg';

const ARROWS = Object.freeze({
  up: 'M6 10V2M2.5 5.5 6 2l3.5 3.5',
  down: 'M6 2v8M2.5 6.5 6 10l3.5-3.5',
});

const TONE_TOKENS = Object.freeze({
  good: 'var(--stat-good)',
  bad: 'var(--stat-bad)',
  none: 'var(--stat-ink-muted)',
  ok: 'var(--stat-meter-ok)',
  warning: 'var(--stat-meter-warning)',
  critical: 'var(--stat-meter-critical)',
});

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
 * One number, what it did, and where it has been.
 *
 * A single current value is a **stat tile, not a chart**: a one-bar bar chart spends an axis,
 * a grid and a legend saying what the number already said. The tile is the honest form, and
 * the sparkline beside it is context rather than a second reading.
 *
 * ```html
 * <ui-stat-tile up="good">
 *   <p class="stat-tile__label">Revenue</p>
 *   <p class="stat-tile__value" data-value="48290">$48,290</p>
 *   <p class="stat-tile__delta" data-change="12.4">vs last month</p>
 *   <ol class="stat-tile__trend"><li>32100</li><li>34500</li><li>48290</li></ol>
 * </ui-stat-tile>
 * ```
 *
 * The label, the value and the delta are ordinary markup and need no script to be read — that
 * is the whole headline. The sparkline is the only part the script adds, and its numbers stay
 * in the page for anything that cannot see it.
 *
 * **The direction is a fact; the judgement is the author's.** `up="bad"` makes a rise read as
 * bad news, which is what a costs tile needs. Neither is ever carried by colour alone: the
 * arrow and the word say it too.
 */
export class UiStatTile extends HTMLElement {
  static get observedAttributes() {
    return ['up', 'size', 'no-trend', 'loading', 'error'];
  }

  constructor() {
    super();
    this._connected = false;
    this._labelOverrides = {};
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

    if (typeof ResizeObserver === 'function' && this._spark) {
      this._observer = new ResizeObserver(this._schedule);
      this._observer.observe(this);
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

    this._read();
    this._render();
  }

  /* ---- What the page can ask ---------------------------------------------------------- */

  get value() {
    return this._value;
  }

  get change() {
    return this._change;
  }

  get trend() {
    return [...this._trend];
  }

  get limit() {
    return this._limit;
  }

  /** `good` unless the author says otherwise; `neutral` reports without judging. */
  get polarity() {
    const asked = (this.getAttribute('up') ?? '').trim().toLowerCase();
    return POLARITIES.includes(asked) ? asked : 'good';
  }

  /** What the change means here: `good`, `bad`, or `none`. */
  get tone() {
    return deltaTone({ change: this._change, polarity: this.polarity });
  }

  /**
   * Re-reads the markup and redraws.
   *
   * A page that rewrites the value in place has changed the data, and the element has no way
   * to know: the numbers live in text nodes rather than in attributes, and observing those
   * would mean watching every character of every tile. One method is the honest interface,
   * and a great deal cheaper than a `MutationObserver` per tile.
   */
  refresh() {
    this._read();
    this._render();
  }

  get labels() {
    return { ...DEFAULT_LABELS, ...this._labelOverrides };
  }

  set labels(value) {
    this._labelOverrides = value && typeof value === 'object' ? { ...value } : {};
    this._render();
  }

  /* ---- Reading the markup ------------------------------------------------------------- */

  _read() {
    this._labelNode = this.querySelector('.stat-tile__label');
    this._valueNode = this.querySelector('.stat-tile__value');
    this._deltaNode = this.querySelector('.stat-tile__delta');
    this._limitNode = this.querySelector('.stat-tile__limit');
    this._trendNode = this.querySelector('.stat-tile__trend');

    this._value = parseValue(this._valueNode?.textContent, this._valueNode?.dataset?.value);
    this._change = parseValue(this._deltaNode?.textContent, this._deltaNode?.dataset?.change);
    this._limit = parseValue(this._limitNode?.textContent, this._limitNode?.dataset?.value);

    this._trend = this._trendNode
      ? [...this._trendNode.querySelectorAll('li')]
          .map((item) => parseValue(item.textContent, item.dataset?.value))
          .filter((value) => Number.isFinite(value))
      : [];
  }

  /* ---- The furniture ------------------------------------------------------------------ */

  _build() {
    if (this._built) {
      return;
    }

    this._built = true;

    // The change rides in front of whatever the author wrote after it — "vs last month" is
    // theirs, "up 12.4%" is worked out.
    if (this._deltaNode && Number.isFinite(this._change)) {
      this._change_ = document.createElement('span');
      this._change_.className = 'stat-tile__change';

      this._arrow = svgNode('svg', {
        class: 'stat-tile__arrow',
        viewBox: '0 0 12 12',
        'aria-hidden': 'true',
      });
      this._arrowPath = svgNode('path');
      this._arrow.append(this._arrowPath);

      this._changeText = document.createElement('span');
      this._change_.append(this._arrow, this._changeText);
      this._deltaNode.prepend(this._change_);
    }

    // A meter, when the markup says what the ceiling is. The bar goes between the value and
    // the line naming that ceiling, so the three read as one measurement.
    if (this._limitNode && Number.isFinite(this._limit)) {
      this._meter = document.createElement('div');
      this._meter.className = 'stat-tile__meter';
      this._meterFill = document.createElement('span');
      this._meterFill.className = 'stat-tile__meter-fill';
      this._meter.append(this._meterFill);
      this._limitNode.before(this._meter);

      this._condition = document.createElement('span');
      this._condition.className = 'stat-tile__condition';
      this._condition.hidden = true;
      this._limitNode.append(this._condition);
    }

    if (this._trendNode && this._trend.length > 1) {
      this._spark = svgNode('svg', { class: 'stat-tile__spark', 'aria-hidden': 'true' });
      this._sparkLine = svgNode('path', { class: 'stat-tile__spark-line' });
      this._sparkPoint = svgNode('circle', { class: 'stat-tile__spark-point', r: 3 });
      this._spark.append(this._sparkLine, this._sparkPoint);
      this._trendNode.before(this._spark);

      // Hidden from the eye and never from the page. The tile's headline is the value and the
      // delta, both of which stay on screen, so twelve readings do not earn a control of their
      // own — but they are still there for anything that reads rather than looks.
      this._trendNode.classList.add('stat-tile__sr-only');
    }

    this._note = document.createElement('p');
    this._note.className = 'stat-tile__note';
    this._note.hidden = true;
    this.append(this._note);
  }

  _schedule() {
    if (this._pending) {
      return;
    }

    this._pending = requestAnimationFrame(() => {
      this._pending = null;
      this._drawSpark();
    });
  }

  /* ---- Drawing ------------------------------------------------------------------------ */

  _render() {
    if (!this._built) {
      return;
    }

    const labels = this.labels;
    const error = this.getAttribute('error');

    this._note.hidden = !error;
    this._note.textContent = error ?? '';

    if (this._valueNode) {
      // A value nobody has yet says so, rather than showing a dash somebody has to decode.
      const unknown = !Number.isFinite(this._value) && !this._valueNode.textContent.trim();

      if (unknown) {
        this._valueNode.textContent = labels.unknown;
      }
    }

    this._renderDelta();
    this._renderMeter();
    this._drawSpark();
  }

  _renderDelta() {
    if (!this._change_) {
      return;
    }

    const labels = this.labels;
    const direction = deltaDirection(this._change);
    const tone = this.tone;

    // Colour is the last of three signals, never the only one. Two of the light-theme status
    // colours sit below the contrast rule by design, and the arrow and the word are what make
    // that legal — as well as what makes the tile readable in a grey-scale print-out.
    this._arrow.toggleAttribute('hidden', direction === 'none');
    this._arrowPath.setAttribute('d', ARROWS[direction] ?? ARROWS.up);

    this._changeText.textContent =
      direction === 'none'
        ? labels.none
        : `${direction === 'up' ? labels.up : labels.down} ${formatChange(this._change)}`;

    this._change_.style.setProperty('--tone-colour', TONE_TOKENS[tone]);
  }

  _renderMeter() {
    if (!this._meter) {
      return;
    }

    const labels = this.labels;
    const fraction = meterFraction({ value: this._value, limit: this._limit });
    const tone = meterTone(fraction);

    this._meterFill.style.inlineSize = `${Math.round((fraction ?? 0) * 100)}%`;
    this._meter.style.setProperty('--tone-colour', TONE_TOKENS[tone] ?? TONE_TOKENS.ok);
    this._condition.style.setProperty('--tone-colour', TONE_TOKENS[tone] ?? TONE_TOKENS.ok);

    const wording = { warning: labels.nearingLimit, critical: labels.atLimit }[tone];
    this._condition.hidden = !wording;
    this._condition.textContent = wording ?? '';

    // Announced as a measurement rather than as a decorated div.
    this._meter.setAttribute('role', 'meter');
    this._meter.setAttribute('aria-valuemin', '0');
    this._meter.setAttribute('aria-valuemax', String(this._limit));
    this._meter.setAttribute('aria-valuenow', String(this._value ?? 0));
    this._meter.setAttribute(
      'aria-label',
      fillLabel(labels.measurement, {
        value: this._valueNode?.textContent.trim() ?? '',
        limit: this._limitNode?.textContent.trim() ?? '',
      }),
    );
  }

  /**
   * The sparkline, redrawn at the width it is given.
   *
   * No axis, no grid, no labels: it says which way this number has been going, and anything
   * else on it would compete with the number it is context for.
   */
  _drawSpark() {
    if (!this._spark) {
      return;
    }

    const off = this.hasAttribute('no-trend') || this.hasAttribute('error');
    this._spark.toggleAttribute('hidden', off);

    if (off) {
      return;
    }

    const width = Math.max(0, Math.round(this._spark.getBoundingClientRect().width));
    const height = Math.max(0, Math.round(this._spark.getBoundingClientRect().height));

    if (width === 0 || height === 0) {
      return;
    }

    this._spark.setAttribute('width', String(width));
    this._spark.setAttribute('height', String(height));

    const { d, last } = sparkPath({ values: this._trend, width, height });

    this._sparkLine.setAttribute('d', d);

    if (last) {
      this._sparkPoint.setAttribute('cx', String(last.x));
      this._sparkPoint.setAttribute('cy', String(last.y));
      this._sparkPoint.removeAttribute('hidden');
    } else {
      this._sparkPoint.setAttribute('hidden', '');
    }
  }
}

if (!customElements.get('ui-stat-tile')) {
  customElements.define('ui-stat-tile', UiStatTile);
}
