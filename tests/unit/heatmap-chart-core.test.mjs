import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BIN_COUNT,
  SCALE_VARS,
  binFor,
  binThresholds,
  colourFor,
  extent,
  fillLabel,
  formatNumber,
  parseValue,
  stepRanges,
} from '../../components/heatmap-chart/source/heatmap-chart-core.js';

describe('parseValue', () => {
  it('reads the number out of a cell', () => {
    assert.equal(parseValue('12'), 12);
    assert.equal(parseValue('1,240'), 1240);
    assert.equal(parseValue('0'), 0);
  });

  it('keeps a measured zero apart from a cell that was never measured', () => {
    // This is the difference an activity calendar gets wrong most often: collapsing the two
    // turns "we have not started" and "nobody did anything" into the same picture.
    assert.equal(parseValue('0'), 0);
    assert.equal(parseValue(''), null);
    assert.equal(parseValue('   '), null);
    assert.equal(parseValue(null), null);
  });

  it('lets data-value settle what it cannot be sure about', () => {
    assert.equal(parseValue('1.234,5', '1234.5'), 1234.5);
  });

  it('says nothing rather than inventing a number', () => {
    assert.equal(parseValue('n/a'), null);
    assert.equal(parseValue('-'), null);
  });
});

describe('extent', () => {
  it('finds the busiest reading on the grid', () => {
    assert.equal(extent([3, 19, null, 7]), 19);
  });

  it('has no extent to report for an empty grid', () => {
    assert.equal(extent([]), 0);
    assert.equal(extent([null, null]), 0);
  });
});

describe('binThresholds', () => {
  it('divides the range into equal slices by default', () => {
    const edges = binThresholds({ values: [0, 10, 20, 50] });

    assert.equal(edges.length, BIN_COUNT);
    assert.deepEqual(edges, [10, 20, 30, 40, 50]);
  });

  it('honours a pinned ceiling, so two grids can be compared', () => {
    const edges = binThresholds({ values: [1, 2, 3], max: 100 });

    assert.equal(edges.at(-1), 100);
    assert.deepEqual(edges, [20, 40, 60, 80, 100]);
  });

  it('divides by rank when asked, for a grid one cell dominates', () => {
    // With a linear scale a single reading of 1000 puts every other cell in step one and the
    // picture says nothing at all.
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000];
    const linear = binThresholds({ values });
    const quantile = binThresholds({ values, scale: 'quantile' });

    assert.equal(linear[0], 200);
    assert.ok(quantile[0] < 10, 'the first rank-based step stops among the small readings');
    assert.equal(quantile.at(-1), 1000);
  });

  it('keeps rank-based edges in order when readings repeat', () => {
    // Repeated readings collapse neighbouring edges; nudged apart, a value cannot fall into
    // two steps at once.
    const edges = binThresholds({ values: [5, 5, 5, 5, 5, 5, 9], scale: 'quantile' });

    edges.forEach((edge, index) => {
      if (index > 0) {
        assert.ok(edge >= edges[index - 1], `${edge} after ${edges[index - 1]}`);
      }
    });
  });

  it('has no steps to draw for a grid with nothing above zero', () => {
    assert.deepEqual(binThresholds({ values: [0, 0, null] }), []);
    assert.deepEqual(binThresholds({ values: [] }), []);
  });
});

describe('binFor', () => {
  const edges = [10, 20, 30, 40, 50];

  it('puts a reading in the step its size belongs to', () => {
    assert.equal(binFor(1, edges), 1);
    assert.equal(binFor(10, edges), 1);
    assert.equal(binFor(11, edges), 2);
    assert.equal(binFor(50, edges), 5);
  });

  it('lands the busiest reading in the last step, however far past it goes', () => {
    assert.equal(binFor(500, edges), 5);
  });

  it('gives a measured zero its own step, and nothing at all no step', () => {
    assert.equal(binFor(0, edges), 0);
    assert.equal(binFor(null, edges), null);
    assert.equal(binFor(undefined, edges), null);
    assert.equal(binFor(Number.NaN, edges), null);
  });

  it('treats a negative as the quiet end rather than inventing a step below the scale', () => {
    assert.equal(binFor(-4, edges), 0);
  });

  it('puts everything in the first step when there are no edges yet', () => {
    assert.equal(binFor(7, []), 1);
    assert.equal(binFor(0, []), 0);
  });
});

describe('colourFor', () => {
  it('names a step without ever building the property name', () => {
    // A `--heat-step-${n}` assembled at run time is a property nothing can verify exists.
    assert.equal(colourFor(0), 'var(--heat-step-0)');
    assert.equal(colourFor(5), 'var(--heat-step-5)');
    assert.equal(SCALE_VARS.length, BIN_COUNT + 1);
  });

  it('never reaches past the end of the scale', () => {
    assert.equal(colourFor(99), 'var(--heat-step-5)');
    assert.equal(colourFor(-1), 'var(--heat-step-0)');
  });
});

describe('stepRanges', () => {
  it('says what each swatch covers, for the name read aloud', () => {
    const ranges = stepRanges([10, 20, 30, 40, 50]);

    assert.equal(ranges[0], 'up to 10');
    assert.equal(ranges[1], '10 to 20');
    assert.equal(ranges.length, 5);
  });

  it('has nothing to describe without a scale', () => {
    assert.deepEqual(stepRanges([]), []);
  });
});

describe('formatNumber', () => {
  it('separates thousands', () => {
    assert.equal(formatNumber(12400), '12,400');
  });

  it('says nothing for what is not a number', () => {
    assert.equal(formatNumber(null), '');
  });
});

describe('fillLabel', () => {
  it('puts the values into the template', () => {
    assert.equal(
      fillLabel('{row}, {column}: {value}', { row: 'Mon', column: '09', value: '12' }),
      'Mon, 09: 12',
    );
  });

  it('leaves nothing ragged when a part is missing', () => {
    assert.equal(fillLabel('up to {to}', {}), 'up to');
  });
});
