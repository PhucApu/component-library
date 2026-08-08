import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_DURATION,
  DEFAULT_LABELS,
  FACES,
  MAX_DURATION,
  MIN_DURATION,
  clampDuration,
  facingFace,
  fillLabel,
  inertFace,
  labelFor,
  otherFace,
  panelAngle,
  resolveFace,
  shouldFlipFrom,
} from '../../components/flip-card/source/flip-card-core.js';

describe('resolveFace, otherFace and facingFace', () => {
  it('knows two faces and nothing else', () => {
    assert.deepEqual(FACES, ['front', 'back']);
    assert.equal(resolveFace('back'), 'back');
    assert.equal(resolveFace('sideways'), 'front');
    assert.equal(resolveFace(undefined), 'front');
  });

  it('names the other one', () => {
    assert.equal(otherFace('front'), 'back');
    assert.equal(otherFace('back'), 'front');
    assert.equal(otherFace('nonsense'), 'back');
  });

  it('names the one showing', () => {
    assert.equal(facingFace(false), 'front');
    assert.equal(facingFace(true), 'back');
  });
});

describe('panelAngle and inertFace', () => {
  it('turns the card right over and back', () => {
    assert.equal(panelAngle(false), 0);
    assert.equal(panelAngle(true), 180);
  });

  // Hiding a face from the eye is not enough: it still carries its links, and a reader on
  // a keyboard would tab into them behind the card.
  it('takes the face turned away out of the page', () => {
    assert.equal(inertFace(false), 'back');
    assert.equal(inertFace(true), 'front');
    assert.notEqual(inertFace(true), facingFace(true));
    assert.notEqual(inertFace(false), facingFace(false));
  });
});

describe('shouldFlipFrom', () => {
  it('turns on a press of the card itself', () => {
    assert.equal(shouldFlipFrom({}), true);
    assert.equal(shouldFlipFrom(), true);
  });

  // The card is not a button, so everything inside it keeps its own behaviour.
  it('leaves a press on something that does its own job alone', () => {
    assert.equal(shouldFlipFrom({ interactive: true }), false);
  });

  it('does not read the end of a text selection as a press', () => {
    assert.equal(shouldFlipFrom({ selecting: true }), false);
  });

  it('always answers its own toggle', () => {
    assert.equal(shouldFlipFrom({ toggle: true, interactive: true }), true);
    assert.equal(shouldFlipFrom({ toggle: true, selecting: true }), true);
  });
});

describe('clampDuration, labelFor and fillLabel', () => {
  it('keeps a turn inside what can be watched', () => {
    assert.equal(clampDuration(620), 620);
    assert.equal(clampDuration('240'), 240);
    assert.equal(clampDuration(10), MIN_DURATION);
    assert.equal(clampDuration(99999), MAX_DURATION);
    assert.equal(clampDuration('abc'), DEFAULT_DURATION);
    assert.equal(clampDuration(null), DEFAULT_DURATION);
  });

  it('names the control for the face it sits on', () => {
    assert.equal(labelFor('front'), DEFAULT_LABELS.details);
    assert.equal(labelFor('back'), DEFAULT_LABELS.back);
    assert.equal(labelFor('nonsense'), DEFAULT_LABELS.details);
  });

  it('fills a template and survives one that is missing', () => {
    assert.equal(fillLabel('Showing {face}', { face: 'the back' }), 'Showing the back');
    assert.equal(fillLabel(undefined, { face: 'x' }), '');
  });
});
