/**
 * Real map surfaces, and the one place they are configured.
 *
 * Every variant of this component uses one of these rather than the drawing that ships with
 * it. That is a deliberate choice with a price, and the price is worth writing down:
 *
 * - This component reaches the network. Every other component in this collection is checked
 *   for making no request at all, and its own check has been narrowed rather than deleted:
 *   the only origins it may reach are the ones named here.
 * - The packaged download needs a network. It cannot work on a train.
 * - Generating previews and running the tests both load a real map, so both are as reliable
 *   as somebody else's servers.
 *
 * The alternative is `DrawingMap`, which still ships and still works; set it as the adapter
 * and none of the above applies.
 */

/** `leaflet` or `google`. */
export const MAP_PROVIDER = 'leaflet';

/**
 * Google needs one of these, with a billing account behind it, restricted by HTTP referrer.
 * Leaflet needs nothing.
 *
 * Left empty on purpose: a key written into a repository is a key published. Paste yours here
 * on your own machine and do not commit it.
 */
export const GOOGLE_API_KEY = '';

const LEAFLET_VERSION = '1.9.4';

/** The only origins this component is allowed to reach, and the test checks exactly these. */
export const ALLOWED_ORIGINS = Object.freeze([
  'https://unpkg.com',
  'https://tile.openstreetmap.org',
  'https://maps.googleapis.com',
  'https://maps.gstatic.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
]);

/**
 * One request per URL, however many maps are on the page.
 *
 * The States variant has three of them, and each asks for the same provider. Sharing the
 * promise is not only about saving two requests: an element that arrives second must not be
 * left waiting on a `load` event that has already fired, and must not be left waiting for
 * ever on one that will never fire because the first request failed. A map that hangs reports
 * nothing at all, which is worse than a map that says the provider is down.
 *
 * A failure is forgotten rather than remembered, so pressing a button to try again is a real
 * attempt rather than the first refusal replayed.
 */
const inFlight = new Map();

function once(url, load) {
  if (!inFlight.has(url)) {
    inFlight.set(
      url,
      load().catch((error) => {
        inFlight.delete(url);
        throw error;
      }),
    );
  }

  return inFlight.get(url);
}

function loadStylesheet(href) {
  return once(href, () =>
    new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      link.onerror = () => {
        link.remove();
        reject(new Error(`Could not load ${href}`));
      };
      document.head.append(link);
    }));
}

function loadScript(src) {
  return once(src, () =>
    new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        reject(new Error(`Could not load ${src}`));
      };
      document.head.append(script);
    }));
}

/**
 * Leaflet behind the component's search.
 *
 * Seven members, the same seven the drawing implements. `flyTo` is one line, because Leaflet
 * already knows how to fly.
 */
