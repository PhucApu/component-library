import {
  DEFAULT_DURATION,
  DEFAULT_LABELS,
  MAX_STACK_DEPTH,
  canTurn,
  clampDuration,
  clampPage,
  clampTurned,
  commitTurn,
  dragProgress,
  easeInOut,
  fillLabel,
  leafCount,
  leavesFrom,
  pageForTurned,
  shadeAt,
  spreadOf,
  stackOffset,
  turnAngle,
  turnedForPage,
  zIndexFor,
} from './flip-book-core.js';

/** Past this, a press was a drag and the page under it must not take the click. */
const DRAG_SLOP = 4;

/** How much of the recent pointer movement counts towards the flick. */
const VELOCITY_WINDOW = 120;

const ARROWS = Object.freeze({
  previous: { path: 'M15 5l-7 7 7 7', step: -1 },
  next: { path: 'M9 5l7 7-7 7', step: 1 },
});

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A stack of pages that turns like a book.
 *
 * Two things carry it. The first is that one number — how many leaves have been turned —
 * describes the whole book, so a leaf caught half way through a turn is still a book with a
 * definite state rather than an animation with a value in it. The second is that a leaf
 * carries two pages, front and back, which is what makes turning one of them reveal a page
 * on each side of the spine instead of swapping one picture for another.
 */
export class UiFlipBook extends HTMLElement {
  static get observedAttributes() {
    return ['page', 'duration', 'no-drag', 'label'];
  }

  constructor() {
    super();
    this._connected = false;
    this._turned = 0;
    this._turn = null;
    this._frame = 0;
    this._pointerId = null;
    this._dragging = false;
    this._samples = [];

    this._handleFrame = this._handleFrame.bind(this);
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerUp = this._handlePointerUp.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleClickCapture = this._handleClickCapture.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    const list = this.querySelector('ul, ol');

    if (!list) {
      return;
    }

    this._list = list;
    this._pages = [...list.children];

    if (this._pages.length === 0) {
      return;
    }

    if (!this._stage) {
      this._build();
    }

    this._connected = true;
    this._turned = turnedForPage(this.getAttribute('page') ?? 1, this.pages);
    this._apply(true);
  }

  disconnectedCallback() {
    this._connected = false;
    this._stop();
  }

  attributeChangedCallback(name, previous, value) {
    if (!this._connected) {
      return;
    }

    if (name === 'label') {
      this._stage.setAttribute('aria-label', value || DEFAULT_LABELS.book);
      return;
    }

    if (name === 'page' && previous !== value) {
      this.goTo(value);
      return;
    }

    this._apply(true);
  }

  /** How many pages there are, counting both sides of every leaf. */
  get pages() {
    return this._pages?.length ?? 0;
  }

  get leaves() {
    return leafCount(this.pages);
  }

  /** How many leaves have been turned, which is the whole state of the book. */
  get turned() {
    return this._turned;
  }

  /** The first page a reader can see right now. */
  get page() {
    return pageForTurned(this._turned, this.pages);
  }

  set page(value) {
    this.goTo(value);
  }

  next() {
    this._startTurn(this._turned, 1, { animate: true });
  }

  previous() {
    this._startTurn(this._turned - 1, -1, { animate: true });
  }

  /**
   * Opens the book at a page.
   *
   * One leaf away is turned; further than that is opened at, without a flip. Riffling
   * through six leaves to answer one call is a wait, not an animation.
   */
  goTo(page) {
    if (!this._connected) {
      return;
    }

    const target = turnedForPage(page, this.pages);

    if (target === this._turned) {
      return;
    }

    if (target === this._turned + 1) {
      this.next();
      return;
    }

    if (target === this._turned - 1) {
      this.previous();
      return;
    }

    this._turn = null;
    this._stop();
    this._turned = target;
    this._apply(true);
    this._announce();
  }

