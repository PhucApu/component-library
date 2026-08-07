/**
 * The arithmetic a funnel decides by, with no DOM in any of them.
 *
 * A funnel is mostly one calculation repeated down a list — how much of the previous stage
 * survived, and how much of the very first one — plus the judgement of where the worst loss
 * happened. All of it runnable in a test file rather than only through a browser.
 */

/**
 * Six stages, and this caps the **colour ramp** rather than the data.
 *
 * A seven-step funnel is a perfectly ordinary thing to measure, so nothing is thrown away or
 * summed together — summing two stages of a funnel would be meaningless, unlike summing two
 * slices of a donut. What runs out at six is the ordinal ramp: measured against this
 * component's surfaces, the seventh step has nowhere left to go that stays apart from the
 * sixth. Past six, `shade="stages"` falls back to one colour and says so.
 */
export const STAGE_LIMIT = 6;

/**
 * The ordinal ramp as whole `var()` references, written out rather than built.
 *
 * Never assembled by concatenating an index onto a prefix: a property name built at runtime is
 * invisible to every tool that reads the stylesheet, including this repository's own validator.
 */
/**
 * The one colour every stage takes by default.
 *
 * Separate from the ramp's first step rather than shared with it. The default bar is the
 * accent at full strength; the ramp's first step is deliberately the palest rung it has, and a
 * single token cannot be both without one of the two measurements being wrong.
 */
export const BAR_VAR = 'var(--funnel-bar)';

export const STAGE_VARS = Object.freeze([
  'var(--funnel-stage-1)',
  'var(--funnel-stage-2)',
  'var(--funnel-stage-3)',
  'var(--funnel-stage-4)',
  'var(--funnel-stage-5)',
  'var(--funnel-stage-6)',
]);

export const DEFAULT_LABELS = Object.freeze({
  empty: 'Nothing to follow through',
  showTable: 'Show the table',
  hideTable: 'Hide the table',
  ofPrevious: '{rate} of previous',
  ofTop: '{rate} of the top',
  lost: '{count} lost',
  largestDrop: 'Largest drop',
  overall: '{first} to {last}, {rate} overall',
  worstNote: 'Largest drop at {name}: {count} lost, {rate} of the previous stage kept',
  // Phrased so it reads for one stage and for several without needing two templates.
  risingNote:
    'Larger than the stage before: {names}. That is not a funnel — check the measurement, or whether people are joining part-way through.',
  negatives: '{count} stages left out for having no usable number',
  rampNote: 'More than {limit} stages, so every stage is drawn in one colour.',
  // Name and figure only. The rates are joined on afterwards, and only the ones that exist —
  // a template that carries its own commas announces "Received, 4,820, ," on a first stage.
  stage: '{name}, {value}',
  ignoredColumns: 'Only the first value column is plotted',
  none: 'no data',
});

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

  const cleaned = raw.replace(/[^0-9eE+.-]/g, '');

  if (!cleaned || !/\d/.test(cleaned)) {
    return null;
  }

  const parsed = Number.parseFloat(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Only the rows that can be a stage.
 *
 * A negative count of people is not a stage, and neither is a blank. They are dropped and
 * counted so the chart can say what it left out, rather than quietly renumbering the funnel
 * and reporting a conversion rate against a stage that was never drawn.
 */
export function usableStages(rows = []) {
  const usable = rows.filter((row) => Number.isFinite(row.value) && row.value >= 0);

  return { usable, dropped: rows.length - usable.length };
}

/**
 * Everything each stage needs to be drawn and read.
 *
 * The two rates answer two different questions and a funnel that prints only one is the
 * commonest fault in the form:
 *
 * - `stepRate` — of the people who reached this stage, how many went on. This is the one that
 *   finds the broken step, because it is not dragged down by every loss above it.
 * - `topRate` — of everyone who entered, how many got this far. This is the one that goes in
 *   the report, because it is the number the business actually earns.
 *
 * `drop` is the absolute loss, and it is not a nicety. "68% of previous" is a rate somebody has
 * to turn back into people before it can be argued about; `12,200 lost` is already the sentence.
 */
export function stageMetrics(rows = [], { max } = {}) {
  const stages = rows.map((row, index) => {
    const previous = index > 0 ? rows[index - 1].value : null;
    const rising = previous !== null && row.value > previous;

    return {
      name: row.name,
      value: row.value,
      text: row.text ?? '',
      index,
      // Null rather than 1 on the first stage. A first stage is not "100% of the previous
      // stage"; there is no previous stage, and printing 100% invents one.
      stepRate: previous === null ? null : previous === 0 ? null : row.value / previous,
      topRate: rows[0].value === 0 ? null : row.value / rows[0].value,
      // Negative on a rising stage, which is exactly how `risingStages` finds them.
      drop: previous === null ? null : previous - row.value,
      rising,
    };
  });

  // The ceiling the bars are drawn against. `Math.max` rather than the first stage, so a stage
  // that rises above the top of the funnel still draws inside its own track instead of
  // overflowing it. On a well-formed funnel the two are the same number.
  const ceiling =
    Number.isFinite(max) && max > 0 ? max : stages.reduce((high, s) => Math.max(high, s.value), 0);

  return stages.map((stage) => ({
    ...stage,
    fraction: ceiling > 0 ? Math.min(stage.value / ceiling, 1) : 0,
    dropFraction:
      ceiling > 0 && stage.drop !== null && stage.drop > 0
        ? Math.min(stage.drop / ceiling, 1)
        : 0,
  }));
}

/**
 * Which stage lost the most people, by count rather than by rate.
 *
 * By count on purpose. The worst *rate* is often the last step of a long funnel, where a
 * handful of people are left and losing three of them reads as a catastrophe. The worst *count*
 * is where the work is.
 */
export function worstDropIndex(stages = []) {
  let at = -1;
  let worst = 0;

  stages.forEach((stage, index) => {
    if (stage.drop !== null && stage.drop > worst) {
      worst = stage.drop;
      at = index;
    }
  });

  return at;
}

/**
 * The stages that are bigger than the one before them.
 *
 * This is not a funnel, and drawing it as one would be drawing a shape that cannot exist. It
 * usually means the stages are measured over different windows, or that people are joining
 * part-way through — either way it is a sentence, not a picture.
 */
export function risingStages(stages = []) {
  return stages.filter((stage) => stage.rising);
}

/** First stage to last, which is the number the funnel exists to produce. */
export function overallRate(stages = []) {
  if (stages.length < 2 || !stages[0] || stages[0].value === 0) {
    return null;
  }

  return stages[stages.length - 1].value / stages[0].value;
}

/**
 * The `var()` for a stage, so no property name is ever built from a number.
 *
 * Past the ramp's length every stage takes the first slot — one colour for all of them, which
 * is the default treatment anyway and is stated in a note rather than left to be noticed.
 */
export function colourFor(index, { shade = 'single' } = {}) {
  if (shade !== 'stages' || !Number.isInteger(index) || index < 0 || index >= STAGE_VARS.length) {
    return BAR_VAR;
  }

  return STAGE_VARS[index];
}

/** `0.4213` becomes `42.1%`. One decimal: a conversion rate is not a measurement to six figures. */
export function formatRate(rate) {
  const value = number(rate);

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

/** Thousands-separated, for a figure nobody wrote out. */
export function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString('en-US') : '';
}

/** Fills a template such as `{rate} of previous`, leaving nothing ragged. */
export function fillLabel(template, values = {}) {
  return String(template ?? '')
    .replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : ''))
    .replace(/\s+/g, ' ')
    .trim();
}
