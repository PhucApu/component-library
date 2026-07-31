import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_ZOOM,
  MIN_ZOOM,
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
} from '../../components/lightbox/source/lightbox-core.js';

describe('clampZoom', () => {
  it('keeps a usable magnification', () => {
    assert.equal(clampZoom(1.5), 1.5);
    assert.equal(clampZoom(MIN_ZOOM), MIN_ZOOM);
    assert.equal(clampZoom(MAX_ZOOM), MAX_ZOOM);
    assert.equal(clampZoom(3.75), 3.75);
    // Life size to four times it, which is what the field offers.
    assert.deepEqual([MIN_ZOOM, MAX_ZOOM], [1, 4]);
  });

  it('refuses to shrink below life size or grow past the limit', () => {
    assert.equal(clampZoom(0.2), MIN_ZOOM);
    assert.equal(clampZoom(40), MAX_ZOOM);
    assert.equal(clampZoom(40, { max: 8 }), 8);
  });

  it('survives values that are not magnifications', () => {
    assert.equal(clampZoom(Number.NaN), MIN_ZOOM);
    assert.equal(clampZoom(undefined), MIN_ZOOM);
  });
});

describe('nextIndex', () => {
  it('steps through the set', () => {
    assert.equal(nextIndex(0, 5, 1), 1);
    assert.equal(nextIndex(4, 5, -1), 3);
  });

  it('stops at the ends, so an end is a real end', () => {
    assert.equal(nextIndex(0, 5, -1), 0);
    assert.equal(nextIndex(4, 5, 1), 4);
  });

  it('joins the ends when asked to loop', () => {
    assert.equal(nextIndex(0, 5, -1, { loop: true }), 4);
    assert.equal(nextIndex(4, 5, 1, { loop: true }), 0);
    assert.equal(nextIndex(0, 5, -7, { loop: true }), 3);
  });

  it('has nothing to step through in an empty set', () => {
    assert.equal(nextIndex(0, 0, 1), -1);
    assert.equal(nextIndex(), -1);
  });
});

describe('zoomAt', () => {
  it('leaves the middle alone when magnifying about the middle', () => {
    assert.deepEqual(zoomAt({ scale: 1, nextScale: 2, pointer: { x: 0, y: 0 }, offset: { x: 0, y: 0 } }), {
      x: 0,
      y: 0,
    });
  });

  it('keeps the point under the pointer where it was', () => {
    // Zooming about the centre would slide that detail away exactly when someone is
    // trying to look at it closer.
    assert.deepEqual(
      zoomAt({ scale: 1, nextScale: 2.5, pointer: { x: 120, y: -60 }, offset: { x: 0, y: 0 } }),
      { x: -180, y: 90 },
    );
  });

  it('works from an offset that is already not zero', () => {
    assert.deepEqual(
      zoomAt({ scale: 2, nextScale: 4, pointer: { x: 100, y: 0 }, offset: { x: -50, y: 0 } }),
      { x: -200, y: 0 },
    );
  });

  it('undoes itself when the magnification goes back', () => {
    const pointer = { x: 80, y: 40 };
    const inward = zoomAt({ scale: 1, nextScale: 3, pointer, offset: { x: 0, y: 0 } });
    const back = zoomAt({ scale: 3, nextScale: 1, pointer, offset: inward });

    assert.ok(Math.abs(back.x) < 0.0001);
    assert.ok(Math.abs(back.y) < 0.0001);
  });

  it('survives being asked about nothing', () => {
    assert.deepEqual(zoomAt(), { x: 0, y: 0 });
  });
});

