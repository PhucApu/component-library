import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ANCHORS,
  CLOSE_REASONS,
  isBackdropPress,
  isModalPanel,
  normalizeAnchor,
  normalizeReason,
  pointInBox,
} from '../../components/drawer/source/drawer-core.js';

const box = { left: 0, top: 0, right: 320, bottom: 720 };
const panel = { getBoundingClientRect: () => box };

describe('attribute normalisation', () => {
  it('keeps every documented anchor and reason', () => {
    for (const anchor of ANCHORS) {
      assert.equal(normalizeAnchor(anchor), anchor);
    }

    for (const reason of CLOSE_REASONS) {
      assert.equal(normalizeReason(reason), reason);
    }
  });

  it('falls back rather than passing an unknown value through to a selector', () => {
    assert.equal(normalizeAnchor('left'), 'start');
    assert.equal(normalizeAnchor(null), 'start');
    assert.equal(normalizeReason('gave-up'), 'api');
  });
});

describe('isModalPanel', () => {
  it('treats only a dialog as modal', () => {
    // A permanent navigation panel is not a dialog, and saying it is would tell assistive
    // technology it interrupts something when it does not.
    assert.equal(isModalPanel('DIALOG'), true);
    assert.equal(isModalPanel('dialog'), true);
    assert.equal(isModalPanel('ASIDE'), false);
    assert.equal(isModalPanel('NAV'), false);
    assert.equal(isModalPanel(undefined), false);
  });
});

describe('pointInBox', () => {
  it('answers for points inside, outside, and exactly on the edge', () => {
    assert.equal(pointInBox({ x: 100, y: 100 }, box), true);
    assert.equal(pointInBox({ x: 500, y: 100 }, box), false);
    assert.equal(pointInBox({ x: 100, y: 900 }, box), false);
    assert.equal(pointInBox({ x: 0, y: 0 }, box), true);
    assert.equal(pointInBox({ x: 320, y: 720 }, box), true);
  });

  it('refuses to answer without usable coordinates', () => {
    assert.equal(pointInBox({ x: Number.NaN, y: 10 }, box), false);
    assert.equal(pointInBox(null, box), false);
    assert.equal(pointInBox({ x: 1, y: 1 }, null), false);
  });
});

describe('isBackdropPress', () => {
  it('recognises a press beside the panel', () => {
    // The backdrop is painted rather than built, so the press arrives on the dialog with
    // coordinates outside its own box.
    assert.equal(
      isBackdropPress({ target: panel, panel, point: { x: 800, y: 300 }, detail: 1 }),
      true,
    );
  });

  it('ignores a press inside the panel', () => {
    assert.equal(
      isBackdropPress({ target: panel, panel, point: { x: 100, y: 300 }, detail: 1 }),
      false,
    );
  });

  it('ignores a press that landed on something inside the panel', () => {
    assert.equal(
      isBackdropPress({ target: {}, panel, point: { x: 800, y: 300 }, detail: 1 }),
      false,
    );
  });

  it('ignores a keyboard activation, which has no coordinates worth reading', () => {
    // Enter on a focused close button reports 0,0 and a detail of zero; treating that as a
    // backdrop press would report the wrong reason for every keyboard dismissal.
    assert.equal(
      isBackdropPress({ target: panel, panel, point: { x: 0, y: 0 }, detail: 0 }),
      false,
    );
  });

  it('survives being asked about nothing', () => {
    assert.equal(isBackdropPress(), false);
    assert.equal(isBackdropPress({ target: panel }), false);
  });
});
