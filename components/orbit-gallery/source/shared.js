import {
  DEFAULT_LABELS,
  DEFAULT_SPEED,
  STEP_DURATION,
  angleForIndex,
  autoDelta,
  autoRadius,
  clampSpeed,
  decayVelocity,
  depthAt,
  dragToAngle,
  fillLabel,
  isCentred,
  itemStep,
  nearestIndex,
  offsetFromFront,
  resolveDirection,
  snapAngle,
  stepAngle,
} from './orbit-gallery-core.js';

/** How much of the recent pointer movement counts towards the throw. */
const VELOCITY_WINDOW = 120;

/** Past this, a press was a drag and the pictures under it must not take the click. */
const DRAG_SLOP = 4;

const ARROWS = Object.freeze({
  previous: { path: 'M15 5l-7 7 7 7', delta: -1 },
  next: { path: 'M9 5l7 7-7 7', delta: 1 },
});

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function easeOut(progress) {
  return 1 - (1 - progress) ** 3;
}

/**
 * A ring of pictures that turns on its own.
 *
 * The whole position of the ring is one number, `angle`, and everything else reads it:
 * the drift adds to it, a drag writes it, a throw decays into it, and the keyboard steps
 * it. Only two things are written to the DOM each frame — the ring's rotation and how
 * much light each picture keeps — so the browser has one transform to composite rather
 * than a layout to redo.
 *
 * The far half of the ring is turned away from the viewer and hidden by
 * `backface-visibility`, so the element also takes those pictures out of the pointer's
 * reach: a hover that stopped the ring from behind would look like it stopped by itself.
 *
 * One picture at a time is singled out, and it is the one facing the viewer with the ring
 * at rest — never the one under the pointer. Pointing is how you stop the ring; bringing a
 * picture round to the front is how you choose it.
 */
export class UiOrbitGallery extends HTMLElement {
  static get observedAttributes() {
    return ['speed', 'direction', 'radius', 'paused', 'no-drag', 'label'];
  }

  constructor() {
    super();
    this._connected = false;
    this._angle = 0;
    this._velocity = 0;
    this._frame = 0;
    this._lastTime = 0;
    this._front = -1;
    this._hovered = false;
    this._focused = false;
    this._dragging = false;
    this._pointerId = null;
    this._samples = [];
    this._travel = null;
    this._parked = false;

    this._handleTick = this._handleTick.bind(this);
    this._handlePointerEnter = this._handlePointerEnter.bind(this);
    this._handlePointerLeave = this._handlePointerLeave.bind(this);
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerUp = this._handlePointerUp.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleFocusIn = this._handleFocusIn.bind(this);
    this._handleFocusOut = this._handleFocusOut.bind(this);
    this._handleClickCapture = this._handleClickCapture.bind(this);
    this._handleImageError = this._handleImageError.bind(this);
    this._handleVisibility = this._handleVisibility.bind(this);
    this._handleResize = this._handleResize.bind(this);
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
    this._items = [...list.children];

    if (this._items.length === 0) {
      return;
    }

    // An element moved to another parent is disconnected and connected again. The ring it
    // already built is still the ring, so only the listener that was taken off comes back.
    if (this._stage) {
      document.addEventListener('visibilitychange', this._handleVisibility);
    } else {
      this._build();
    }

    this._connected = true;
    this._measure();
    this._apply(true);
    this._schedule();
  }