describe('clampOffset', () => {
  const frame = { width: 800, height: 600 };

  it('allows movement only as far as the picture overhangs', () => {
    // 1000 wide inside an 800 frame leaves 100 either side.
    const image = { width: 1000, height: 600 };
    assert.deepEqual(clampOffset({ offset: { x: 500, y: 0 }, scale: 1, frame, image }), {
      x: 100,
      y: 0,
    });
    assert.deepEqual(clampOffset({ offset: { x: -500, y: 0 }, scale: 1, frame, image }), {
      x: -100,
      y: 0,
    });
  });

  it('pins an axis where the picture is smaller than the frame', () => {
    // A picture narrower than the frame has nowhere to go sideways, however far it is
    // magnified in the other direction.
    const image = { width: 400, height: 1200 };
    assert.deepEqual(clampOffset({ offset: { x: 90, y: 90 }, scale: 1, frame, image }), {
      x: 0,
      y: 90,
    });
  });

  it('scales the room along with the picture', () => {
    const image = { width: 800, height: 600 };
    assert.deepEqual(clampOffset({ offset: { x: 9999, y: 9999 }, scale: 2, frame, image }), {
      x: 400,
      y: 300,
    });
  });

  it('survives being asked about nothing', () => {
    assert.deepEqual(clampOffset(), { x: 0, y: 0 });
  });
});

describe('the zoom field', () => {
  it('shows whole per cent, because nobody types 137.5', () => {
    assert.equal(formatZoomPercent(1), 100);
    assert.equal(formatZoomPercent(1.5), 150);
    assert.equal(formatZoomPercent(1.337), 134);
  });

  it('reads a number however it was written', () => {
    assert.equal(parseZoomPercent('150'), 1.5);
    assert.equal(parseZoomPercent(' 150% '), 1.5);
    assert.equal(parseZoomPercent('125'), 1.25);
    // Three figures, now that the range runs past a hundred per cent twice over.
    assert.equal(parseZoomPercent('275'), 2.75);
    assert.equal(parseZoomPercent('400'), 4);
  });

  it('clamps rather than refusing a number outside the range', () => {
    assert.equal(parseZoomPercent('900'), MAX_ZOOM);
    assert.equal(parseZoomPercent('401'), MAX_ZOOM);
    assert.equal(parseZoomPercent('10'), MIN_ZOOM);
  });

  it('returns nothing for anything unusable, so a half-typed number is left alone', () => {
    // Clamping every keystroke is what makes such a field impossible to type into.
    assert.equal(parseZoomPercent(''), null);
    assert.equal(parseZoomPercent('abc'), null);
    assert.equal(parseZoomPercent('0'), null);
    assert.equal(parseZoomPercent(null), null);
  });
});

describe('stripWindow', () => {
  it('shows everything when there is little enough to show', () => {
    assert.deepEqual(stripWindow({ index: 0, total: 4 }), { start: 0, end: 4 });
    assert.deepEqual(stripWindow({ index: 0, total: 6 }), { start: 0, end: 6 });
  });

  it('holds still while the picture stays inside it', () => {
    assert.deepEqual(stripWindow({ index: 3, total: 14, start: 2 }), { start: 2, end: 8 });
  });

  it('is dragged along when the picture would fall outside', () => {
    // A strip that marks where you are is no use if that mark is not on it.
    assert.deepEqual(stripWindow({ index: 11, total: 14, start: 0 }), { start: 7, end: 13 });
    assert.deepEqual(stripWindow({ index: 1, total: 14, start: 6 }), { start: 0, end: 6 });
  });

  it('moves before the picture reaches the edge, not after', () => {
    // What is coming next has to be on the strip already, or asking for it is a leap in
    // the dark. Index 5 is the last of the window 0-5, so the window is already moving.
    assert.deepEqual(stripWindow({ index: 4, total: 14, start: 0 }), { start: 0, end: 6 });
    assert.deepEqual(stripWindow({ index: 5, total: 14, start: 0 }), { start: 1, end: 7 });
    assert.deepEqual(stripWindow({ index: 3, total: 14, start: 3 }), { start: 2, end: 8 });
  });

  it('keeps no lookahead when asked for none', () => {
    assert.deepEqual(stripWindow({ index: 5, total: 14, start: 0, margin: 0 }), {
      start: 0,
      end: 6,
    });
  });

  it('will not ask for more room than the window has', () => {
    // A margin of four either side of a window of six is impossible; it is capped rather
    // than allowed to produce a window that jumps about.
    assert.deepEqual(stripWindow({ index: 6, total: 14, start: 6, margin: 4 }), {
      start: 4,
      end: 10,
    });
  });

  it('never runs past either end', () => {
    assert.deepEqual(stripWindow({ index: 13, total: 14, start: 99 }), { start: 8, end: 14 });
    assert.deepEqual(stripWindow({ index: 0, total: 14, start: -5 }), { start: 0, end: 6 });
    assert.deepEqual(stripWindow({ index: 13, total: 14, start: 0 }), { start: 8, end: 14 });
  });

  it('survives being asked about nothing', () => {
    assert.deepEqual(stripWindow(), { start: 0, end: 0 });
  });
});

