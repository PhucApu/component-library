import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SERIES_LIMIT,
  SERIES_SLOTS,
  areaPath,
  bandFor,
  barPath,
  extentValues,
  fillLabel,
  foldSeries,
  formatNumber,
  labelStride,
  linePath,
  linearScale,
  markerIndices,
  parseValue,
  scaleFor,
  slotFor,
  stackValues,
  visibleLabels,
} from '../../components/cartesian-chart/source/cartesian-chart-core.js';

const series = (name, values, index = 0) => ({ name, index, values });

describe('parseValue', () => {
  it('reads the number out of a cell written for a person', () => {
    assert.equal(parseValue('$4,200'), 4200);
    assert.equal(parseValue('1 234'), 1234);
    assert.equal(parseValue('12%'), 12);
    assert.equal(parseValue('-90'), -90);
    assert.equal(parseValue('3.5'), 3.5);
  });

  it('reads an accounting negative, which carries no minus sign at all', () => {
    assert.equal(parseValue('(890)'), -890);
    assert.equal(parseValue('($1,200)'), -1200);
  });

  it('treats an empty cell as missing rather than as zero', () => {
    // The difference is the whole point: zero says "we sold nothing", missing says "we did
    // not measure". A line dives to the baseline for one and breaks for the other.
    assert.equal(parseValue(''), null);
    assert.equal(parseValue('   '), null);
    assert.equal(parseValue(null), null);
    assert.equal(parseValue(undefined), null);
  });

  it('says nothing rather than inventing a number from text', () => {
    assert.equal(parseValue('n/a'), null);
    assert.equal(parseValue('-'), null);
    assert.equal(parseValue('$'), null);
  });

  it('lets data-value win, which is the way out for anything it cannot parse', () => {
    // A decimal comma is the case that matters: `1.234,56` is one thousand two hundred in
    // half of Europe and one-point-two here, and no amount of guessing settles it.
    assert.equal(parseValue('1.234,56', '1234.56'), 1234.56);
    assert.equal(parseValue('nearly two thousand', '1980'), 1980);
    assert.equal(parseValue('4,200', '0'), 0);
  });
});

describe('linearScale', () => {
  it('lands the top and bottom of the plot on a labelled tick', () => {
    const scale = linearScale({ values: [12, 87, 41] });

    assert.equal(scale.min, scale.ticks[0]);
    assert.equal(scale.max, scale.ticks[scale.ticks.length - 1]);
    assert.ok(scale.min <= 12);
    assert.ok(scale.max >= 87);
  });

  it('picks a step a person would have picked', () => {
    // Never 3.7. One, two or five times a power of ten, and nothing else.
    for (const values of [[0, 9], [0, 93], [0, 940], [0, 4], [0, 0.7]]) {
      const { step } = linearScale({ values });
      const magnitude = 10 ** Math.floor(Math.log10(step));
      assert.ok(
        [1, 2, 5, 10].includes(Number((step / magnitude).toPrecision(6))),
        `step ${step} is not a round one`,
      );
    }
  });

  it('does not drift into a tick labelled 0.30000000000000004', () => {
    // Counted from the floor rather than accumulated, because adding a step to itself thirty
    // times does not land where the arithmetic says it should.
    const { ticks } = linearScale({ values: [0, 1], tickCount: 10 });

    ticks.forEach((tick) => {
      assert.equal(String(tick).replace('-', '').replace('.', '').length <= 8, true, String(tick));
    });
  });

  it('includes zero when asked, because a bar is read by its length', () => {
    // A column chart starting at 40 makes 41 look like nothing and 45 like everything.
    const bars = linearScale({ values: [41, 45, 43], includeZero: true });
    const lines = linearScale({ values: [41, 45, 43] });

    assert.equal(bars.min, 0);
    assert.ok(lines.min > 0, 'a line has no such obligation and should keep its detail');
  });

  it('lets a pinned minimum reach further down but never lift off zero', () => {
    assert.equal(linearScale({ values: [10, 20], includeZero: true, min: -50 }).min <= -50, true);
    // Asking a bar chart to start at 15 is asking it to lie, so the floor stays at zero.
    assert.equal(linearScale({ values: [10, 20], includeZero: true, min: 15 }).min, 0);
    // A line is free to be pinned wherever the author likes.
    assert.equal(linearScale({ values: [10, 20], min: 15 }).min <= 15, true);
  });

  it('gives a flat series a plot with height rather than one line on the floor', () => {
    const scale = linearScale({ values: [7, 7, 7] });

    assert.ok(scale.max > scale.min);
    assert.ok(scale.min <= 7 && scale.max >= 7);
  });

  it('survives having nothing to scale', () => {
    const scale = linearScale({ values: [] });

    assert.ok(Number.isFinite(scale.min));
    assert.ok(scale.max > scale.min);
    assert.ok(scale.ticks.length > 1);
  });

  it('ignores values that are not numbers', () => {
    const scale = linearScale({ values: [10, null, Number.NaN, 20, undefined] });

    assert.ok(scale.min <= 10);
    assert.ok(scale.max >= 20);
  });
});

