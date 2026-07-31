import {
  DEFAULT_LABELS,
  autoplayDelay,
  clampIndex,
  clampPerView,
  commitDrag,
  fillLabel,
  indexFromScroll,
  isDrag,
  isLayered,
  lastIndex,
  nextIndex,
  pageCount,
  resolveEffect,
} from './carousel-core.js';

const ICONS = Object.freeze({
  previous: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  play: 'M8 5v14l11-7z',
  pause: 'M9 5v14M15 5v14',
});

/** How much of the recent pointer movement counts towards the flick. */
const VELOCITY_WINDOW = 120;

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A strip of pictures that moves one at a time.
 *
 * The track is an ordinary scroll container with snap points, which is where the swiping, the
 * momentum, the keyboard scrolling and the whole of the no-script behaviour come from. What
 * the element adds is the arrows, the dots, dragging with a pointer, the transitions that
 * cannot be done by scrolling, and telling anyone listening where it has got to.
 */
export class UiCarousel extends HTMLElement {
  static get observedAttributes() {
    return ['effect', 'loop', 'autoplay', 'per-view', 'no-drag', 'label'];
  }

  constructor() {
    super();
    this._connected = false;
    this._labelOverrides = {};
    this._index = 0;
    this._playing = false;
    this._timer = 0;
    this._dragged = false;

    this._handleScroll = this._handleScroll.bind(this);
    this._handleScrollEnd = this._handleScrollEnd.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerUp = this._handlePointerUp.bind(this);
    this._handleClickCapture = this._handleClickCapture.bind(this);
    this._handleControlClick = this._handleControlClick.bind(this);
    this._handleEnter = this._handleEnter.bind(this);
    this._handleLeave = this._handleLeave.bind(this);
    this._handleVisibility = this._handleVisibility.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this._build();
    this._adopt();
    this._render();

    if (this.hasAttribute('autoplay')) {
      this.play();
    }
  }

  disconnectedCallback() {
    this.pause();
    document.removeEventListener('visibilitychange', this._handleVisibility);
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._connected || oldValue === newValue) {
      return;
    }

    this._adopt();
    this._render();

