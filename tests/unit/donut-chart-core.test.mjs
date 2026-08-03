import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SLICE_LIMIT,
  arcPath,
  fillLabel,
  foldSlices,
  formatNumber,
  formatShare,
  gapRadians,
  midAngle,
  parseValue,
  sliceAngles,
  usableSlices,
} from '../../components/donut-chart/source/donut-chart-core.js';

const row = (name, value) => ({ name, value, text: String(value) });
const TAU = Math.PI * 2;

describe('parseValue', () => {
  it('reads the number out of a cell written for a person', () => {
    assert.equal(parseValue('18,400'), 18400);
    assert.equal(parseValue('42%'), 42);
    assert.equal(parseValue('$9,100'), 9100);
  });

  it('lets data-value settle what it cannot be sure about', () => {
    assert.equal(parseValue('1.234,56', '1234.56'), 1234.56);
  });

  it('says nothing rather than inventing a number', () => {
    assert.equal(parseValue(''), null);
    assert.equal(parseValue('n/a'), null);
  });
});

describe('usableSlices', () => {
  it('keeps only what can be part of a whole', () => {
    // A negative share of a total is not a thing. Drawing one would either invert a wedge or
    // quietly shrink everybody else.
    const { usable, dropped } = usableSlices([row('a', 10), row('b', -4), row('c', 0), row('d', 6)]);

    assert.deepEqual(
      usable.map((entry) => entry.name),
      ['a', 'd'],
    );
    assert.equal(dropped, 2);
  });

  it('counts what it dropped so the chart can say so', () => {
    assert.equal(usableSlices([row('a', -1), row('b', -2)]).dropped, 2);
  });
});

describe('foldSlices', () => {
  it('leaves a readable number of wedges alone', () => {
    const rows = Array.from({ length: 5 }, (unused, index) => row(`s${index}`, index + 1));
    const { shown, folded } = foldSlices(rows);

    assert.equal(shown.length, 5);
    assert.equal(folded, 0);
    assert.deepEqual(
      shown.map((entry) => entry.slot),
      [0, 1, 2, 3, 4],
    );
  });

  it('folds the tail by default, because a ring stops reading past six', () => {
    // The opposite default from the line chart on purpose: a ninth line is still a readable
    // line, a ninth wedge is a sliver with a label nobody can place.
    const rows = Array.from({ length: 10 }, (unused, index) => row(`s${index}`, 10));
    const { shown, folded } = foldSlices(rows);

    // Five real wedges plus one remainder makes six on screen; the remainder holds the other
    // five rows.
    assert.equal(shown.length, SLICE_LIMIT);
    assert.equal(folded, 5);

    const other = shown.at(-1);
    assert.equal(other.isOther, true);
    assert.equal(other.value, 50);
    // Last in reading order, and in the last slot rather than given a colour of its own.
    assert.equal(other.slot, SLICE_LIMIT - 1);
  });

  it('folds nothing at exactly the limit', () => {
    const rows = Array.from({ length: SLICE_LIMIT }, (unused, index) => row(`s${index}`, 1));

    assert.equal(foldSlices(rows).folded, 0);
    assert.equal(foldSlices(rows).shown.length, SLICE_LIMIT);
  });
});

describe('sliceAngles', () => {
  it('divides the whole circle between the values', () => {
    const { slices, total } = sliceAngles([25, 25, 50]);

    assert.equal(total, 100);
    assert.equal(slices.length, 3);
    assert.ok(Math.abs(slices[2].share - 0.5) < 1e-9);

    const covered = slices.reduce((sum, slice) => sum + (slice.to - slice.from), 0);
    assert.ok(Math.abs(covered - TAU) < 1e-9, 'with no gap the wedges fill the circle');
  });

  it('starts at twelve o clock, where a reader starts', () => {
    const { slices } = sliceAngles([1, 1]);

    assert.ok(Math.abs(slices[0].from + Math.PI / 2) < 1e-9);
  });

  it('takes the gap out of each wedge so they still add up', () => {
    const gap = 0.1;
    const { slices } = sliceAngles([1, 1, 1, 1], { gap });
    const covered = slices.reduce((sum, slice) => sum + (slice.to - slice.from), 0);

    assert.ok(Math.abs(covered - (TAU - gap * 4)) < 1e-9);
  });

  it('never lets the gap eat a sliver whole', () => {
    // A wedge worth a fraction of a per cent would otherwise be spaced out of existence.
    const { slices } = sliceAngles([999, 1], { gap: 1 });

    slices.forEach((slice) => assert.ok(slice.to > slice.from, 'every wedge still has width'));
  });

  it('gives a single slice a whole ring with no notch in it', () => {
    const { slices } = sliceAngles([42], { gap: 0.2 });

    assert.equal(slices.length, 1);
    assert.ok(Math.abs(slices[0].to - slices[0].from - TAU) < 1e-9);
  });

  it('has nothing to divide when the total is zero', () => {
    assert.deepEqual(sliceAngles([]), { slices: [], total: 0 });
    assert.deepEqual(sliceAngles([0, 0]), { slices: [], total: 0 });
  });

  it('ignores what cannot be part of a whole', () => {
    const { slices, total } = sliceAngles([10, -5, null, 'x', 10]);

    assert.equal(slices.length, 2);
    assert.equal(total, 20);
  });
});

