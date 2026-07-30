export const SIZES = Object.freeze(['md', 'sm']);
export const SEPARATORS = Object.freeze(['slash', 'chevron', 'arrow']);

export const DEFAULT_LABELS = Object.freeze({
  expand: 'Show {count} hidden levels',
});

/**
 * Hiding a single level behind a button costs a press and saves almost no width, so a
 * trail only collapses when there are at least this many levels to put away.
 */
export const MINIMUM_HIDDEN = 2;

function normalizeFrom(allowed, value, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function normalizeSize(value) {
  return normalizeFrom(SIZES, value, 'md');
}

export function normalizeSeparator(value) {
  return normalizeFrom(SEPARATORS, value, 'slash');
}

function wholeNumber(value, fallback) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

/**
 * Works out which levels a long trail should put away.
 *
 * The first levels give the trail its root and the last give the current position, so the
 * middle is what goes behind the button.
 */
export function collapseModel({
  count,
  maxItems,
  itemsBeforeCollapse = 1,
  itemsAfterCollapse = 1,
} = {}) {
  const total = wholeNumber(count, 0);
  const limit = wholeNumber(maxItems, 0);

  if (total === 0 || limit === 0 || total <= limit) {
    return { collapsed: false, hidden: [] };
  }

  const before = Math.min(wholeNumber(itemsBeforeCollapse, 1), total);
  const after = Math.min(wholeNumber(itemsAfterCollapse, 1), total - before);

  const hidden = [];
  for (let index = before; index < total - after; index += 1) {
    hidden.push(index);
  }

  if (hidden.length < MINIMUM_HIDDEN) {
    return { collapsed: false, hidden: [] };
  }

  return { collapsed: true, hidden };
}

export function expandLabel(count, labels = {}) {
  const template =
    typeof labels.expand === 'string' && labels.expand.trim().length
      ? labels.expand
      : DEFAULT_LABELS.expand;

  return template.replace('{count}', String(count));
}
