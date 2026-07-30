import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DENSITIES,
  SORT_STATES,
  ariaSortFor,
  compareValues,
  detectNumeric,
  fillLabel,
  nextSortState,
  normalizeDensity,
  selectionState,
} from '../../components/table/source/table-core.js';

describe('attribute normalisation', () => {
  it('keeps every documented density', () => {
    for (const density of DENSITIES) {
      assert.equal(normalizeDensity(density), density);
    }
  });

  it('falls back rather than passing an unknown value through to a selector', () => {
    assert.equal(normalizeDensity('roomy'), 'comfortable');
    assert.equal(normalizeDensity(null), 'comfortable');
  });
});

describe('nextSortState', () => {
  it('offers a way back to the order the data arrived in', () => {
    // Two states would strand anyone who sorted a column to check one thing.
    assert.equal(nextSortState('none'), 'ascending');
    assert.equal(nextSortState('ascending'), 'descending');
    assert.equal(nextSortState('descending'), 'none');
    assert.deepEqual([...SORT_STATES], ['none', 'ascending', 'descending']);
  });

  it('starts from the beginning for anything unrecognised', () => {
    assert.equal(nextSortState(undefined), 'ascending');
    assert.equal(nextSortState('sideways'), 'ascending');
  });
});

describe('ariaSortFor', () => {
  it('passes the documented states through and rejects the rest', () => {
    assert.equal(ariaSortFor('ascending'), 'ascending');
    assert.equal(ariaSortFor('descending'), 'descending');
    assert.equal(ariaSortFor('none'), 'none');
    assert.equal(ariaSortFor('other'), 'none');
  });
});

describe('detectNumeric', () => {
  it('accepts a column where every value present is a number', () => {
    assert.equal(detectNumeric(['8', '64', '128']), true);
    assert.equal(detectNumeric(['$1,420', '$96']), true);
    assert.equal(detectNumeric(['8', '', '64']), true);
  });

  it('refuses a column holding one stray label', () => {
    // Comparing as text is wrong far less often than putting the label at an arbitrary end.
    assert.equal(detectNumeric(['8', 'unknown', '64']), false);
  });

  it('refuses an empty column', () => {
    assert.equal(detectNumeric([]), false);
    assert.equal(detectNumeric(['', '  ']), false);
    assert.equal(detectNumeric(), false);
  });
});

describe('compareValues', () => {
  it('orders text and reverses it on request', () => {
    assert.ok(compareValues('apple', 'banana') < 0);
    assert.ok(compareValues('apple', 'banana', { direction: 'descending' }) > 0);
  });

  it('orders numbers by value rather than by digit', () => {
    // "128" sorts before "64" as text; the point of the numeric path is that it does not.
    assert.ok(compareValues('128', '64', { numeric: true }) > 0);
    assert.ok(compareValues('$1,420', '$96', { numeric: true }) > 0);
  });

  it('keeps blanks last in both directions', () => {
    // A column reversed into a wall of empty rows tells the reader nothing.
    assert.ok(compareValues('', 'anything') > 0);
    assert.ok(compareValues('anything', '') < 0);
    assert.ok(compareValues('', 'anything', { direction: 'descending' }) > 0);
    assert.ok(compareValues('anything', '', { direction: 'descending' }) < 0);
  });

  it('treats two blanks as equal', () => {
    assert.equal(compareValues('', '   '), 0);
    assert.equal(compareValues(undefined, null), 0);
  });
});

describe('selectionState', () => {
  it('reports the third state a checkbox cannot express on its own', () => {
    assert.equal(selectionState({ total: 4, selected: 0 }), 'none');
    assert.equal(selectionState({ total: 4, selected: 1 }), 'some');
    assert.equal(selectionState({ total: 4, selected: 4 }), 'all');
  });

  it('counts a full selection as complete even when the tally overruns', () => {
    // A row locked into the selection by the author must not leave the header stuck.
    assert.equal(selectionState({ total: 3, selected: 4 }), 'all');
  });

  it('has nothing to report for an empty table', () => {
    assert.equal(selectionState({ total: 0, selected: 0 }), 'none');
    assert.equal(selectionState(), 'none');
  });
});

describe('fillLabel', () => {
  it('substitutes and tidies the result', () => {
    assert.equal(
      fillLabel('{caption}, scrollable', { caption: 'Recent orders' }),
      'Recent orders, scrollable',
    );
  });

  it('closes the gap left by a table with no caption', () => {
    assert.equal(fillLabel('{caption}, scrollable', { caption: '' }), ', scrollable');
    assert.equal(fillLabel(null, { caption: 'x' }), '');
  });
});
