import {
  DEFAULT_DROP_DURATION,
  DEFAULT_MAX_RIPPLES,
  DEFAULT_RINGS,
  DEFAULT_SPACING,
  DEFAULT_WAKE_DURATION,
  RING_STAGGER,
  VELOCITY_WINDOW,
  angleBetween,
  capRipples,
  clampDuration,
  clampMaxRipples,
  clampRings,
  clampSpacing,
  maxRadiusFor,
  pointerSpeed,
  pruneRipples,
  rippleAlpha,
  rippleRadius,
  rippleWidth,
  ringBirths,
  shouldEmit,
  wakeRadius,
  wakeSpread,
} from './ripple-surface-core.js';

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A surface that answers the pointer the way still water answers a boat and a stone.
 *
 * Two things carry the whole component. The first is that the canvas is drawn over the
 * content and takes no pointer events itself, so a heading stays selectable and a button
 * underneath stays a button: the surface is something the content is seen through, not a
 * lid on top of it. The second is that at rest there is nothing to draw and no frame is
 * asked for — a still surface costs exactly nothing, which is what lets it sit on a page
 * that has other work to do.
 */
export class UiRippleSurface extends HTMLElement {
  static get observedAttributes() {
    return ['rings', 'spacing', 'drop-duration', 'wake-duration', 'max-ripples', 'no-wake', 'no-drop'];
  }

  constructor() {
    super();
    this._connected = false;
    this._ripples = [];
    this._samples = [];
    this._lastEmit = null;
    this._frame = 0;
    this._width = 0;
    this._height = 0;

    this._handleFrame = this._handleFrame.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handlePointerLeave = this._handlePointerLeave.bind(this);
    this._handleResize = this._handleResize.bind(this);
  }

  connectedCallback() {
    if (!this._canvas) {
      this._build();
    }

    this._connected = true;
    this._measure();
  }

  disconnectedCallback() {
    this._connected = false;
    this._stop();
    this._ripples = [];
    this._resizeObserver?.disconnect();
  }

  attributeChangedCallback() {
    if (this._connected) {
      this._measure();
    }
  }

  /** How many ripples are alive on the surface right now. */
  get count() {
    return this._ripples.length;
  }

  get rings() {
    return clampRings(this.getAttribute('rings') ?? DEFAULT_RINGS);
  }

  get spacing() {
    return clampSpacing(this.getAttribute('spacing') ?? DEFAULT_SPACING);
  }

  get dropDuration() {
    return clampDuration(this.getAttribute('drop-duration') ?? DEFAULT_DROP_DURATION);
  }

  get wakeDuration() {
    return clampDuration(this.getAttribute('wake-duration') ?? DEFAULT_WAKE_DURATION, DEFAULT_WAKE_DURATION);
  }

  get maxRipples() {
    return clampMaxRipples(this.getAttribute('max-ripples') ?? DEFAULT_MAX_RIPPLES);
  }

  /** Rings spreading from a point, as though something had fallen in there. */
  drop(x, y) {
    if (!this._canvas || prefersReducedMotion() || this.hasAttribute('no-drop')) {
      return;
    }

    const now = performance.now();
    const reach = maxRadiusFor(this._width, this._height);
    const width = this._readNumber('--ripple-drop-width', 2);

    ringBirths(now, this.rings, RING_STAGGER).forEach((birth) => {
      this._add({
        kind: 'drop',
        x,
        y,
        birth,
        duration: this.dropDuration,
        maxRadius: reach,
        width,
      });
    });

    this._start();
  }

  /** Takes everything off the surface and lets it go still. */
  clear() {
    this._ripples = [];
    this._lastEmit = null;
    this._samples = [];
    this._stop();
    this._paint(performance.now());
  }