describe('scaleFor', () => {
  it('maps the domain onto the range, upside down the way a screen is', () => {
    const y = scaleFor({ min: 0, max: 100, from: 200, to: 0 });

    assert.equal(y(0), 200);
    assert.equal(y(100), 0);
    assert.equal(y(50), 100);
  });

  it('returns nothing for a missing value rather than a coordinate of NaN', () => {
    const y = scaleFor({ min: 0, max: 100, from: 200, to: 0 });

    assert.equal(y(null), null);
    assert.equal(y(Number.NaN), null);
  });

  it('does not divide by an empty domain', () => {
    const y = scaleFor({ min: 5, max: 5, from: 100, to: 0 });

    assert.equal(y(5), 100);
  });
});

describe('stackValues', () => {
  it('stacks each series on the one before it', () => {
    const bands = stackValues([series('a', [1, 2]), series('b', [3, 4])]);

    assert.deepEqual(bands[0][0], { from: 0, to: 1, value: 1 });
    assert.deepEqual(bands[1][0], { from: 1, to: 4, value: 3 });
    assert.deepEqual(bands[1][1], { from: 2, to: 6, value: 4 });
  });

  it('lets a missing value add nothing and draw nothing', () => {
    // Counting it as zero would be the same lie the line chart refuses to tell, only harder
    // to see: the stack would keep its height and the segment would silently vanish.
    const bands = stackValues([series('a', [5, null]), series('b', [2, 3])]);

    assert.equal(bands[0][1], null);
    assert.deepEqual(bands[1][1], { from: 0, to: 3, value: 3 });
  });

  it('stacks negatives downward on their own side of the baseline', () => {
    const bands = stackValues([series('a', [-2]), series('b', [-3]), series('c', [4])]);

    assert.deepEqual(bands[0][0], { from: 0, to: -2, value: -2 });
    assert.deepEqual(bands[1][0], { from: -2, to: -5, value: -3 });
    assert.deepEqual(bands[2][0], { from: 0, to: 4, value: 4 });
  });

  it('pads to the longest series rather than dropping the tail', () => {
    const bands = stackValues([series('a', [1]), series('b', [2, 3])]);

    assert.equal(bands[0].length, 2);
    assert.equal(bands[0][1], null);
  });
});

describe('extentValues', () => {
  it('covers every plotted number when the series stand side by side', () => {
    const values = extentValues({ series: [series('a', [1, 9]), series('b', [4, 2])] });

    assert.equal(Math.min(...values), 1);
    assert.equal(Math.max(...values), 9);
  });

  it('covers the top of the stack, not the tallest single series', () => {
    const values = extentValues({
      series: [series('a', [3, 3]), series('b', [4, 4])],
      stacked: true,
    });

    assert.equal(Math.max(...values), 7);
  });
});

