import {
  DEFAULT_LABELS,
  clampLines,
  pointerPosition,
  resolveEffect,
  resolveOrientation,
  resolveRatio,
  stateAttributes,
  tracksPointer,
} from './card-core.js';

/**
 * An article or product card.
 *
 * Nearly all of this component is CSS: the hover treatments, the equal heights, the pinned
 * footers, the clamped descriptions and the whole-card link are all stylesheet. The script
 * exists for the three things a stylesheet cannot do — follow the pointer, tell a drag from
 * a click, and refuse a press on a card that is unavailable — plus the small amount of
 * tidying the markup needs.
 */
export class UiCard extends HTMLElement {
  static get observedAttributes() {
    return ['effect', 'orientation', 'ratio', 'clamp', 'interactive', 'loading', 'disabled', 'current'];
  }

  constructor() {
    super();
    this._connected = false;
    this._labelOverrides = {};

    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handleClick = this._handleClick.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this._adopt();

    // Capturing, because a press on an unavailable card has to be stopped before it reaches
    // the link, and a bubbling listener is already too late.
    this.addEventListener('click', this._handleClick, true);
  }

  disconnectedCallback() {
    this.removeEventListener('pointermove', this._handlePointerMove);
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this._connected && oldValue !== newValue) {
      this._adopt();
    }
  }

  get effect() {
    return resolveEffect(this.getAttribute('effect'));
  }

  get orientation() {
    return resolveOrientation(this.getAttribute('orientation'));
  }

  get interactive() {
    return this.hasAttribute('interactive');
  }

  get loading() {
    return this.hasAttribute('loading');
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  get current() {
    return this.hasAttribute('current');
  }

  /** The link that names the card, and that the whole card stands in for. */
  get link() {
    return this.querySelector('.card__link') ?? this.querySelector('.card__title a');
  }

  get labels() {
    return { ...DEFAULT_LABELS, ...this._labelOverrides };
  }

  set labels(value) {
    this._labelOverrides = value && typeof value === 'object' ? { ...value } : {};
    this._adopt();
  }

  _adopt() {
    const effect = this.effect;

    this.setAttribute('data-effect', effect);
    this.setAttribute('data-orientation', this.orientation);
    this.style.setProperty('--card-ratio', resolveRatio(this.getAttribute('ratio')));

    const lines = clampLines(this.getAttribute('clamp'));

    if (lines === null) {
      this.style.removeProperty('--card-clamp');
      this.removeAttribute('data-clamped');
    } else {
      this.style.setProperty('--card-clamp', String(lines));
      this.setAttribute('data-clamped', '');
    }

    // The title's link is named so the stylesheet can stretch that one and lift every other
    // control above it. Guessing from the tag would catch the wrong link in a card whose
    // footer holds one.
    const title = this.querySelector('.card__title a');

    if (title) {
      title.classList.add('card__link');
    }

    Object.entries(
      stateAttributes({ loading: this.loading, disabled: this.disabled, current: this.current }),
    ).forEach(([name, value]) => {
      if (value === null) {
        this.removeAttribute(name);
      } else {
        this.setAttribute(name, value);
      }
    });

    const link = this.link;

    if (link) {
      link.setAttribute('aria-disabled', String(this.disabled));
    }

    // Only the treatments that need it, and only while they need it. A listener on every
    // card in a grid, firing on every pointer move, is a cost nobody asked for.
    this.removeEventListener('pointermove', this._handlePointerMove);

    if (tracksPointer(effect)) {
      this.addEventListener('pointermove', this._handlePointerMove);
    }
  }

  _handlePointerMove(event) {
    const { x, y } = pointerPosition({
      point: { x: event.clientX, y: event.clientY },
      rect: this.getBoundingClientRect(),
    });

    this.style.setProperty('--card-x', `${x}%`);
    this.style.setProperty('--card-y', `${y}%`);
  }

  /**
   * Refuses a press on a card that is unavailable.
   *
   * That is the whole of it. A guard against a drag being taken for a press was written here
   * first and then measured out again: a mouse drag of any real length over a link produces
   * **no click at all** — the log after a 180px drag was empty, where a plain press logged
   * one. So there was nothing to guard against, and the guard could only ever have fired
   * for a drag too short for the browser to notice, which is to say for the small wobble of
   * a hand that meant to click. It would have broken clicking for the people least able to
   * afford it.
   *
   * The card stays out of the way of `aria-disabled` too: nothing here removes the link from
   * the tab order, because a control nobody can reach is a control nobody can discover is
   * unavailable, and a disabled element cannot hold focus at all.
   */
  _handleClick(event) {
    if (!this.disabled) {
      return;
    }

    const link = event.target.closest('a');

    if (link && this.contains(link)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
}

if (!customElements.get('ui-card')) {
  customElements.define('ui-card', UiCard);
}
