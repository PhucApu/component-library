import {
  DEFAULT_LABELS,
  DEFAULT_LENGTH,
  GRAB_RADIUS,
  PULL_THRESHOLD,
  SEGMENTS,
  armedFrom,
  clampLength,
  fillLabel,
  handleAngle,
  isSettled,
  nearestPoint,
  pullFrom,
  reachFor,
  restRope,
  spacingFor,
  stepRope,
  tugged,
} from './light-pull-core.js';

/** The simulation runs on a fixed step so the cord cannot judder with the frame rate. */
const STEP = 16;

/** However long a frame took, this many steps is all it may ask for. */
const MAX_STEPS = 4;

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A cord you pull to work a switch.
 *
 * The cord is simulated rather than animated: every joint carries its own momentum, so it
 * curves as it is pulled, follows a hand with a lag, and swings itself out after it is let
 * go. Nothing about that is choreographed, which is why a hard pull and a gentle one do not
 * look the same.
 *
 * The switch is a real `<button role="switch">` sitting on the handle rather than a shape
 * drawn in the cord: the pointer and the keyboard then work the same control, and the state
 * is something a screen reader can read instead of something only the eye can see.
 */
export class UiLightPull extends HTMLElement {
  static get observedAttributes() {
    return ['on', 'label', 'length'];
  }

  constructor() {
    super();
    this._connected = false;
    this._frame = 0;
    this._lastTime = 0;
    this._carry = 0;
    this._held = null;
    this._pointerId = null;
    this._dragging = false;
    this._maxPull = 0;

    this._handleFrame = this._handleFrame.bind(this);
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerUp = this._handlePointerUp.bind(this);
    this._handleClick = this._handleClick.bind(this);
    this._handleResize = this._handleResize.bind(this);
  }

  connectedCallback() {
    if (!this._field) {
      this._build();
    }

    this._connected = true;
    this._measure();
    this._render();
  }

  disconnectedCallback() {
    this._connected = false;
    this._stop();
    this._resizeObserver?.disconnect();
  }

  attributeChangedCallback(name, previous, value) {
    if (!this._connected) {
      return;
    }

    if (name === 'length') {
      this._measure();
      this._render();
      return;
    }

    if (name === 'on' && previous !== value) {
      this._announce();
    }

    this._render();
  }

  /** Whether the switch is on. */
  get on() {
    return this.hasAttribute('on');
  }

  set on(value) {
    this.toggleAttribute('on', Boolean(value));
  }

  get length() {
    return clampLength(this.getAttribute('length') ?? DEFAULT_LENGTH);
  }

  /** Whether the cord is still moving. */
  get swinging() {
    return this._frame !== 0;
  }

  toggle() {
    this.on = !this.on;
  }

  /** A tug: the cord is shoved down and the switch works, which is what a press looks like. */
  pull() {
    if (!this._connected) {
      return;
    }

    this.toggle();

    if (prefersReducedMotion()) {
      return;
    }

    this._points = tugged(this._points);
    this._start();
  }

