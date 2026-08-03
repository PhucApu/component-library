/**
 * The rules a donut decides by, with no DOM in any of them.
 *
 * Arc geometry, the slice cap, the share arithmetic and the gap between slices — all of it
 * runnable and arguable in a test file rather than only through a browser.
 */

/**
 * Six, and the seventh onward is summed into one.
 *
 * `cartesian-chart` refuses to fold by default because a ninth line is still a readable line.
 * A ring is not: past six wedges the small ones are slivers, their labels collide, and the
 * shape stops answering the question it was drawn for. So here folding is what happens, and
 * the note says how many were folded.
 */
export const SLICE_LIMIT = 6;

/** The eight validated slots, of which a ring may use the first six. */
export const SERIES_VARS = Object.freeze([
  'var(--donut-series-1)',
  'var(--donut-series-2)',
  'var(--donut-series-3)',
  'var(--donut-series-4)',
  'var(--donut-series-5)',
  'var(--donut-series-6)',
]);

export const DEFAULT_LABELS = Object.freeze({
  other: 'Other',
  total: 'Total',
  empty: 'Nothing to divide',
  showTable: 'Show the table',
  hideTable: 'Hide the table',
  folded: '{count} smaller sources folded into {name}',
  ignoredColumns: 'Only the first value column is plotted',
  slice: '{name}, {value}, {share}',
  negatives: '{count} negative values left out',
});

const TAU = Math.PI * 2;

function number(value) {
  return typeof value === 'number' ? value : Number.parseFloat(value);
}

/** The number behind a cell written for a person. `data-value` settles anything ambiguous. */
export function parseValue(text, override) {
  const source = override ?? text;

  if (source === null || source === undefined) {
    return null;
  }

  const raw = String(source).trim();

  if (!raw) {
    return null;
  }

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

/**
 * Only what can be part of a whole.
 *
 * A negative share of a total is not a thing, and drawing one would either invert a wedge or
 * quietly shrink everybody else. They are dropped and counted, so the chart can say so rather
 * than pretend the data was what it wanted.
 */
export function usableSlices(rows = []) {
  const usable = rows.filter((row) => Number.isFinite(row.value) && row.value > 0);

  return { usable, dropped: rows.length - usable.length };
}

/**
 * Six wedges, and the rest summed into one.
 *
 * The folded slice keeps the last slot rather than being given a new colour, and it is always
 * last in reading order — an "Other" that turns up in the middle of a legend reads as a
 * category rather than as a remainder.
 */
export function foldSlices(rows = [], { limit = SLICE_LIMIT, name = 'Other' } = {}) {
  if (rows.length <= limit) {
    return { shown: rows.map((row, index) => ({ ...row, slot: index })), folded: 0 };
  }

  const kept = rows.slice(0, limit - 1).map((row, index) => ({ ...row, slot: index }));
  const tail = rows.slice(limit - 1);
  const value = tail.reduce((sum, row) => sum + row.value, 0);

  return {
    shown: [...kept, { name, value, text: '', slot: limit - 1, isOther: true }],
    folded: tail.length,
  };
}

/**
 * Where each wedge starts and stops.
 *
 * Angles run from twelve o'clock clockwise, because that is where a reader starts. The gap is
 * taken out of each wedge rather than drawn on top, so the wedges still add up to the whole
 * circle — and it is clamped per wedge, or a sliver would be eaten entirely by its own
 * spacing and disappear.
 *
 * One slice is a whole ring and gets no gap at all: a circle with a two-pixel notch in it
 * reads as a fault.
 */
export function sliceAngles(values = [], { gap = 0 } = {}) {
  const usable = values.map(number).filter((value) => Number.isFinite(value) && value > 0);
  const total = usable.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return { slices: [], total: 0 };
  }

  const single = usable.length === 1;
  let cursor = -Math.PI / 2;

  const slices = usable.map((value) => {
    const span = (value / total) * TAU;
    const padding = single ? 0 : Math.min(gap, span * 0.5);
    const from = cursor + padding / 2;
    const to = cursor + span - padding / 2;
    cursor += span;

    return { from, to, value, share: value / total };
  });

  return { slices, total };
}

/** A wedge of a ring: out along one edge, round the rim, back in, round the hole. */
export function arcPath({ cx = 0, cy = 0, outer = 100, inner = 60, from = 0, to = Math.PI } = {}) {
  const span = to - from;

  if (!(outer > 0) || !(span > 0)) {
    return '';
  }

  // A full turn cannot be drawn as one arc — its start and end points are the same, and the
  // renderer has no way to tell a whole circle from nothing at all. Two halves say it.
  if (span >= TAU - 1e-6) {
    return [
      ring(cx, cy, outer, 1),
      inner > 0 ? ring(cx, cy, inner, 0) : '',
    ].join('');
  }

  const large = span > Math.PI ? 1 : 0;
  const [x0, y0] = at(cx, cy, outer, from);
  const [x1, y1] = at(cx, cy, outer, to);

  if (!(inner > 0)) {
    return `M${cx} ${cy}L${x0} ${y0}A${r(outer)} ${r(outer)} 0 ${large} 1 ${x1} ${y1}Z`;
  }

  const [x2, y2] = at(cx, cy, inner, to);
  const [x3, y3] = at(cx, cy, inner, from);

  return (
    `M${x0} ${y0}` +
    `A${r(outer)} ${r(outer)} 0 ${large} 1 ${x1} ${y1}` +
    `L${x2} ${y2}` +
    `A${r(inner)} ${r(inner)} 0 ${large} 0 ${x3} ${y3}Z`
  );
}

function ring(cx, cy, radius, sweep) {
  const top = r(cy - radius);
  const bottom = r(cy + radius);

  return (
    `M${r(cx)} ${top}` +
    `A${r(radius)} ${r(radius)} 0 1 ${sweep} ${r(cx)} ${bottom}` +
    `A${r(radius)} ${r(radius)} 0 1 ${sweep} ${r(cx)} ${top}Z`
  );
}

function at(cx, cy, radius, angle) {
  return [r(cx + radius * Math.cos(angle)), r(cy + radius * Math.sin(angle))];
}

function r(value) {
  return Math.round(value * 100) / 100;
}

/** The angle a wedge's label points along, for anything that has to sit on it. */
export function midAngle(slice) {
  return (slice.from + slice.to) / 2;
}

/** The gap in radians that draws as `pixels` wide at the middle of the ring. */
export function gapRadians(pixels, outer, inner) {
  const middle = (outer + inner) / 2;
  return middle > 0 ? pixels / middle : 0;
}

/** `0.4213` becomes `42.1%`. One decimal: a share is not a measurement to six figures. */
export function formatShare(share) {
  const value = number(share);

  if (!Number.isFinite(value)) {
    return '';
  }

  const percent = value * 100;
  const decimals = percent >= 10 || percent === 0 ? (Number.isInteger(percent) ? 0 : 1) : 1;

  return `${percent.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/** Thousands-separated, for a total nobody wrote out. */
export function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString('en-US') : '';
}

/** Fills a template such as `{name}, {value}, {share}`, leaving nothing ragged. */
export function fillLabel(template, values = {}) {
  return String(template ?? '')
    .replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : ''))
    .replace(/\s+/g, ' ')
    .trim();
}