  _build() {
    this._canvas = document.createElement('canvas');
    this._canvas.className = 'ripple-surface__canvas';
    // Nothing here is content, and nothing here may take a press away from what is under
    // it. Both of those have to be said out loud or the surface becomes a lid.
    this._canvas.setAttribute('aria-hidden', 'true');
    this._context = this._canvas.getContext('2d');
    this.prepend(this._canvas);
    this.dataset.enhanced = '';

    this.addEventListener('pointermove', this._handlePointerMove);
    this.addEventListener('pointerdown', this._handlePointerDown);
    this.addEventListener('pointerleave', this._handlePointerLeave);
    this.addEventListener('pointercancel', this._handlePointerLeave);

    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver(this._handleResize);
      this._resizeObserver.observe(this);
    }
  }

  /**
   * The canvas is sized in device pixels and drawn in CSS pixels, so a ring is a ring
   * rather than a staircase on a screen that has more pixels than it admits to.
   */
  _measure() {
    if (!this._canvas) {
      return;
    }

    const box = this.getBoundingClientRect();
    const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));

    this._width = box.width;
    this._height = box.height;
    this._canvas.width = Math.max(1, Math.round(box.width * ratio));
    this._canvas.height = Math.max(1, Math.round(box.height * ratio));
    this._context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  _readNumber(property, fallback) {
    const value = Number.parseFloat(getComputedStyle(this).getPropertyValue(property));
    return Number.isFinite(value) ? value : fallback;
  }

  _add(ripple) {
    this._ripples = capRipples([...this._ripples, ripple], this.maxRipples);
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
  }

  _handleFrame(now) {
    this._frame = 0;
    this._ripples = pruneRipples(this._ripples, now);
    this._paint(now);

    if (this._ripples.length > 0) {
      this._start();
    }
  }

  _paint(now) {
    if (!this._context) {
      return;
    }

    this._context.clearRect(0, 0, this._width, this._height);

    if (this._ripples.length === 0) {
      return;
    }

    // Read once a frame, and only while there is something to draw: a theme change then
    // reaches the ripples already spreading rather than only the next one.
    //
    // The colour comes off the canvas's own `color`, never out of `--ripple-ink` directly.
    // A custom property is handed back as the tokens it was written with, so a
    // `light-dark()` in one arrives here as text the canvas cannot paint with — and a
    // canvas handed a colour it cannot read keeps the last one it had, which is black.
    const ink = getComputedStyle(this._canvas).color;
    const strength = this._readNumber('--ripple-strength', 1);

    this._context.save();
    this._context.strokeStyle = ink;
    this._context.lineCap = 'round';

    for (const ripple of this._ripples) {
      const age = now - ripple.birth;

      if (age < 0) {
        continue;
      }

      const alpha = rippleAlpha(age, ripple.duration) * strength;
      const width = rippleWidth(age, ripple.duration, ripple.width);

      if (alpha <= 0.002 || width <= 0.05) {
        continue;
      }

      const radius = rippleRadius(age, ripple.duration, ripple.maxRadius);
      this._context.globalAlpha = alpha;
      this._context.lineWidth = width;
      this._context.beginPath();

      if (ripple.kind === 'wake') {
        this._context.arc(
          ripple.x,
          ripple.y,
          radius,
          ripple.angle - ripple.spread,
          ripple.angle + ripple.spread,
        );
      } else {
        this._context.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
      }

      this._context.stroke();
    }

    this._context.restore();
  }

  _pointIn(event) {
    const box = this.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top, time: event.timeStamp };
  }

  _handlePointerMove(event) {
    // A finger dragged across a page is scrolling it, not steering a boat. Leaving touch
    // out is what keeps the surface from fighting the gesture it is drawn on top of.
    if (
      event.pointerType === 'touch' ||
      prefersReducedMotion() ||
      this.hasAttribute('no-wake') ||
      !this._canvas
    ) {
      return;
    }

    const point = this._pointIn(event);
    this._samples = [...this._samples, point].filter(
      (sample) => point.time - sample.time <= VELOCITY_WINDOW,
    );

    if (!shouldEmit(this._lastEmit, point, this.spacing)) {
      return;
    }

    const speed = pointerSpeed(this._samples);
    // The arc opens behind the pointer: a wake is what the water does after something has
    // gone past, so it faces the way the pointer came from.
    const angle = this._lastEmit
      ? angleBetween(point, this._lastEmit)
      : angleBetween({ x: 0, y: 0 }, { x: -1, y: 0 });

    this._lastEmit = point;
    this._add({
      kind: 'wake',
      x: point.x,
      y: point.y,
      birth: performance.now(),
      duration: this.wakeDuration,
      maxRadius: wakeRadius(speed),
      width: this._readNumber('--ripple-wake-width', 1.5),
      angle,
      spread: wakeSpread(speed),
    });
    this._start();
  }

  _handlePointerDown(event) {
    const point = this._pointIn(event);
    this.drop(point.x, point.y);
  }

  _handlePointerLeave() {
    // The next arrival is a new journey. Without this, re-entering the surface somewhere
    // else would draw a wake for a crossing that never happened.
    this._lastEmit = null;
    this._samples = [];
  }

  _handleResize() {
    this._measure();
    this._paint(performance.now());
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-ripple-surface')) {
  customElements.define('ui-ripple-surface', UiRippleSurface);
}
