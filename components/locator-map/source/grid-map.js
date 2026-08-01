import { MAP_BOUNDS, MAP_SIZE, fillLabel, project } from './locator-map-core.js';

/**
 * A second map surface, written to prove the seam is real.
 *
 * It is deliberately plain — a grid with dots on it — because what is being shown is the
 * contract and not the artwork. Everything the component needs is here and nothing else:
 * seven members, no knowledge of the search, the directory, or how anything is announced.
 *
 * The same seven drive a real provider's map. What changes is the body of `flyTo`, which for
 * Google Maps is one line:
 *
 * ```js
 * flyTo(place, { zoom, reduced }) {
 *   this.map.panTo({ lat: place.lat, lng: place.lon });
 *   this.map.setZoom(zoom);
 * }
 * ```
 */
export class GridMap {
  constructor({ minZoom = 1, maxZoom = 6 } = {}) {
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this._view = { x: 0, y: 0, k: minZoom };
    this._handleClick = this._handleClick.bind(this);
  }

  get view() {
    return { ...this._view };
  }

  mount(frame, { onSelect, onViewChange, labels } = {}) {
    this._frame = frame;
    this._onSelect = onSelect;
    this._onViewChange = onViewChange;
    this._labels = labels;

    this._world = document.createElement('div');
    this._world.className = 'locator-map__world grid-map';
    this._world.innerHTML = `<div class="grid-map__paper" aria-hidden="true"></div>`;

    this._markers = document.createElement('div');
    this._markers.className = 'locator-map__markers';
    this._world.append(this._markers);

    frame.append(this._world);
    frame.addEventListener('click', this._handleClick);

    this._write(0);
  }

  destroy() {
    this._frame?.removeEventListener('click', this._handleClick);
    this._world?.remove();
    this._frame = null;
  }

  update({ places = [], selected = -1 } = {}) {
    const labels = this._labels ?? {};

    this._markers.replaceChildren(
      ...places.map((place) => {
        const point = project(place, { bounds: MAP_BOUNDS, size: MAP_SIZE });
        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = 'locator-map__marker';
        marker.dataset.index = String(place.index);
        marker.style.setProperty('--marker-x', `${(point.x / MAP_SIZE.width) * 100}%`);
        marker.style.setProperty('--marker-y', `${(point.y / MAP_SIZE.height) * 100}%`);
        marker.setAttribute(
          'aria-label',
          fillLabel(labels.marker ?? '{name}, {address}', {
            name: place.name,
            address: place.address,
          }),
        );
        marker.toggleAttribute('data-selected', place.index === selected);
        marker.innerHTML = '<span class="locator-map__pin" aria-hidden="true"></span>';
        return marker;
      }),
    );
  }

  flyTo(place, { zoom = 4, reduced = false } = {}) {
    const point = project(place, { bounds: MAP_BOUNDS, size: MAP_SIZE });
    const k = Math.min(Math.max(zoom, this.minZoom), this.maxZoom);

    this._view = {
      x: 0.5 - (point.x / MAP_SIZE.width) * k,
      y: 0.5 - (point.y / MAP_SIZE.height) * k,
      k,
    };

    this._write(reduced ? 0 : 520);
  }

  reset({ reduced = false } = {}) {
    this._view = { x: 0, y: 0, k: this.minZoom };
    this._write(reduced ? 0 : 520);
  }

  zoomBy(factor) {
    const k = Math.min(Math.max(this._view.k * factor, this.minZoom), this.maxZoom);
    this._view = { x: 0.5 - (0.5 - this._view.x) * (k / this._view.k), y: 0.5 - (0.5 - this._view.y) * (k / this._view.k), k };
    this._write(320);
  }

  _write(ms) {
    this._frame.style.setProperty('--map-x', String(this._view.x));
    this._frame.style.setProperty('--map-y', String(this._view.y));
    this._frame.style.setProperty('--map-k', String(this._view.k));
    this._frame.style.setProperty('--map-flight', `${ms}ms`);
    this._onViewChange?.({ ...this._view });
  }

  _handleClick(event) {
    const marker = event.target.closest('.locator-map__marker');

    if (marker) {
      this._onSelect?.(Number.parseInt(marker.dataset.index, 10));
    }
  }
}
