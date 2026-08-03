/**
 * The rules a stat tile decides by, with no DOM in any of them.
 *
 * A tile is mostly text, so there is less arithmetic here than in a chart — but the two things
 * it does decide are the two easiest to get quietly wrong: what a change *means*, and where a
 * sparkline's points fall.
 */

export const DEFAULT_LABELS = Object.freeze({
  up: 'up',
  down: 'down',
  none: 'no change',
  // No "of" in the template: the author writes the whole phrase — `of 1 TB`, `out of 50`,
  // `remaining` — and putting one here as well announced "430 GB of of 1 TB".
  measurement: '{value} {limit}',
  trend: 'Recent trend',
  loading: 'Updating',
  unknown: 'Not available',
  // The word that carries the state where the colour cannot: amber on a light surface reaches
  // only 1.70 against its own track, and no lighter step of it does better.
  nearingLimit: 'nearing the limit',
  atLimit: 'at the limit',
});

/** Rising is usually the good news. `bad` inverts it; `neutral` reports it without judging. */
export const POLARITIES = Object.freeze(['good', 'bad', 'neutral']);

/** Where a meter stops being comfortable, as a fraction of its limit. */
export const METER_THRESHOLDS = Object.freeze({ warning: 0.75, critical: 0.9 });

function number(value) {
  return typeof value === 'number' ? value : Number.parseFloat(value);
}

/**
 * The number behind a cell written for a person.
 *
 * `$48,290` is what a reader wants and `48290` is what the arithmetic wants. `data-value` wins
 * when it is there, which is the way out for anything this cannot be sure about — a decimal
 * comma above all.
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

/** Up, down, or neither. A fact about the number, before anyone decides how to feel about it. */
export function deltaDirection(change) {
  const value = number(change);

  if (!Number.isFinite(value) || value === 0) {
    return 'none';
  }

  return value > 0 ? 'up' : 'down';
}

/**
 * What a change *means*, which is not the same as which way it went.
 *
 * Costs rising twelve per cent and revenue rising twelve per cent are the same arrow and
 * opposite news. The direction comes from the number; the judgement comes from the author,
 * through `polarity`, and defaults to the common case that up is good.
 *
 * `neutral` reports the direction and declines to judge it — a headcount going up is neither.
 */
export function deltaTone({ change, polarity = 'good' } = {}) {
  const direction = deltaDirection(change);

  if (direction === 'none' || polarity === 'neutral') {
    return 'none';
  }

  const rising = direction === 'up';

  return polarity === 'bad' ? (rising ? 'bad' : 'good') : rising ? 'good' : 'bad';
}

/** `12.4` becomes `12.4%`, `-3` becomes `3%` — the sign is carried by the arrow and the word. */
export function formatChange(change, { suffix = '%' } = {}) {
  const value = number(change);

  if (!Number.isFinite(value)) {
    return '';
  }

  const magnitude = Math.abs(value);
  const decimals = Number.isInteger(magnitude) ? 0 : 1;

  return `${magnitude.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;
}

/**
 * How full a meter is, between nothing and all of it.
 *
 * Clamped on purpose: a quota already exceeded is a full bar plus a number that says how far
 * past, not a bar drawn beyond its own track.
 */
export function meterFraction({ value, limit } = {}) {
  const amount = number(value);
  const cap = number(limit);

  if (!Number.isFinite(amount) || !Number.isFinite(cap) || cap <= 0) {
    return null;
  }

  return Math.min(1, Math.max(0, amount / cap));
}

/**
 * How worried a meter should look.
 *
 * The fill carries the severity; the track behind it stays a lighter step of the same hue, so
 * the whole bar reads as one measurement rather than as two colours meeting.
 */
export function meterTone(fraction, thresholds = METER_THRESHOLDS) {
  if (!Number.isFinite(fraction)) {
    return 'none';
  }

  if (fraction >= thresholds.critical) {
    return 'critical';
  }

  return fraction >= thresholds.warning ? 'warning' : 'ok';
}

/**
 * The sparkline, as points and a path.
 *
 * Twelve or so readings with no axis, no grid and no labels: it is there to say which way this
 * number has been going, and anything else on it competes with the number itself.
 *
 * A flat run still gets a line through the middle rather than one pinned to the floor.
 */
export function sparkPath({ values = [], width = 120, height = 32, inset = 3 } = {}) {
  const usable = values.map(number).filter((value) => Number.isFinite(value));

  if (usable.length === 0) {
    return { d: '', points: [], last: null };
  }

  const low = Math.min(...usable);
  const high = Math.max(...usable);
  const span = high - low;
  const top = inset;
  const bottom = Math.max(inset, height - inset);

  const points = usable.map((value, index) => ({
    x:
      usable.length === 1
        ? width / 2
        : inset + (index / (usable.length - 1)) * Math.max(0, width - inset * 2),
    y: span === 0 ? (top + bottom) / 2 : bottom - ((value - low) / span) * (bottom - top),
    value,
  }));

  const d = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`)
    .join('');

  return { d, points, last: points[points.length - 1] };
}

function round(value) {
  return Math.round(value * 100) / 100;
}

/** Fills a template such as `{value} of {limit}`, leaving nothing ragged when a part is absent. */
export function fillLabel(template, values = {}) {
  return String(template ?? '')
    .replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : ''))
    .replace(/\s+/g, ' ')
    .trim();
}