  _build() {
    this._stage = document.createElement('div');
    this._stage.className = 'flip-book__stage';
    this._stage.tabIndex = 0;
    this._stage.setAttribute('role', 'group');
    this._stage.setAttribute('aria-label', this.getAttribute('label') || DEFAULT_LABELS.book);

    this._spread = document.createElement('div');
    this._spread.className = 'flip-book__spread';

    this._status = document.createElement('p');
    this._status.className = 'flip-book__status';
    this._status.setAttribute('role', 'status');
    this._status.setAttribute('aria-live', 'polite');

    this._arrows = Object.entries(ARROWS).map(([name, arrow]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `flip-book__arrow flip-book__arrow--${name}`;
      button.setAttribute('aria-label', DEFAULT_LABELS[name]);
      button.innerHTML =
        `<svg class="flip-book__arrow-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" ` +
        `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
        `<path d="${arrow.path}" /></svg>`;
      button.addEventListener('click', () => {
        if (arrow.step > 0) {
          this.next();
        } else {
          this.previous();
        }
      });
      return button;
    });

    // The author's pages are moved into leaves rather than copied, so a page carrying a
    // link or a button keeps the element that was already there and everything bound to it.
    this._leaves = leavesFrom(this.pages).map((leaf, index) => {
      const element = document.createElement('li');
      element.className = 'flip-book__leaf';
      element.style.setProperty('--flip-leaf', String(index));
      element.append(
        this._buildFace('front', this._pages[leaf.front]),
        this._buildFace('back', leaf.back === null ? null : this._pages[leaf.back]),
      );
      return element;
    });

    this._list.classList.add('flip-book__leaves');
    this._list.replaceChildren(...this._leaves);
    this._list.before(this._stage);
    this._spread.append(this._list);
    this._stage.append(this._spread, ...this._arrows);
    this.append(this._status);
    this.dataset.enhanced = '';

    this._stage.addEventListener('pointerdown', this._handlePointerDown);
    this._stage.addEventListener('pointermove', this._handlePointerMove);
    this._stage.addEventListener('pointerup', this._handlePointerUp);
    this._stage.addEventListener('pointercancel', this._handlePointerUp);
    this._stage.addEventListener('keydown', this._handleKeyDown);
    this._stage.addEventListener('click', this._handleClickCapture, true);
  }

  _buildFace(side, page) {
    const face = document.createElement('div');
    face.className = `flip-book__face flip-book__face--${side}`;

    if (page) {
      face.append(page);
    } else {
      // A book with an odd page count ends on a blank, and dropping the leaf would lose
      // the page in front of it.
      face.dataset.blank = '';
    }

    const shade = document.createElement('div');
    shade.className = 'flip-book__shade';
    shade.setAttribute('aria-hidden', 'true');
    face.append(shade);

    return face;
  }

  get _duration() {
    return clampDuration(this.getAttribute('duration') ?? DEFAULT_DURATION);
  }

  get _pageWidth() {
    return Number.parseFloat(getComputedStyle(this._leaves[0]).width) || 0;
  }

  /** Writes where every leaf stands. Only the one in the air changes between turns. */
  _apply(force = false) {
    if (!this._connected) {
      return;
    }

    this._leaves.forEach((leaf, index) => {
      const turning = this._turn?.index === index;
      const angle = turning
        ? turnAngle(this._turn.direction > 0 ? this._turn.progress : 1 - this._turn.progress)
        : (index < this._turned ? -180 : 0);
      const depth = index < this._turned ? this._turned - 1 - index : index - this._turned;

      leaf.style.setProperty('--flip-angle', `${angle}deg`);
      leaf.style.setProperty('--flip-offset', `${stackOffset(Math.max(0, depth))}px`);
      leaf.style.setProperty('--flip-shade', String(shadeAt(angle)));
      leaf.style.zIndex = String(zIndexFor(index, this._turned, this.pages, turning));
      leaf.toggleAttribute('data-turned', !turning && index < this._turned);
      leaf.toggleAttribute('data-turning', turning);
      leaf.toggleAttribute('data-deep', !turning && Math.abs(depth) > MAX_STACK_DEPTH);
    });

    if (!force) {
      return;
    }

    const page = String(this.page);

    if (this.getAttribute('page') !== page) {
      this.setAttribute('page', page);
    }

    this._arrows[0].disabled = !canTurn(this._turned, this.pages, -1);
    this._arrows[1].disabled = !canTurn(this._turned, this.pages, 1);
  }

  _announce() {
    const spread = spreadOf(this._turned, this.pages);
    const total = this.pages;

    this._status.textContent =
      spread.left && spread.right
        ? fillLabel(DEFAULT_LABELS.spread, { left: spread.left, right: spread.right, total })
        : fillLabel(DEFAULT_LABELS.single, { page: spread.right ?? spread.left, total });

    this.dispatchEvent(
      new CustomEvent('flip-change', {
        bubbles: true,
        composed: true,
        detail: { page: this.page, pages: total },
      }),
    );
  }

  /**
   * Puts a leaf in the air.
   *
   * `direction` is which way it is going rather than which pile it came from, so a drag
   * that starts on the left and a press of the back arrow are the same movement.
   */
  _startTurn(index, direction, { animate = false, progress = 0 } = {}) {
    if (!this._connected || this._turn) {
      return false;
    }

    if (index < 0 || index >= this.leaves) {
      return false;
    }

    if (!canTurn(this._turned, this.pages, direction)) {
      return false;
    }

    this._turn = { index, direction, progress };
    this._apply();

    if (animate) {
      this._animateTo(1);
    }

    return true;
  }

  /** Runs the leaf the rest of the way, from wherever it is now. */
  _animateTo(target) {
    if (!this._turn) {
      return;
    }

    if (prefersReducedMotion()) {
      this._turn.progress = target;
      this._settle();
      return;
    }

    const from = this._turn.progress;
    const distance = Math.abs(target - from);

    if (distance === 0) {
      this._settle();
      return;
    }

    this._travel = {
      from,
      to: target,
      start: performance.now(),
      duration: this._duration * distance,
    };
    this._start();
  }

  _start() {
    if (!this._frame && this._connected) {
      this._frame = requestAnimationFrame(this._handleFrame);
    }
  }

  _stop() {
    if (this._frame) {
      cancelAnimationFrame(this._frame);
      this._frame = 0;
    }

    this._travel = null;
  }

  _handleFrame(now) {
    this._frame = 0;

    if (!this._travel || !this._turn) {
      return;
    }

    const share = Math.min(1, (now - this._travel.start) / this._travel.duration);
    this._turn.progress = this._travel.from + (this._travel.to - this._travel.from) * easeInOut(share);
    this._apply();

    if (share < 1) {
      this._start();
      return;
    }

    this._travel = null;
    this._settle();
  }

  /** The leaf lands: the book takes the new state, and nothing is in the air any more. */
  _settle() {
    const { index, direction, progress } = this._turn;
    const over = progress >= 1;

    if (over) {
      this._turned = clampTurned(direction > 0 ? index + 1 : index, this.pages);
    }

    this._turn = null;
    this._apply(true);

    if (over) {
      this._announce();
    }
  }

  _pointIn(event) {
    const box = this._spread.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top, time: event.timeStamp };
  }

  _handlePointerDown(event) {
    if (
      this.hasAttribute('no-drag') ||
      event.button !== 0 ||
      this._pointerId !== null ||
      this._turn ||
      this.leaves === 0
    ) {
      return;
    }

    this._pointerId = event.pointerId;
    this._dragging = false;
    this._origin = event.clientX;
    this._samples = [{ x: event.clientX, time: event.timeStamp }];
  }

  _handlePointerMove(event) {
    if (event.pointerId !== this._pointerId) {
      return;
    }

    const distance = event.clientX - this._origin;

    if (!this._dragging && Math.abs(distance) < DRAG_SLOP) {
      return;
    }

    if (!this._dragging) {
      // Which leaf is taken depends on which way the hand went, not on where it landed:
      // pulling left turns the next page, pulling right puts the last one back.
      const forward = distance < 0;
      const index = forward ? this._turned : this._turned - 1;

      if (!this._startTurn(index, forward ? 1 : -1)) {
        this._pointerId = null;
        return;
      }

      this._dragging = true;
      this._stage.setPointerCapture(event.pointerId);
      this._stage.classList.add('is-dragging');
    }

    this._samples.push({ x: event.clientX, time: event.timeStamp });
    this._samples = this._samples.filter((sample) => event.timeStamp - sample.time <= VELOCITY_WINDOW);

    const travelled = this._turn.direction > 0 ? -distance : distance;
    this._turn.progress = dragProgress(travelled, this._pageWidth);
    this._apply();
  }

  _handlePointerUp(event) {
    if (event.pointerId !== this._pointerId) {
      return;
    }

    if (this._stage.hasPointerCapture(event.pointerId)) {
      this._stage.releasePointerCapture(event.pointerId);
    }

    this._pointerId = null;

    if (!this._dragging || !this._turn) {
      return;
    }

    this._dragging = false;
    this._stage.classList.remove('is-dragging');

    const first = this._samples[0];
    const width = this._pageWidth;
    const time = first ? event.timeStamp - first.time : 0;
    const moved = first ? (this._turn.direction > 0 ? first.x - event.clientX : event.clientX - first.x) : 0;
    const velocity = time > 0 ? dragProgress(moved, width) / time : 0;

    this._animateTo(commitTurn({ progress: this._turn.progress, velocity }) ? 1 : 0);
  }

  _handleKeyDown(event) {
    const steps = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const step = steps[event.key];

    if (step) {
      event.preventDefault();

      if (step > 0) {
        this.next();
      } else {
        this.previous();
      }

      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      this.goTo(event.key === 'Home' ? 1 : clampPage(this.pages, this.pages));
    }
  }

  /** A drag across a link must not follow it when the pointer lets go. */
  _handleClickCapture(event) {
    if (this._samples.length > 1 && Math.abs(event.clientX - this._origin) > DRAG_SLOP) {
      event.preventDefault();
      event.stopPropagation();
      this._samples = [];
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-flip-book')) {
  customElements.define('ui-flip-book', UiFlipBook);
}
