import {
  DEFAULT_DROP_DURATION,
  DEFAULT_MAX_RIPPLES,
  DEFAULT_RINGS,
  DEFAULT_SPACING,
  DEFAULT_WAKE_DURATION,
  RING_STAGGER,
  VELOCITY_WINDOW,
  WAKE_STRANDS,
  alongFade,
  alongFromHead,
  capRipples,
  clampDuration,
  clampMaxRipples,
  clampRings,
  clampSpacing,
  maxRadiusFor,
  offsetPoint,
  pointerSpeed,
  pruneRipples,
  resamplePath,
  rippleAlpha,
  rippleRadius,
  rippleWidth,
  ringBirths,
  shouldEmit,
  trailAngles,
  wakeAlpha,
  wakeJitter,
  wakeOffset,
  wakeStrength,
  wakeWave,
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
 *
 * A press and a crossing are kept as different things. A press is a set of rings, each one
 * complete in itself. A crossing is one trail: the pointer's recent path, drawn as two
 * lines standing off either side of it, meeting in a point at the pointer. Marks made
 * independently of one another could never meet in that point, which is the whole shape of
 * a wake.
 */
export class UiRippleSurface extends HTMLElement {
  static get observedAttributes() {
    return ['rings', 'spacing', 'drop-duration', 'wake-duration', 'max-ripples', 'no-wake', 'no-drop'];
  }

  constructor() {
    super();
    this._connected = false;
    this._ripples = [];
    this._trail = [];
    this._head = null;
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

  /** How much is still moving on the surface: rings alive, plus points in the trail. */
  get count() {
    return this._ripples.length + this._trail.length;
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
    this._trail = [];
    this._head = null;
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
    this._trail = this._trail.filter((point) => now - point.time < this.wakeDuration);

    if (this._trail.length === 0) {
      this._head = null;
    }

    this._paint(now);

    if (this.count > 0) {
      this._start();
    }
  }

  _paint(now) {
    if (!this._context) {
      return;
    }

    this._context.clearRect(0, 0, this._width, this._height);

    if (this.count === 0) {
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
    this._context.lineJoin = 'round';

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

      this._context.globalAlpha = alpha;
      this._context.lineWidth = width;
      this._context.beginPath();
      this._context.arc(
        ripple.x,
        ripple.y,
        rippleRadius(age, ripple.duration, ripple.maxRadius),
        0,
        Math.PI * 2,
      );
      this._context.stroke();
    }

    this._paintWake(now, strength);
    this._context.restore();
  }

  /**
   * The wake: several strands either side of the path the pointer took, all of them
   * meeting in a point at the pointer, where every offset is zero.
   *
   * Each strand is drawn segment by segment rather than as one path, because the wake has
   * to fade from the point backwards and a stroke cannot carry a gradient along itself. The
   * segments are curves through the midpoints, which is what keeps a hand-drawn path from
   * showing a corner at every sample.
   */
  _paintWake(now, strength) {
    const path = this._head ? [...this._trail, this._head] : this._trail;

    if (path.length < 3) {
      return;
    }

    const along = alongFromHead(path);
    const angles = trailAngles(path);
    const width = this._readNumber('--ripple-wake-width', 1.4);

    for (const side of [1, -1]) {
      for (const strand of WAKE_STRANDS) {
        this._paintStrand({ now, strength, path, along, angles, width, side, strand });
      }
    }
  }

  _paintStrand({ now, strength, path, along, angles, width, side, strand }) {
    const edge = path.map((point, index) => {
      const age = now - point.time;
      const spread = wakeOffset(along[index], age) * strand.scale;
      const swell = side * wakeWave(along[index], age, strand.phase);
      const wander = wakeJitter(along[index], point.time + strand.phase);

      return offsetPoint(point, angles[index] + (side * Math.PI) / 2, spread + swell + wander);
    });

    for (let index = 1; index < edge.length; index += 1) {
      const point = path[index];
      const alpha =
        wakeAlpha(now - point.time, this.wakeDuration) *
        alongFade(along[index]) *
        wakeStrength(point.speed) *
        strand.alpha *
        strength;

      if (alpha <= 0.004) {
        continue;
      }

      const previous = edge[index - 1];
      const current = edge[index];
      const next = edge[index + 1] ?? current;
      const start = { x: (previous.x + current.x) / 2, y: (previous.y + current.y) / 2 };
      const end = { x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 };

      this._context.globalAlpha = alpha;
      // Thinning towards the tail, so the point of the wake is the sharpest part of it.
      this._context.lineWidth = Math.max(0.2, width * strand.width * (0.35 + 0.65 * alpha));
      this._context.beginPath();
      this._context.moveTo(start.x, start.y);
      this._context.quadraticCurveTo(current.x, current.y, end.x, end.y);
      this._context.stroke();
    }
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

    // The head is where the pointer is now, not where the trail last took a sample. It is
    // what the two sides meet at, so a prow that lagged the pointer by up to a whole
    // spacing would be a blunt end following the cursor around.
    const speed = pointerSpeed(this._samples);
    this._head = { ...point, speed };

    if (shouldEmit(this._lastEmit, point, this.spacing)) {
      const filled = resamplePath(this._lastEmit, { ...point, speed }, this.spacing);
      this._trail = capRipples([...this._trail, ...filled], this.maxRipples);
      this._lastEmit = point;
    }

    this._start();
  }

  _handlePointerDown(event) {
    const point = this._pointIn(event);
    this.drop(point.x, point.y);
  }

  _handlePointerLeave() {
    // The next arrival is a new journey. Without this, re-entering the surface somewhere
    // else would draw a wake for a crossing that never happened. The trail already made
    // stays and fades where it is; only the prow goes with the pointer.
    this._lastEmit = null;
    this._head = null;
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
