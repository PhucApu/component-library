/**
 * The rules the locator map decides by, kept away from the DOM so they can be read and
 * tested without a browser.
 *
 * The projection here is real Web Mercator, the same one every tile provider uses. The
 * drawing behind it is a simplified silhouette rather than a survey, but the arithmetic that
 * places a marker is not simplified, so swapping the drawing for real tiles later would not
 * move a single pin.
 */

/** The corner of the world the map is cut from. */
export const MAP_BOUNDS = Object.freeze({
  north: 23.5,
  south: 8.4,
  west: 102,
  east: 109.6,
});

/** The drawing's own coordinate space, and therefore the space markers are placed in. */
export const MAP_SIZE = Object.freeze({ width: 400, height: 720 });

export const MIN_SCALE = 1;
export const MAX_SCALE = 8;

export const MIN_FLIGHT = 260;
export const MAX_FLIGHT = 900;

/** Beyond this latitude Mercator runs to infinity, so it is where the projection stops. */
const MERCATOR_LIMIT = 85.05112878;

export const DEFAULT_LABELS = Object.freeze({
  search: 'Search offices',
  clear: 'Clear the search',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  reset: 'Show the whole country',
  empty: 'No office matches {query}',
  none: 'No offices to show',
  marker: '{name}, {address}',
  selected: '{name}. {address}',
  results: '{count} of {total} offices',
  directions: 'Directions',
  // Nine links all called "Directions" are nine links nobody can tell apart out of context,
  // which is exactly how a screen reader lists them.
  directionsTo: 'Directions to {name}',
  group: '{region}',
  groupCount: '{count}',
});

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function number(value, fallback) {
  return finite(typeof value === 'string' ? Number.parseFloat(value) : value, fallback);
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

function mercatorX(lon) {
  return (number(lon, 0) + 180) / 360;
}

function mercatorY(lat) {
  const rad = (clamp(number(lat, 0), -MERCATOR_LIMIT, MERCATOR_LIMIT) * Math.PI) / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
}

/**
 * Where a latitude and longitude land in the drawing.
 *
 * A degree of longitude is the same width everywhere; a degree of latitude is not, which is
 * the whole reason a projection exists. Spacing the markers evenly by latitude would put
 * every one of them in the wrong place, and worse the further from the equator.
 */
export function project({ lat, lon } = {}, { bounds = MAP_BOUNDS, size = MAP_SIZE } = {}) {
  const left = mercatorX(bounds?.west);
  const right = mercatorX(bounds?.east);
  const top = mercatorY(bounds?.north);
  const bottom = mercatorY(bounds?.south);
  const width = Math.max(1, number(size?.width, MAP_SIZE.width));
  const height = Math.max(1, number(size?.height, MAP_SIZE.height));

  // A map with no extent has no inside, so everything is at the middle of it.
  const across = right - left;
  const down = bottom - top;

  return {
    x: across === 0 ? width / 2 : ((mercatorX(lon) - left) / across) * width,
    y: down === 0 ? height / 2 : ((mercatorY(lat) - top) / down) * height,
  };
}

/**
 * The view that puts a point in the middle of the frame.
 *
 * Everything is a fraction of the frame rather than a pixel, so nothing has to be recomputed
 * when the map is resized: the same three numbers describe the same view at any size.
 */
export function viewFor({ point, scale, size = MAP_SIZE } = {}) {
  const k = Math.max(0.0001, number(scale, 1));
  const width = Math.max(1, number(size?.width, MAP_SIZE.width));
  const height = Math.max(1, number(size?.height, MAP_SIZE.height));

  return {
    x: 0.5 - (number(point?.x, 0) / width) * k,
    y: 0.5 - (number(point?.y, 0) / height) * k,
    k,
  };
}

/**
 * Zooms about a point of the frame, keeping whatever is under that point under it.
 *
 * Zooming about the middle is the easy version and the wrong one whenever the pointer is
 * somewhere else: the office somebody is aiming at slides away from them exactly as they try
 * to get closer to it. `focus` is a fraction of the frame, so the middle is `0.5, 0.5`.
 */
export function zoomAbout({ view, factor, focus } = {}) {
  const k = Math.max(0.0001, number(view?.k, 1));
  const next = k * Math.max(0.0001, number(factor, 1));
  const fx = number(focus?.x, 0.5);
  const fy = number(focus?.y, 0.5);

  return {
    x: fx - ((fx - number(view?.x, 0)) / k) * next,
    y: fy - ((fy - number(view?.y, 0)) / k) * next,
    k: next,
  };
}

/**
 * Keeps the map covering the frame.
 *
 * Scaled by `k` the map spans `k` frames, so its left edge may sit anywhere from `1 - k` to
 * `0` and no further; past that the frame shows nothing where the country used to be. At
 * life size or smaller there is no room to move at all, so it is centred instead of clamped
 * to a corner.
 */
export function clampView({ x, y, k } = {}, { min = MIN_SCALE, max = MAX_SCALE } = {}) {
  const low = Math.max(0.0001, number(min, MIN_SCALE));
  const high = Math.max(low, number(max, MAX_SCALE));
  const scale = clamp(number(k, 1), low, high);
  const hold = (value) =>
    scale <= 1 ? (1 - scale) / 2 : clamp(number(value, 0), 1 - scale, 0);

  return { x: hold(x), y: hold(y), k: scale };
}

/**
 * How long a flight should take.
 *
 * Proportional to how far the view actually travels, floored so a hop between two neighbours
 * is not sluggish and capped so crossing the country does not feel broken. The scale change
 * counts as distance too: zooming in on the spot is a journey even though nothing moved
 * sideways.
 */
export function flightDuration(from, to, { min = MIN_FLIGHT, max = MAX_FLIGHT } = {}) {
  const dx = number(to?.x, 0) - number(from?.x, 0);
  const dy = number(to?.y, 0) - number(from?.y, 0);
  const dk = Math.abs(number(to?.k, 1) - number(from?.k, 1)) / Math.max(1, number(to?.k, 1));
  const travelled = Math.hypot(dx, dy) + dk;
  const low = Math.max(0, number(min, MIN_FLIGHT));
  const high = Math.max(low, number(max, MAX_FLIGHT));

  return Math.round(clamp(low + travelled * (high - low), low, high));
}

const COMBINING_MARKS = /[̀-ͯ]/g;

// Normalising to NFD separates a combining mark from its letter, which takes care of every
// tone and vowel mark. It does nothing for a stroke drawn through the glyph, because that is
// part of the letter itself — so Vietnamese `d with stroke` survives every fold and has to
// be mapped by hand. Listed by code point to keep this source unaccented.
const STROKED_LETTERS = new Map([
  [0x0111, 'd'], // small d with stroke
  [0x0110, 'd'], // capital D with stroke
]);

/**
 * The form two pieces of text are compared in.
 *
 * Somebody looking for an office in Da Nang types "da nang", and every letter of that is
 * different from the letters on the page.
 */
function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .split('')
    .map((character) => STROKED_LETTERS.get(character.codePointAt(0)) ?? character)
    .join('')
    .toLowerCase();
}

