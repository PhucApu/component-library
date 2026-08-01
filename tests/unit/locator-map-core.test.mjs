import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAP_BOUNDS,
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
  normalise,
  project,
  viewFor,
  zoomAbout,
} from '../../components/locator-map/source/locator-map-core.js';

// Spelled as escaped code points on purpose. This repository keeps its own text unaccented
// and a check enforces it, so the only way to test the folding is to write the marked
// letters as escapes — which is also the clearest way to say exactly which letters are meant.
const DA_NANG = '\u0110\u00e0 N\u1eb5ng'; // D with stroke, a with grave, a with breve and tilde
const HUE = 'Hu\u1ebf'; // e with circumflex and acute
const HANOI = 'H\u00e0 N\u1ed9i'; // a with grave, o with circumflex and dot below
const D_STROKE = '\u0111';
const D_STROKE_CAPITAL = '\u0110';

describe('project', () => {
  it('puts the corners of the map at the corners of the drawing', () => {
    const topLeft = project({ lat: MAP_BOUNDS.north, lon: MAP_BOUNDS.west });
    const bottomRight = project({ lat: MAP_BOUNDS.south, lon: MAP_BOUNDS.east });

    assert.ok(Math.abs(topLeft.x) < 0.001, `${topLeft.x}`);
    assert.ok(Math.abs(topLeft.y) < 0.001, `${topLeft.y}`);
    assert.ok(Math.abs(bottomRight.x - MAP_SIZE.width) < 0.001, `${bottomRight.x}`);
    assert.ok(Math.abs(bottomRight.y - MAP_SIZE.height) < 0.001, `${bottomRight.y}`);
  });

  it('places real cities where they belong relative to one another', () => {
    const hanoi = project({ lat: 21.0278, lon: 105.8342 });
    const daNang = project({ lat: 16.0544, lon: 108.2022 });
    const canTho = project({ lat: 10.0452, lon: 105.7469 });

    // Da Nang is south of Hanoi and further east; Can Tho is south of both and west again.
    assert.ok(daNang.y > hanoi.y);
    assert.ok(daNang.x > hanoi.x);
    assert.ok(canTho.y > daNang.y);
    assert.ok(canTho.x < daNang.x);
  });

  it('spaces latitudes the way Mercator does, not evenly', () => {
    // A degree of longitude is the same width everywhere; a degree of latitude is not, and
    // spacing them evenly would put every marker in the wrong place, worse further north.
    const near = project({ lat: 10, lon: 106 });
    const middle = project({ lat: 15, lon: 106 });
    const far = project({ lat: 20, lon: 106 });

    // Mercator stretches further from the equator, so the five degrees from 15 to 20 take up
    // more of the drawing than the five from 10 to 15. Evenly spaced they would be equal.
    const lower = near.y - middle.y;
    const upper = middle.y - far.y;

    assert.ok(upper > lower, `${upper} should exceed ${lower}`);
  });

  it('survives a map with no extent and coordinates that are not coordinates', () => {
    const flat = project(
      { lat: 10, lon: 106 },
      { bounds: { north: 10, south: 10, west: 106, east: 106 } },
    );
    assert.deepEqual(flat, { x: MAP_SIZE.width / 2, y: MAP_SIZE.height / 2 });
    assert.ok(Number.isFinite(project().x));
    assert.ok(Number.isFinite(project({ lat: 'abc', lon: null }).y));
  });
});

describe('viewFor', () => {
  it('puts the point in the middle of the frame', () => {
    const view = viewFor({ point: { x: MAP_SIZE.width / 2, y: MAP_SIZE.height / 2 }, scale: 1 });
    assert.deepEqual(view, { x: 0, y: 0, k: 1 });
  });

  it('measures in fractions of the frame, so a resize changes nothing', () => {
    const view = viewFor({ point: { x: 0, y: 0 }, scale: 4 });
    // The top-left corner of the map, put in the middle: the map moves half a frame right
    // and down whatever size the frame happens to be.
    assert.deepEqual(view, { x: 0.5, y: 0.5, k: 4 });
  });

  it('survives being handed nothing', () => {
    const view = viewFor();
    assert.ok(Number.isFinite(view.x) && Number.isFinite(view.y) && view.k > 0);
  });
});

describe('zoomAbout', () => {
  it('keeps whatever is under the point under it', () => {
    const view = { x: 0, y: 0, k: 1 };
    const focus = { x: 0.25, y: 0.75 };
    const next = zoomAbout({ view, factor: 3, focus });

    // The same fraction of the map has to end up at the same fraction of the frame.
    const before = (focus.x - view.x) / view.k;
    const after = (focus.x - next.x) / next.k;
    assert.ok(Math.abs(before - after) < 1e-9, `${before} vs ${after}`);
  });

  it('zooms about the middle when no point is given', () => {
    const next = zoomAbout({ view: { x: 0, y: 0, k: 1 }, factor: 2 });
    assert.deepEqual(next, { x: -0.5, y: -0.5, k: 2 });
  });

  it('survives nonsense', () => {
    const next = zoomAbout();
    assert.ok(Number.isFinite(next.x) && next.k > 0);
  });
});

