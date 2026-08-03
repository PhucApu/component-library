/**
 * The rules a heatmap decides by, with no DOM in any of them.
 *
 * Almost all of a heatmap is one question asked once per cell — which step of the scale does
 * this number belong to — so that question and the two ways of answering it live here.
 */

/**
 * Five steps, and that is a limit rather than a starting point.
 *
 * Past about seven classes adjacent steps blur into each other and the reader is back to
 * consulting the legend for every cell, which is the thing a colour scale exists to avoid.
 * Five are distinguishable and, more to the point, memorable.
 */
export const BIN_COUNT = 5;

/**
 * The scale as whole `var()` references, written out rather than built.
 *
 * Index 0 is a measured zero — a day that was counted and had nothing on it. That is not the
 * same as no cell at all, and the two must never share a colour.
 */
export const SCALE_VARS = Object.freeze([
  'var(--heat-step-0)',
  'var(--heat-step-1)',
  'var(--heat-step-2)',
  'var(--heat-step-3)',
  'var(--heat-step-4)',
  'var(--heat-step-5)',
]);

export const DEFAULT_LABELS = Object.freeze({
  less: 'Less',
  more: 'More',
  scale: 'Scale',
  empty: 'Nothing to show',
  showTable: 'Show the table',
  hideTable: 'Hide the table',
  cell: '{row}, {column}: {value}',
  none: 'no data',
  step: '{from} to {to}',
  firstStep: 'up to {to}',
  zero: 'none',
  quantileNote:
    'Steps hold equal numbers of cells rather than equal amounts, so the same colour is not the same quantity twice.',
});

function number(value) {
  return typeof value === 'number' ? value : Number.parseFloat(value);
}

/**
 * The number behind a cell, and the difference that matters most here.
 *
 * An empty cell is **outside the range** — a day that has not happened, a month with no rows
 * yet — and gets no square at all. A written `0` was measured and had nothing in it, and gets
 * the quietest square on the scale. Collapsing the two is the commonest fault in an activity
 * calendar: it turns "we have not started" and "nobody did anything" into the same picture.
 */
export function parseValue(text, override) {
  const source = override ?? text;

  if (source === null || source === undefined) {
    return null;
  }

  const raw = String(source).trim();

  if (!raw) {
    return null;
  }

  const cleaned = raw.replace(/[^0-9eE+.-]/g, '');

  if (!cleaned || !/\d/.test(cleaned)) {
    return null;
  }

  const parsed = Number.parseFloat(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

/** The largest reading on the grid, which is where a linear scale has to end. */
export function extent(values = []) {
  const usable = values.map(number).filter((value) => Number.isFinite(value));

  return usable.length ? Math.max(...usable) : 0;
}

/**
 * Where one step of the scale stops and the next begins.
 *
 * **Linear** divides the range into equal slices and is the honest default: the colour means
 * the same amount of the measurement wherever it appears.
 *
 * **Quantile** divides by rank instead, so each step holds the same number of cells. It is
 * for a grid where one cell is a hundred times the rest — with a linear scale everything but
 * that one cell lands in step one and the picture says nothing. The cost is that the colour
 * no longer means a fixed amount, which is why it has to be asked for.
 */
export function binThresholds({ values = [], count = BIN_COUNT, scale = 'linear', max } = {}) {
  const positives = values
    .map(number)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  const ceiling = Number.isFinite(max) && max > 0 ? max : positives.at(-1) ?? 0;

  if (ceiling <= 0) {
    return [];
  }

  if (scale !== 'quantile' || positives.length === 0) {
    return Array.from({ length: count }, (unused, index) =>
      round((ceiling * (index + 1)) / count),
    );
  }

  const edges = Array.from({ length: count }, (unused, index) => {
    const at = Math.ceil(((index + 1) / count) * positives.length) - 1;
    return positives[Math.min(Math.max(at, 0), positives.length - 1)];
  });

  // Repeated readings collapse neighbouring edges. Nudged apart so the steps stay in order
  // and a value cannot fall into two of them.
  return edges.map((edge, index) => round(Math.max(edge, edges[index - 1] ?? edge)));
}

function round(value) {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * The step a reading belongs to.
 *
 * `null` means no cell at all. `0` means a measured zero. Anything above lands in one of the
 * steps, and the busiest reading always lands in the last one.
 */
export function binFor(value, thresholds = []) {
  const amount = number(value);

  if (!Number.isFinite(amount)) {
    return null;
  }

  if (amount <= 0) {
    return 0;
  }

  if (thresholds.length === 0) {
    return 1;
  }

  const at = thresholds.findIndex((edge) => amount <= edge);

  return at < 0 ? thresholds.length : at + 1;
}

/** The `var()` for a step, so no property name is ever built from a number. */
export function colourFor(bin) {
  const step = Number.isInteger(bin) && bin >= 0 ? bin : 0;
  return SCALE_VARS[Math.min(step, SCALE_VARS.length - 1)];
}

/** What each swatch in the scale legend covers, for the name a screen reader reads out. */
export function stepRanges(thresholds = [], labels = DEFAULT_LABELS) {
  return thresholds.map((edge, index) =>
    index === 0
      ? fillLabel(labels.firstStep, { to: format(edge) })
      : fillLabel(labels.step, { from: format(thresholds[index - 1]), to: format(edge) }),
  );
}

function format(value) {
  return Number.isFinite(value) ? value.toLocaleString('en-US') : '';
}

export { format as formatNumber };

/** Fills a template such as `{row}, {column}: {value}`, leaving nothing ragged. */
export function fillLabel(template, values = {}) {
  return String(template ?? '')
    .replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : ''))
    .replace(/\s+/g, ' ')
    .trim();
}
