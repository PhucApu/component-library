import {
  DEFAULT_LABELS,
  DRAG_THRESHOLD,
  autoScrollStep,
  blockedBy,
  dropIndex,
  fillLabel,
  moveItem,
  nextIndex,
  offsetTo,
  segmentFor,
  shiftFor,
} from './sortable-list-core.js';

let sequence = 0;

function uniqueId(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Rows the reader can put in the order they want.
 *
 * ```html
 * <ui-sortable-list>
 *   <ol>
 *     <li>Review pull requests</li>
 *     <li data-locked>Deploy to production</li>
 *   </ol>
 * </ui-sortable-list>
 * ```
 *
 * **Pointer events rather than the HTML5 drag-and-drop API.** That API does not fire on touch
 * in most mobile browsers — on a phone the feature simply is not there — it needs a
 * `preventDefault` on `dragover` before a drop is allowed at all, and its drag image is a
 * browser-rendered bitmap you cannot style. `dataTransfer` exists to move data *between
 * applications*, which is not what reordering a list is. Pointer events give one code path for
 * mouse, touch and pen.
 *
 * **The keyboard is the second required path, not an extra.** Space or Enter grabs, the arrows
 * move, Space or Enter drops, Escape cancels and puts the row back. Every step is spoken.
 *
 * Rows are **moved, not re-rendered**. The same nodes are re-inserted, so focus, text selection
 * and anything living inside a row survive the reorder.
 */
export class UiSortableList extends HTMLElement {
  static get observedAttributes() {
    return ['drag', 'disabled', 'pending', 'error'];
  }

  constructor() {
    super();
    this._connected = false;
    this._labelOverrides = {};
    this._rows = [];
    this._locked = new Set();
    this._from = -1;
    this._to = -1;
    this._keyboard = false;
    this._dragging = false;
    this._armed = null;
    this._commit = null;
    this._commitToken = 0;
    this._scrolling = null;

    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerUp = this._handlePointerUp.bind(this);
    this._handlePointerCancel = this._handlePointerCancel.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this._read();
    this._build();
    this._render();
  }

  disconnectedCallback() {
    this._connected = false;
    this._stopAutoScroll();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._connected || oldValue === newValue) {
      return;
    }

    if (name === 'drag') {
      this._read();
      this._syncHandles();
    }

    this._render();
  }

  /* ---- What the page can ask ---------------------------------------------------------- */

  /** Every row in its current order, with the name that gets spoken and whether it is a wall. */
  get items() {
    return this._rows.map((row, index) => ({
      index,
      name: this._nameFor(row),
      locked: this._locked.has(index),
      element: row,
    }));
  }

  /** Just the names, in order — the shape most pages want to persist. */
  get order() {
    return this._rows.map((row) => this._nameFor(row));
  }

  get drag() {
    return this.getAttribute('drag') === 'row' ? 'row' : 'handle';
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  get pending() {
    return this.hasAttribute('pending');
  }

  set pending(next) {
    this.toggleAttribute('pending', Boolean(next));
  }

  /**
   * An async function run after every reorder. Reject it and the list goes back.
   *
   * Mirrors the same contract `ui-switch` uses, because the problem is the same one: the
   * optimistic change has already been shown and something has to undo it honestly.
   */
  get commit() {
    return this._commit;
  }

  set commit(next) {
    this._commit = typeof next === 'function' ? next : null;
  }

  get labels() {
    return { ...DEFAULT_LABELS, ...this._labelOverrides };
  }

  set labels(value) {
    this._labelOverrides = value && typeof value === 'object' ? { ...value } : {};
    this._syncHandles();
  }

  /** Moves a row without a pointer or a keyboard, for a page driving the list itself. */
  move(from, to) {
    if (!this._rows.length || from === to) {
      return false;
    }

    const { start, end } = segmentFor(from, { locked: this._locked, count: this._rows.length });

    if (this._locked.has(from) || to < start || to > end) {
      return false;
    }

    this._applyOrder(moveItem(this._rows, from, to));
    this._announce(
      fillLabel(this.labels.moved, {
        name: this._nameFor(this._rows[to]),
        position: to + 1,
        total: this._rows.length,
      }),
    );
    this._settle(from, to);
    return true;
  }

  refresh() {
    this._read();
    this._syncHandles();
    this._render();
  }

  /* ---- Reading the markup ------------------------------------------------------------- */

  _read() {
    const table = this.querySelector('table');
    // A table row is a row too — arguably the row people mean. The only difference that
    // reaches this file is where the container lives.
    this._container = table ? table.querySelector('tbody') : this.querySelector('ol, ul');
    this._isTable = Boolean(table);

    if (!this._container) {
      this._rows = [];
      this._locked = new Set();
      return;
    }

    this._rows = [...this._container.children].filter((row) =>
      this._isTable ? row.tagName === 'TR' : row.tagName === 'LI',
    );

    this._locked = new Set(
      this._rows.map((row, index) => (row.hasAttribute('data-locked') ? index : -1)).filter((i) => i >= 0),
    );
  }

  _nameFor(row) {
    if (!row) {
      return '';
    }

    return (
      row.getAttribute('data-sortable-name') ||
      row.querySelector('[data-sortable-name]')?.textContent.trim() ||
      row.textContent.replace(/\s+/g, ' ').trim()
    );
  }

  /* ---- The furniture ------------------------------------------------------------------ */

  _build() {
    if (this._status) {
      return;
    }

    this._status = document.createElement('span');
    this._status.className = 'sortable__sr-only';
    this._status.setAttribute('role', 'status');

    this._instructions = document.createElement('span');
    this._instructions.className = 'sortable__sr-only';
    this._instructions.id = uniqueId('sortable-help');
    this._instructions.textContent =
      'Press space or enter to pick this row up, then the arrow keys to move it.';

    this._empty = document.createElement('p');
    this._empty.className = 'sortable__empty';
    this._empty.hidden = true;

    this._note = document.createElement('p');
    this._note.className = 'sortable__note';
    this._note.hidden = true;

    this.append(this._empty, this._note, this._instructions, this._status);
    this._syncHandles();
  }

  /**
   * One handle per row, and the author's own if they put one there.
   *
   * The component cannot invent a table column, so a created handle goes *inside* the first
   * cell rather than beside it — a new `<td>` would leave the header one heading short and
   * every row misaligned from it.
   */
  _syncHandles() {
    const labels = this.labels;

    this._rows.forEach((row, index) => {
      row.classList.add('sortable__row');
      row.dataset.sortableIndex = String(index);

      const locked = this._locked.has(index);
      let handle = row.querySelector('[data-sortable-handle]');

      // A locked row is marked positively rather than by the absence of a handle, and marked
      // with a glyph rather than a tint. No tint could clear its own contrast floor in dark
      // mode without going darker than the page behind it, and a fill nobody can see is worse
      // than no fill at all.
      if (locked && !handle && !row.querySelector('.sortable__lock')) {
        const lock = document.createElement('span');
        lock.className = 'sortable__lock';
        lock.setAttribute('role', 'img');
        lock.setAttribute('aria-label', fillLabel(labels.locked, { name: this._nameFor(row) }));
        lock.innerHTML =
          '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
          '<path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="currentColor" ' +
          'stroke-width="1.5" stroke-linecap="round"/>' +
          '<rect x="3" y="7" width="10" height="7" rx="2" fill="currentColor"/></svg>';

        const host = this._isTable ? row.querySelector('td, th') ?? row : row;
        host.prepend(lock);
      }

      if (!handle && !locked) {
        handle = document.createElement('button');
        handle.type = 'button';
        handle.setAttribute('data-sortable-handle', '');
        handle.innerHTML =
          '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
          '<circle cx="6" cy="3" r="1.4"/><circle cx="10" cy="3" r="1.4"/>' +
          '<circle cx="6" cy="8" r="1.4"/><circle cx="10" cy="8" r="1.4"/>' +
          '<circle cx="6" cy="13" r="1.4"/><circle cx="10" cy="13" r="1.4"/></svg>';

        const host = this._isTable ? row.querySelector('td, th') ?? row : row;
        host.prepend(handle);
      }

      if (handle) {
        handle.classList.add('sortable__handle');
        handle.setAttribute('aria-label', fillLabel(labels.handle, { name: this._nameFor(row) }));
        handle.setAttribute('aria-describedby', this._instructions.id);
        handle.toggleAttribute('disabled', this.disabled || this.pending);

        if (!handle.dataset.sortableWired) {
          handle.dataset.sortableWired = 'true';
          handle.addEventListener('pointerdown', this._handlePointerDown);
          handle.addEventListener('keydown', this._handleKeyDown);
        }
      }

      // Whole-row dragging is opt-in. A row that is draggable everywhere cannot have its text
      // selected or its buttons pressed, which is too much to take from every list by default.
      if (this.drag === 'row' && !locked && !row.dataset.sortableWired) {
        row.dataset.sortableWired = 'true';
        row.addEventListener('pointerdown', this._handlePointerDown);
      }

      row.toggleAttribute('data-sortable-locked', locked);
    });
  }

  _render() {
    if (!this._status) {
      return;
    }

    const labels = this.labels;
    const error = this.getAttribute('error');
    const nothing = this._rows.length === 0;

    this._empty.hidden = !nothing;
    this._empty.textContent = labels.empty;

    this._note.hidden = !error;
    this._note.textContent = error ?? '';

    this._syncHandles();
  }

  /* ---- Picking a row up ---------------------------------------------------------------- */

  _indexOfEvent(event) {
    const row = event.target.closest?.('.sortable__row');
    return row ? this._rows.indexOf(row) : -1;
  }

  _handlePointerDown(event) {
    if (this.disabled || this.pending || event.button > 0) {
      return;
    }

    const index = this._indexOfEvent(event);

    if (index < 0 || this._locked.has(index) || this._dragging) {
      return;
    }

    // Whole-row dragging must not swallow the controls inside the row.
    if (event.currentTarget === event.target.closest('.sortable__row')) {
      if (event.target.closest('a, button, input, select, textarea, [contenteditable]')) {
        return;
      }
    }

    // Armed, not dragging. Nothing moves until the pointer clears the threshold, or a press on
    // a button inside the row would register as a one-pixel drag and eat the click.
    this._armed = {
      index,
      pointerId: event.pointerId,
      startY: event.clientY,
      target: event.currentTarget,
    };

    // Capture keeps the move events coming when the pointer wanders off the handle, but it is
    // allowed to fail — a pointer the browser no longer considers active throws
    // `NotFoundError`. Optional chaining does not help: it guards a missing method, not a
    // throwing one, and letting it escape here would abandon the drag before it started. The
    // drag works without capture; it just gives up more easily.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* No capture. The listeners below still run. */
    }

    event.currentTarget.addEventListener('pointermove', this._handlePointerMove);
    event.currentTarget.addEventListener('pointerup', this._handlePointerUp);
    event.currentTarget.addEventListener('pointercancel', this._handlePointerCancel);
  }

  _handlePointerMove(event) {
    if (!this._armed || event.pointerId !== this._armed.pointerId) {
      return;
    }

    const delta = event.clientY - this._armed.startY;

    if (!this._dragging) {
      if (Math.abs(delta) < DRAG_THRESHOLD) {
        return;
      }

      this._beginDrag(this._armed.index, { keyboard: false });
    }

    event.preventDefault();
    this._pointerY = event.clientY;
    this._updateDrag(event.clientY - this._armed.startY);
    this._autoScroll(event.clientY);
  }

  _handlePointerUp(event) {
    this._releasePointer(event);

    if (this._dragging) {
      this._endDrag({ cancelled: false });
    }

    this._armed = null;
  }

  _handlePointerCancel(event) {
    this._releasePointer(event);

    // A phone call, a system gesture, a lost pointer. The list goes back rather than dropping
    // the row wherever it happened to be.
    if (this._dragging) {
      this._endDrag({ cancelled: true });
    }

    this._armed = null;
  }

  _releasePointer(event) {
    const target = this._armed?.target ?? event.currentTarget;

    try {
      target?.releasePointerCapture(event.pointerId);
    } catch {
      /* Never captured, or already released. Either way there is nothing to give back. */
    }

    target?.removeEventListener('pointermove', this._handlePointerMove);
    target?.removeEventListener('pointerup', this._handlePointerUp);
    target?.removeEventListener('pointercancel', this._handlePointerCancel);
    this._stopAutoScroll();
  }

  /* ---- The drag itself ------------------------------------------------------------------ */

  _beginDrag(index, { keyboard }) {
    this._dragging = true;
    this._keyboard = keyboard;
    this._from = index;
    this._to = index;
    // Measured once, before anything moves. Re-measuring mid-drag would read the transforms
    // the drag itself applied and chase its own tail.
    this._boxes = this._rows.map((row) => {
      const rect = row.getBoundingClientRect();
      return { top: rect.top, height: rect.height };
    });

    this._rows[index].toggleAttribute('data-sortable-grabbed', true);
    this.toggleAttribute('data-sortable-dragging', true);

    this._announce(
      fillLabel(this.labels.grabbed, {
        name: this._nameFor(this._rows[index]),
        position: index + 1,
        total: this._rows.length,
      }),
    );
  }

  _updateDrag(delta) {
    const { start, end } = segmentFor(this._from, {
      locked: this._locked,
      count: this._rows.length,
    });

    const wanted = dropIndex({ boxes: this._boxes, from: this._from, delta });
    this._to = Math.min(Math.max(wanted, start), end);

    this._paint(delta);
  }

  /** Puts every row where the current `from`/`to` says it should be. */
  _paint(delta) {
    this._rows.forEach((row, index) => {
      if (index === this._from) {
        row.style.transform = `translateY(${delta}px)`;
        return;
      }

      const shift = shiftFor({ boxes: this._boxes, from: this._from, to: this._to, index });
      row.style.transform = shift ? `translateY(${shift}px)` : '';
      row.toggleAttribute('data-sortable-shifted', shift !== 0);
    });
  }

  _endDrag({ cancelled }) {
    const from = this._from;
    const to = cancelled ? from : this._to;
    const row = this._rows[from];
    const name = this._nameFor(row);

    this._rows.forEach((each) => {
      each.style.transform = '';
      each.removeAttribute('data-sortable-shifted');
    });
    row.removeAttribute('data-sortable-grabbed');
    this.removeAttribute('data-sortable-dragging');

    this._dragging = false;
    this._keyboard = false;
    this._stopAutoScroll();

    if (cancelled) {
      this._announce(
        fillLabel(this.labels.cancelled, { name, position: from + 1, total: this._rows.length }),
      );
      return;
    }

    if (to === from) {
      this._announce(
        fillLabel(this.labels.dropped, { name, position: from + 1, total: this._rows.length }),
      );
      return;
    }

    this._applyOrder(moveItem(this._rows, from, to));
    this._announce(
      fillLabel(this.labels.dropped, { name, position: to + 1, total: this._rows.length }),
    );
    this._settle(from, to);
  }

  /**
   * Re-inserts the same nodes in the new order.
   *
   * Moving nodes rather than rebuilding them is what lets focus stay on the handle that was
   * just used, and what lets an input halfway down the list keep what somebody typed into it.
   */
  _applyOrder(next) {
    // Re-inserting a node removes it first, and removing the focused element from the document
    // blurs it — being the *same* node is not enough. Somebody reordering by keyboard would be
    // dropped back on the body after every move, which is the exact failure this whole path
    // exists to avoid.
    const active = document.activeElement;
    const refocus = active && this.contains(active) ? active : null;

    const anchor = document.createDocumentFragment();
    next.forEach((row) => anchor.append(row));
    this._container.append(anchor);
    this._rows = next;

    refocus?.focus({ preventScroll: true });

    this._locked = new Set(
      this._rows.map((row, index) => (row.hasAttribute('data-locked') ? index : -1)).filter((i) => i >= 0),
    );

    this._rows.forEach((row, index) => {
      row.dataset.sortableIndex = String(index);
    });
  }

  _settle(from, to) {
    const detail = { from, to, order: this.order, name: this._nameFor(this._rows[to]) };

    this.dispatchEvent(new CustomEvent('reorder', { detail, bubbles: true, composed: true }));

    if (this._commit) {
      this._runCommit({ ...detail, previous: moveItem(this._rows, to, from) });
    }
  }

  /**
   * The optimistic change has already been shown, so something has to undo it honestly.
   *
   * The token is not decoration: two quick reorders leave two commits in flight, and without
   * it the slower one's failure would roll back a change the reader has since replaced.
   */
  async _runCommit({ from, to, order, previous }) {
    const token = (this._commitToken += 1);

    this.pending = true;
    this._syncHandles();
    this._announce(this.labels.saving);

    try {
      await this._commit({ from, to, order });

      if (token !== this._commitToken) {
        return;
      }

      this.pending = false;
      this._syncHandles();
      this._announce(this.labels.saved);
    } catch (reason) {
      if (token !== this._commitToken) {
        return;
      }

      this.pending = false;
      this._applyOrder(previous);
      this._syncHandles();
      this._announce(
        fillLabel(this.labels.failed, {
          name: this._nameFor(previous[from]),
          position: from + 1,
          total: previous.length,
        }),
      );

      this.dispatchEvent(
        new CustomEvent('reorder-failed', {
          detail: { from, to, reason },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  /* ---- The keyboard, which is the other half of this component -------------------------- */

  _handleKeyDown(event) {
    if (this.disabled || this.pending) {
      return;
    }

    const index = this._indexOfEvent(event);

    if (index < 0) {
      return;
    }

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();

      if (this._dragging && this._keyboard) {
        this._endDrag({ cancelled: false });
      } else if (!this._dragging) {
        if (this._locked.has(index)) {
          this._announce(fillLabel(this.labels.locked, { name: this._nameFor(this._rows[index]) }));
          return;
        }

        this._beginDrag(index, { keyboard: true });
        this._paint(0);
      }

      return;
    }

    if (!this._dragging || !this._keyboard) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this._endDrag({ cancelled: true });
      return;
    }

    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      return;
    }

    // Cancelled, or the arrows scroll the page out from under the row being moved.
    event.preventDefault();

    const count = this._rows.length;
    const next = nextIndex({ from: this._to, key: event.key, count, locked: this._locked });

    if (next === this._to) {
      const wall = blockedBy({ from: this._to, key: event.key, count, locked: this._locked });

      if (wall >= 0) {
        this._announce(
          fillLabel(this.labels.blocked, {
            name: this._nameFor(this._rows[this._from]),
            other: this._nameFor(this._rows[wall]),
          }),
        );
      }

      return;
    }

    this._to = next;
    this._paint(offsetTo({ boxes: this._boxes, from: this._from, to: next }));
    this._announce(
      fillLabel(this.labels.moved, {
        name: this._nameFor(this._rows[this._from]),
        position: next + 1,
        total: count,
      }),
    );
  }

  /* ---- Following the pointer past the edge ---------------------------------------------- */

  _scrollParent() {
    let node = this.parentElement;

    while (node && node !== document.body) {
      const style = getComputedStyle(node);

      if (/(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
        return node;
      }

      node = node.parentElement;
    }

    return null;
  }

  /**
   * A fifty-row list cannot be reordered past what fits on the screen without this.
   *
   * It runs on its own frame loop rather than off pointermove, because holding still at the
   * edge has to keep scrolling — and a pointer that is not moving sends no events.
   */
  _autoScroll(pointerY) {
    const box = this._scrollParent();

    if (!box) {
      return;
    }

    const rect = box.getBoundingClientRect();
    const step = autoScrollStep({ pointer: pointerY, top: rect.top, bottom: rect.bottom });

    if (step === 0) {
      this._stopAutoScroll();
      return;
    }

    if (this._scrolling) {
      this._scrolling.step = step;
      return;
    }

    this._scrolling = { step, box, frame: 0 };

    const tick = () => {
      if (!this._scrolling || !this._dragging) {
        return;
      }

      this._scrolling.box.scrollTop += this._scrolling.step;
      this._updateDrag(this._pointerY - this._armed.startY);
      this._scrolling.frame = requestAnimationFrame(tick);
    };

    this._scrolling.frame = requestAnimationFrame(tick);
  }

  _stopAutoScroll() {
    if (this._scrolling) {
      cancelAnimationFrame(this._scrolling.frame);
      this._scrolling = null;
    }
  }

  _announce(message) {
    this._status.textContent = message;
  }
}

if (!customElements.get('ui-sortable-list')) {
  customElements.define('ui-sortable-list', UiSortableList);
}

export { DRAG_THRESHOLD, prefersReducedMotion };