describe('clampView', () => {
  it('centres the map when there is no room to move', () => {
    assert.deepEqual(clampView({ x: 4, y: -9, k: 1 }), { x: 0, y: 0, k: 1 });
  });

  it('stops the map being dragged off the frame', () => {
    // Scaled by 3 the map spans three frames, so its edge may sit between -2 and 0 and no
    // further; past that the frame shows sea where the country used to be.
    assert.deepEqual(clampView({ x: 5, y: 5, k: 3 }), { x: 0, y: 0, k: 3 });
    assert.deepEqual(clampView({ x: -9, y: -9, k: 3 }), { x: -2, y: -2, k: 3 });
    assert.deepEqual(clampView({ x: -1, y: -0.5, k: 3 }), { x: -1, y: -0.5, k: 3 });
  });

  it('holds the zoom range', () => {
    assert.equal(clampView({ x: 0, y: 0, k: 99 }).k, MAX_SCALE);
    assert.equal(clampView({ x: 0, y: 0, k: 0.01 }).k, MIN_SCALE);
    assert.equal(clampView({ x: 0, y: 0, k: 99 }, { max: 12 }).k, 12);
  });

  it('survives being handed nothing', () => {
    assert.deepEqual(clampView(), { x: 0, y: 0, k: 1 });
  });
});

describe('flightDuration', () => {
  it('takes longer the further the view travels', () => {
    const short = flightDuration({ x: 0, y: 0, k: 1 }, { x: -0.1, y: 0, k: 1 });
    const long = flightDuration({ x: 0, y: 0, k: 1 }, { x: -0.9, y: -0.9, k: 1 });

    assert.ok(long > short, `${long} should exceed ${short}`);
  });

  it('counts a change of zoom as distance', () => {
    // Zooming in on the spot is a journey even though nothing moved sideways.
    const still = flightDuration({ x: 0, y: 0, k: 1 }, { x: 0, y: 0, k: 1 });
    const closer = flightDuration({ x: 0, y: 0, k: 1 }, { x: 0, y: 0, k: 6 });

    assert.ok(closer > still);
  });

  it('refuses to be quicker than the floor or slower than the ceiling', () => {
    assert.equal(flightDuration({ x: 0, y: 0, k: 1 }, { x: 0, y: 0, k: 1 }), 260);
    assert.equal(flightDuration({ x: 0, y: 0, k: 1 }, { x: -40, y: -40, k: 8 }), 900);
  });

  it('survives being handed nothing', () => {
    assert.equal(flightDuration(), 260);
  });
});

describe('normalise', () => {
  it('takes the marks off so an unmarked search still finds it', () => {
    assert.equal(normalise(DA_NANG), 'da nang');
    assert.equal(normalise(HUE), 'hue');
    assert.equal(normalise(HANOI), 'ha noi');
  });

  it('handles the letter that normalising cannot take apart', () => {
    // A stroke drawn through the glyph is part of the letter, not a mark added to it, so no
    // amount of decomposing separates them. It is mapped by hand.
    assert.equal(normalise(D_STROKE), 'd');
    assert.equal(normalise(D_STROKE_CAPITAL), 'd');
  });

  it('tidies spacing and case', () => {
    assert.equal(normalise('  Da   NANG  '), 'da nang');
    assert.equal(normalise(undefined), '');
    assert.equal(normalise(null), '');
  });
});

describe('matchPlaces', () => {
  const places = [
    { name: 'Ha Noi head office', address: '72 Le Thanh Tong, Hoan Kiem', region: 'north' },
    { name: 'Hai Phong depot', address: '18 Dien Bien Phu, Hong Bang', region: 'north' },
    { name: 'Hue studio', address: '3 Le Loi, Vinh Ninh', region: 'central' },
    { name: 'Ho Chi Minh City office', address: '65 Le Loi, District 1', region: 'south' },
  ];

  it('returns everything when nothing was typed', () => {
    assert.equal(matchPlaces('', places).length, 4);
    assert.equal(matchPlaces(undefined, places).length, 4);
  });

  it('puts a name that starts with the query before one that only contains it', () => {
    const names = matchPlaces('ha', places).map((result) => result.place.name);
    assert.deepEqual(names, ['Ha Noi head office', 'Hai Phong depot']);
  });

  it('puts a match in the street last', () => {
    // Somebody typing two letters means the city, not an address that happens to hold them.
    const names = matchPlaces('loi', places).map((result) => result.place.name);
    assert.deepEqual(names, ['Hue studio', 'Ho Chi Minh City office']);
  });

  it('finds a marked name from an unmarked query', () => {
    const marked = [{ name: DA_NANG + ' office', address: '210 Bach Dang', region: 'central' }];
    assert.equal(matchPlaces('da nang', marked).length, 1);
    assert.equal(matchPlaces('nang', marked).length, 1);
  });

  it('says nothing rather than everything when nothing matches', () => {
    assert.deepEqual(matchPlaces('zzz', places), []);
  });

  it('survives being handed nothing', () => {
    assert.deepEqual(matchPlaces('ha'), []);
    assert.deepEqual(matchPlaces('ha', null), []);
  });
});

