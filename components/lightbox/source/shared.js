import {
  DEFAULT_LABELS,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  clampOffset,
  clampZoom,
  fillLabel,
  imageAnnouncement,
  nextIndex,
  pressedBeside,
  zoomAt,
} from './lightbox-core.js';

/** Matches the fade in the stylesheet. */
const EXIT_MS = 180;

const ICONS = Object.freeze({
  previous: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  close: 'm6 6 12 12M18 6 6 18',
  zoomIn: 'M11 5v12M5 11h12M20 20l-4.5-4.5',
  zoomOut: 'M5 11h12M20 20l-4.5-4.5',
  zoomReset: 'M4 9a8 8 0 1 1 .6 5M4 4v5h5',
});

/**
 * A gallery that opens into a viewer.
 *
 * The gallery is a list of links to the full images, so with no script at all pressing one
 * opens that image. The element intercepts those presses and shows the image in a `dialog`
 * instead, which is where the focus trap, the Escape key, the top layer, the backdrop, and
 * the return of focus all come from.
 */
export class UiLightbox extends HTMLElement {
  static get observedAttributes() {
    return ['loop', 'max-zoom'];
  }

  constructor() {
    super();
    this._connected = false;
    this._labelOverrides = {};
    this._index = 0;
    this._scale = 1;
    this._offset = { x: 0, y: 0 };
    this._base = { width: 0, height: 0 };
    this._source = null;

    this._handleGalleryClick = this._handleGalleryClick.bind(this);
    this._handlePanelClick = this._handlePanelClick.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleCancel = this._handleCancel.bind(this);
    this._handleWheel = this._handleWheel.bind(this);
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerUp = this._handlePointerUp.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this.addEventListener('click', this._handleGalleryClick);
    this._build();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._handleGalleryClick);
    this._frame?.removeEventListener('wheel', this._handleWheel);
    this._releaseScroll();
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this._connected && oldValue !== newValue) {
      this._renderStrip();
      this._renderImage();
    }
  }

  /** Every gallery entry, in document order. */
  get items() {
    return [...this.querySelectorAll('.lightbox__item')];
  }

  get open() {
    return Boolean(this._panel?.open);
  }

  get index() {
    return this._index;
  }

  get scale() {
    return this._scale;
  }

  get loop() {
    return this.hasAttribute('loop');
  }

  get maxZoom() {
    const parsed = Number.parseFloat(this.getAttribute('max-zoom') ?? '');
    return Number.isFinite(parsed) && parsed > MIN_ZOOM ? parsed : MAX_ZOOM;
  }

  get labels() {
    return { ...DEFAULT_LABELS, ...this._labelOverrides };
  }

  set labels(next) {
    this._labelOverrides = next && typeof next === 'object' ? { ...next } : {};
  }

  _icon(name) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"></path></svg>`;
  }

  /**
   * The drawing and the name are chosen separately: the strip arrows borrow the same
   * chevrons as the picture arrows but say something quite different, because they move
   * the strip rather than the picture.
   */
  _control({ action, icon, label, className }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.dataset.action = action;
    button.innerHTML = this._icon(icon);
    button.setAttribute('aria-label', this.labels[label]);
    return button;
  }

  _build() {
    if (this._panel) {
      return;
    }

    const labels = this.labels;

    this._panel = document.createElement('dialog');
    this._panel.className = 'lightbox__panel';
    this._panel.setAttribute('aria-label', labels.panel);

    const bar = document.createElement('div');
    bar.className = 'lightbox__bar';
    this._counter = document.createElement('p');
    this._counter.className = 'lightbox__counter';
    const tools = document.createElement('div');
    tools.className = 'lightbox__tools';
    const tool = (action, key, extra = '') =>
      this._control({ action, icon: key, label: key, className: `lightbox__tool ${extra}`.trim() });

    tools.append(
      tool('zoom-out', 'zoomOut'),
      tool('zoom-reset', 'zoomReset'),
      tool('zoom-in', 'zoomIn'),
      tool('close', 'close', 'lightbox__tool--close'),
    );
    bar.append(this._counter, tools);

    const stage = document.createElement('div');
    stage.className = 'lightbox__stage';
    this._prev = this._control({
      action: 'previous',
      icon: 'previous',
      label: 'previous',
      className: 'lightbox__nav',
    });
    this._next = this._control({
      action: 'next',
      icon: 'next',
      label: 'next',
      className: 'lightbox__nav',
    });

    this._frame = document.createElement('div');
    this._frame.className = 'lightbox__frame';
    this._image = document.createElement('img');
    this._image.className = 'lightbox__image';
    this._image.draggable = false;
    this._frame.append(this._image);

    stage.append(this._prev, this._frame, this._next);

    this._caption = document.createElement('p');
    this._caption.className = 'lightbox__caption';

    this._strip = document.createElement('div');
    this._strip.className = 'lightbox__strip';
    this._stripPrev = this._control({
      action: 'strip-prev',
      icon: 'previous',
      label: 'stripPrevious',
      className: 'lightbox__strip-arrow',
    });
    this._stripNext = this._control({
      action: 'strip-next',
      icon: 'next',
      label: 'stripNext',
      className: 'lightbox__strip-arrow',
    });
    this._thumbs = document.createElement('ul');
    this._thumbs.className = 'lightbox__thumbs';
    this._strip.append(this._stripPrev, this._thumbs, this._stripNext);

    // Present and empty before there is anything to say. Swapping the source of an image
    // already on the page announces nothing on its own.
    this._status = document.createElement('span');
    this._status.className = 'lightbox__sr-only';
    this._status.setAttribute('role', 'status');

    this._panel.append(bar, stage, this._caption, this._strip, this._status);
    this.append(this._panel);

    this._panel.addEventListener('click', this._handlePanelClick);
    this._panel.addEventListener('keydown', this._handleKeyDown);
    this._panel.addEventListener('cancel', this._handleCancel);
    this._thumbs.addEventListener('scroll', () => this._syncStripArrows());
    // Stated rather than assumed. Browsers make `wheel` passive by default only on
    // `window`, `document` and `body`; on an ordinary element it already is not. Measured:
    // dropping this flag changes nothing here. It is written down so the handler survives
    // being moved somewhere the default does apply, where a passive listener could not
    // cancel the gesture at all.
    this._frame.addEventListener('wheel', this._handleWheel, { passive: false });
    this._frame.addEventListener('pointerdown', this._handlePointerDown);
  }

  _lockScroll() {
    if (this._previousOverflow !== undefined) {
      return;
    }

    this._previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
  }

  _releaseScroll() {
    if (this._previousOverflow === undefined) {
      return;
    }

    document.documentElement.style.overflow = this._previousOverflow;
    this._previousOverflow = undefined;
  }

  /** Opens the viewer on one of the gallery entries. */
  show(index = 0) {
    const items = this.items;

    if (items.length === 0 || this.open) {
      return;
    }

    this._index = Math.min(Math.max(Math.floor(index) || 0, 0), items.length - 1);
    this._source = items[this._index];

    this._renderStrip();
    // Shown first, then measured. A panel still `display: none` reports every width as
    // zero, so the strip would decide it never overflows and turn both arrows off.
    this._panel.showModal?.();
    this._lockScroll();
    this._renderImage();

    // `showModal()` lands on the first focusable control, which at life size is the
    // shrink button, and rendering immediately turns that button off. A disabled element
    // cannot hold focus, so it would fall to the body and the keyboard would go dead.
    // Close is the one control that is always there and never unavailable.
    this._panel.querySelector('.lightbox__tool--close')?.focus();

    void this._panel.offsetWidth;
    this._panel.setAttribute('data-shown', '');

    if (typeof ResizeObserver === 'function' && !this._observer) {
      this._observer = new ResizeObserver(() => this._syncStripArrows());
      this._observer.observe(this._thumbs);
    }

    this.dispatchEvent(
      new CustomEvent('lightbox-open', {
        detail: { index: this._index },
        bubbles: true,
        composed: true,
      }),
    );
  }

  close(reason = 'api') {
    if (!this.open) {
      return;
    }

    const source = this._source;
    this._panel.removeAttribute('data-shown');

    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    clearTimeout(this._exitTimer);
    this._exitTimer = setTimeout(
      () => {
        this._panel.close?.();
        this._releaseScroll();
        this._status.textContent = '';
        // The dialog hands focus back to whatever it took it from, which is not
        // necessarily the picture that was pressed.
        source?.focus();
      },
      reduced ? 0 : EXIT_MS,
    );

    this.dispatchEvent(
      new CustomEvent('lightbox-close', { detail: { reason }, bubbles: true, composed: true }),
    );
  }

  goTo(index) {
    const total = this.items.length;
    const target = Math.min(Math.max(Math.floor(index) || 0, 0), total - 1);

    if (total === 0 || target === this._index) {
      return false;
    }

    this._index = target;
    this._source = this.items[target];
    this._renderImage();

    this.dispatchEvent(
      new CustomEvent('lightbox-change', {
        detail: { index: target, total },
        bubbles: true,
        composed: true,
      }),
    );

    return true;
  }

  step(delta) {
    return this.goTo(nextIndex(this._index, this.items.length, delta, { loop: this.loop }));
  }

  /** Sets the magnification, keeping `pointer` (measured from the frame centre) still. */
  setZoom(next, pointer = { x: 0, y: 0 }) {
    const target = clampZoom(next, { min: MIN_ZOOM, max: this.maxZoom });

    if (target === this._scale) {
      return;
    }

    const moved = zoomAt({
      scale: this._scale,
      nextScale: target,
      pointer,
      offset: this._offset,
    });

    this._scale = target;
    this._offset = target === MIN_ZOOM ? { x: 0, y: 0 } : moved;
    this._applyTransform();
  }

  resetZoom() {
    this._scale = MIN_ZOOM;
    this._offset = { x: 0, y: 0 };
    this._applyTransform();
  }

  _applyTransform() {
    const frame = this._frame.getBoundingClientRect();
    this._offset = clampOffset({
      offset: this._offset,
      scale: this._scale,
      frame,
      image: this._base,
    });

    this._image.style.translate = `${this._offset.x}px ${this._offset.y}px`;
    this._image.style.scale = String(this._scale);
    this._panel.toggleAttribute('data-zoomed', this._scale > MIN_ZOOM);

    this._panel.querySelector('[data-action="zoom-in"]').disabled = this._scale >= this.maxZoom;
    this._panel.querySelector('[data-action="zoom-out"]').disabled = this._scale <= MIN_ZOOM;
    this._panel.querySelector('[data-action="zoom-reset"]').disabled = this._scale === MIN_ZOOM;
  }

  _renderImage() {
    const items = this.items;
    const item = items[this._index];

    if (!item) {
      return;
    }

    const picture = item.querySelector('img');
    const alt = picture?.getAttribute('alt') ?? '';

    this._image.src = item.getAttribute('href') ?? picture?.src ?? '';
    this._image.alt = alt;
    this._scale = MIN_ZOOM;
    this._offset = { x: 0, y: 0 };
    this._image.style.translate = '0px 0px';
    this._image.style.scale = '1';

    // The size the picture is actually drawn at, which is what the drag limits measure
    // against. The element fills the frame and `object-fit` letterboxes inside it, so the
    // element's own box is the frame rather than the picture; the drawn size has to be
    // worked out from the natural proportions.
    const measure = () => {
      const frame = this._frame.getBoundingClientRect();
      const naturalWidth = this._image.naturalWidth || frame.width;
      const naturalHeight = this._image.naturalHeight || frame.height;
      const fit = Math.min(frame.width / naturalWidth, frame.height / naturalHeight);

      this._base = { width: naturalWidth * fit, height: naturalHeight * fit };
      this._applyTransform();
    };

    if (this._image.complete && this._image.naturalWidth) {
      measure();
    } else {
      this._image.addEventListener('load', measure, { once: true });
    }

    requestAnimationFrame(measure);

    const labels = this.labels;
    this._counter.textContent = fillLabel(labels.counter, {
      index: this._index + 1,
      total: items.length,
    });

    const caption = item.dataset.caption ?? '';
    this._caption.textContent = caption;
    this._caption.hidden = caption.length === 0;

    const single = items.length < 2;
    this._prev.hidden = single;
    this._next.hidden = single;
    this._strip.hidden = single;
    this._prev.disabled = !single && !this.loop && this._index === 0;
    this._next.disabled = !single && !this.loop && this._index === items.length - 1;

    this._thumbs.querySelectorAll('button').forEach((button, position) => {
      const active = position === this._index;
      button.toggleAttribute('data-active', active);

      if (active) {
        button.setAttribute('aria-current', 'true');
      } else {
        button.removeAttribute('aria-current');
      }
    });

    this._scrollThumbIntoView();
    this._syncStripArrows();
    this._status.textContent = imageAnnouncement({
      index: this._index,
      total: items.length,
      alt,
      labels,
    });
    this._applyTransform();
  }

  _renderStrip() {
    const items = this.items;
    const labels = this.labels;

    this._thumbs.replaceChildren(
      ...items.map((item, position) => {
        const entry = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'lightbox__thumb';
        button.dataset.index = String(position);

        const picture = item.querySelector('img');
        const alt = picture?.getAttribute('alt') ?? '';
        const image = document.createElement('img');
        image.src = picture?.getAttribute('src') ?? '';
        image.alt = '';
        button.append(image);
        button.setAttribute(
          'aria-label',
          fillLabel(labels.thumb, { index: position + 1, total: items.length, alt }),
        );

        entry.append(button);
        return entry;
      }),
    );
  }

  /**
   * Brings the current thumbnail back into view, and only when it has left.
   *
   * The strip marks where you are, and a mark nobody can see says nothing. Scrolling on
   * every change instead would move the strip out from under a pointer that is using it.
   */
  _scrollThumbIntoView() {
    const active = this._thumbs.querySelector('[data-active]');

    if (!active) {
      return;
    }

    const strip = this._thumbs.getBoundingClientRect();
    const thumb = active.getBoundingClientRect();

    if (thumb.left >= strip.left && thumb.right <= strip.right) {
      return;
    }

    this._thumbs.scrollBy({
      left:
        thumb.left < strip.left ? thumb.left - strip.left - 12 : thumb.right - strip.right + 12,
      behavior: 'auto',
    });
  }

  _syncStripArrows() {
    const room = this._thumbs.scrollWidth - this._thumbs.clientWidth;
    const at = this._thumbs.scrollLeft;

    this._strip.toggleAttribute('data-scrollable', room > 1);
    this._stripPrev.disabled = at <= 1;
    this._stripNext.disabled = at >= room - 1;
  }

  _pointerIn(event) {
    const rect = this._frame.getBoundingClientRect();
    return {
      x: event.clientX - (rect.left + rect.width / 2),
      y: event.clientY - (rect.top + rect.height / 2),
    };
  }

  _handleGalleryClick(event) {
    const item = event.target.closest('.lightbox__item');

    if (!item || !this.contains(item)) {
      return;
    }

    // Without script this link opens the full image, which is the fallback worth keeping.
    event.preventDefault();
    this.show(this.items.indexOf(item));
  }

  _handlePanelClick(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;

    if (action) {
      const moves = {
        previous: () => this.step(-1),
        next: () => this.step(1),
        close: () => this.close('close'),
        'zoom-in': () => this.setZoom(this._scale + ZOOM_STEP * 2),
        'zoom-out': () => this.setZoom(this._scale - ZOOM_STEP * 2),
        'zoom-reset': () => this.resetZoom(),
        'strip-prev': () => this._scrollStrip(-1),
        'strip-next': () => this._scrollStrip(1),
      };

      moves[action]?.();
      return;
    }

    const thumb = event.target.closest('.lightbox__thumb');

    if (thumb) {
      this.goTo(Number.parseInt(thumb.dataset.index, 10));
      return;
    }

    if (this._scale > MIN_ZOOM) {
      return;
    }

    // The panel fills the viewport, so there is no `::backdrop` left to press. What people
    // aim at is the dark surround, which is the panel, the stage, or the letterboxing
    // inside the frame, and that last one arrives on the image itself.
    const surround = [this._panel, this._panel.querySelector('.lightbox__stage'), this._frame];
    const beside =
      event.target === this._image &&
      pressedBeside({
        point: this._pointerIn(event),
        offset: this._offset,
        size: this._base,
        scale: this._scale,
      });

    if (beside || surround.includes(event.target)) {
      this.close('backdrop');
    }
  }

  _scrollStrip(direction) {
    this._thumbs.scrollBy({
      left: direction * Math.max(120, this._thumbs.clientWidth * 0.8),
      behavior: 'smooth',
    });
  }

  _handleKeyDown(event) {
    const zoomed = this._scale > MIN_ZOOM;
    const pan = 40;

    const actions = {
      // Arrows move between pictures at rest and move the picture once it is enlarged.
      // Zooming is what changes the mode, which is what makes the change noticeable.
      ArrowLeft: () => (zoomed ? this._panBy(pan, 0) : this.step(-1)),
      ArrowRight: () => (zoomed ? this._panBy(-pan, 0) : this.step(1)),
      ArrowUp: () => (zoomed ? this._panBy(0, pan) : null),
      ArrowDown: () => (zoomed ? this._panBy(0, -pan) : null),
      Home: () => this.goTo(0),
      End: () => this.goTo(this.items.length - 1),
      '+': () => this.setZoom(this._scale + ZOOM_STEP * 2),
      '=': () => this.setZoom(this._scale + ZOOM_STEP * 2),
      '-': () => this.setZoom(this._scale - ZOOM_STEP * 2),
      0: () => this.resetZoom(),
    };

    const run = actions[event.key];

    if (!run) {
      return;
    }

    event.preventDefault();
    run();
  }

  _panBy(x, y) {
    this._offset = { x: this._offset.x + x, y: this._offset.y + y };
    this._applyTransform();
  }

  _handleWheel(event) {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    this.setZoom(this._scale + direction * ZOOM_STEP, this._pointerIn(event));
  }

  _handlePointerDown(event) {
    if (this._scale <= MIN_ZOOM || event.button !== 0) {
      return;
    }

    event.preventDefault();
    this._dragFrom = { x: event.clientX, y: event.clientY, offset: { ...this._offset } };
    this._frame.setPointerCapture(event.pointerId);
    this._frame.addEventListener('pointermove', this._handlePointerMove);
    this._frame.addEventListener('pointerup', this._handlePointerUp);
    this._frame.addEventListener('pointercancel', this._handlePointerUp);
    this._panel.setAttribute('data-dragging', '');
  }

  _handlePointerMove(event) {
    if (!this._dragFrom) {
      return;
    }

    this._offset = {
      x: this._dragFrom.offset.x + (event.clientX - this._dragFrom.x),
      y: this._dragFrom.offset.y + (event.clientY - this._dragFrom.y),
    };
    this._applyTransform();
  }

  _handlePointerUp(event) {
    this._dragFrom = null;
    this._frame.releasePointerCapture?.(event.pointerId);
    this._frame.removeEventListener('pointermove', this._handlePointerMove);
    this._frame.removeEventListener('pointerup', this._handlePointerUp);
    this._frame.removeEventListener('pointercancel', this._handlePointerUp);
    this._panel.removeAttribute('data-dragging');
  }

  _handleCancel(event) {
    // Left alone the browser removes the dialog at once and the fade never runs.
    event.preventDefault();
    this.close('escape');
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-lightbox')) {
  customElements.define('ui-lightbox', UiLightbox);
}
