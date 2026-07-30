import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MINIMUM_HIDDEN,
  SEPARATORS,
  SIZES,
  collapseModel,
  expandLabel,
  normalizeSeparator,
  normalizeSize,
} from '../../components/breadcrumbs/source/breadcrumbs-core.js';

describe('attribute normalisation', () => {
  it('keeps every documented size and separator', () => {
    for (const size of SIZES) {
      assert.equal(normalizeSize(size), size);
    }

    for (const separator of SEPARATORS) {
      assert.equal(normalizeSeparator(separator), separator);
    }
  });

  it('falls back rather than passing an unknown value through to a selector', () => {
    assert.equal(normalizeSize('huge'), 'md');
    assert.equal(normalizeSize(null), 'md');
    assert.equal(normalizeSeparator('pipe'), 'slash');
    assert.equal(normalizeSeparator(undefined), 'slash');
  });
});

describe('collapseModel', () => {
  it('leaves a path shorter than the limit alone', () => {
    assert.deepEqual(collapseModel({ count: 3, maxItems: 5 }), { collapsed: false, hidden: [] });
    assert.deepEqual(collapseModel({ count: 5, maxItems: 5 }), { collapsed: false, hidden: [] });
  });

  it('treats no limit as never collapsing', () => {
    assert.deepEqual(collapseModel({ count: 12, maxItems: 0 }), { collapsed: false, hidden: [] });
    assert.deepEqual(collapseModel({ count: 12 }), { collapsed: false, hidden: [] });
  });

  it('hides the middle and keeps the ends', () => {
    // Six levels, one kept either side: everything between goes away.
    assert.deepEqual(collapseModel({ count: 6, maxItems: 3 }), {
      collapsed: true,
      hidden: [1, 2, 3, 4],
    });
  });

  it('honours how many levels stay at each end', () => {
    assert.deepEqual(
      collapseModel({ count: 6, maxItems: 4, itemsBeforeCollapse: 2, itemsAfterCollapse: 2 }),
      { collapsed: true, hidden: [2, 3] },
    );
  });

  it('refuses to trade a single level for a press', () => {
    // Three levels with one kept either side leaves exactly one to hide, which saves
    // almost no width and costs an interaction.
    assert.deepEqual(collapseModel({ count: 3, maxItems: 2 }), { collapsed: false, hidden: [] });
    assert.equal(MINIMUM_HIDDEN, 2);
  });

  it('stays whole when the ends already cover the path', () => {
    assert.deepEqual(
      collapseModel({ count: 4, maxItems: 2, itemsBeforeCollapse: 3, itemsAfterCollapse: 3 }),
      { collapsed: false, hidden: [] },
    );
  });

  it('survives values that are not usable counts', () => {
    assert.deepEqual(collapseModel(), { collapsed: false, hidden: [] });
    assert.deepEqual(collapseModel({ count: 0, maxItems: 3 }), { collapsed: false, hidden: [] });
    assert.deepEqual(collapseModel({ count: 6, maxItems: 'three' }), {
      collapsed: false,
      hidden: [],
    });
    // A negative count is not usable, so the default of one applies rather than clamping
    // to zero. For a trail that matters: the root level always survives.
    assert.deepEqual(
      collapseModel({ count: 6, maxItems: 3, itemsBeforeCollapse: -4, itemsAfterCollapse: null }),
      { collapsed: true, hidden: [1, 2, 3, 4] },
    );
  });

  it('accepts an explicit zero, which is different from a broken value', () => {
    assert.deepEqual(
      collapseModel({ count: 6, maxItems: 3, itemsBeforeCollapse: 0, itemsAfterCollapse: 1 }),
      { collapsed: true, hidden: [0, 1, 2, 3, 4] },
    );
  });
});

describe('expandLabel', () => {
  it('counts what it is hiding', () => {
    assert.equal(expandLabel(4), 'Show 4 hidden levels');
  });

  it('lets an author replace the wording, and ignores a blank override', () => {
    assert.equal(expandLabel(2, { expand: 'Reveal {count} more' }), 'Reveal 2 more');
    assert.equal(expandLabel(2, { expand: '   ' }), 'Show 2 hidden levels');
  });
});