describe('highlightSegments', () => {
  it('cuts the matched part out of the original', () => {
    assert.deepEqual(highlightSegments('Hai Phong depot', 'phong'), [
      { text: 'Hai ', match: false },
      { text: 'Phong', match: true },
      { text: ' depot', match: false },
    ]);
  });

  it('gives the marks back, because it cuts the original and not the folded text', () => {
    // Matching "da nang" must still show the name written the way it is written.
    const segments = highlightSegments(DA_NANG + ' office', 'da nang');
    assert.equal(segments[0].text, DA_NANG);
    assert.equal(segments[0].match, true);
    assert.equal(segments[1].text, ' office');
  });

  it('leaves the text whole when there is nothing to mark', () => {
    assert.deepEqual(highlightSegments('Hue studio', ''), [{ text: 'Hue studio', match: false }]);
    assert.deepEqual(highlightSegments('Hue studio', 'zzz'), [
      { text: 'Hue studio', match: false },
    ]);
  });

  it('drops the empty ends rather than emitting them', () => {
    assert.deepEqual(highlightSegments('Hue', 'hue'), [{ text: 'Hue', match: true }]);
  });

  it('survives being handed nothing', () => {
    assert.deepEqual(highlightSegments(), [{ text: '', match: false }]);
  });
});

describe('directionsUrl', () => {
  it('points at the coordinates', () => {
    assert.equal(
      directionsUrl({ lat: 21.0278, lon: 105.8342 }),
      'https://www.google.com/maps/dir/?api=1&destination=21.0278%2C105.8342',
    );
  });

  it('says nothing rather than pointing at the ocean', () => {
    // A place with no usable coordinates gets no link at all, so the caller can leave it out.
    assert.equal(directionsUrl({ lat: Number.NaN, lon: 105 }), null);
    assert.equal(directionsUrl({ lat: 21, lon: undefined }), null);
    assert.equal(directionsUrl({}), null);
    assert.equal(directionsUrl(), null);
  });

  it('refuses coordinates that are not on the planet', () => {
    assert.equal(directionsUrl({ lat: 200, lon: 105 }), null);
    assert.equal(directionsUrl({ lat: 21, lon: -400 }), null);
  });

  it('takes another destination service', () => {
    assert.ok(
      directionsUrl({ lat: 21, lon: 105 }, { base: 'https://example.test/go/' }).startsWith(
        'https://example.test/go/?api=1',
      ),
    );
  });
});

describe('groupPlaces', () => {
  const places = [
    { name: 'A', region: 'north' },
    { name: 'B', region: 'south' },
    { name: 'C', region: 'north' },
    { name: 'D', region: 'central' },
  ];

  it('gathers a region together wherever its places were written', () => {
    assert.deepEqual(
      groupPlaces(places).map((group) => [group.region, group.count, group.places.map((p) => p.name)]),
      [
        ['north', 2, ['A', 'C']],
        ['south', 1, ['B']],
        ['central', 1, ['D']],
      ],
    );
  });

  it('keeps the order a region first appeared in', () => {
    // A directory that reshuffles itself between renders is a directory nobody can scan.
    assert.deepEqual(
      groupPlaces(places).map((group) => group.region),
      ['north', 'south', 'central'],
    );
  });

  it('puts places with no region in a group with no name', () => {
    const mixed = [{ name: 'A', region: 'north' }, { name: 'B' }, { name: 'C', region: '' }];
    const groups = groupPlaces(mixed);

    assert.equal(groups.length, 2);
    assert.equal(groups[1].region, '');
    assert.equal(groups[1].count, 2);
  });

  it('survives being handed nothing', () => {
    assert.deepEqual(groupPlaces(), []);
    assert.deepEqual(groupPlaces(null), []);
  });
});

describe('fillLabel', () => {
  it('puts the values into the label', () => {
    assert.equal(
      fillLabel('{name}, {address}', { name: 'Hue studio', address: '3 Le Loi' }),
      'Hue studio, 3 Le Loi',
    );
  });

  it('leaves nothing ragged when a value is missing', () => {
    assert.equal(fillLabel('{name}, {address}', { name: '', address: '3 Le Loi' }), ', 3 Le Loi');
    assert.equal(fillLabel(undefined, { name: 'x' }), '');
  });
});