export function normalise(text) {
  return fold(text).replace(/\s+/g, ' ').trim();
}

/**
 * The offices that match, best first.
 *
 * A name that starts with what was typed beats one that merely contains it, and both beat a
 * match found only in the address: somebody typing "ha" means Hanoi, not the office on Ha Ba
 * Trung street in another city.
 */
export function matchPlaces(query, places = []) {
  const list = Array.isArray(places) ? places : [];
  const needle = normalise(query);

  if (!needle) {
    return list.map((place, index) => ({ place, index, rank: 0 }));
  }

  return list
    .map((place, index) => {
      const name = normalise(place?.name);
      const address = normalise(place?.address);
      const region = normalise(place?.region);

      if (name.startsWith(needle)) {
        return { place, index, rank: 0 };
      }

      if (name.includes(needle)) {
        return { place, index, rank: 1 };
      }

      if (address.includes(needle) || region.includes(needle)) {
        return { place, index, rank: 2 };
      }

      return null;
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank || a.index - b.index);
}

/**
 * The text broken into the part that matched and the parts that did not.
 *
 * Found on the folded text and cut from the original, so the marks come back: matching "da
 * nang" must still show "Da Nang" with everything it was written with.
 */
export function highlightSegments(text, query) {
  const original = String(text ?? '');
  const needle = fold(query).trim();

  if (!needle) {
    return [{ text: original, match: false }];
  }

  // `fold` rather than `normalise`: collapsing runs of spaces and trimming both change how
  // many characters there are, and every offset after the change would point at the wrong
  // letter. Folding alone swaps one character for one — a combining mark is removed with the
  // letter it sat on, a stroked letter is replaced — so an offset in the folded text is the
  // same offset in the original.
  const folded = fold(original);

  // Unless something exotic broke that promise, in which case the honest answer is not to
  // cut the string at all rather than to cut it in the wrong place.
  if (folded.length !== original.length) {
    return [{ text: original, match: false }];
  }

  const at = folded.indexOf(needle);

  if (at < 0) {
    return [{ text: original, match: false }];
  }

  return [
    { text: original.slice(0, at), match: false },
    { text: original.slice(at, at + needle.length), match: true },
    { text: original.slice(at + needle.length), match: false },
  ].filter((segment) => segment.text.length > 0);
}

/**
 * Where to send somebody who wants to be told how to get there.
 *
 * A plain link to Google's directions, which is the one piece of a real map provider that
 * costs nothing to use: no key, no billing, no script, and no request at all until it is
 * pressed. That is why it can live inside a component that is checked for reaching nowhere.
 *
 * Returns `null` for a place with no usable coordinates rather than a link to the middle of
 * the ocean, so the caller can leave it out.
 */
export function directionsUrl(place, { base = 'https://www.google.com/maps/dir/' } = {}) {
  const lat = number(place?.lat, Number.NaN);
  const lon = number(place?.lon, Number.NaN);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }

  return `${base}?api=1&destination=${encodeURIComponent(`${lat},${lon}`)}`;
}

/**
 * The places gathered under the region each belongs to.
 *
 * Groups keep the order their region first appears in, and places keep the order they were
 * written in, so a directory never reshuffles itself between renders. A place with no region
 * falls into a group of its own with an empty name, which the caller can render without a
 * heading rather than inventing one.
 */
export function groupPlaces(places = []) {
  const list = Array.isArray(places) ? places : [];
  const groups = new Map();

  list.forEach((place) => {
    const region = String(place?.region ?? '').trim();

    if (!groups.has(region)) {
      groups.set(region, []);
    }

    groups.get(region).push(place);
  });

  return [...groups.entries()].map(([region, members]) => ({
    region,
    places: members,
    count: members.length,
  }));
}

export function fillLabel(template, values = {}) {
  return Object.entries(values)
    .reduce(
      (text, [key, value]) => text.replaceAll(`{${key}}`, String(value ?? '')),
      typeof template === 'string' ? template : '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}
