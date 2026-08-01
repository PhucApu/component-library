import {
  DEFAULT_LABELS,
  MAP_SIZE,
  MAX_SCALE,
  MIN_SCALE,
  clampView,
  directionsUrl,
  fillLabel,
  flightDuration,
  groupPlaces,
  highlightSegments,
  matchPlaces,
  project,
  viewFor,
  zoomAbout,
} from './locator-map-core.js';

const ICONS = Object.freeze({
  zoomIn: 'M12 6v12M6 12h12',
  zoomOut: 'M6 12h12',
  reset: 'M4 9a8 8 0 1 1 .6 5M4 4v5h5',
  clear: 'm6 6 12 12M18 6 6 18',
});

const ZOOM_STEP = 1.6;

let sequence = 0;

function uniqueId(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The outline, traced from the projection rather than drawn by eye.
 *
 * Every point on it was worked out by running a real latitude and longitude through the same
 * `project` the markers use, so the coast falls where the coast falls. Drawn by eye the first
 * time, it left three offices standing in the sea.
 *
 * It is a generalisation and the mainland only. It claims nothing about any border and shows
 * nothing at sea.
 */
const COASTLINE = [
  'M176 30',
  'Q260 62 310 122',
  'Q280 200 237 269',
  'Q300 320 332 363',
  'Q370 410 384 459',
  'Q386 510 379 553',
  'Q330 595 274 623',
  'Q220 670 165 711',
  'Q152 680 150 648',
  'Q172 620 200 600',
  'Q240 578 274 553',
  'Q282 505 279 459',
  'Q258 410 237 363',
  'Q190 315 132 269',
  'Q66 205 24 128',
  'Q28 70 44 34',
  'Q110 16 176 30',
  'Z',
].join('');

const LAND = `<svg class="locator-map__drawing" viewBox="0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}" role="presentation" aria-hidden="true" preserveAspectRatio="none"><path class="locator-map__land" d="${COASTLINE}"/></svg>`;

/**
 * The map surface that ships with the component: a drawing, and nothing fetched.
 *
 * This is one implementation of a small contract, not the only one. Anything with the same
 * seven members can take its place — a real provider's map above all — which is what lets a
 * consumer put Google Maps behind the same search without this catalog depending on it.
 *
 * ```js
 * carousel.adapter = {
 *   mount(frame, { onSelect, onViewChange }) {},
 *   update({ places, selected }) {},
 *   flyTo(place, { zoom, reduced }) {},
 *   reset({ reduced }) {},
 *   zoomBy(factor) {},
 *   get view() {},
 *   destroy() {},
 * };
 * ```
 */
export class DrawingMap {
  constructor({ minZoom = MIN_SCALE, maxZoom = MAX_SCALE } = {}) {
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this._view = { x: 0, y: 0, k: minZoom };

    this._handleClick = this._handleClick.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerUp = this._handlePointerUp.bind(this);
  }

  get view() {
    return { ...this._view };
  }

  mount(frame, { onSelect, onViewChange, labels = DEFAULT_LABELS } = {}) {
    this._frame = frame;
    this._onSelect = onSelect;
    this._onViewChange = onViewChange;
    this._labels = labels;

    this._world = document.createElement('div');
    this._world.className = 'locator-map__world';
    this._world.innerHTML = LAND;

    this._markers = document.createElement('div');
    this._markers.className = 'locator-map__markers';
    this._world.append(this._markers);

    this._zoom = document.createElement('div');
    this._zoom.className = 'locator-map__zoom';
    this._zoom.append(
      this._tool('zoom-in', 'zoomIn', labels.zoomIn),
      this._tool('zoom-out', 'zoomOut', labels.zoomOut),
      this._tool('reset', 'reset', labels.reset),
    );

    frame.append(this._world, this._zoom);
    frame.addEventListener('click', this._handleClick);
    frame.addEventListener('keydown', this._handleKeyDown);
    frame.addEventListener('pointerdown', this._handlePointerDown);

    this._apply(this._view, { duration: 0 });
  }

  destroy() {
    this._frame?.removeEventListener('click', this._handleClick);
    this._frame?.removeEventListener('keydown', this._handleKeyDown);
    this._frame?.removeEventListener('pointerdown', this._handlePointerDown);
    this._world?.remove();
    this._zoom?.remove();
    this._frame = null;
  }

  _tool(action, icon, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'locator-map__tool';
    button.dataset.action = action;
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[icon]}"></path></svg>`;
    button.setAttribute('aria-label', label);
    return button;
  }

  update({ places = [], selected = -1 } = {}) {
    const labels = this._labels ?? DEFAULT_LABELS;

    this._markers.replaceChildren(
      ...places.map((place) => {
        const point = project(place);
        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = 'locator-map__marker';
        marker.dataset.index = String(place.index);
        marker.style.setProperty('--marker-x', `${(point.x / MAP_SIZE.width) * 100}%`);
        marker.style.setProperty('--marker-y', `${(point.y / MAP_SIZE.height) * 100}%`);
        marker.setAttribute(
          'aria-label',
          fillLabel(labels.marker, { name: place.name, address: place.address }),
        );
        marker.toggleAttribute('data-selected', place.index === selected);
        marker.innerHTML = '<span class="locator-map__pin" aria-hidden="true"></span>';
        return marker;
      }),
    );
  }

  /**
   * The zoom is clamped before the offsets are worked out, not after.
   *
   * `zoom` is whatever the page asked for, and a page that means to drive a real provider asks
   * for a provider's number — 14, say, where this surface only goes to 8. Working the offsets
   * out at 14 and then reducing the scale to 8 puts the office a quarter of a frame off centre,
   * because the two halves of the view no longer agree about how big the map is.
   */
  flyTo(place, { zoom = 4.5, reduced = false } = {}) {
    const scale = Math.min(Math.max(zoom, this.minZoom), this.maxZoom);

    this._apply(viewFor({ point: project(place), scale }), { reduced });
  }

  reset({ reduced = false } = {}) {
    this._apply({ x: 0, y: 0, k: this.minZoom }, { reduced });
  }

  zoomBy(factor) {
    this._apply(zoomAbout({ view: this._view, factor }));
  }

  _apply(next, { reduced = false, duration } = {}) {
    const view = clampView(next, { min: this.minZoom, max: this.maxZoom });
    const ms = duration ?? (reduced ? 0 : flightDuration(this._view, view));

    this._view = view;
    this._frame.style.setProperty('--map-x', String(view.x));
    this._frame.style.setProperty('--map-y', String(view.y));
    this._frame.style.setProperty('--map-k', String(view.k));
    this._frame.style.setProperty('--map-flight', `${ms}ms`);

    this._onViewChange?.({ ...view });
  }

  _handleClick(event) {
    const control = event.target.closest('[data-action], .locator-map__marker');

    if (!control) {
      return;
    }

    const actions = {
      'zoom-in': () => this.zoomBy(ZOOM_STEP),
      'zoom-out': () => this.zoomBy(1 / ZOOM_STEP),
      reset: () => this._onSelect?.(-1),
    };

    if (control.dataset.action) {
      actions[control.dataset.action]?.();
      return;
    }

    this._onSelect?.(Number.parseInt(control.dataset.index, 10));
  }

  _handleKeyDown(event) {
    // Less the closer you are, so one press covers about the same amount of what you can see
    // whatever the zoom.
    const step = 0.12 / this._view.k;
    const moves = {
      ArrowLeft: () => ({ ...this._view, x: this._view.x + step }),
      ArrowRight: () => ({ ...this._view, x: this._view.x - step }),
      ArrowUp: () => ({ ...this._view, y: this._view.y + step }),
      ArrowDown: () => ({ ...this._view, y: this._view.y - step }),
      '+': () => zoomAbout({ view: this._view, factor: ZOOM_STEP }),
      '=': () => zoomAbout({ view: this._view, factor: ZOOM_STEP }),
      '-': () => zoomAbout({ view: this._view, factor: 1 / ZOOM_STEP }),
    };

    if (event.key === '0') {
      event.preventDefault();
      this._onSelect?.(-1);
      return;
    }

    const move = moves[event.key];

    if (!move) {
      return;
    }

    // Cancelled, or the frame scrolls the page as well as panning the map.
    event.preventDefault();
    this._apply(move());
  }

  _handlePointerDown(event) {
    if (event.button !== 0 || event.target.closest('button')) {
      return;
    }

    this._dragging = true;
    this._from = { x: event.clientX, y: event.clientY, view: { ...this._view } };
    this._frame.toggleAttribute('data-dragging', true);

    // Capture is worth having and not worth failing over: it throws for a pointer id the
    // browser has no record of, and an exception here would leave the drag half started with
    // no listeners and no way back.
    try {
      this._frame.setPointerCapture?.(event.pointerId);
    } catch {
      // The drag still works without it; only tracking outside the frame is lost.
    }

    this._frame.addEventListener('pointermove', this._handlePointerMove);
    this._frame.addEventListener('pointerup', this._handlePointerUp);
    this._frame.addEventListener('pointercancel', this._handlePointerUp);
  }

  _handlePointerMove(event) {
    if (!this._dragging) {
      return;
    }

    const rect = this._frame.getBoundingClientRect();

    this._apply(
      {
        x: this._from.view.x + (event.clientX - this._from.x) / rect.width,
        y: this._from.view.y + (event.clientY - this._from.y) / rect.height,
        k: this._from.view.k,
      },
      { duration: 0 },
    );
  }

  _handlePointerUp() {
    this._dragging = false;
    this._frame.removeAttribute('data-dragging');
    this._frame.removeEventListener('pointermove', this._handlePointerMove);
    this._frame.removeEventListener('pointerup', this._handlePointerUp);
    this._frame.removeEventListener('pointercancel', this._handlePointerUp);
  }
}