  disconnectedCallback() {
    if (!this._connected) {
      return;
    }

    this._stop();
    this._resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this._handleVisibility);
    this._motionQuery?.removeEventListener('change', this._handleResize);
    this._connected = false;
  }

  attributeChangedCallback(name) {
    if (!this._connected) {
      return;
    }

    if (name === 'label') {
      this._stage.setAttribute('aria-label', this.getAttribute('label') || DEFAULT_LABELS.gallery);
      return;
    }

    if (name === 'radius') {
      this._measure();
    }

    this._apply(true);
    this._schedule();
  }

  /** The picture at the front of the ring. */
  get index() {
    return this._front;
  }

  get items() {
    return this._items ? [...this._items] : [];
  }

  /** Where the ring has got to, in degrees of item space. */
  get angle() {
    return this._angle;
  }

  pause() {
    this.setAttribute('paused', '');
  }

  /** Starts the drift again, including after a reader has taken the ring over. */
  resume() {
    this._parked = false;
    this.removeAttribute('paused');
    this._apply(true);
    this._schedule();
  }

  /** Turns on by whole pictures, which is what the arrows and the arrow keys both do. */
  step(delta) {
    if (!this._connected || !this._turnable) {
      return;
    }

    // Turning the ring deliberately is taking it over. Motion that carried on regardless
    // would take the picture the reader just chose straight back off the front.
    this._parked = true;
    this._travelTo(stepAngle(this._angle, delta, this._items.length));
  }

  /** Turns the shortest way round to bring one picture to the front. */
  rotateTo(index) {
    if (!this._connected) {
      return;
    }

    this._travelTo(angleForIndex(index, this._angle, this._items.length));
  }

  _build() {
    this._stage = document.createElement('div');
    this._stage.className = 'orbit__stage';
    this._stage.tabIndex = 0;
    this._stage.setAttribute('role', 'group');
    this._stage.setAttribute('aria-label', this.getAttribute('label') || DEFAULT_LABELS.gallery);

    this._status = document.createElement('p');
    this._status.className = 'orbit__status';
    this._status.setAttribute('role', 'status');
    this._status.setAttribute('aria-live', 'polite');

    // Two ways to reach the same act. A ring you can only drag asks for a gesture some
    // readers cannot make accurately, and asks every reader to guess that it is draggable.
    this._arrows = Object.entries(ARROWS).map(([name, arrow]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `orbit__arrow orbit__arrow--${name}`;
      button.setAttribute('aria-label', DEFAULT_LABELS[name]);
      button.innerHTML =
        `<svg class="orbit__arrow-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" ` +
        `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
        `<path d="${arrow.path}" /></svg>`;
      button.addEventListener('click', () => this.step(arrow.delta));
      return button;
    });

    this._list.classList.add('orbit__ring');
    this._list.before(this._stage);
    this._stage.append(this._list, ...this._arrows);
    this.append(this._status);

    // One picture has nowhere to step to, so the controls for stepping do not exist.
    this._arrows.forEach((button) => {
      button.hidden = !this._turnable;
    });

    this._items.forEach((item, index) => {
      item.classList.add('orbit__item');
      item.style.setProperty('--orbit-index', String(index));

      // The tile is what grows under the pointer. It is a second box because the item
      // itself carries the ring placement, and one element cannot be both turned into
      // position and scaled back out of it without the two fighting each frame.
      if (!item.querySelector('.orbit__tile')) {
        const tile = document.createElement('div');
        tile.className = 'orbit__tile';
        tile.append(...item.childNodes);
        item.append(tile);
      }

      // A picture that failed before the element was upgraded has already fired its only
      // error event, and waiting for a second one would leave an empty frame on the ring.
      const image = item.querySelector('img');

      if (image?.complete && image.naturalWidth === 0) {
        this._markUnavailable(item);
      }
    });

    this.dataset.enhanced = '';

    // The whole stage, not each picture: the arrows stand on it too, and a ring that
    // drifted on under the arrow you were reaching for would move the target away.
    this._stage.addEventListener('pointerenter', this._handlePointerEnter);
    this._stage.addEventListener('pointerleave', this._handlePointerLeave);
    this._stage.addEventListener('pointerdown', this._handlePointerDown);
    this._stage.addEventListener('pointermove', this._handlePointerMove);
    this._stage.addEventListener('pointerup', this._handlePointerUp);
    this._stage.addEventListener('pointercancel', this._handlePointerUp);
    this._stage.addEventListener('keydown', this._handleKeyDown);
    this._stage.addEventListener('focusin', this._handleFocusIn);
    this._stage.addEventListener('focusout', this._handleFocusOut);
    this._stage.addEventListener('click', this._handleClickCapture, true);
    this._stage.addEventListener('error', this._handleImageError, true);
    document.addEventListener('visibilitychange', this._handleVisibility);

    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver(this._handleResize);
      this._resizeObserver.observe(this._stage);
    }

    if (typeof matchMedia === 'function') {
      this._motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
      this._motionQuery.addEventListener('change', this._handleResize);
    }
  }

  /**
   * The radius follows the pictures rather than a hard-coded number, so the same element
   * holds five of them or twelve without the author working anything out.
   */
  _measure() {
    const declared = Number.parseFloat(this.getAttribute('radius') ?? '');
    // Computed width rather than a measured box: an item is already turned in three
    // dimensions, and its box on screen is the projection of it rather than its width.
    const width = this._items[0]
      ? Number.parseFloat(getComputedStyle(this._items[0]).width) || 0
      : 0;
    const gap = Number.parseFloat(getComputedStyle(this).getPropertyValue('--orbit-gap')) || 0;
    const radius = Number.isFinite(declared)
      ? declared
      : autoRadius({ total: this._items.length, itemWidth: width, gap });

    this.style.setProperty('--orbit-radius', `${Math.round(radius)}px`);
    this.style.setProperty('--orbit-step', `${itemStep(this._items.length)}deg`);
  }

  get _speed() {
    return clampSpeed(this.getAttribute('speed') ?? DEFAULT_SPEED);
  }

  get _direction() {
    return resolveDirection(this.getAttribute('direction'));
  }

  /**
   * One picture has no ring to be on. The radius is zero, so turning would spin it about
   * its own edge and hide it for half of every turn instead of showing another picture.
   */
  get _turnable() {
    return this._items.length > 1;
  }

  get _drifting() {
    return (
      this._turnable &&
      this._speed > 0 &&
      !this._parked &&
      !this.hasAttribute('paused') &&
      !this._hovered &&
      !this._focused &&
      !prefersReducedMotion()
    );
  }

  /**
   * Whether the ring will stay where a gesture leaves it.
   *
   * Settling onto a picture is only worth doing if the picture is going to stand there.
   * A ring that is about to drift on again would land, be singled out for a moment, and
   * lose it — a wobble at the end of every throw.
   */
  get _holds() {
    return (
      this._parked ||
      this._hovered ||
      this._focused ||
      this.hasAttribute('paused') ||
      this._speed === 0
    );
  }

  _schedule() {
    if (!this._connected || this._frame) {
      return;
    }

    const busy = this._dragging || this._velocity !== 0 || this._travel !== null;

    if (document.hidden || (!busy && !this._drifting)) {
      // Nothing to do, so the clock is thrown away rather than carried: the next frame
      // after a pause would otherwise be handed every millisecond spent stopped.
      this._lastTime = 0;
      return;
    }

    this._frame = requestAnimationFrame(this._handleTick);
  }

  _stop() {
    if (this._frame) {
      cancelAnimationFrame(this._frame);
      this._frame = 0;
    }

    this._lastTime = 0;
  }

  _handleTick(now) {
    this._frame = 0;

    const elapsed = this._lastTime ? Math.min(64, now - this._lastTime) : 0;
    this._lastTime = now;

    if (this._travel) {
      const progress = Math.min(1, (now - this._travel.start) / this._travel.duration);
      this._angle = this._travel.from + (this._travel.to - this._travel.from) * easeOut(progress);

      if (progress === 1) {
        this._travel = null;
      }
    } else if (this._velocity !== 0) {
      this._angle += this._velocity * elapsed;
      this._velocity = decayVelocity(this._velocity, elapsed);

      if (this._velocity === 0) {
        this._settle();
      }
    } else if (this._drifting) {
      this._angle += autoDelta({
        speed: this._speed,
        direction: this._direction,
        elapsed,
      });
    }

    this._apply();
    this._schedule();
  }

  /** Writes the two things that change: where the ring points, and what each picture keeps. */
  _apply(force = false) {
    if (!this._connected) {
      return;
    }

    this._list.style.setProperty('--orbit-angle', `${-this._angle}deg`);

    const total = this._items.length;
    // The picture at the front is singled out only once the ring has come to rest on it.
    // A drifting ring would flash every picture in turn as it went past.
    const atRest =
      !this._dragging && this._velocity === 0 && this._travel === null && !this._drifting;
    this._list.classList.toggle('is-centred', atRest && isCentred(this._angle, total));

    this._items.forEach((item, index) => {
      const depth = depthAt(offsetFromFront(index, this._angle, total));
      item.style.setProperty('--orbit-depth-opacity', String(depth.opacity));
      item.style.pointerEvents = depth.interactive ? '' : 'none';
    });

    const front = nearestIndex(this._angle, total);

    if (front === this._front && !force) {
      return;
    }

    this._front = front;
    this._items.forEach((item, index) => {
      item.toggleAttribute('data-front', index === front);
    });
    this._report();
    this.dispatchEvent(
      new CustomEvent('orbit-change', {
        bubbles: true,
        composed: true,
        detail: { index: front, total },
      }),
    );
  }

  /**
   * The ring drifts past picture after picture, so it only says where it is once someone
   * has stopped it. Announcing every picture a turn goes by would be a live region that
   * never stops talking.
   */
  _report() {
    if (!this._status) {
      return;
    }

    if (this._drifting || this._dragging) {
      this._status.textContent = '';
      return;
    }

    const item = this._items[this._front];
    const label = item?.querySelector('img')?.alt ?? '';

    this._status.textContent = fillLabel(
      label ? DEFAULT_LABELS.described : DEFAULT_LABELS.position,
      { index: this._front + 1, total: this._items.length, label },
    );
  }

  /** Goes the rest of the way to the picture nearest the front, once nothing else is moving. */
  _settle() {
    if (!this._turnable || !this._holds) {
      return;
    }

    const target = snapAngle(this._angle, this._items.length);

    if (target !== this._angle) {
      this._travelTo(target);
    }
  }

  _travelTo(target) {
    if (prefersReducedMotion()) {
      this._travel = null;
      this._angle = target;
      this._apply(true);
      this._report();
      return;
    }

    this._velocity = 0;
    this._travel = {
      from: this._angle,
      to: target,
      start: performance.now(),
      duration: STEP_DURATION,
    };
    this._schedule();
  }

  _handlePointerEnter() {
    this._hovered = true;
    this._report();
  }

  _handlePointerLeave() {
    this._hovered = false;
    this._schedule();
  }

  _handlePointerDown(event) {
    if (
      !this._turnable ||
      this.hasAttribute('no-drag') ||
      event.button !== 0 ||
      this._pointerId !== null
    ) {
      return;
    }

    this._pointerId = event.pointerId;
    this._dragging = false;
    this._origin = event.clientX;
    this._originAngle = this._angle;
    this._samples = [{ x: event.clientX, time: event.timeStamp }];
    this._travel = null;
    this._velocity = 0;
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
      this._dragging = true;
      this._list.classList.add('is-dragging');
      this._status.textContent = '';
      // Captured only once the press has become a drag. Capturing on the way down would
      // redirect the click that follows to the stage, and the arrows would never fire.
      this._stage.setPointerCapture(event.pointerId);
    }

    this._samples.push({ x: event.clientX, time: event.timeStamp });
    this._samples = this._samples.filter(
      (sample) => event.timeStamp - sample.time <= VELOCITY_WINDOW,
    );

    const width = this._stage.getBoundingClientRect().width;
    this._angle = this._originAngle + dragToAngle(distance, width);
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

    if (!this._dragging) {
      return;
    }

    this._dragging = false;
    this._parked = true;
    this._list.classList.remove('is-dragging');

    const first = this._samples[0];
    const width = this._stage.getBoundingClientRect().width;

    // A throw is what the pointer was doing when it let go, not what it did overall: the
    // slow part of a long drag would otherwise cancel the flick at the end of it.
    if (first && !prefersReducedMotion()) {
      const time = event.timeStamp - first.time;
      this._velocity = time > 0 ? dragToAngle(event.clientX - first.x, width) / time : 0;
    }

    // A drag let go slowly has no throw to wait for, so it settles from here.
    if (this._velocity === 0) {
      this._settle();
    }

    this._report();
    this._schedule();
  }

  _handleKeyDown(event) {
    if (!this._turnable) {
      return;
    }

    const steps = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const step = steps[event.key];

    if (step) {
      event.preventDefault();
      this.step(step);
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      this._parked = true;
      this.rotateTo(event.key === 'Home' ? 0 : this._items.length - 1);
    }
  }

  _handleFocusIn() {
    this._focused = true;
    this._report();
  }

  _handleFocusOut(event) {
    if (event.relatedTarget && this._stage.contains(event.relatedTarget)) {
      return;
    }

    this._focused = false;
    this._schedule();
  }

  /** A drag that crossed a link must not follow it when the pointer lets go. */
  _handleClickCapture(event) {
    if (this._samples.length > 1 && Math.abs(this._angle - this._originAngle) > 0.5) {
      event.preventDefault();
      event.stopPropagation();
      this._samples = [];
    }
  }

  _handleImageError(event) {
    const item = event.target.closest?.('.orbit__item');

    if (item) {
      this._markUnavailable(item);
    }
  }

  /**
   * The place keeps its turn on the ring. Closing the gap would move every other picture
   * for a reason the reader cannot see, so what is missing says so in words instead.
   */
  _markUnavailable(item) {
    if (item.hasAttribute('data-unavailable')) {
      return;
    }

    item.setAttribute('data-unavailable', '');
    const note = document.createElement('p');
    note.className = 'orbit__unavailable';
    note.textContent = DEFAULT_LABELS.unavailable;
    item.querySelector('.orbit__tile')?.append(note);
  }

  _handleVisibility() {
    if (document.hidden) {
      this._stop();
      return;
    }

    this._schedule();
  }

  _handleResize() {
    this._measure();
    this._apply(true);
    this._schedule();
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-orbit-gallery')) {
  customElements.define('ui-orbit-gallery', UiOrbitGallery);
}
