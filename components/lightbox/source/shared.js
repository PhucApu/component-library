import {
  DEFAULT_LABELS,
  MAX_ZOOM,
  MIN_ZOOM,
  STRIP_WINDOW,
  ZOOM_STEP,
  clampOffset,
  clampZoom,
  fillLabel,
  formatZoomPercent,
  imageAnnouncement,
  nextIndex,
  parseZoomPercent,
  pressedBeside,
  shiftWindow,
  stripWindow,
  zoomAt,
} from './lightbox-core.js';

/** Matches the fade in the stylesheet. */
const EXIT_MS = 180;

/** How far, as a share of the frame, a new picture travels in from. */
const SLIDE_TRAVEL = 8;

/**
 * How close to the bottom of the picture the pointer comes before the folded tab appears.
 *
 * Generous, because it is a target nobody can see. Roughly the height of the strip it
 * brings back, so the band is about as big as the thing being asked for.
 */
const DOCK_REVEAL = 96;

const ICONS = Object.freeze({
  previous: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  close: 'm6 6 12 12M18 6 6 18',
  zoomIn: 'M12 6v12M6 12h12',
  zoomOut: 'M6 12h12',
  zoomReset: 'M4 9a8 8 0 1 1 .6 5M4 4v5h5',
  stripToggle: 'm7 10 5 5 5-5',
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
    this._windowStart = 0;
    this._stripOpen = true;
    this._stepDirection = 0;

    this._handleGalleryClick = this._handleGalleryClick.bind(this);
    this._handlePanelClick = this._handlePanelClick.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleCancel = this._handleCancel.bind(this);
    this._handleWheel = this._handleWheel.bind(this);
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerUp = this._handlePointerUp.bind(this);
    this._handleDockProximity = this._handleDockProximity.bind(this);
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
   * chevrons as the picture arrows, and are named for the thumbnails they step through
   * rather than repeating a name already on the page.
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
    // The folded state is the absence of this attribute, so the panel has to be born with
    // it or the first open would play the unfolding animation for nothing.
    this._panel.toggleAttribute('data-strip-open', this._stripOpen);

    const bar = document.createElement('div');
    bar.className = 'lightbox__bar';
    this._counter = document.createElement('p');
    this._counter.className = 'lightbox__counter';
    const tools = document.createElement('div');
    tools.className = 'lightbox__tools';
    const tool = (action, key, extra = '') =>
      this._control({ action, icon: key, label: key, className: `lightbox__tool ${extra}`.trim() });

    // Shrink, the level, and grow belong together: they are one adjustment, so they sit in
    // one bordered group. Reset is a different act and stands apart from it.
    const zoomGroup = document.createElement('div');
    zoomGroup.className = 'lightbox__zoom';

    this._zoomField = document.createElement('input');
    this._zoomField.className = 'lightbox__zoom-field';
    this._zoomField.type = 'text';
    this._zoomField.inputMode = 'numeric';
    this._zoomField.autocomplete = 'off';
    this._zoomField.setAttribute('aria-label', labels.zoomLevel);
    this._zoomField.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this._commitZoomField();
      }
      // The panel turns arrows and digits into navigation and magnification; inside the
      // field they have to stay ordinary typing.
      event.stopPropagation();
    });
    this._zoomField.addEventListener('blur', () => this._commitZoomField());

    const suffix = document.createElement('span');
    suffix.className = 'lightbox__zoom-suffix';
    suffix.setAttribute('aria-hidden', 'true');
    suffix.textContent = '%';

    zoomGroup.append(
      tool('zoom-out', 'zoomOut', 'lightbox__tool--flush'),
      this._zoomField,
      suffix,
      tool('zoom-in', 'zoomIn', 'lightbox__tool--flush'),
    );

    tools.append(zoomGroup, tool('zoom-reset', 'zoomReset'), tool('close', 'close', 'lightbox__tool--close'));
    bar.append(this._counter, tools);

    const stage = document.createElement('div');
    stage.className = 'lightbox__stage';
    this._stage = stage;
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
    // The slide and the magnification need separate elements: both want to move the
    // picture, and one transform cannot hold two unrelated jobs.
    this._slide = document.createElement('div');
    this._slide.className = 'lightbox__slide';
    this._image = document.createElement('img');
    this._image.className = 'lightbox__image';
    this._image.draggable = false;
    this._slide.append(this._image);
    this._frame.append(this._slide);

    // Over the picture rather than beside it, so nothing is given up to bars of empty
    // black either side.
    this._prev.classList.add('lightbox__nav--prev');
    this._next.classList.add('lightbox__nav--next');
    stage.append(this._frame, this._prev, this._next);

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

    // The toggle belongs to the part it folds, not to the toolbar at the far end of the
    // panel: a control that hides something should stand on the thing it hides. The dock
    // carries the tab so the two read as one piece of furniture.
    this._dock = document.createElement('div');
    this._dock.className = 'lightbox__dock';
    this._stripToggle = this._control({
      action: 'strip-toggle',
      icon: 'stripToggle',
      label: 'hideStrip',
      className: 'lightbox__dock-tab',
    });
    this._dock.append(this._stripToggle, this._strip);

    // Present and empty before there is anything to say. Swapping the source of an image
    // already on the page announces nothing on its own.
    this._status = document.createElement('span');
    this._status.className = 'lightbox__sr-only';
    this._status.setAttribute('role', 'status');

    this._panel.append(bar, stage, this._caption, this._dock, this._status);

    // Folded away, the tab is invisible and out of the flow, so something has to say when
    // it is wanted. Pointer movement near the bottom of the picture is the signal; a press
    // counts too, because a touch screen has no hovering to do.
    stage.addEventListener('pointermove', this._handleDockProximity);
    stage.addEventListener('pointerdown', this._handleDockProximity);
    stage.addEventListener('pointerleave', this._handleDockProximity);
    this.append(this._panel);

    this._panel.addEventListener('click', this._handlePanelClick);
    this._panel.addEventListener('keydown', this._handleKeyDown);
    this._panel.addEventListener('cancel', this._handleCancel);
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
    // Reopening starts from the default rather than from however it was left, because a
    // strip that is missing when the viewer opens is a strip nobody knows about. Set while
    // the panel is still `display: none`, where no transition can run: unfolding it in
    // front of the picture would also mean measuring the frame while it was still moving.
    this.toggleStrip(true);
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

    // Which way the new picture comes in from. A step knows its own direction even when
    // looping carries the index the other way; a thumbnail has only the two positions.
    const towards = this._stepDirection || Math.sign(target - this._index);

    this._index = target;
    this._source = this.items[target];
    this._renderImage();
    this._slideIn(towards);

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
    this._stepDirection = Math.sign(delta);

    try {
      return this.goTo(nextIndex(this._index, this.items.length, delta, { loop: this.loop }));
    } finally {
      this._stepDirection = 0;
    }
  }

  /**
   * Brings the new picture in from the side it came from.
   *
   * Two steps, because a transition needs a starting point that has already been rendered:
   * put the picture where it comes from with the transition off, let the layout settle, then
   * turn the transition back on and send it home. Clearing the inline transition hands the
   * timing back to the stylesheet, which is also where `prefers-reduced-motion` removes it —
   * the same two steps then simply arrive at once.
   */
  _slideIn(direction) {
    const towards = Math.sign(direction) || 0;

    if (!towards) {
      return;
    }

    this._slide.style.transition = 'none';
    this._slide.style.translate = `${towards * SLIDE_TRAVEL}% 0`;
    this._slide.style.opacity = '0';
    void this._slide.offsetWidth;
    this._slide.style.transition = '';
    this._slide.style.translate = '0 0';
    this._slide.style.opacity = '1';
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
    this._syncZoomField();

    this._syncZoomControls();
  }

  /**
   * Turns the zoom controls off where they can do nothing, without taking the keyboard with
   * them.
   *
   * A disabled element cannot hold focus. Every one of these turns itself off as a direct
   * result of being pressed — reset and shrink at life size, grow at the ceiling — so the
   * control being disabled is very often the one under the finger. Measured: pressing reset
   * dropped focus to the body, and from there `+` and the arrow keys did nothing at all,
   * because the panel never saw the events.
   *
   * Each hands focus to the neighbour that is still worth pressing, and to close as a last
   * resort, which is the one control that is always available.
   */
  _syncZoomControls() {
    const grow = this._panel.querySelector('[data-action="zoom-in"]');
    const shrink = this._panel.querySelector('[data-action="zoom-out"]');
    const reset = this._panel.querySelector('[data-action="zoom-reset"]');

    for (const [control, off, heir] of [
      [grow, this._scale >= this.maxZoom, shrink],
      [shrink, this._scale <= MIN_ZOOM, grow],
      [reset, this._scale === MIN_ZOOM, grow],
    ]) {
      if (off && control === document.activeElement) {
        const target = heir?.disabled ? this._panel.querySelector('.lightbox__tool--close') : heir;
        target?.focus();
      }

      control.disabled = off;
    }
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
    this._dock.hidden = single;
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

    this._followIndex();
    this._syncZoomField();
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
   * Shows one run of thumbnails and puts the rest away.
   *
   * The ones outside are `hidden` rather than merely scrolled past, so they leave the tab
   * order with them.
   */
  _syncStrip() {
    const total = this.items.length;

    this._windowStart = shiftWindow({
      start: this._windowStart,
      delta: 0,
      total,
      size: STRIP_WINDOW,
    });

    const view = { start: this._windowStart, end: Math.min(this._windowStart + STRIP_WINDOW, total) };

    [...this._thumbs.children].forEach((entry, position) => {
      entry.toggleAttribute('hidden', position < view.start || position >= view.end);
    });

    // The arrows step the picture, so they run out where the picture does — at the ends of
    // the set, not at the ends of the window.
    const windowed = total > STRIP_WINDOW;
    this._stripPrev.hidden = !windowed;
    this._stripNext.hidden = !windowed;
    this._stripPrev.disabled = !this.loop && this._index === 0;
    this._stripNext.disabled = !this.loop && this._index === total - 1;
  }

  /**
   * Slides the window along to keep up with the picture being viewed.
   *
   * It moves before the current picture reaches the edge rather than after, so what is
   * coming next is already on the strip when you ask for it.
   */
  _followIndex() {
    this._windowStart = stripWindow({
      index: this._index,
      total: this.items.length,
      size: STRIP_WINDOW,
      start: this._windowStart,
    }).start;
    this._syncStrip();
  }

  /** Writes the level into the field, unless somebody is in the middle of typing one. */
  _syncZoomField() {
    if (document.activeElement === this._zoomField) {
      return;
    }

    this._zoomField.value = String(formatZoomPercent(this._scale));
  }

  _commitZoomField() {
    const parsed = parseZoomPercent(this._zoomField.value, { min: MIN_ZOOM, max: this.maxZoom });

    // Anything unusable leaves the picture alone and puts the real level back, rather than
    // guessing at what was meant.
    if (parsed !== null) {
      this.setZoom(parsed);
    }

    this._zoomField.value = String(formatZoomPercent(this._scale));
  }

  toggleStrip(force) {
    this._stripOpen = force === undefined ? !this._stripOpen : Boolean(force);
    const labels = this.labels;

    this._panel.toggleAttribute('data-strip-open', this._stripOpen);
    // Unfolding satisfies whatever the reveal was for, and an unfolded tab is visible
    // anyway. Left set, it would keep the reveal alive under the next fold.
    this._panel.removeAttribute('data-dock-near');
    // `hidden` would remove the strip between one frame and the next, and nothing that is
    // gone can be animated away. It folds in CSS instead, and `inert` does the part `hidden`
    // was there for: taking the thumbnails out of the tab order while they are not in use.
    this._strip.inert = !this._stripOpen;
    this._stripToggle.setAttribute('aria-expanded', String(this._stripOpen));
    this._stripToggle.setAttribute(
      'aria-label',
      this._stripOpen ? labels.hideStrip : labels.showStrip,
    );
  }

  /**
   * Shows the folded tab when the pointer comes near the bottom of the picture.
   *
   * Only while folded: unfolded, the tab is a visible notch on the strip and has nothing to
   * wait for. Leaving the picture puts it away again.
   */
  _handleDockProximity(event) {
    if (this._stripOpen) {
      this._panel.removeAttribute('data-dock-near');
      return;
    }

    // Only a mouse leaves. A touch always "leaves" the instant it is lifted — the browser
    // sends `pointerleave` straight after `pointerup` — so honouring it here would undo the
    // reveal in the same breath as the tap that asked for it. Measured: tapping near the
    // foot turned the tab on and back off before it could be pressed. For touch, the next
    // press somewhere else is what puts it away, which happens on its own.
    if (event.type === 'pointerleave') {
      if (event.pointerType === 'mouse') {
        this._panel.removeAttribute('data-dock-near');
      }

      return;
    }

    const rect = this._stage.getBoundingClientRect();

    this._panel.toggleAttribute('data-dock-near', rect.bottom - event.clientY <= DOCK_REVEAL);
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
        'strip-prev': () => this.step(-1),
        'strip-next': () => this.step(1),
        'strip-toggle': () => this.toggleStrip(),
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
