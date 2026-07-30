export const DENSITIES = Object.freeze(['comfortable', 'compact']);
export const SORT_STATES = Object.freeze(['none', 'ascending', 'descending']);

export const DEFAULT_LABELS = Object.freeze({
  scrollRegion: '{caption}, scrollable',
  selectAll: 'Select all rows',
  expandRow: 'Show details',
  collapseRow: 'Hide details',
});

export function normalizeDensity(value) {
  return DENSITIES.includes(value) ? value : 'comfortable';
}

/**
 * Three states rather than two. Without a way back, a person who sorted a column to look
 * at one thing can never see the order the data arrived in again.
 */
export function nextSortState(current) {
  // Anything unrecognised is treated as unsorted and then advanced, so the first press
  // always sorts rather than doing nothing.
  const from = SORT_STATES.includes(current) ? current : 'none';
  return SORT_STATES[(SORT_STATES.indexOf(from) + 1) % SORT_STATES.length];
}

/** What belongs in `aria-sort`, which lives on the header cell and not on its button. */
export function ariaSortFor(state) {
  return SORT_STATES.includes(state) ? state : 'none';
}

function cellText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseNumber(value) {
  const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

/**
 * Decides whether a column should be compared as numbers.
 *
 * Every value present has to parse. One stray label in a column of prices means comparing
 * as text, which is wrong far less often than putting that label at an arbitrary end.
 */
export function detectNumeric(values) {
  const present = (Array.isArray(values) ? values : []).map(cellText).filter(Boolean);

  if (present.length === 0) {
    return false;
  }

  return present.every((value) => Number.isFinite(Number.parseFloat(value.replace(/[^\d.-]/g, ''))));
}

/**
 * Orders two cells.
 *
 * Blank cells sort last in **both** directions. "No value" is not a small value, and a
 * column reversed into a wall of empty rows tells the reader nothing.
 */
export function compareValues(a, b, { numeric = false, direction = 'ascending' } = {}) {
  const left = cellText(a);
  const right = cellText(b);

  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  const order = numeric
    ? parseNumber(left) - parseNumber(right)
    : left.localeCompare(right, 'en', { sensitivity: 'base', numeric: true });

  return direction === 'descending' ? -order : order;
}

/** Drives the header checkbox, which has a third state the other two cannot express. */
export function selectionState({ total, selected } = {}) {
  const rows = Number.isFinite(total) && total > 0 ? total : 0;
  const chosen = Number.isFinite(selected) && selected > 0 ? selected : 0;

  if (rows === 0 || chosen === 0) {
    return 'none';
  }

  return chosen >= rows ? 'all' : 'some';
}

export function fillLabel(template, values = {}) {
  return Object.entries(values)
    .reduce(
      (text, [key, value]) => text.replaceAll(`{${key}}`, String(value ?? '')),
      typeof template === 'string' ? template : '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}
