import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_HEADING_LEVEL,
  MAX_DURATION,
  MAX_HEADING_LEVEL,
  MIN_DURATION,
  MIN_HEADING_LEVEL,
  REGION_LIMIT,
  clampHeadingLevel,
  expandedAfter,
  expansionDiff,
  fillLabel,
  nextHeaderIndex,
  normaliseExpanded,
  panelDuration,
  shouldExposeRegion,
} from '../../components/accordion/source/accordion-core.js';

describe('clampHeadingLevel', () => {
  it('keeps a level that can actually be rendered', () => {
    assert.equal(clampHeadingLevel(2), 2);
    assert.equal(clampHeadingLevel('4'), 4);
    assert.equal(clampHeadingLevel(6), 6);
    assert.deepEqual([MIN_HEADING_LEVEL, MAX_HEADING_LEVEL], [2, 6]);
  });

  it('pulls anything outside the range into it', () => {
    assert.equal(clampHeadingLevel(1), MIN_HEADING_LEVEL);
    assert.equal(clampHeadingLevel(9), MAX_HEADING_LEVEL);
  });

  it('falls back rather than guessing at nonsense', () => {
    assert.equal(clampHeadingLevel(null), DEFAULT_HEADING_LEVEL);
    assert.equal(clampHeadingLevel('abc'), DEFAULT_HEADING_LEVEL);
    assert.equal(clampHeadingLevel(undefined), DEFAULT_HEADING_LEVEL);
    assert.equal(clampHeadingLevel('', { fallback: 5 }), 5);
  });
});

describe('shouldExposeRegion', () => {
  it('makes panels landmarks while there are few enough of them', () => {
    assert.equal(shouldExposeRegion(1), true);
    assert.equal(shouldExposeRegion(REGION_LIMIT), true);
  });

  it('stops before the landmarks become the problem', () => {
    // The Authoring Practices asks for the role and then warns against breeding landmarks
    // with it. Both halves are followed, so the count is what decides.
    assert.equal(shouldExposeRegion(REGION_LIMIT + 1), false);
    assert.equal(shouldExposeRegion(40), false);
  });

  it('says no to a group with nothing in it', () => {
    assert.equal(shouldExposeRegion(0), false);
    assert.equal(shouldExposeRegion(-3), false);
    assert.equal(shouldExposeRegion(undefined), false);
  });
});

describe('panelDuration', () => {
  it('takes longer for a panel with further to go', () => {
    const shortPanel = panelDuration(200);
    const tallPanel = panelDuration(500);

    assert.ok(tallPanel > shortPanel, `${tallPanel} should exceed ${shortPanel}`);
  });

  it('refuses to be quicker than the floor or slower than the ceiling', () => {
    // One speed for every panel is wrong at both ends: a two-line panel crawls and a long
    // one drags.
    assert.equal(panelDuration(0), MIN_DURATION);
    assert.equal(panelDuration(10), MIN_DURATION);
    assert.equal(panelDuration(100000), MAX_DURATION);
  });

  it('survives a height that is not a height', () => {
    assert.equal(panelDuration(Number.NaN), MIN_DURATION);
    assert.equal(panelDuration(-40), MIN_DURATION);
    assert.equal(panelDuration(undefined), MIN_DURATION);
  });
});

describe('nextHeaderIndex', () => {
  it('walks the headers and wraps at both ends', () => {
    assert.equal(nextHeaderIndex({ current: 0, total: 4, delta: 1 }), 1);
    assert.equal(nextHeaderIndex({ current: 3, total: 4, delta: 1 }), 0);
    assert.equal(nextHeaderIndex({ current: 0, total: 4, delta: -1 }), 3);
  });

  it('stops at the ends when told not to wrap', () => {
    assert.equal(nextHeaderIndex({ current: 3, total: 4, delta: 1, loop: false }), 3);
    assert.equal(nextHeaderIndex({ current: 0, total: 4, delta: -1, loop: false }), 0);
  });

  it('lands on a disabled header rather than stepping over it', () => {
    // Nothing here knows which headers are disabled, and that is the point: a header nobody
    // can reach is a header nobody can discover is unavailable, and skipping one would also
    // throw out anybody counting their way down the list.
    assert.equal(nextHeaderIndex({ current: 0, total: 3, delta: 1 }), 1);
  });

  it('survives an empty group and rubbish input', () => {
    assert.equal(nextHeaderIndex({ current: 0, total: 0, delta: 1 }), -1);
    assert.equal(nextHeaderIndex(), -1);
    assert.equal(nextHeaderIndex({ current: 99, total: 3, delta: 0 }), 2);
  });
});

describe('expandedAfter', () => {
  it('adds a panel without disturbing the others', () => {
    assert.deepEqual(expandedAfter({ expanded: [0], index: 2, open: true, total: 4 }), [0, 2]);
  });

  it('takes one away', () => {
    assert.deepEqual(expandedAfter({ expanded: [0, 2], index: 0, open: false, total: 4 }), [2]);
  });

  it('replaces rather than adds when only one may be open', () => {
    assert.deepEqual(
      expandedAfter({ expanded: [0], index: 2, open: true, exclusive: true, total: 4 }),
      [2],
    );
  });

  it('still closes the one that was open in exclusive mode', () => {
    assert.deepEqual(
      expandedAfter({ expanded: [2], index: 2, open: false, exclusive: true, total: 4 }),
      [],
    );
  });

  it('ignores a panel that is not there', () => {
    assert.deepEqual(expandedAfter({ expanded: [1], index: 9, open: true, total: 4 }), [1]);
    assert.deepEqual(expandedAfter({ expanded: [1], index: -1, open: true, total: 4 }), [1]);
  });

  it('returns the set in order and without repeats', () => {
    assert.deepEqual(expandedAfter({ expanded: [3, 1, 1], index: 0, open: true, total: 4 }), [0, 1, 3]);
  });
});

describe('normaliseExpanded', () => {
  it('drops what is out of range and what is repeated', () => {
    assert.deepEqual(normaliseExpanded({ expanded: [2, 2, 9, -1, 0], total: 4 }), [0, 2]);
  });

  it('keeps only the first when only one may be open', () => {
    // A request the group's own rule forbids has to be answered with a state it allows, or
    // the next press appears to do nothing.
    assert.deepEqual(normaliseExpanded({ expanded: [1, 2, 3], total: 4, exclusive: true }), [1]);
  });

  it('survives being handed nothing', () => {
    assert.deepEqual(normaliseExpanded(), []);
    assert.deepEqual(normaliseExpanded({ expanded: 'nope', total: 4 }), []);
  });
});

describe('expansionDiff', () => {
  it('names what has to open and what has to close', () => {
    assert.deepEqual(expansionDiff([0, 1], [1, 2], { total: 4 }), {
      opening: [2],
      closing: [0],
    });
  });

  it('reports nothing when nothing moves', () => {
    assert.deepEqual(expansionDiff([1], [1], { total: 4 }), { opening: [], closing: [] });
  });
});

describe('fillLabel', () => {
  it('puts the title into the announcement', () => {
    assert.equal(fillLabel('{title} collapsed', { title: 'Standard delivery' }), 'Standard delivery collapsed');
  });

  it('leaves nothing ragged when a value is missing', () => {
    assert.equal(fillLabel('{title} collapsed', { title: '' }), 'collapsed');
    assert.equal(fillLabel(undefined, { title: 'x' }), '');
  });
});
