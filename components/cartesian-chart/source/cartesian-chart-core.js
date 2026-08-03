/**
 * The rules that decide a chart, with no DOM anywhere in them.
 *
 * Scales, ticks, stacking, number parsing, colour slots and path geometry all live here so
 * they can be run and argued with in a test file rather than only through a browser. What is
 * left in the element is DOM work: reading a table, drawing SVG, and answering a pointer.
 */

/**
 * The eight categorical slots, in the order that passes every colour-vision gate.
 *
 * The order is the safety mechanism, not decoration: it was chosen because each neighbouring
 * pair stays apart under simulated colour blindness. Measured against this component's own
 * surfaces, worst adjacent pair 9.1 light and 8.4 dark on a floor of 8. Re-ordering them, or
 * adding a ninth, breaks that and cannot be done by eye.
 */
export const SERIES_SLOTS = Object.freeze([
  'blue',
  'orange',
  'aqua',
  'yellow',
  'magenta',
  'green',
  'violet',
  'red',
]);

/** Past this a ninth hue would have to be invented, and an invented hue is not distinct. */
export const SERIES_LIMIT = SERIES_SLOTS.length;

/**
 * The eight slots as whole `var()` references, written out rather than built.
 *
 * Assembling `--chart-series-${n}` from a number reads as harmless and is not: the property
 * name then exists only at run time, so nothing can check that the component actually defines
 * it, and the repository's own validator says so. Eight literals cost eight lines and can be
 * verified by reading them.
 */
export const SERIES_VARS = Object.freeze([
  'var(--chart-series-1)',
  'var(--chart-series-2)',
  'var(--chart-series-3)',
  'var(--chart-series-4)',
  'var(--chart-series-5)',
  'var(--chart-series-6)',
  'var(--chart-series-7)',
  'var(--chart-series-8)',
]);

/** The colour a series keeps, bound to the column it was written in. */
export function colourFor(index) {
  const position = Number.isInteger(index) && index >= 0 ? index : 0;
  return SERIES_VARS[position % SERIES_VARS.length];
}

/** Beyond this many points a marker on every one of them is noise rather than information. */
const DENSE_POINTS = 12;

export const DEFAULT_LABELS = Object.freeze({
  showTable: 'Show the table',
  hideTable: 'Hide the table',
  empty: 'No data to plot',
  loading: 'Updating',
  series: '{name}',
  point: '{category}: {value}',
  hiddenSeries: '{count} more in the table',
  other: 'Other',
  toggleSeries: 'Toggle {name}',
});

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

/** The slot a series keeps for as long as it exists, whoever else is shown or hidden. */
export function slotFor(index) {
  const position = Number.isInteger(index) && index >= 0 ? index : 0;
  return SERIES_SLOTS[position % SERIES_SLOTS.length];
}