describe('foldSeries', () => {
  it('leaves a normal number of series alone', () => {
    const many = Array.from({ length: 5 }, (unused, index) => series(`s${index}`, [index]));

    assert.equal(foldSeries(many).shown.length, 5);
    assert.equal(foldSeries(many).hidden.length, 0);
  });

  it('draws eight and leaves the rest to the table rather than inventing a ninth hue', () => {
    // A generated ninth colour is indistinguishable from one already on screen under
    // colour-vision simulation, so it would be a lie told in colour.
    const many = Array.from({ length: 11 }, (unused, index) => series(`s${index}`, [index]));
    const { shown, hidden, folded } = foldSeries(many);

    assert.equal(shown.length, SERIES_LIMIT);
    assert.equal(hidden.length, 3);
    assert.equal(folded, false);
  });

  it('sums the tail only when asked, because summing changes what was written', () => {
    const many = Array.from({ length: 10 }, (unused, index) => series(`s${index}`, [1, 2]));
    const { shown, hidden, folded } = foldSeries(many, { fold: true });

    assert.equal(shown.length, SERIES_LIMIT);
    assert.equal(hidden.length, 0);
    assert.equal(folded, true);

    const other = shown[shown.length - 1];
    assert.equal(other.isOther, true);
    // Three series folded, each contributing 1 then 2.
    assert.deepEqual(other.values, [3, 6]);
  });

  it('keeps a folded total missing when every part of it was missing', () => {
    const many = Array.from({ length: 10 }, (unused, index) =>
      series(`s${index}`, index >= SERIES_LIMIT - 1 ? [null, 4] : [1, 1]),
    );
    const other = foldSeries(many, { fold: true }).shown.at(-1);

    assert.equal(other.values[0], null);
    assert.equal(other.values[1], 12);
  });
});

describe('slotFor', () => {
  it('binds a colour to the position a series was written in', () => {
    // Colour follows the entity, never its rank. A reader who learned "Retail is orange"
    // must not find it repainted because another series was switched off.
    assert.equal(slotFor(0), 'blue');
    assert.equal(slotFor(1), 'orange');
    assert.equal(slotFor(7), 'red');
    assert.equal(SERIES_SLOTS.length, SERIES_LIMIT);
  });
});

describe('linePath', () => {
  it('draws one run of points', () => {
    const path = linePath([
      { x: 0, y: 10 },
      { x: 5, y: 20 },
    ]);

    assert.equal(path, 'M0 10L5 20');
  });

  it('breaks across a gap rather than drawing through a month nobody measured', () => {
    const path = linePath([{ x: 0, y: 10 }, null, { x: 10, y: 30 }, { x: 15, y: 20 }]);

    assert.equal(path, 'M0 10M10 30L15 20');
  });

  it('has nothing to say about no points', () => {
    assert.equal(linePath([]), '');
    assert.equal(linePath([null, null]), '');
  });
});

describe('areaPath', () => {
  it('closes each run down to the baseline on its own', () => {
    const path = areaPath([{ x: 0, y: 10 }, { x: 5, y: 20 }, null, { x: 15, y: 5 }], 100);

    // Two shapes, so the gap stays a gap instead of being filled in.
    assert.equal(path.split('M').length - 1, 2);
    assert.ok(path.includes('Z'));
    assert.ok(path.startsWith('M0 100'));
  });
});

describe('barPath', () => {
  it('rounds the data end and leaves the baseline square', () => {
    // A rect with `rx` rounds all four corners, which lifts the foot off the very zero the
    // bar is measured from and turns a stack into a column of separate pills.
    const column = barPath({ x: 10, y: 20, width: 24, height: 100, end: 'top' });

    assert.ok(column.includes('A4 4'), 'the top corners are rounded');
    // The foot: two square corners at y = 120.
    assert.ok(column.includes('120'), 'the baseline edge is there');
    assert.equal(column.match(/A/g).length, 2, 'exactly two arcs, both at the data end');
  });

  it('rounds the other end for a negative bar', () => {
    const down = barPath({ x: 0, y: 0, width: 10, height: 40, end: 'bottom' });
    const right = barPath({ x: 0, y: 0, width: 40, height: 10, end: 'right' });
    const left = barPath({ x: 0, y: 0, width: 40, height: 10, end: 'left' });

    [down, right, left].forEach((path) => assert.equal(path.match(/A/g).length, 2));
    assert.notEqual(down, right);
    assert.notEqual(right, left);
  });

  it('draws a plain rectangle for an interior segment of a stack', () => {
    const middle = barPath({ x: 0, y: 0, width: 10, height: 20, radius: 0 });

    assert.equal(middle, 'M0 0H10V20H0Z');
    assert.equal(middle.includes('A'), false);
  });

  it('never rounds more than the bar can take', () => {
    // A two-pixel sliver asked for a four-pixel radius would turn inside out.
    const sliver = barPath({ x: 0, y: 0, width: 20, height: 3, end: 'top' });

    assert.ok(sliver.includes('A1.5 1.5'));
  });

  it('draws nothing at all rather than a zero-sized shape', () => {
    assert.equal(barPath({ x: 0, y: 0, width: 0, height: 20 }), '');
    assert.equal(barPath({ x: 0, y: 0, width: 20, height: 0 }), '');
  });
});

