/**
 * The arithmetic a reorder decides by, with no DOM in any of it.
 *
 * Where a dragged row lands, how far every displaced row has to shift, where a locked row
 * stops a move, and what gets said out loud. All of it runnable in a test file rather than
 * only through a browser, because the interesting failures here are arithmetic — a list that
 * drops one place off is a bug you cannot see by looking at a screenshot.
 */

/**
 * How far a pointer travels before it is a drag rather than a click.
 *
 * Without a threshold, pressing a button inside a row registers a one-pixel drag and the
 * click never lands. Five pixels is enough to swallow the wobble of a mouse click and a
 * fingertip, and small enough that a deliberate drag starts immediately.
 */
export const DRAG_THRESHOLD = 5;

/** How close to an edge the pointer has to get before a scrolling list follows it. */
export const SCROLL_EDGE = 48;
export const SCROLL_SPEED = 12;

export const DEFAULT_LABELS = Object.freeze({
  handle: 'Reorder {name}',
  grabbed:
    'Grabbed {name}, position {position} of {total}. Use the arrow keys to move, space to drop, escape to cancel.',
  moved: '{name}, position {position} of {total}.',
  dropped: 'Dropped {name} at position {position} of {total}.',
  cancelled: 'Reorder cancelled. {name} is back at position {position} of {total}.',
  locked: '{name} is locked and cannot be moved.',
  blocked: '{name} cannot move past {other}.',
  saving: 'Saving the new order.',
  saved: 'Order saved.',
  failed: 'That order could not be saved. {name} is back at position {position} of {total}.',
  empty: 'Nothing to reorder',
});

const bottomOf = (box) => box.top + box.height;

/** Keeps an index inside the list rather than off either end. */
export function clampIndex(index, count) {
  if (!Number.isInteger(index) || count <= 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), count - 1);
}

/** Moves one entry and slides everything between the two positions along. */
export function moveItem(items = [], from = 0, to = 0) {
  const next = [...items];

  if (from === to || from < 0 || from >= next.length) {
    return next;
  }

  const [moved] = next.splice(from, 1);
  next.splice(clampIndex(to, items.length), 0, moved);

  return next;
}

/**
 * Which slot the dragged row is currently over.
 *
 * The distance a row travels to swap with its neighbour is **the neighbour's** height plus the
 * gap between them, not its own. With rows of one height those are the same number and any
 * formula looks right; with a real table they are different, and using the wrong one is what
 * makes a mixed-height list feel like it drops a place off from where you let go.
 *
 * `delta` is how far the row has been dragged from where it started, in the same units as the
 * boxes. Boxes are the layout as it was *before* the drag began — they are not re-measured
 * while a row is in the air, so the arithmetic stays stable.
 */
export function dropIndex({ boxes = [], from = 0, delta = 0 } = {}) {
  const count = boxes.length;

  if (count === 0 || from < 0 || from >= count) {
    return clampIndex(from, count);
  }

  let to = from;
  let travelled = 0;

  if (delta > 0) {
    for (let index = from + 1; index < count; index += 1) {
      const step = bottomOf(boxes[index]) - bottomOf(boxes[index - 1]);

      if (delta < travelled + step / 2) {
        break;
      }

      travelled += step;
      to = index;
    }
  } else if (delta < 0) {
    for (let index = from - 1; index >= 0; index -= 1) {
      const step = boxes[index + 1].top - boxes[index].top;

      if (-delta < travelled + step / 2) {
        break;
      }

      travelled += step;
      to = index;
    }
  }

  return to;
}

/**
 * How far a row has to move out of the way while another one is being dropped on its slot.
 *
 * Every displaced row shifts by the same amount — the space the dragged row is vacating,
 * which is its own height plus the gap on the side it is leaving from. That side differs by
 * direction, which is why the two branches do not share a formula.
 */
export function shiftFor({ boxes = [], from = 0, to = 0, index = 0 } = {}) {
  if (to === from || index === from || boxes.length === 0) {
    return 0;
  }

  if (to > from && index > from && index <= to) {
    return -(boxes[from + 1].top - boxes[from].top);
  }

  if (to < from && index >= to && index < from) {
    return bottomOf(boxes[from]) - bottomOf(boxes[from - 1]);
  }

  return 0;
}

/**
 * How far the dragged row itself has to travel to sit at `to`.
 *
 * The pointer path does not need this — the row is already under the finger. The keyboard path
 * does: pressing an arrow has to move the row somewhere, and "somewhere" is the same slot the
 * pointer would have dropped it in, so both paths land in exactly one place.
 */
export function offsetTo({ boxes = [], from = 0, to = 0 } = {}) {
  if (to === from || boxes.length === 0 || !boxes[from] || !boxes[to]) {
    return 0;
  }

  return to > from
    ? bottomOf(boxes[to]) - bottomOf(boxes[from])
    : boxes[to].top - boxes[from].top;
}

/**
 * The stretch of the list a row is allowed to move within.
 *
 * A locked row is a **wall**, not merely an item that cannot be picked up. Rows reorder freely
 * on either side of it and never across it, which is what "this one stays third" actually
 * means. Treating a locked row as merely unpickable lets everything else slide underneath it
 * and quietly changes its position anyway.
 */
export function segmentFor(index, { locked = new Set(), count = 0 } = {}) {
  let start = 0;
  let end = count - 1;

  for (let at = index - 1; at >= 0; at -= 1) {
    if (locked.has(at)) {
      start = at + 1;
      break;
    }
  }

  for (let at = index + 1; at < count; at += 1) {
    if (locked.has(at)) {
      end = at - 1;
      break;
    }
  }

  return { start, end };
}

/** Where a keyboard step lands, stopping at a locked row rather than jumping over it. */
export function nextIndex({ from = 0, key = '', count = 0, locked = new Set() } = {}) {
  if (count === 0 || locked.has(from)) {
    return from;
  }

  const { start, end } = segmentFor(from, { locked, count });

  const target = {
    ArrowUp: from - 1,
    ArrowDown: from + 1,
    Home: start,
    End: end,
  }[key];

  if (target === undefined) {
    return from;
  }

  return Math.min(Math.max(target, start), end);
}

/** The row a move was refused by, so the refusal can name it instead of going silent. */
export function blockedBy({ from = 0, key = '', count = 0, locked = new Set() } = {}) {
  const { start, end } = segmentFor(from, { locked, count });

  if (key === 'ArrowUp' && from === start && start > 0) {
    return start - 1;
  }

  if (key === 'ArrowDown' && from === end && end < count - 1) {
    return end + 1;
  }

  return -1;
}

/** Fills a template such as `{name}, position {position} of {total}`, leaving nothing ragged. */
export function fillLabel(template, values = {}) {
  return String(template ?? '')
    .replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/** How far a list scrolls this frame when a drag is held near its edge. */
export function autoScrollStep({ pointer = 0, top = 0, bottom = 0, edge = SCROLL_EDGE, speed = SCROLL_SPEED } = {}) {
  if (bottom - top <= edge * 2) {
    return 0;
  }

  if (pointer < top + edge) {
    return -Math.round(speed * Math.min(1, (top + edge - pointer) / edge));
  }

  if (pointer > bottom - edge) {
    return Math.round(speed * Math.min(1, (pointer - (bottom - edge)) / edge));
  }

  return 0;
}