/**
 * The number behind a cell.
 *
 * A cell is written for a person to read — `$4,200`, `1 234`, `12%`, `(890)` — and the chart
 * needs the number inside it. `data-value` wins when it is there, which is the escape hatch
 * for anything this cannot parse, a decimal comma above all.
 *
 * An empty cell is **missing**, not zero. A line breaks across it rather than diving to the
 * baseline and inventing a month with no sales.
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

  // Accounting negatives are written in brackets, and a minus sign nowhere in sight.
  const bracketed = /^\((.*)\)$/.test(raw);
  const cleaned = raw.replace(/[^0-9eE+.-]/g, '');

  if (!cleaned || !/\d/.test(cleaned)) {
    return null;
  }

  const parsed = Number.parseFloat(cleaned);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return bracketed ? -Math.abs(parsed) : parsed;
}

/** Axis ticks and tooltips, thousands-separated and never showing more decimals than the step. */
export function formatNumber(value, { step = 1 } = {}) {
  if (!Number.isFinite(value)) {
    return '';
  }

  const decimals = step > 0 && step < 1 ? Math.min(6, Math.ceil(-Math.log10(step))) : 0;

  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** A step a person would have chosen: 1, 2 or 5 times a power of ten, never 3.7. */
function niceStep(span, count) {
  const rough = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const stepped = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;

  return stepped * magnitude;
}

/**
 * The y scale: where it starts, where it stops, and the ticks in between.
 *
 * `includeZero` is not a preference. A bar is read by its length, so a bar chart that starts
 * at 40 makes 41 look like nothing and 45 look like everything; the component sets it for
 * bars and columns and does not offer a way off. `min` can still pull the floor further
 * down — it just cannot lift it off zero.
 *
 * The domain is widened to land on whole steps, so the top and bottom of the plot are always
 * a labelled tick rather than a number nobody chose.
 */
export function linearScale({
  values = [],
  includeZero = false,
  min,
  max,
  tickCount = 5,
} = {}) {
  const usable = values.filter((value) => Number.isFinite(value));

  let low = usable.length ? Math.min(...usable) : 0;
  let high = usable.length ? Math.max(...usable) : 1;

  if (includeZero) {
    low = Math.min(low, 0);
    high = Math.max(high, 0);
  }

  if (Number.isFinite(min)) {
    low = includeZero ? Math.min(min, low) : min;
  }

  if (Number.isFinite(max)) {
    high = includeZero ? Math.max(max, high) : max;
  }

  // A flat series still needs a plot with height, or every point sits on one line at the
  // bottom and the chart says nothing at all.
  if (low === high) {
    const padding = Math.abs(low) > 0 ? Math.abs(low) * 0.1 : 1;
    low -= padding;
    high += padding;

    if (includeZero) {
      low = Math.min(low, 0);
      high = Math.max(high, 0);
    }
  }

  const step = niceStep(high - low, tickCount);
  const flooredLow = Math.floor(low / step) * step;
  const ceilingHigh = Math.ceil(high / step) * step;
  const ticks = [];

  // Counted rather than accumulated: adding `step` to itself thirty times drifts, and the
  // drift shows up as an axis labelled 0.30000000000000004.
  const total = Math.round((ceilingHigh - flooredLow) / step);

  for (let index = 0; index <= total; index += 1) {
    ticks.push(Number((flooredLow + index * step).toPrecision(12)));
  }

  return { min: flooredLow, max: ceilingHigh, step, ticks };
}

/** Turns a domain and a pixel range into the one function everything else asks. */
export function scaleFor({ min, max, from, to }) {
  const span = max - min;

  return (value) => {
    if (!Number.isFinite(value)) {
      return null;
    }

    if (span === 0) {
      return from;
    }

    return from + ((value - min) / span) * (to - from);
  };
}

/**
 * The bands of a stacked chart.
 *
 * A missing value adds nothing to the running total and draws no segment. Treating it as
 * zero would be the same lie the line chart refuses to tell, only harder to see.
 */
export function stackValues(series = []) {
  const length = series.reduce((most, entry) => Math.max(most, entry.values?.length ?? 0), 0);
  const offsets = { positive: new Array(length).fill(0), negative: new Array(length).fill(0) };

  return series.map((entry) =>
    Array.from({ length }, (unused, index) => {
      const value = entry.values?.[index];

      if (!Number.isFinite(value)) {
        return null;
      }

      const side = value < 0 ? 'negative' : 'positive';
      const from = offsets[side][index];
      const to = from + value;
      offsets[side][index] = to;

      return { from, to, value };
    }),
  );
}

/** Every number a scale has to cover, stacked or not. */
export function extentValues({ series = [], stacked = false } = {}) {
  if (!stacked) {
    return series.flatMap((entry) => entry.values ?? []);
  }

  return stackValues(series)
    .flat()
    .filter(Boolean)
    .flatMap((band) => [band.from, band.to]);
}

/**
 * What to plot when there are more series than there are colours.
 *
 * The ninth series is not given an invented hue — under colour-vision simulation a generated
 * ninth is indistinguishable from one already on screen, so it would be a lie told in colour.
 * By default the tail is simply not drawn and the table is said to hold it. `fold` sums the
 * tail into one series instead, which is a real change to what the author wrote and so is
 * something they have to ask for rather than something that happens to them.
 */
export function foldSeries(series = [], { limit = SERIES_LIMIT, fold = false } = {}) {
  if (series.length <= limit) {
    return { shown: series, hidden: [], folded: false };
  }

  const shown = series.slice(0, fold ? limit - 1 : limit);
  const tail = series.slice(fold ? limit - 1 : limit);

  if (!fold) {
    return { shown, hidden: tail, folded: false };
  }

  const length = tail.reduce((most, entry) => Math.max(most, entry.values?.length ?? 0), 0);
  const values = Array.from({ length }, (unused, index) => {
    const parts = tail
      .map((entry) => entry.values?.[index])
      .filter((value) => Number.isFinite(value));

    return parts.length ? parts.reduce((sum, value) => sum + value, 0) : null;
  });

  return {
    shown: [...shown, { name: DEFAULT_LABELS.other, index: limit - 1, values, isOther: true }],
    hidden: [],
    folded: true,
  };
}

/**
 * A line, broken wherever the data is.
 *
 * Each run of present values becomes its own move-and-draw. Joining across a gap would draw a
 * straight confident line through a month nobody measured.
 */
export function linePath(points = []) {
  const parts = [];
  let open = false;

  points.forEach((point) => {
    if (!point) {
      open = false;
      return;
    }

    parts.push(`${open ? 'L' : 'M'}${round(point.x)} ${round(point.y)}`);
    open = true;
  });

  return parts.join('');
}

/** The same runs, closed down to the baseline. One shape per run, so gaps stay gaps. */
export function areaPath(points = [], baseline = 0) {
  const runs = [];
  let current = [];

  points.forEach((point) => {
    if (point) {
      current.push(point);
      return;
    }

    if (current.length) {
      runs.push(current);
      current = [];
    }
  });

  if (current.length) {
    runs.push(current);
  }

  return runs
    .map((run) => {
      const forward = run.map((point) => `${round(point.x)} ${round(point.y)}`).join('L');
      const first = run[0];
      const last = run[run.length - 1];

      return `M${round(first.x)} ${round(baseline)}L${forward}L${round(last.x)} ${round(baseline)}Z`;
    })
    .join('');
}

function round(value) {
  return Math.round(value * 100) / 100;
}

/**
 * A bar with two rounded corners at the data end and two square ones at the baseline.
 *
 * A `<rect>` with `rx` rounds all four, which lifts the foot off the very zero the bar is
 * measured from and turns a stack into a column of separate pills. `end` names the side the
 * value reaches: an interior segment of a stack passes `radius: 0` and gets none.
 */
export function barPath({ x, y, width, height, radius = 4, end = 'top' } = {}) {
  const w = Math.max(0, width);
  const h = Math.max(0, height);

  if (w === 0 || h === 0) {
    return '';
  }

  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  const [x0, y0, x1, y1] = [round(x), round(y), round(x + w), round(y + h)];

  if (r === 0) {
    return `M${x0} ${y0}H${x1}V${y1}H${x0}Z`;
  }

  const corners = {
    top: `M${x0} ${y1}V${round(y + r)}A${r} ${r} 0 0 1 ${round(x + r)} ${y0}H${round(x1 - r)}A${r} ${r} 0 0 1 ${x1} ${round(y + r)}V${y1}Z`,
    bottom: `M${x0} ${y0}V${round(y1 - r)}A${r} ${r} 0 0 0 ${round(x + r)} ${y1}H${round(x1 - r)}A${r} ${r} 0 0 0 ${x1} ${round(y1 - r)}V${y0}Z`,
    right: `M${x0} ${y0}H${round(x1 - r)}A${r} ${r} 0 0 1 ${x1} ${round(y + r)}V${round(y1 - r)}A${r} ${r} 0 0 1 ${round(x1 - r)} ${y1}H${x0}Z`,
    left: `M${x1} ${y0}H${round(x0 + r)}A${r} ${r} 0 0 0 ${x0} ${round(y + r)}V${round(y1 - r)}A${r} ${r} 0 0 0 ${round(x0 + r)} ${y1}H${x1}Z`,
  };

  return corners[end] ?? corners.top;
}

/**
 * Which points get a marker.
 *
 * Every point while there are few enough to count; past that only the ends, plus any value
 * standing alone between two gaps — which would otherwise be a line segment of nothing and
 * disappear entirely.
 */
export function markerIndices(values = []) {
  const present = values
    .map((value, index) => (Number.isFinite(value) ? index : null))
    .filter((index) => index !== null);

  if (present.length === 0) {
    return [];
  }

  if (present.length <= DENSE_POINTS) {
    return present;
  }

  const isolated = present.filter(
    (index) => !Number.isFinite(values[index - 1]) && !Number.isFinite(values[index + 1]),
  );

  return [...new Set([present[0], present[present.length - 1], ...isolated])].sort(
    (left, right) => left - right,
  );
}

/**
 * How many category labels to skip so they stop overlapping.
 *
 * Thinned rather than rotated. A rotated label is measurably slower to read and, on a narrow
 * screen, it is the axis that ends up taller than the plot.
 */
export function labelStride(count, available, minSpacing) {
  if (count <= 1 || !(available > 0) || !(minSpacing > 0)) {
    return 1;
  }

  const each = available / count;

  return each >= minSpacing ? 1 : Math.ceil(minSpacing / each);
}

/**
 * The labels a stride leaves, with the last one kept.
 *
 * The final category is the one a reader looks for first on a time axis, so it is always
 * shown; whichever strided label would have crowded it gives way instead.
 */
export function visibleLabels(count, stride) {
  if (count <= 0) {
    return [];
  }

  const step = Math.max(1, Math.round(stride));
  const last = count - 1;
  const indices = [];

  for (let index = 0; index <= last; index += step) {
    indices.push(index);
  }

  if (indices[indices.length - 1] !== last) {
    if (last - indices[indices.length - 1] < step) {
      indices.pop();
    }

    indices.push(last);
  }

  return indices;
}

/** Fills a template such as `{category}: {value}`, leaving nothing ragged when a part is absent. */
export function fillLabel(template, values = {}) {
  return String(template ?? '')
    .replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/** The band a category owns, and the slice of it one series gets inside a grouped chart. */
export function bandFor({ index, count, from, to, groups = 1, group = 0, padding = 0.2 } = {}) {
  const span = (to - from) / Math.max(1, count);
  const inner = span * (1 - padding);
  const start = from + span * index + (span - inner) / 2;
  const slice = inner / Math.max(1, groups);

  return { start: start + slice * group, size: slice, centre: from + span * index + span / 2 };
}

export { finite };
