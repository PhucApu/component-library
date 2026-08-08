import {
  clampDuration,
  facingFace,
  inertFace,
  labelFor,
  otherFace,
  panelAngle,
  resolveFace,
  shouldFlipFrom,
} from './flip-card-core.js';

/** Anything that does something of its own, and therefore is not a press on the card. */
const INTERACTIVE = 'a[href], button, input, select, textarea, summary, [tabindex]';

/**
 * A card with two faces that turns to show the second one.
 *
 * The whole component rests on one decision: the card itself is not a button. Its back
 * carries real content — links, controls — and a button inside a button is not markup, so
 * the card's own surface answers a press while every control inside it keeps its own
 * behaviour, and each face carries a real button for readers who are not using a pointer.
 *
 * The other half of it is that the face turned away is taken out of the page with `inert`
 * rather than merely hidden. A face nobody can see still carries its links, and a reader on
 * a keyboard would otherwise tab straight into them behind the card.
 */
export class UiFlipCard extends HTMLElement {
  static get observedAttributes() {
    return ['flipped', 'duration'];
  }

  constructor() {
    super();
    this._connected = false;
    this._handleClick = this._handleClick.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    const faces = [...this.children].filter((child) => !child.classList.contains('flip-card__scene'));

    if (faces.length === 0) {
      return;
    }

    if (!this._panel) {
      this._build(faces);
    }

    this._connected = true;
    this._apply();
  }

  attributeChangedCallback(name, previous, value) {
    if (!this._connected || previous === value) {
      return;
    }

    this._apply(name === 'flipped');
  }

  /** Which way round the card is. */
  get flipped() {
    return this.hasAttribute('flipped');
  }

  set flipped(value) {
    this.toggleAttribute('flipped', Boolean(value));
  }

  /** The two faces, front first. A card with nothing on the back has only one. */
  get faces() {
    return this._faces ? [...this._faces] : [];
  }

  flip() {
    this.show(otherFace(facingFace(this.flipped)));
  }

  show(face) {
    if (!this._turnable) {
      return;
    }

    this.flipped = resolveFace(face) === 'back';
  }

  _build(faces) {
    this._scene = document.createElement('div');
    this._scene.className = 'flip-card__scene';

    this._panel = document.createElement('div');
    this._panel.className = 'flip-card__panel';

    this._faces = ['front', 'back'].slice(0, faces.length).map((side, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = `flip-card__face flip-card__face--${side}`;
      wrapper.dataset.face = side;
      wrapper.append(faces[index]);
      return wrapper;
    });

    // A card with nothing on the back has nowhere to turn to, so it is given no control
    // that says otherwise.
    this._turnable = this._faces.length > 1;

    if (this._turnable) {
      this._faces.forEach((face) => {
        const authored = face.querySelector('[data-flip-toggle]');
        const toggle = authored ?? document.createElement('button');

        if (!authored) {
          toggle.type = 'button';
          toggle.className = 'flip-card__toggle';
          toggle.textContent = labelFor(face.dataset.face);
          face.append(toggle);
        }

        toggle.dataset.flipToggle = '';
        face.dataset.toggle = '';
      });
    }

    this._panel.append(...this._faces);
    this._scene.append(this._panel);
    this.replaceChildren(this._scene);
    this.dataset.enhanced = '';
    this.toggleAttribute('data-single', !this._turnable);

    this.addEventListener('click', this._handleClick);
  }

  _apply(announce = false) {
    if (!this._panel) {
      return;
    }

    this.style.setProperty('--flip-card-angle', `${panelAngle(this.flipped)}deg`);
    this.style.setProperty(
      '--flip-card-duration',
      `${clampDuration(this.getAttribute('duration'))}ms`,
    );

    const hidden = inertFace(this.flipped);

    this._faces.forEach((face) => {
      const away = this._turnable && face.dataset.face === hidden;

      // Both, deliberately. `inert` is what takes it out of the tab order and out of the
      // accessibility tree; `aria-hidden` says the same thing to anything that has not
      // caught up with `inert` yet.
      face.inert = away;
      face.toggleAttribute('aria-hidden', away);
    });

    if (announce) {
      this.dispatchEvent(
        new CustomEvent('flip-card-change', {
          bubbles: true,
          composed: true,
          detail: { flipped: this.flipped },
        }),
      );
    }
  }

  _handleClick(event) {
    if (!this._turnable) {
      return;
    }

    const toggle = Boolean(event.target.closest('[data-flip-toggle]'));
    const interactive = Boolean(event.target.closest(INTERACTIVE));
    const selecting = Boolean(window.getSelection && !window.getSelection().isCollapsed);

    if (!shouldFlipFrom({ toggle, interactive, selecting })) {
      return;
    }

    this.flip();

    // A press with no pointer behind it came from the keyboard, and the control that was
    // used has just been turned away. Focus follows the card round rather than being
    // dropped on the body — but a mouse press keeps its hands off focus.
    if (toggle && event.detail === 0) {
      this._focusFacing();
    }
  }

  _focusFacing() {
    const facing = this._faces.find((face) => face.dataset.face === facingFace(this.flipped));
    facing?.querySelector('[data-flip-toggle]')?.focus();
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-flip-card')) {
  customElements.define('ui-flip-card', UiFlipCard);
}
