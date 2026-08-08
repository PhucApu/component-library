import { glowVariables, positionIn, shouldGlowFor } from './cursor-glow-core.js';

/**
 * A region that lights up around the pointer.
 *
 * The whole effect is one overlay carrying a radial gradient whose centre is two custom
 * properties. Moving the pointer changes those two numbers and nothing else — no canvas,
 * no simulation, and no animation frame while the pointer is still.
 *
 * The one thing worth being careful about is how often those numbers are written. A mouse
 * can report over a hundred moves a second, and each write is a style recalculation, so
 * the writes are collected into at most one a frame. The glow is still exactly under the
 * pointer, because the position is taken from the last event rather than interpolated.
 */
export class UiCursorGlow extends HTMLElement {
  constructor() {
    super();
    this._connected = false;
    this._frame = 0;
    this._point = null;

    this._handlePointerEnter = this._handlePointerEnter.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerLeave = this._handlePointerLeave.bind(this);
    this._write = this._write.bind(this);
  }

  connectedCallback() {
    if (!this._light) {
      this._build();
    }

    this._connected = true;
  }

  disconnectedCallback() {
    this._connected = false;

    if (this._frame) {
      cancelAnimationFrame(this._frame);
      this._frame = 0;
    }
  }

  /** Whether the pointer is inside the region and lighting it. */
  get active() {
    return this.hasAttribute('data-active');
  }

  _build() {
    this._light = document.createElement('div');
    this._light.className = 'cursor-glow__light';
    // It is a light, not content: nothing may take a press from what is underneath it, and
    // there is nothing here for a screen reader to be told about.
    this._light.setAttribute('aria-hidden', 'true');

    this.append(this._light);
    this.dataset.enhanced = '';

    this.addEventListener('pointerenter', this._handlePointerEnter);
    this.addEventListener('pointermove', this._handlePointerMove);
    this.addEventListener('pointerleave', this._handlePointerLeave);
    this.addEventListener('pointercancel', this._handlePointerLeave);
  }

  _handlePointerEnter(event) {
    if (!shouldGlowFor(event.pointerType)) {
      return;
    }

    this._track(event);
    this.toggleAttribute('data-active', true);
  }

  _handlePointerMove(event) {
    if (!shouldGlowFor(event.pointerType)) {
      return;
    }

    this._track(event);

    // A pointer that entered before the element was upgraded never sent an enter event.
    if (!this.active) {
      this.toggleAttribute('data-active', true);
    }
  }

  _handlePointerLeave() {
    // The position is left where it was, so the light fades out where it stood rather than
    // jumping to a corner on its way out.
    this.toggleAttribute('data-active', false);
  }

  _track(event) {
    this._point = { x: event.clientX, y: event.clientY };

    if (!this._frame && this._connected) {
      this._frame = requestAnimationFrame(this._write);
    }
  }

  _write() {
    this._frame = 0;

    if (!this._point) {
      return;
    }

    const position = positionIn(this.getBoundingClientRect(), this._point);

    Object.entries(glowVariables(position.x, position.y)).forEach(([property, value]) => {
      this.style.setProperty(property, value);
    });
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-cursor-glow')) {
  customElements.define('ui-cursor-glow', UiCursorGlow);
}