describe('shiftWindow', () => {
  it('moves one place at a time', () => {
    assert.equal(shiftWindow({ start: 0, delta: 1, total: 14 }), 1);
    assert.equal(shiftWindow({ start: 4, delta: -1, total: 14 }), 3);
  });

  it('stops at both ends', () => {
    assert.equal(shiftWindow({ start: 0, delta: -1, total: 14 }), 0);
    // Fourteen pictures in a window of six leaves the last start at eight.
    assert.equal(shiftWindow({ start: 8, delta: 1, total: 14 }), 8);
  });

  it('has nowhere to go when everything already fits', () => {
    assert.equal(shiftWindow({ start: 0, delta: 1, total: 4 }), 0);
  });

  it('survives being asked about nothing', () => {
    assert.equal(shiftWindow(), 0);
  });
});

describe('pressedBeside', () => {
  // The element fills the frame and `object-fit` letterboxes the picture inside it, so a
  // press on the dark surround still arrives on the image. Only the drawn rectangle counts.
  const size = { width: 400, height: 300 };

  it('says no for a press on the picture', () => {
    assert.equal(pressedBeside({ point: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, size, scale: 1 }), false);
    assert.equal(pressedBeside({ point: { x: 199, y: 149 }, offset: { x: 0, y: 0 }, size, scale: 1 }), false);
  });

  it('says yes for a press beside it', () => {
    assert.equal(pressedBeside({ point: { x: 260, y: 0 }, offset: { x: 0, y: 0 }, size, scale: 1 }), true);
    assert.equal(pressedBeside({ point: { x: 0, y: -200 }, offset: { x: 0, y: 0 }, size, scale: 1 }), true);
  });

  it('follows the picture as it grows and moves', () => {
    // Twice the size reaches twice as far, and the offset carries the rectangle with it.
    assert.equal(pressedBeside({ point: { x: 380, y: 0 }, offset: { x: 0, y: 0 }, size, scale: 2 }), false);
    assert.equal(pressedBeside({ point: { x: 380, y: 0 }, offset: { x: -200, y: 0 }, size, scale: 2 }), true);
  });

  it('survives being asked about nothing', () => {
    assert.equal(pressedBeside(), false);
  });
});

describe('imageAnnouncement', () => {
  it('reads the position and the alternative text', () => {
    // Swapping the source of an image already on the page announces nothing on its own.
    assert.equal(
      imageAnnouncement({ index: 2, total: 6, alt: 'Rolling desert dunes' }),
      '3 of 6: Rolling desert dunes',
    );
  });

  it('falls back to the position when the author wrote no alternative text', () => {
    assert.equal(imageAnnouncement({ index: 0, total: 4, alt: '  ' }), '1 of 4');
    assert.equal(imageAnnouncement({ index: 0, total: 4 }), '1 of 4');
  });

  it('lets an author replace the wording', () => {
    assert.equal(
      imageAnnouncement({ index: 1, total: 3, alt: 'A pier', labels: { announce: '{alt} ({index}/{total})' } }),
      'A pier (2/3)',
    );
  });
});

describe('fillLabel', () => {
  it('substitutes and tidies the result', () => {
    assert.equal(fillLabel('Show image {index} of {total}', { index: 2, total: 9 }), 'Show image 2 of 9');
  });

  it('survives a template that is not a string', () => {
    assert.equal(fillLabel(null, { index: 1 }), '');
  });
});
