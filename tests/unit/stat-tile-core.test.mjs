import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  METER_THRESHOLDS,
  deltaDirection,
  deltaTone,
  fillLabel,
  formatChange,
  meterFraction,
  meterTone,
  parseValue,
  sparkPath,
} from '../../components/stat-tile/source/stat-tile-core.js';

describe('parseValue', () => {
  it('reads the number out of a value written for a person', () => {
    assert.equal(parseValue('$48,290'), 48290);
    assert.equal(parseValue('12.4%'), 12.4);
    assert.equal(parseValue('(890)'), -890);
    assert.equal(parseValue('812 GB'), 812);
  });

  it('lets data-value settle what it cannot be sure about', () => {
    assert.equal(parseValue('1.234,56', '1234.56'), 1234.56);
    assert.equal(parseValue('4.2M', '4200000'), 4200000);
  });

  it('says nothing rather than inventing a number', () => {
    assert.equal(parseValue(''), null);
    assert.equal(parseValue('n/a'), null);
    assert.equal(parseValue(undefined), null);
  });
});

describe('deltaDirection', () => {
  it('reports which way the number went, before anyone judges it', () => {
    assert.equal(deltaDirection(12.4), 'up');
    assert.equal(deltaDirection(-3), 'down');
    assert.equal(deltaDirection(0), 'none');
  });

  it('has no direction for what is not a number', () => {
    assert.equal(deltaDirection(null), 'none');
    assert.equal(deltaDirection(Number.NaN), 'none');
  });
});

describe('deltaTone', () => {
  it('reads a rise as good news by default', () => {
    assert.equal(deltaTone({ change: 12.4 }), 'good');
    assert.equal(deltaTone({ change: -12.4 }), 'bad');
  });

  it('inverts it when a rise is the bad news', () => {
    // Costs rising twelve per cent and revenue rising twelve per cent are the same arrow and
    // opposite news. This is the whole reason the attribute exists.
    assert.equal(deltaTone({ change: 12.4, polarity: 'bad' }), 'bad');
    assert.equal(deltaTone({ change: -12.4, polarity: 'bad' }), 'good');
  });

  it('reports the direction and declines to judge it when asked to', () => {
    // Headcount going up is neither good nor bad, and colouring it green says otherwise.
    assert.equal(deltaTone({ change: 12.4, polarity: 'neutral' }), 'none');
    assert.equal(deltaTone({ change: -12.4, polarity: 'neutral' }), 'none');
  });

  it('has nothing to say about no change at all', () => {
    assert.equal(deltaTone({ change: 0 }), 'none');
    assert.equal(deltaTone({ change: 0, polarity: 'bad' }), 'none');
    assert.equal(deltaTone({}), 'none');
  });
});

describe('formatChange', () => {
  it('drops the sign, because the arrow and the word carry it', () => {
    assert.equal(formatChange(12.4), '12.4%');
    assert.equal(formatChange(-12.4), '12.4%');
  });

  it('shows a decimal only when there is one', () => {
    assert.equal(formatChange(12), '12%');
    assert.equal(formatChange(12.4), '12.4%');
    assert.equal(formatChange(1234), '1,234%');
  });

  it('says nothing for what is not a number', () => {
    assert.equal(formatChange(null), '');
    assert.equal(formatChange('several'), '');
  });
});

describe('meterFraction', () => {
  it('measures the value against its ceiling', () => {
    assert.equal(meterFraction({ value: 512, limit: 1024 }), 0.5);
    assert.equal(meterFraction({ value: 0, limit: 1024 }), 0);
  });

  it('fills the bar and stops there when the ceiling is already past', () => {
    // A quota exceeded is a full bar plus a number saying how far past, never a bar drawn
    // beyond its own track.
    assert.equal(meterFraction({ value: 1200, limit: 1000 }), 1);
    assert.equal(meterFraction({ value: -50, limit: 1000 }), 0);
  });

  it('has no fraction without a usable ceiling', () => {
    assert.equal(meterFraction({ value: 10, limit: 0 }), null);
    assert.equal(meterFraction({ value: 10, limit: null }), null);
    assert.equal(meterFraction({ value: null, limit: 10 }), null);
  });
});

describe('meterTone', () => {
  it('stays comfortable until it is not', () => {
    assert.equal(meterTone(0.2), 'ok');
    assert.equal(meterTone(0.74), 'ok');
    assert.equal(meterTone(METER_THRESHOLDS.warning), 'warning');
    assert.equal(meterTone(0.89), 'warning');
    assert.equal(meterTone(METER_THRESHOLDS.critical), 'critical');
    assert.equal(meterTone(1), 'critical');
  });

  it('has no opinion about a fraction it was never given', () => {
    assert.equal(meterTone(null), 'none');
  });
});

describe('sparkPath', () => {
  it('draws the readings across the width it is given', () => {
    const { d, points, last } = sparkPath({ values: [1, 2, 3], width: 100, height: 30 });

    assert.equal(points.length, 3);
    assert.ok(d.startsWith('M'));
    assert.equal(last, points[2]);
    // Highest reading sits highest.
    assert.ok(points[2].y < points[0].y);
  });

  it('puts a flat run through the middle rather than along the floor', () => {
    const { points } = sparkPath({ values: [7, 7, 7], width: 100, height: 30 });

    assert.equal(new Set(points.map((point) => point.y)).size, 1);
    assert.ok(points[0].y > 5 && points[0].y < 25);
  });

  it('ignores readings that are not numbers', () => {
    const { points } = sparkPath({ values: [1, null, 3, 'x'], width: 100, height: 30 });

    assert.equal(points.length, 2);
  });

  it('centres a single reading rather than pinning it to the left', () => {
    const { points } = sparkPath({ values: [5], width: 100, height: 30 });

    assert.equal(points[0].x, 50);
  });

  it('has nothing to draw with nothing to draw from', () => {
    assert.deepEqual(sparkPath({ values: [] }), { d: '', points: [], last: null });
  });

  it('keeps every point inside the box it was given', () => {
    const { points } = sparkPath({ values: [3, 9, 1, 7, 5], width: 120, height: 32 });

    points.forEach((point) => {
      assert.ok(point.x >= 0 && point.x <= 120, `x ${point.x}`);
      assert.ok(point.y >= 0 && point.y <= 32, `y ${point.y}`);
    });
  });
});

describe('fillLabel', () => {
  it('puts the values into the template', () => {
    // The author writes the whole phrase — `of 1 TB` — so the template adds no preposition of
    // its own. Adding one announced "812 GB of of 1 TB".
    assert.equal(fillLabel('{value} {limit}', { value: '812 GB', limit: 'of 1 TB' }), '812 GB of 1 TB');
  });

  it('leaves nothing ragged when a part is missing', () => {
    assert.equal(fillLabel('{value} {limit}', { value: '812 GB' }), '812 GB');
  });
});