describe('markerIndices', () => {
  it('marks every point while there are few enough to count', () => {
    assert.deepEqual(markerIndices([1, 2, 3]), [0, 1, 2]);
  });

  it('marks only the ends once a marker on each would be noise', () => {
    const many = Array.from({ length: 40 }, (unused, index) => index);

    assert.deepEqual(markerIndices(many), [0, 39]);
  });

  it('marks a value standing alone between two gaps, which would otherwise vanish', () => {
    // A run of one draws no line segment at all, so without a marker the reading disappears.
    const values = Array.from({ length: 40 }, (unused, index) => (index === 20 ? 5 : index));
    values[19] = null;
    values[21] = null;

    assert.ok(markerIndices(values).includes(20));
  });

  it('says nothing when there is nothing present', () => {
    assert.deepEqual(markerIndices([null, null]), []);
    assert.deepEqual(markerIndices([]), []);
  });
});

describe('labelStride and visibleLabels', () => {
  it('shows every label while they fit', () => {
    assert.equal(labelStride(6, 600, 40), 1);
    assert.deepEqual(visibleLabels(4, 1), [0, 1, 2, 3]);
  });

  it('thins them rather than turning them on their side', () => {
    // A rotated label is slower to read, and on a narrow screen the axis ends up taller
    // than the plot it belongs to.
    assert.ok(labelStride(30, 300, 40) > 1);
  });

  it('always keeps the last category, which is the one a time axis is read from', () => {
    const shown = visibleLabels(10, 3);

    assert.equal(shown[0], 0);
    assert.equal(shown[shown.length - 1], 9);
  });

  it('drops the neighbour rather than crowding the last one', () => {
    const shown = visibleLabels(11, 3);

    assert.equal(shown[shown.length - 1], 10);
    assert.ok(10 - shown[shown.length - 2] >= 3);
  });

  it('has nothing to thin when there is one category or none', () => {
    assert.equal(labelStride(1, 10, 40), 1);
    assert.deepEqual(visibleLabels(0, 1), []);
  });
});

describe('bandFor', () => {
  it('centres a single series in its category band', () => {
    const band = bandFor({ index: 0, count: 2, from: 0, to: 100 });

    assert.equal(band.centre, 25);
    assert.ok(band.start > 0 && band.size < 50, 'the band keeps air around the bar');
  });

  it('splits the band between grouped series without overlapping them', () => {
    const first = bandFor({ index: 0, count: 1, from: 0, to: 100, groups: 2, group: 0 });
    const second = bandFor({ index: 0, count: 1, from: 0, to: 100, groups: 2, group: 1 });

    assert.equal(first.size, second.size);
    assert.ok(first.start + first.size <= second.start + 0.001);
  });
});

describe('formatNumber', () => {
  it('separates thousands', () => {
    assert.equal(formatNumber(1234567), '1,234,567');
  });

  it('shows no more decimals than the step it labels', () => {
    assert.equal(formatNumber(0.5, { step: 0.5 }), '0.5');
    assert.equal(formatNumber(1200, { step: 400 }), '1,200');
  });

  it('says nothing for what is not a number', () => {
    assert.equal(formatNumber(null), '');
    assert.equal(formatNumber(Number.NaN), '');
  });
});

describe('fillLabel', () => {
  it('puts the values into the template', () => {
    assert.equal(fillLabel('{category}: {value}', { category: 'Jan', value: '4,200' }), 'Jan: 4,200');
  });

  it('leaves nothing ragged when a part is missing', () => {
    assert.equal(fillLabel('{count} more in the table', {}), 'more in the table');
  });
});