export class LeafletMap {
  mount(frame, { onSelect } = {}) {
    this.onSelect = onSelect;

    this.surface = document.createElement('div');
    this.surface.className = 'locator-map__surface';
    frame.append(this.surface);

    this.map = L.map(this.surface).setView([16, 106], 5);

    L.tileLayer(`https://tile.openstreetmap.org/{z}/{x}/{y}.png`, {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.pins = L.layerGroup().addTo(this.map);
    this.bounds = [];
  }

  update({ places = [], selected = -1 } = {}) {
    this.pins.clearLayers();
    this.bounds = [];

    places.forEach((place) => {
      const position = [place.lat, place.lon];
      this.bounds.push(position);

      const chosen = place.index === selected;

      const pin = L.marker(position, {
        title: place.name,
        // The chosen one on top, so it is never buried under a neighbour.
        zIndexOffset: chosen ? 1000 : 0,
        // This component's own pin rather than Leaflet's blue image. It matches the drawing,
        // it marks the chosen office the same way, and it fetches neither icon nor shadow.
        icon: L.divIcon({
          className: 'locator-map__provider-pin',
          html: `<span class="locator-map__pin"${chosen ? ' data-selected' : ''}></span>`,
          iconSize: [20, 20],
          iconAnchor: [10, 18],
        }),
      });

      pin.on('click', () => this.onSelect?.(place.index));
      pin.addTo(this.pins);

      // Named for the office and its address, so it means something out of context. Leaflet
      // gives the icon a tab stop of its own; without a name it is a tab stop that announces
      // nothing at all.
      const element = pin.getElement();

      if (element) {
        element.setAttribute('role', 'button');
        element.setAttribute('aria-label', `${place.name}, ${place.address}`);
      }
    });
  }

  flyTo(place, { zoom = 14, reduced = false } = {}) {
    const position = [place.lat, place.lon];

    // Reduced motion is not a slower flight, it is no flight.
    if (reduced) {
      this.map.setView(position, zoom, { animate: false });
      return;
    }

    this.map.flyTo(position, zoom, { duration: 0.9 });
  }

  reset({ reduced = false } = {}) {
    if (this.bounds.length === 0) {
      return;
    }

    this.map.fitBounds(this.bounds, { padding: [32, 32], animate: !reduced });
  }

  zoomBy(factor) {
    this.map.setZoom(this.map.getZoom() + (factor > 1 ? 1 : -1));
  }

  get view() {
    const centre = this.map?.getCenter();
    return { lat: centre?.lat, lon: centre?.lng, zoom: this.map?.getZoom() };
  }

  destroy() {
    this.map?.remove();
    this.surface?.remove();
  }
}

/** Google Maps behind the same search. Identical shape; only the calls differ. */
export class GoogleMap {
  mount(frame, { onSelect } = {}) {
    this.onSelect = onSelect;
    this.pins = [];

    this.surface = document.createElement('div');
    this.surface.className = 'locator-map__surface';
    frame.append(this.surface);

    this.map = new google.maps.Map(this.surface, {
      center: { lat: 16, lng: 106 },
      zoom: 5,
    });
  }

  update({ places = [], selected = -1 } = {}) {
    this.pins.forEach((pin) => pin.setMap(null));

    this.pins = places.map((place) => {
      const pin = new google.maps.Marker({
        map: this.map,
        position: { lat: place.lat, lng: place.lon },
        title: place.name,
        zIndex: place.index === selected ? 1000 : 1,
      });

      pin.addListener('click', () => this.onSelect?.(place.index));
      return pin;
    });
  }

  flyTo(place, { zoom = 14 } = {}) {
    this.map.panTo({ lat: place.lat, lng: place.lon });
    this.map.setZoom(zoom);
  }

  reset() {
    if (this.pins.length === 0) {
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    this.pins.forEach((pin) => bounds.extend(pin.getPosition()));
    this.map.fitBounds(bounds);
  }

  zoomBy(factor) {
    this.map.setZoom(this.map.getZoom() + (factor > 1 ? 1 : -1));
  }

  get view() {
    const centre = this.map?.getCenter()?.toJSON();
    return { lat: centre?.lat, lon: centre?.lng, zoom: this.map?.getZoom() };
  }

  destroy() {
    this.pins.forEach((pin) => pin.setMap(null));
    this.surface?.remove();
  }
}

async function loadProvider() {
  if (MAP_PROVIDER === 'google') {
    if (!GOOGLE_API_KEY) {
      throw new Error('Google Maps needs an API key. Set GOOGLE_API_KEY in source/real-map.js');
    }

    await loadScript(
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_API_KEY)}`,
    );

    return new GoogleMap();
  }

  await loadStylesheet(`https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`);
  await loadScript(`https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`);

  return new LeafletMap();
}

/**
 * Puts a real map behind a locator.
 *
 * If the provider cannot be loaded — no network, no key, a bad day at somebody else's data
 * centre — the drawing that the element already mounted stays where it is and the search goes
 * on working. A map component that shows nothing at all when a third party is down is a map
 * component that has traded away the only thing it could guarantee.
 */
export async function attachRealMap(element, { onError } = {}) {
  try {
    element.adapter = await loadProvider();
    // Marked either way, and never left unmarked. Removing an attribute that was never there
    // changes nothing a page can observe, so success alone would be silent — and a page that
    // wants to say which surface it ended up with would have nothing to watch.
    element.setAttribute('data-map-provider', MAP_PROVIDER);
    element.removeAttribute('data-map-unavailable');
    return true;
  } catch (error) {
    element.removeAttribute('data-map-provider');
    element.setAttribute('data-map-unavailable', '');
    onError?.(error);
    return false;
  }
}