/**
 * A list of places, a search over them, and a map that goes to whichever one is chosen.
 *
 * The markup the author writes is a list of addresses, and that is what anyone sees if the
 * script never arrives — a working directory rather than an empty grey box.
 *
 * **The map is not part of this element.** It owns the search, the ranking, the directory,
 * the announcements and the decision to go somewhere; the surface that moves is an adapter it
 * is given. The one that ships draws a country and fetches nothing, which is what keeps every
 * variant offline and the packaged download working on a train. A consumer who wants a real
 * provider's map supplies an adapter that drives it, and everything else stays as it is.
 */
export class UiLocatorMap extends HTMLElement {
  static get observedAttributes() {
    return [
      'zoom',
      'min-zoom',
      'max-zoom',
      'focus-zoom',
      'region',
      'no-search',
      'no-directions',
      'no-groups',
    ];
  }

  constructor() {
    super();
    this._connected = false;
    this._labelOverrides = {};
    this._places = [];
    this._results = [];
    this._active = -1;
    this._selected = -1;

    this._handleInput = this._handleInput.bind(this);
    this._handleSearchKeyDown = this._handleSearchKeyDown.bind(this);
    this._handleListClick = this._handleListClick.bind(this);
    this._handleBlur = this._handleBlur.bind(this);
    this._handleDirectoryClick = this._handleDirectoryClick.bind(this);
    this._handleClear = this._handleClear.bind(this);
    this._handleAdapterSelect = this._handleAdapterSelect.bind(this);
    this._handleAdapterView = this._handleAdapterView.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this._read();
    this._build();

    if (!this._adapter) {
      this.adapter = new DrawingMap({ minZoom: this.minZoom, maxZoom: this.maxZoom });
    }

    this._render();
  }

