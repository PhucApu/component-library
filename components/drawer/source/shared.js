import {
  DEFAULT_LABELS,
  isBackdropPress,
  isModalPanel,
  normalizeAnchor,
  normalizeReason,
} from './drawer-core.js';

/** Matches the slide in the stylesheet. */
const EXIT_MS = 220;

/**
 * A panel that comes in from an edge.
 *
 * When the author writes a `dialog`, `showModal()` supplies the focus trap, the Escape
 * key, the top layer, the backdrop, and the return of focus to whatever opened it. Writing
 * any of that by hand would be more code and worse. When the author writes an `aside` or a
 * `nav` instead, none of it applies: a panel that is always there does not interrupt
 * anything, and the element behaves accordingly.
 */
export class UiDrawer extends HTMLElement {
  static get observedAttributes() {
    return ['anchor', 'open', 'trigger'];
  }

  constructor() {
    super();
    this._connected = false;
    this._labelOverrides = {};
    this._reason = 'api';
    this._handlePanelClick = this._handlePanelClick.bind(this);
    this._handleCancel = this._handleCancel.bind(this);
    this._handleTriggerClick = this._handleTriggerClick.bind(this);
    this._handleCloseClick = this._handleCloseClick.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this.addEventListener('click', this._handleCloseClick);
    this.panel?.addEventListener('click', this._handlePanelClick);
    this.panel?.addEventListener('cancel', this._handleCancel);
    this._wireTrigger();
    this._sync();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._handleCloseClick);
    this.panel?.removeEventListener('click', this._handlePanelClick);
    this.panel?.removeEventListener('cancel', this._handleCancel);
    this._trigger?.removeEventListener('click', this._handleTriggerClick);
    this._releaseScroll();
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._connected || oldValue === newValue) {
      return;
    }

    if (name === 'trigger') {
      this._wireTrigger();
    }

    if (name === 'open') {
      this._applyOpenState();
      return;
    }

    this._sync();
  }

  get panel() {
    return this.querySelector('.drawer__panel');
  }

  /** Derived from the element the author wrote, never from an attribute. */
  get modal() {
    return isModalPanel(this.panel?.tagName);
  }

  get anchor() {
    return normalizeAnchor(this.getAttribute('anchor'));
  }

  get open() {
    return this.hasAttribute('open');
  }

  set open(next) {
    this.toggleAttribute('open', Boolean(next));
  }

  get labels() {
    return { ...DEFAULT_LABELS, ...this._labelOverrides };
  }

  set labels(next) {
    this._labelOverrides = next && typeof next === 'object' ? { ...next } : {};
  }

  show() {
    if (!this.open) {
      this._reason = 'api';
      this.open = true;
    }
  }

  close(reason = 'api') {
    if (this.open) {
      this._reason = normalizeReason(reason);
      this.open = false;
    }
  }

  toggle(force) {
    const next = force === undefined ? !this.open : Boolean(force);

    if (next) {
      this.show();
    } else {
      this.close();
    }
  }

  _wireTrigger() {
    this._trigger?.removeEventListener('click', this._handleTriggerClick);

    const id = this.getAttribute('trigger');
    this._trigger = id ? document.getElementById(id) : null;

    if (!this._trigger) {
      return;
    }

    this._trigger.addEventListener('click', this._handleTriggerClick);
    this._trigger.setAttribute('aria-expanded', String(this.open));

    if (this.panel && !this._trigger.getAttribute('aria-controls')) {
      if (!this.panel.id) {
        this.panel.id = `${this.id || 'ui-drawer'}-panel`;
      }

      this._trigger.setAttribute('aria-controls', this.panel.id);
    }
  }

  /**
   * `showModal()` puts the dialog in the top layer but leaves the page behind it free to
   * scroll, which is how a drawer ends up sliding over a document that keeps moving.
   */
  _lockScroll() {
    if (!this.modal || this._previousOverflow !== undefined) {
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

  _applyOpenState() {
    const panel = this.panel;

    if (!panel) {
      return;
    }

    clearTimeout(this._exitTimer);
    this._trigger?.setAttribute('aria-expanded', String(this.open));

    if (this.open) {
      this._wasOpen = true;

      if (this.modal && typeof panel.showModal === 'function' && !panel.open) {
        panel.showModal();
      }

      this._lockScroll();
      panel.removeAttribute('data-leaving');
      // Read a layout value so the state above lands before the one below. Applied in a
      // single recalculation there is nothing for the slide to start from, and the panel
      // simply appears.
      void panel.offsetWidth;
      panel.setAttribute('data-shown', '');

      this.dispatchEvent(new CustomEvent('drawer-open', { bubbles: true, composed: true }));
      return;
    }

    // Connecting a closed drawer is not a closing. Running the exit here would report a
    // dismissal nobody performed, on every page load.
    if (!this._wasOpen) {
      return;
    }

    panel.removeAttribute('data-shown');
    panel.setAttribute('data-leaving', '');

    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._exitTimer = setTimeout(
      () => {
        panel.removeAttribute('data-leaving');
        this._releaseScroll();

        // Closing the dialog properly is what hands focus back to whatever opened it.
        if (this.modal && panel.open && typeof panel.close === 'function') {
          panel.close();
        }
      },
      reduced ? 0 : EXIT_MS,
    );

    this.dispatchEvent(
      new CustomEvent('drawer-close', {
        detail: { reason: this._reason },
        bubbles: true,
        composed: true,
      }),
    );
    this._reason = 'api';
  }

  _sync() {
    this.dataset.anchor = this.anchor;
    this.dataset.mode = this.modal ? 'modal' : 'inline';

    const close = this.querySelector('.drawer__close');

    if (close && !close.getAttribute('aria-label')) {
      close.setAttribute('aria-label', this.labels.close);
    }

    this._applyOpenState();
  }

  _handleTriggerClick() {
    this.toggle();
  }

  _handleCloseClick(event) {
    if (event.target.closest('.drawer__close')) {
      this.close('close');
    }
  }

  _handlePanelClick(event) {
    // The backdrop is not an element, so a press on it arrives with the dialog as target
    // and coordinates outside the dialog's own box.
    const backdrop = isBackdropPress({
      target: event.target,
      panel: this.panel,
      point: { x: event.clientX, y: event.clientY },
      detail: event.detail,
    });

    if (backdrop && !this.hasAttribute('no-backdrop-close')) {
      this.close('backdrop');
    }
  }

  _handleCancel(event) {
    // The browser would remove the dialog immediately, skipping the slide out.
    event.preventDefault();
    this.close('escape');
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-drawer')) {
  customElements.define('ui-drawer', UiDrawer);
}