  _build() {
    this._field = document.createElement('div');
    this._field.className = 'light-pull__field';

    this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svg.setAttribute('class', 'light-pull__cord');
    // The cord is a picture of what the button is doing. The button carries the meaning.
    this._svg.setAttribute('aria-hidden', 'true');
    this._svg.setAttribute('preserveAspectRatio', 'none');

    this._path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this._path.setAttribute('class', 'light-pull__line');
    this._svg.append(this._path);

    this._handle = document.createElement('button');
    this._handle.type = 'button';
    this._handle.className = 'light-pull__handle';
    this._handle.setAttribute('role', 'switch');
    this._handle.innerHTML = '<span class="light-pull__grip" aria-hidden="true"></span>';

    this._field.append(this._svg, this._handle);
    this.prepend(this._field);
    this.dataset.enhanced = '';

    this._field.addEventListener('pointerdown', this._handlePointerDown);
    this._field.addEventListener('pointermove', this._handlePointerMove);
    this._field.addEventListener('pointerup', this._handlePointerUp);
    this._field.addEventListener('pointercancel', this._handlePointerUp);
    this._handle.addEventListener('click', this._handleClick);

    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver(this._handleResize);
      this._resizeObserver.observe(this._field);
    }
  }

  _measure() {
    const box = this._field.getBoundingClientRect();
    const width = box.width || 1;

    this._anchor = { x: width / 2, y: 0 };
    this._spacing = spacingFor(this.length, SEGMENTS);
    this._rest = restRope(this._anchor, { segments: SEGMENTS, length: this.length });
    this._points = this._rest.map((point) => ({ ...point }));
    this._svg.setAttribute('viewBox', `0 0 ${width} ${Math.max(1, box.height)}`);
  }

  _start() {
    if (!this._frame && this._connected) {
      this._lastTime = 0;
      this._frame = requestAnimationFrame(this._handleFrame);
    }
  }

  _stop() {
    if (this._frame) {
      cancelAnimationFrame(this._frame);
      this._frame = 0;
    }

    this._carry = 0;
  }

  _handleFrame(now) {
    this._frame = 0;

    const elapsed = this._lastTime ? Math.min(120, now - this._lastTime) : STEP;
    this._lastTime = now;
    this._carry += elapsed;

    let steps = 0;

    while (this._carry >= STEP && steps < MAX_STEPS) {
      this._points = stepRope(this._points, {
        anchor: this._anchor,
        held: this._held,
        spacing: this._spacing,
      });
      this._carry -= STEP;
      steps += 1;
    }

    // Anything left over is thrown away rather than carried: a tab that was hidden for a
    // minute would otherwise come back and run a minute of rope in one frame.
    this._carry = Math.min(this._carry, STEP);
    this._render();

    if (this._dragging || !isSettled(this._points)) {
      this._start();
      return;
    }

    this._stop();
  }

  _render() {
    if (!this._path) {
      return;
    }

    this._path.setAttribute('d', this._cordPath());

    const handle = this._points.at(-1);
    this._handle.style.translate = `calc(${handle.x}px - 50%) calc(${handle.y}px - 50%)`;
    this._handle.style.rotate = `${handleAngle(this._points)}deg`;
    this._handle.setAttribute('aria-checked', String(this.on));
    this._handle.setAttribute(
      'aria-label',
      fillLabel('{light}', { light: this.getAttribute('label') || DEFAULT_LABELS.light }),
    );
  }

  /** A curve through the joints rather than a line between them. */
  _cordPath() {
    const [first, ...rest] = this._points;
    let path = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;

    rest.forEach((point, index) => {
      const next = rest[index + 1];

      if (!next) {
        path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
        return;
      }

      const midX = (point.x + next.x) / 2;
      const midY = (point.y + next.y) / 2;
      path += ` Q ${point.x.toFixed(2)} ${point.y.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`;
    });

    return path;
  }

  _pointIn(event) {
    const box = this._field.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  _handlePointerDown(event) {
    if (event.button !== 0 || this._pointerId !== null) {
      return;
    }

    const point = this._pointIn(event);
    const index = nearestPoint(this._points, point, GRAB_RADIUS);

    if (index < 0) {
      return;
    }

    this._pointerId = event.pointerId;
    this._dragging = true;
    this._maxPull = 0;
    this._moved = false;
    // Where the cord was when it was taken hold of, which is what the pull is measured
    // against. A cord that has been used once already hangs a little lower than its ideal
    // rest, and counting that sag as part of the pull works the switch on a shorter tug.
    this._baseline = this._points.at(-1).y;
    this._held = { index, x: point.x, y: point.y };
    this._field.setPointerCapture(event.pointerId);
    this._field.classList.add('is-held');
    this._start();
  }

  _handlePointerMove(event) {
    if (event.pointerId !== this._pointerId || !this._held) {
      return;
    }

    const point = this._pointIn(event);
    // The hand can go further than the cord will give. What it gives is its own length
    // plus the travel of the switch it is fastened to.
    const reach = reachFor(this._held.index, this._spacing, SEGMENTS);
    const dx = point.x - this._anchor.x;
    const dy = point.y - this._anchor.y;
    const distance = Math.hypot(dx, dy) || 0.0001;
    const share = distance > reach ? reach / distance : 1;

    this._held = {
      index: this._held.index,
      x: this._anchor.x + dx * share,
      y: this._anchor.y + dy * share,
    };
    this._moved = true;
    this._maxPull = Math.max(this._maxPull, pullFrom(this._points, this._baseline));
    this._start();
  }

  _handlePointerUp(event) {
    if (event.pointerId !== this._pointerId) {
      return;
    }

    if (this._field.hasPointerCapture(event.pointerId)) {
      this._field.releasePointerCapture(event.pointerId);
    }

    this._pointerId = null;
    this._dragging = false;
    this._held = null;
    this._field.classList.remove('is-held');

    // A press that never moved is a tug at the handle rather than a drag of the cord.
    if (!this._moved) {
      this.pull();
      return;
    }

    // Pulled far enough at any point in the drag, the way a real switch works the moment
    // it passes its catch rather than at the moment the hand opens.
    if (armedFrom(Math.max(this._maxPull, pullFrom(this._points, this._baseline)), PULL_THRESHOLD)) {
      this.toggle();
    }

    if (prefersReducedMotion()) {
      this._points = this._rest.map((point) => ({ ...point }));
      this._render();
      this._stop();
      return;
    }

    this._start();
  }

  _handleClick(event) {
    // The pointer path has already dealt with a press it can see. This is the keyboard,
    // which reports a click with no pointer behind it.
    if (event.detail === 0) {
      this.pull();
    }
  }

  _announce() {
    this.dispatchEvent(
      new CustomEvent('light-pull-change', {
        bubbles: true,
        composed: true,
        detail: { on: this.on },
      }),
    );
  }

  _handleResize() {
    this._measure();
    this._render();
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-light-pull')) {
  customElements.define('ui-light-pull', UiLightPull);
}