    if (name === 'autoplay') {
      this.hasAttribute('autoplay') ? this.play() : this.pause();
    }
  }

  get slides() {
    return this._track ? [...this._track.querySelectorAll(':scope > .carousel__slide')] : [];
  }

  get index() {
    return this._index;
  }

  set index(value) {
    this.goTo(value);
  }

  get effect() {
    return resolveEffect(this.getAttribute('effect'));
  }

  get layered() {
    return isLayered(this.effect);
  }

  get loop() {
    return this.hasAttribute('loop');
  }

  get perView() {
    return clampPerView(this.getAttribute('per-view'), this.slides.length);
  }

  get draggable() {
    return !this.hasAttribute('no-drag');
  }

  get delay() {
    return autoplayDelay(this.getAttribute('autoplay'));
  }

  get playing() {
    return this._playing;
  }

  get labels() {
    return { ...DEFAULT_LABELS, ...this._labelOverrides };
  }

  set labels(value) {
    this._labelOverrides = value && typeof value === 'object' ? { ...value } : {};
    this._adopt();
    this._render();
  }

  _icon(name) {
    const fill = name === 'play' ? 'currentColor' : 'none';
    return `<svg viewBox="0 0 24 24" aria-hidden="true" data-fill="${fill}"><path d="${ICONS[name]}"></path></svg>`;
  }

  _control(action, icon, label, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.dataset.action = action;
    button.innerHTML = this._icon(icon);
    button.setAttribute('aria-label', label);
    return button;
  }

  _build() {
    if (this._frame) {
      return;
    }

    const track = this.querySelector(':scope > .carousel__track');

    if (!track) {
      return;
    }

    this._track = track;

    // The track is wrapped rather than moved, so the arrows can sit over the pictures
    // without being inside the thing that scrolls.
    this._frame = document.createElement('div');
    this._frame.className = 'carousel__frame';
    track.before(this._frame);
    this._frame.append(track);

    const labels = this.labels;
    this._previous = this._control('previous', 'previous', labels.previous, 'carousel__arrow carousel__arrow--previous');
    this._next = this._control('next', 'next', labels.next, 'carousel__arrow carousel__arrow--next');
    this._frame.append(this._previous, this._next);

    this._dots = document.createElement('div');
    this._dots.className = 'carousel__dots';
    this._dots.setAttribute('role', 'group');

    this._toggle = this._control('toggle', 'pause', labels.pause, 'carousel__toggle');

    this._bar = document.createElement('div');
    this._bar.className = 'carousel__bar';
    this._bar.append(this._dots, this._toggle);
    this._frame.after(this._bar);

    // Present and empty before there is anything to say. A region written into the page at
    // the moment it gains text is a region nothing announces.
    this._status = document.createElement('span');
    this._status.className = 'carousel__sr-only';
    this._status.setAttribute('role', 'status');
    this.append(this._status);

    this.addEventListener('click', this._handleControlClick);
    track.addEventListener('scroll', this._handleScroll, { passive: true });
    track.addEventListener('scrollend', this._handleScrollEnd);
    track.addEventListener('keydown', this._handleKeyDown);
    track.addEventListener('pointerdown', this._handlePointerDown);
    // Capturing, and on the host: a press that turned into a drag has to be stopped before
    // it reaches a link inside a slide, and a bubbling listener is already too late.
    this.addEventListener('click', this._handleClickCapture, true);
    this.addEventListener('pointerenter', this._handleEnter);
    this.addEventListener('pointerleave', this._handleLeave);
    this.addEventListener('focusin', this._handleEnter);
    this.addEventListener('focusout', this._handleLeave);
    document.addEventListener('visibilitychange', this._handleVisibility);
  }

  /** Brings whatever markup the author wrote up to the shape the element works with. */
  _adopt() {
    if (!this._track) {
      return;
    }

    const labels = this.labels;
    const slides = this.slides;
    const total = slides.length;

    this.setAttribute('role', 'group');
    this.setAttribute('aria-roledescription', labels.carousel);

    if (!this.hasAttribute('aria-label')) {
      this.setAttribute('aria-label', this.getAttribute('label') ?? labels.track);
    }

    // Measured: a scroll container reports `tabIndex: -1` whether or not it holds focusable
    // children, so nothing puts it in the tab order but this line. A strip that can be
    // scrolled and cannot be reached is a strip the keyboard cannot use.
    this._track.tabIndex = 0;
    this._track.setAttribute('aria-label', labels.track);

    this.style.setProperty('--carousel-per-view', String(this.perView));
    this.toggleAttribute('data-layered', this.layered);
    this.setAttribute('data-effect', this.effect);
    this.toggleAttribute('data-single', total < 2);

    slides.forEach((slide, position) => {
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', labels.slide);
      slide.setAttribute(
        'aria-label',
        fillLabel(labels.position, { index: position + 1, total }),
      );
    });

    this._renderDots();
  }

  _renderDots() {
    const labels = this.labels;
    const total = this.slides.length;
    const pages = pageCount({ total, perView: this.perView });

    this._dots.setAttribute('aria-label', labels.track);
    this._dots.replaceChildren(
      ...Array.from({ length: pages }, (unused, position) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'carousel__dot';
        dot.dataset.action = 'goto';
        dot.dataset.index = String(position);
        dot.setAttribute(
          'aria-label',
          fillLabel(labels.goTo, { index: position + 1, total: pages }),
        );
        return dot;
      }),
    );
  }

  _render() {
    const total = this.slides.length;
    const last = lastIndex({ total, perView: this.perView });

    this._index = clampIndex({ index: this._index, total, perView: this.perView });

    const atStart = !this.loop && this._index <= 0;
    const atEnd = !this.loop && this._index >= last;

    // The control that turns itself off is very often the one under the finger, and a
    // disabled element cannot hold focus: it drops to the body and takes the keyboard with
    // it. Each hands over to its neighbour before it goes.
    this._retire(this._previous, atStart, this._next);
    this._retire(this._next, atEnd, this._previous);

    [...this._dots.children].forEach((dot, position) => {
      const current = position === this._index;
      dot.toggleAttribute('data-current', current);

      if (current) {
        dot.setAttribute('aria-current', 'true');
      } else {
        dot.removeAttribute('aria-current');
      }
    });

    this._toggle.hidden = !this.hasAttribute('autoplay');
    this._toggle.innerHTML = this._icon(this._playing ? 'pause' : 'play');
    this._toggle.setAttribute('aria-label', this._playing ? this.labels.pause : this.labels.play);

    this.slides.forEach((slide, position) => {
      const current = this.layered
        ? position === this._index
        : position >= this._index && position < this._index + this.perView;

      slide.toggleAttribute('data-current', current);

      // Only in the stacked modes. On the track every slide can still be scrolled to, so
      // taking the others out of reach would break the scrolling that is the whole base.
      if (this.layered) {
        slide.inert = !current;
      } else if (slide.inert) {
        slide.inert = false;
      }
    });
  }

  _retire(control, off, heir) {
    if (off && control === document.activeElement) {
      (heir?.disabled ? this._track : heir)?.focus();
    }

    control.disabled = off;
  }

  goTo(index, { announce = true, smooth = true } = {}) {
    const total = this.slides.length;
    const target = clampIndex({ index, total, perView: this.perView });

    if (target < 0) {
      return false;
    }

    const changed = target !== this._index;
    const leaving = this.slides[this._index];
    this._direction = Math.sign(target - this._index) || this._direction || 1;
    this._index = target;

    if (this.layered) {
      this.setAttribute('data-direction', this._direction > 0 ? 'forward' : 'back');

      if (changed) {
        this._markLeaving(leaving);
      }
    } else {
      this._scrollTo(target, smooth);
    }

    this._render();

    if (changed) {
      if (announce) {
        this._announce();
      }

      this._report();
    }

    return changed;
  }

  /**
   * Keeps the outgoing slide on the page for as long as the transition lasts.
   *
   * Without it there is nothing to tell an arriving slide from a departing one, and every
   * effect that moves them in opposite directions — `cover` above all — is impossible: one
   * rule cannot send the same selector both ways at once.
   */
  _markLeaving(slide) {
    clearTimeout(this._leavingTimer);
    this._leaving?.removeAttribute('data-leaving');

    if (!slide || slide === this.slides[this._index]) {
      this._leaving = null;
      return;
    }

    slide.setAttribute('data-leaving', '');
    this._leaving = slide;

    const move = Number.parseFloat(getComputedStyle(this).getPropertyValue('--carousel-move'));
    const ms = Number.isFinite(move) ? move : 320;

    this._leavingTimer = setTimeout(() => {
      slide.removeAttribute('data-leaving');
      this._leaving = null;
    }, prefersReducedMotion() ? 0 : ms);
  }

  _scrollTo(index, smooth) {
    const slide = this.slides[index];

    if (!slide) {
      return;
    }

    this._track.scrollTo({
      left: slide.offsetLeft - this._track.offsetLeft,
      behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
    });
  }

  next() {
    return this._step(1);
  }

  previous() {
    return this._step(-1);
  }

  _step(delta) {
    return this.goTo(
      nextIndex({
        current: this._index,
        total: this.slides.length,
        delta,
        perView: this.perView,
        loop: this.loop,
      }),
    );
  }

  play() {
    // Movement that starts on its own and cannot be stopped is the thing the rule about
    // moving content exists for. Under a reduced-motion setting it never starts.
    if (this._playing || prefersReducedMotion() || this.slides.length < 2) {
      return;
    }

    this._playing = true;
    this._schedule();
    this._render();

    this.dispatchEvent(new CustomEvent('carousel-play', { bubbles: true, composed: true }));
  }

  pause() {
    if (!this._playing) {
      return;
    }

    this._playing = false;
    clearTimeout(this._timer);
    this._render();

    this.dispatchEvent(new CustomEvent('carousel-pause', { bubbles: true, composed: true }));
  }

  _schedule() {
    clearTimeout(this._timer);

    if (!this._playing || this._held) {
      return;
    }

    this._timer = setTimeout(() => {
      const last = lastIndex({ total: this.slides.length, perView: this.perView });
      // Rolling round is what makes a slideshow a slideshow; without `loop` it stops at the
      // end rather than jumping back, which would be a surprise nobody asked for.
      this.goTo(this._index >= last ? (this.loop ? 0 : last) : this._index + 1);

      if (!this.loop && this._index >= last) {
        this.pause();
        return;
      }

      this._schedule();
    }, this.delay);
  }

  /**
   * What the status region says.
   *
   * Silent while it is running on its own: a region that speaks every few seconds without
   * being asked is a region people turn off. Only a change somebody made is announced.
   */
  _announce() {
    if (this._playing) {
      return;
    }

    this._status.textContent = fillLabel(this.labels.position, {
      index: this._index + 1,
      total: pageCount({ total: this.slides.length, perView: this.perView }),
    });
  }

  _handleControlClick(event) {
    const control = event.target.closest('[data-action]');

    if (!control || !this.contains(control)) {
      return;
    }

    const actions = {
      previous: () => this.previous(),
      next: () => this.next(),
      goto: () => this.goTo(Number.parseInt(control.dataset.index, 10)),
      toggle: () => (this._playing ? this.pause() : this.play()),
    };

    actions[control.dataset.action]?.();
  }

  _handleScroll() {
    if (this.layered || this._dragging) {
      return;
    }

    const settled = indexFromScroll({
      scrollLeft: this._track.scrollLeft,
      slideSize: this.slides[0]?.getBoundingClientRect().width ?? 0,
      gap: this._gap(),
      total: this.slides.length,
      perView: this.perView,
    });

    if (settled !== this._index) {
      this._index = settled;
      this._render();
    }
  }

  _handleScrollEnd() {
    if (this.layered || this._dragging) {
      return;
    }

    this._handleScroll();
    this._announce();
    this._report();
  }

  /**
   * Says where it has got to, once per arrival.
   *
   * Every route ends here, and there are four: a control, the keyboard, a drag, and the
   * scroller settling by itself. Left to dispatch on their own they overlap — a press
   * announces the change and then the scroll it caused announces the same thing again — so
   * the last position reported is remembered and a repeat is dropped.
   */
  _report() {
    if (this._reported === this._index) {
      return;
    }

    this._reported = this._index;

    this.dispatchEvent(
      new CustomEvent('carousel-change', {
        detail: { index: this._index, total: this.slides.length },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _gap() {
    return Number.parseFloat(getComputedStyle(this._track).columnGap) || 0;
  }

  _handleKeyDown(event) {
    const actions = {
      ArrowLeft: () => this.previous(),
      ArrowRight: () => this.next(),
      Home: () => this.goTo(0),
      End: () => this.goTo(lastIndex({ total: this.slides.length, perView: this.perView })),
    };

    const run = actions[event.key];

    if (!run) {
      return;
    }

    // Cancelled, or the browser scrolls the track as well and two slides go by for one key.
    event.preventDefault();
    run();
  }

  _handlePointerDown(event) {
    if (!this.draggable || event.button !== 0 || this.slides.length < 2) {
      return;
    }

    this._dragging = true;
    this._dragged = false;
    this._start = { x: event.clientX, scroll: this._track.scrollLeft, at: event.timeStamp };
    this._recent = { x: event.clientX, at: event.timeStamp };

    // Measured: with snapping on, a hand-driven `scrollLeft` is pulled straight back to the
    // nearest snap point — 60px became 0 again — so the drag would fight the browser the
    // whole way. Snapping goes off for as long as the drag lasts and comes back for the
    // landing.
    this._track.style.scrollSnapType = 'none';

    // Capture is worth having and not worth failing over: it throws for a pointer id the
    // browser has no record of, and an exception here would leave the drag half started —
    // snapping off, no listeners, and no way back.
    try {
      this._track.setPointerCapture?.(event.pointerId);
    } catch {
      // The drag still works without it; only tracking outside the element is lost.
    }

    this.toggleAttribute('data-dragging', true);

    this._track.addEventListener('pointermove', this._handlePointerMove);
    this._track.addEventListener('pointerup', this._handlePointerUp);
    this._track.addEventListener('pointercancel', this._handlePointerUp);
  }

  _handlePointerMove(event) {
    if (!this._dragging) {
      return;
    }

    const delta = event.clientX - this._start.x;

    if (isDrag(delta)) {
      this._dragged = true;
    }

    if (event.timeStamp - this._recent.at > VELOCITY_WINDOW) {
      this._recent = { x: event.clientX, at: event.timeStamp };
    }

    if (this.layered) {
      // Nothing scrolls in the stacked modes, so the movement is shown rather than done.
      this.style.setProperty('--carousel-drag', `${delta}px`);
      return;
    }

    this._track.scrollLeft = this._start.scroll - delta;
  }

  _handlePointerUp(event) {
    if (!this._dragging) {
      return;
    }

    this._dragging = false;
    this.style.removeProperty('--carousel-drag');
    this.removeAttribute('data-dragging');
    this._track.removeEventListener('pointermove', this._handlePointerMove);
    this._track.removeEventListener('pointerup', this._handlePointerUp);
    this._track.removeEventListener('pointercancel', this._handlePointerUp);

    const delta = event.clientX - this._start.x;
    const elapsed = Math.max(1, event.timeStamp - this._recent.at);
    const step = commitDrag({
      delta,
      size: this.slides[0]?.getBoundingClientRect().width ?? 1,
      velocity: (event.clientX - this._recent.x) / elapsed,
    });

    if (step === 0) {
      this.goTo(this._index);
    } else {
      this._step(step);
    }

    this._restoreSnap();
  }

  /**
   * Gives snapping back once the landing is over, not before it starts.
   *
   * Restoring it first hands the scroller to the browser while the drag is still being
   * decided: it snaps to whichever slide is nearest, and only then does the carousel glide
   * to the one it actually chose. Two movements for one gesture, and the position is wrong
   * in between. Measured — a drag of 320px landed on the wrong slide and corrected itself
   * afterwards.
   *
   * The timer covers a drag that moved nothing, where there is no scroll to end.
   */
  _restoreSnap() {
    clearTimeout(this._snapTimer);

    const restore = () => {
      clearTimeout(this._snapTimer);
      this._track.removeEventListener('scrollend', restore);
      this._track.style.scrollSnapType = '';
    };

    this._track.addEventListener('scrollend', restore, { once: true });
    this._snapTimer = setTimeout(restore, 700);
  }

  _handleClickCapture(event) {
    if (!this._dragged) {
      return;
    }

    // A slide can hold a link, and a drag that ends over one would otherwise follow it.
    this._dragged = false;
    event.preventDefault();
    event.stopPropagation();
  }

  _handleEnter() {
    this._held = true;
    clearTimeout(this._timer);
  }

  _handleLeave() {
    this._held = false;
    this._schedule();
  }

  _handleVisibility() {
    if (document.hidden) {
      clearTimeout(this._timer);
    } else {
      this._schedule();
    }
  }
}

if (!customElements.get('ui-carousel')) {
  customElements.define('ui-carousel', UiCarousel);
}
