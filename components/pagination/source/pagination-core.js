export const SIZES = Object.freeze(['md', 'sm']);
export const ELLIPSIS_START = 'ellipsis-start';
export const ELLIPSIS_END = 'ellipsis-end';

export const DEFAULT_LABELS = Object.freeze({
  first: 'Go to first page',
  previous: 'Go to previous page',
  next: 'Go to next page',
  last: 'Go to last page',
  page: 'Go to page {page}',
  current: 'Page {page}',
  compact: 'Page {page} of {count}',
  announce: 'Page {page} of {count}',
  announceRange: 'Page {page} of {count}, showing {start} to {end} of {total}',
});

export function normalizeSize(value) {
  return SIZES.includes(value) ? value : 'md';
}

function wholeNumber(value, fallback) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

/** At least one page always exists, even with nothing to show. */
export function clampCount(value) {
  return Math.max(1, wholeNumber(value, 1));
}

export function clampPage(value, count) {
  const pages = clampCount(count);
  return Math.min(Math.max(1, wholeNumber(value, 1)), pages);
}

function range(start, end) {
  const list = [];

  for (let value = start; value <= end; value += 1) {
    list.push(value);
  }

  return list;
}

/**
 * Works out which page numbers to show.
 *
 * `boundaryCount` pages stay at each end so the first and last are always one press away;
 * `siblingCount` pages sit either side of the current one. Everything else collapses.
 *
 * One detail decides whether this feels right: when a gap holds exactly one page, that
 * page is shown instead of an ellipsis. Replacing a single number with a mark that stands
 * for it is the same width and one fewer thing anyone can reach.
 */
export function buildRange({ page, count, siblingCount = 1, boundaryCount = 1 } = {}) {
  const pages = clampCount(count);
  const current = clampPage(page, pages);
  const siblings = Math.max(0, wholeNumber(siblingCount, 1));
  const boundary = Math.max(1, wholeNumber(boundaryCount, 1));

  const startPages = range(1, Math.min(boundary, pages));
  const endPages = range(Math.max(pages - boundary + 1, boundary + 1), pages);

  const siblingsStart = Math.max(
    Math.min(current - siblings, pages - boundary - siblings * 2 - 1),
    boundary + 2,
  );

  const siblingsEnd = Math.min(
    Math.max(current + siblings, boundary + siblings * 2 + 2),
    endPages.length > 0 ? endPages[0] - 2 : pages - 1,
  );

  const middle = range(siblingsStart, siblingsEnd);

  const before =
    siblingsStart > boundary + 2
      ? [ELLIPSIS_START]
      : boundary + 1 < pages - boundary
        ? [boundary + 1]
        : [];

  const after =
    siblingsEnd < pages - boundary - 1
      ? [ELLIPSIS_END]
      : pages - boundary > boundary
        ? [pages - boundary]
        : [];

  return [...startPages, ...before, ...middle, ...after, ...endPages];
}

/** Which rows a page covers, as one-based inclusive positions. */
export function pageSlice({ page, pageSize, total } = {}) {
  const size = Math.max(1, wholeNumber(pageSize, 1));
  const rows = Math.max(0, wholeNumber(total, 0));

  if (rows === 0) {
    return { start: 0, end: 0, count: 1 };
  }

  const pages = Math.max(1, Math.ceil(rows / size));
  const current = clampPage(page, pages);
  const start = (current - 1) * size + 1;

  return { start, end: Math.min(current * size, rows), count: pages };
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

/**
 * What the live region says after a page change.
 *
 * Moving page rewrites the content below while focus stays on the button that was pressed,
 * so without this a screen reader user is told nothing at all. Where the row range is
 * known it is worth more than the page number on its own.
 */
export function pageAnnouncement({ page, count, pageSize, total, labels } = {}) {
  const pack = { ...DEFAULT_LABELS, ...labels };
  const pages = clampCount(count);
  const current = clampPage(page, pages);

  if (Number.isFinite(Number(total)) && Number(total) > 0 && Number(pageSize) > 0) {
    const slice = pageSlice({ page: current, pageSize, total });
    return fillLabel(pack.announceRange, {
      page: current,
      count: pages,
      start: slice.start,
      end: slice.end,
      total: Math.floor(Number(total)),
    });
  }

  return fillLabel(pack.announce, { page: current, count: pages });
}