  disconnectedCallback() {
    this._adapter?.destroy?.();
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._connected || oldValue === newValue) {
      return;
    }

    this._read();
    this._render();
  }

  /**
   * The surface that moves.
   *
   * Set it before the element connects, or afterwards to swap one out: the old one is torn
   * down and the new one mounted into the same frame, which is what makes it possible to
   * start with the drawing and hand over to a provider's map once its script has loaded.
   */
  get adapter() {
    return this._adapter;
  }

  set adapter(next) {
    if (!next || next === this._adapter) {
      return;
    }

    // Whatever a helper said about the last surface is no longer about the surface that is
    // there. `attachRealMap` writes its mark after assigning, so its own answer survives;
    // a page swapping in a surface of its own clears the claim rather than inheriting it.
    this.removeAttribute('data-map-provider');
    this.removeAttribute('data-map-unavailable');

    this._adapter?.destroy?.();
    this._adapter = next;

    if (this._frame) {
      next.mount?.(this._frame, {
        onSelect: this._handleAdapterSelect,
        onViewChange: this._handleAdapterView,
        labels: this.labels,
      });
      this._render();
    }
  }

  get places() {
    return this._places.map((place) => ({ ...place }));
  }

  get visible() {
    // Compared without case, so `region="south"` still finds places written `South`. Making
    // the author match their own spelling exactly buys nothing and costs an afternoon.
    const wanted = (this.getAttribute('region') ?? '').trim().toLowerCase();
    return this._places.filter(
      (place) => !wanted || place.region.trim().toLowerCase() === wanted,
    );
  }

  get selected() {
    return this._selected;
  }

  /** Whatever the adapter reports; the drawing reports `{ x, y, k }`. */
  get view() {
    return this._adapter?.view;
  }

  get minZoom() {
    const parsed = Number.parseFloat(this.getAttribute('min-zoom') ?? '');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : MIN_SCALE;
  }

  get maxZoom() {
    const parsed = Number.parseFloat(this.getAttribute('max-zoom') ?? '');
    return Number.isFinite(parsed) && parsed > this.minZoom ? parsed : MAX_SCALE;
  }

  get focusZoom() {
    const parsed = Number.parseFloat(this.getAttribute('focus-zoom') ?? '');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 4.5;
  }

  get labels() {
    return { ...DEFAULT_LABELS, ...this._labelOverrides };
  }

  set labels(value) {
    this._labelOverrides = value && typeof value === 'object' ? { ...value } : {};
    this._render();
  }

  /**
   * Reads the offices out of the markup.
   *
   * The list is the source and the fallback at once, so nothing here removes it or rewrites
   * what it says — the only change is that each name becomes a button, which is what makes
   * the directory work as well as the map.
   */
  _read() {
    this._list = this.querySelector('.locator-map__places');

    // The group headings this element inserts are list items too. Without excluding them,
    // every re-read after the first render counts them as offices — three extra places with
    // no coordinates, and markers that never appear because the projection rejects them.
    const entries = this._list
      ? [...this._list.querySelectorAll(':scope > li:not(.locator-map__group)')]
      : [];

    this._places = entries.map((entry, index) => {
      const heading = entry.querySelector('h1, h2, h3, h4, h5, h6');
      const detail = entry.querySelector('p');

      if (heading && !heading.querySelector('.locator-map__entry')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'locator-map__entry';
        button.dataset.index = String(index);
        button.append(...heading.childNodes);
        heading.append(button);
      }

      this._ensureDirections(entry, heading);

      return {
        index,
        name: heading?.textContent.trim() ?? '',
        address: detail?.textContent.trim() ?? '',
        region: entry.dataset.region ?? '',
        lat: Number.parseFloat(entry.dataset.lat ?? ''),
        lon: Number.parseFloat(entry.dataset.lon ?? ''),
        entry,
      };
    });
  }

  /**
   * Puts a directions link on an office, or takes one away.
   *
   * A plain anchor to Google's directions: no key, no billing, no script, and no request at
   * all until it is pressed — which is why the one genuinely useful piece of a map provider
   * can live inside a component that is checked for reaching nowhere.
   *
   * Every one of them is named for its office. Nine links all called "Directions" are nine
   * links nobody can tell apart, which is exactly how a screen reader lists them.
   */
  _ensureDirections(entry, heading) {
    const existing = entry.querySelector(':scope > .locator-map__directions');

    if (this.hasAttribute('no-directions')) {
      existing?.remove();
      return;
    }

    const href = directionsUrl({
      lat: Number.parseFloat(entry.dataset.lat ?? ''),
      lon: Number.parseFloat(entry.dataset.lon ?? ''),
    });

    // A place with no usable coordinates gets no link, rather than one to the middle of the
    // ocean.
    if (!href) {
      existing?.remove();
      return;
    }

    const labels = this.labels;
    const link = existing ?? document.createElement('a');

    link.className = 'locator-map__directions';
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = labels.directions;
    link.setAttribute(
      'aria-label',
      fillLabel(labels.directionsTo, { name: heading?.textContent.trim() ?? '' }),
    );

    if (!existing) {
      entry.append(link);
    }
  }

  /**
   * The heading level for a group, one above whatever the offices use.
   *
   * Inferred rather than fixed: the author chose the level their offices sit at, and a group
   * that sits above them has to be a level above them or the outline of the page is a lie.
   */
  _groupLevel() {
    const heading = this._places[0]?.entry.querySelector('h1, h2, h3, h4, h5, h6');
    const level = Number.parseInt(heading?.tagName.slice(1) ?? '3', 10);

    return Math.min(Math.max((Number.isFinite(level) ? level : 3) - 1, 2), 6);
  }

  /**
   * Puts a heading above each run of offices in the same region.
   *
   * The list is moved into group order rather than left interleaved, because a directory that
   * lists the same region twice under two headings reads as a mistake. Places keep the order
   * they were written in inside their own group.
   */
  _renderGroups(visible) {
    this._list?.querySelectorAll(':scope > .locator-map__group').forEach((row) => row.remove());

    if (!this._list || this.hasAttribute('no-groups') || visible.length === 0) {
      return;
    }

    const groups = groupPlaces(visible);
    const labels = this.labels;
    const level = this._groupLevel();

    groups.forEach((group) => {
      group.places.forEach((place) => this._list.append(place.entry));

      // A group with no region name gets its offices and no heading, rather than a heading
      // that says nothing.
      if (!group.region) {
        return;
      }

      const row = document.createElement('li');
      row.className = 'locator-map__group';

      const name = document.createElement(`h${level}`);
      name.className = 'locator-map__group-name';
      name.textContent = fillLabel(labels.group, { region: group.region });

      const count = document.createElement('span');
      count.className = 'locator-map__group-count';
      count.textContent = fillLabel(labels.groupCount, { count: group.count });

      row.append(name, count);
      this._list.insertBefore(row, group.places[0].entry);
    });
  }

  _build() {
    if (this._frame) {
      return;
    }

    const labels = this.labels;

    this._search = document.createElement('div');
    this._search.className = 'locator-map__search';

    this._input = document.createElement('input');
    this._input.type = 'text';
    this._input.className = 'locator-map__input';
    this._input.id = uniqueId('locator-input');
    this._input.autocomplete = 'off';
    this._input.spellcheck = false;
    this._input.placeholder = labels.search;
    this._input.setAttribute('role', 'combobox');
    this._input.setAttribute('aria-expanded', 'false');
    this._input.setAttribute('aria-autocomplete', 'list');
    this._input.setAttribute('aria-label', labels.search);

    this._listbox = document.createElement('ul');
    this._listbox.className = 'locator-map__results';
    this._listbox.id = uniqueId('locator-results');
    this._listbox.setAttribute('role', 'listbox');
    this._listbox.hidden = true;
    this._input.setAttribute('aria-controls', this._listbox.id);

    this._clear = document.createElement('button');
    this._clear.type = 'button';
    this._clear.className = 'locator-map__clear';
    this._clear.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS.clear}"></path></svg>`;
    this._clear.setAttribute('aria-label', labels.clear);
    this._clear.hidden = true;

    this._search.append(this._input, this._clear, this._listbox);

    // The frame is the element's, not the adapter's: it is what carries the tab stop, the
    // size and the clipping, and swapping the surface inside it must not disturb any of that.
    this._frame = document.createElement('div');
    this._frame.className = 'locator-map__frame';
    this._frame.tabIndex = 0;
    this._frame.setAttribute('role', 'group');
    this._frame.setAttribute('aria-label', labels.search);

    // Present and empty before there is anything to say. A region written into the page at
    // the moment it gains text is a region nothing announces.
    this._status = document.createElement('span');
    this._status.className = 'locator-map__sr-only';
    this._status.setAttribute('role', 'status');

    this.prepend(this._search, this._frame);
    this.append(this._status);

    this._input.addEventListener('input', this._handleInput);
    this._input.addEventListener('keydown', this._handleSearchKeyDown);
    this._input.addEventListener('focus', this._handleInput);
    this._listbox.addEventListener('mousedown', this._handleListClick);
    this._clear.addEventListener('click', this._handleClear);
    this.addEventListener('focusout', this._handleBlur);
    this.addEventListener('click', this._handleDirectoryClick);
  }

  _render() {
    const visible = this.visible;

    this._search.hidden = this.hasAttribute('no-search');
    this.toggleAttribute('data-empty', visible.length === 0);

    this._adapter?.update?.({ places: visible, selected: this._selected });

    this._places.forEach((place) => {
      const shown = visible.includes(place);
      place.entry.toggleAttribute('hidden', !shown);
      place.entry
        .querySelector('.locator-map__entry')
        ?.toggleAttribute('data-selected', place.index === this._selected);
    });

    this._renderGroups(visible);
  }

  /** Flies to an office and marks it. */
  flyTo(index) {
    const place = this._places[index];

    if (!place || !this.visible.includes(place)) {
      return false;
    }

    this._selected = index;
    this._adapter?.flyTo?.(place, { zoom: this.focusZoom, reduced: prefersReducedMotion() });
    this._render();

    this._status.textContent = fillLabel(this.labels.selected, {
      name: place.name,
      address: place.address,
    });

    this.dispatchEvent(
      new CustomEvent('locator-select', {
        detail: { index, name: place.name, address: place.address, region: place.region },
        bubbles: true,
        composed: true,
      }),
    );

    return true;
  }

  reset() {
    this._selected = -1;
    this._adapter?.reset?.({ reduced: prefersReducedMotion() });
    this._render();
  }

  zoomIn() {
    this._adapter?.zoomBy?.(ZOOM_STEP);
  }

  zoomOut() {
    this._adapter?.zoomBy?.(1 / ZOOM_STEP);
  }

  _handleAdapterSelect(index) {
    if (index < 0) {
      this.reset();
      return;
    }

    this.flyTo(index);
  }

  _handleAdapterView(view) {
    this.dispatchEvent(
      new CustomEvent('locator-view-change', {
        detail: { view },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /* ---- The search ------------------------------------------------------------------- */

  _handleInput() {
    const query = this._input.value;
    this._results = matchPlaces(query, this.visible);
    this._active = this._results.length > 0 ? 0 : -1;
    this._clear.hidden = query.length === 0;
    this._renderResults(query);
  }

  _renderResults(query) {
    const labels = this.labels;
    const open = document.activeElement === this._input;

    this._listbox.replaceChildren(
      ...this._results.map(({ place }, position) => {
        const option = document.createElement('li');
        option.id = uniqueId('locator-option');
        option.className = 'locator-map__result';
        option.dataset.index = String(place.index);
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(position === this._active));
        option.toggleAttribute('data-active', position === this._active);

        const name = document.createElement('span');
        name.className = 'locator-map__result-name';
        // Marked on the folded text and cut from the original, so an office found by typing
        // "da nang" is still shown written the way it is written.
        highlightSegments(place.name, query).forEach((segment) => {
          const part = segment.match ? document.createElement('mark') : document.createElement('span');
          part.textContent = segment.text;
          name.append(part);
        });

        const address = document.createElement('span');
        address.className = 'locator-map__result-address';
        address.textContent = place.address;

        option.append(name, address);
        return option;
      }),
    );

    if (this._results.length === 0 && query) {
      const empty = document.createElement('li');
      empty.className = 'locator-map__result locator-map__result--empty';
      empty.textContent = fillLabel(labels.empty, { query });
      this._listbox.append(empty);
    }

    const showing = open && (this._results.length > 0 || query.length > 0);
    this._listbox.hidden = !showing;
    this._input.setAttribute('aria-expanded', String(showing));
    this._syncActive();

    this._status.textContent = fillLabel(labels.results, {
      count: this._results.length,
      total: this.visible.length,
    });
  }

  _syncActive() {
    const options = [...this._listbox.querySelectorAll('[role="option"]')];

    options.forEach((option, position) => {
      const active = position === this._active;
      option.setAttribute('aria-selected', String(active));
      option.toggleAttribute('data-active', active);
    });

    const current = options[this._active];

    if (current) {
      this._input.setAttribute('aria-activedescendant', current.id);
      current.scrollIntoView({ block: 'nearest' });
    } else {
      this._input.removeAttribute('aria-activedescendant');
    }
  }

  _handleSearchKeyDown(event) {
    const moves = {
      ArrowDown: () => this._move(1),
      ArrowUp: () => this._move(-1),
      Home: () => this._move(-this._results.length),
      End: () => this._move(this._results.length),
    };

    if (moves[event.key]) {
      event.preventDefault();
      moves[event.key]();
      return;
    }

    if (event.key === 'Enter' && this._results[this._active]) {
      event.preventDefault();
      this._choose(this._results[this._active].place.index);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this._closeResults();
    }
  }

  _move(delta) {
    if (this._results.length === 0) {
      return;
    }

    const last = this._results.length - 1;
    this._active = Math.min(Math.max(this._active + delta, 0), last);
    this._syncActive();
  }

  _handleListClick(event) {
    const option = event.target.closest('[role="option"]');

    if (!option) {
      return;
    }

    // On `mousedown`, before the input loses focus: waiting for the click would let the blur
    // close the list out from under the press.
    event.preventDefault();
    this._choose(Number.parseInt(option.dataset.index, 10));
  }

  _choose(index) {
    const place = this._places[index];

    if (!place) {
      return;
    }

    this._input.value = place.name;
    this._clear.hidden = false;
    this._closeResults();
    this.flyTo(index);
  }

  _closeResults() {
    this._listbox.hidden = true;
    this._input.setAttribute('aria-expanded', 'false');
    this._input.removeAttribute('aria-activedescendant');
  }

  _handleBlur(event) {
    if (!this.contains(event.relatedTarget)) {
      this._closeResults();
    }
  }

  _handleClear() {
    this._input.value = '';
    this._clear.hidden = true;
    this._input.focus();
    this._handleInput();
  }

  _handleDirectoryClick(event) {
    const entry = event.target.closest('.locator-map__entry');

    if (entry && this.contains(entry)) {
      this.flyTo(Number.parseInt(entry.dataset.index, 10));
    }
  }
}

if (!customElements.get('ui-locator-map')) {
  customElements.define('ui-locator-map', UiLocatorMap);
}