describe('arcPath', () => {
  it('draws a wedge out, round, back and round again', () => {
    const d = arcPath({ cx: 100, cy: 100, outer: 90, inner: 55, from: 0, to: 1 });

    assert.ok(d.startsWith('M'));
    assert.equal((d.match(/A/g) ?? []).length, 2, 'the rim and the hole');
    assert.ok(d.endsWith('Z'));
  });

  it('flags the long way round past a half turn', () => {
    const short = arcPath({ outer: 90, inner: 55, from: 0, to: 1 });
    const long = arcPath({ outer: 90, inner: 55, from: 0, to: 4 });

    assert.ok(short.includes('0 0 1'), 'a small wedge takes the short arc');
    assert.ok(long.includes('0 1 1'), 'a big one has to say it is the long way');
  });

  it('draws a whole ring as two halves, because one arc cannot say a full turn', () => {
    // Start and end land on the same point, and the renderer cannot tell a complete circle
    // from nothing at all.
    const d = arcPath({ cx: 100, cy: 100, outer: 90, inner: 55, from: 0, to: Math.PI * 2 });

    assert.equal((d.match(/A/g) ?? []).length, 4);
    assert.equal((d.match(/M/g) ?? []).length, 2);
  });

  it('draws a pie rather than a ring when there is no hole', () => {
    const d = arcPath({ cx: 50, cy: 50, outer: 40, inner: 0, from: 0, to: 1 });

    assert.ok(d.startsWith('M50 50'), 'a pie wedge starts at the centre');
    assert.equal((d.match(/A/g) ?? []).length, 1);
  });

  it('draws nothing rather than a wedge with no width', () => {
    assert.equal(arcPath({ outer: 90, inner: 55, from: 1, to: 1 }), '');
    assert.equal(arcPath({ outer: 0, inner: 0, from: 0, to: 1 }), '');
  });
});

describe('gapRadians', () => {
  it('turns a pixel gap into the angle that draws it at the middle of the ring', () => {
    // Two pixels across a ring whose middle sits at radius 50 is 0.04 radians.
    assert.ok(Math.abs(gapRadians(2, 60, 40) - 0.04) < 1e-9);
  });

  it('has no angle to give for a ring with no size', () => {
    assert.equal(gapRadians(2, 0, 0), 0);
  });
});

describe('midAngle', () => {
  it('points down the middle of a wedge', () => {
    assert.equal(midAngle({ from: 0, to: Math.PI }), Math.PI / 2);
  });
});

describe('formatShare', () => {
  it('shows one decimal, because a share is not a measurement to six figures', () => {
    assert.equal(formatShare(0.4213), '42.1%');
    assert.equal(formatShare(0.5), '50%');
    assert.equal(formatShare(0.00421), '0.4%');
  });

  it('says nothing for what is not a number', () => {
    assert.equal(formatShare(null), '');
  });
});

describe('formatNumber', () => {
  it('separates thousands', () => {
    assert.equal(formatNumber(18400), '18,400');
  });

  it('says nothing for what is not a number', () => {
    assert.equal(formatNumber(Number.NaN), '');
  });
});

describe('fillLabel', () => {
  it('puts the values into the template', () => {
    assert.equal(
      fillLabel('{name}, {value}, {share}', { name: 'Organic', value: '18,400', share: '42.1%' }),
      'Organic, 18,400, 42.1%',
    );
  });

  it('leaves nothing ragged when a part is missing', () => {
    assert.equal(fillLabel('{count} smaller sources folded into {name}', { count: 4 }), '4 smaller sources folded into');
  });
});
