import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_CLAMP,
  MIN_CLAMP,
  clampLines,
  pointerPosition,
  resolveEffect,
  resolveOrientation,
  resolveRatio,
  stateAttributes,
  tracksPointer,
} from '../../components/card/source/card-core.js';

describe('resolveEffect', () => {
  it('knows the treatments it has', () => {
    assert.equal(resolveEffect('zoom'), 'zoom');
    assert.equal(resolveEffect('spotlight'), 'spotlight');
    assert.equal(resolveEffect('none'), 'none');
  });

  it('falls back rather than leaving a card unstyled', () => {
    assert.equal(resolveEffect('sparkle'), 'lift');
    assert.equal(resolveEffect(undefined), 'lift');
    assert.equal(resolveEffect(null), 'lift');
  });

  it('knows which ones need to be told where the pointer is', () => {
    // A listener on every card in a grid, firing on every pointer move, is a cost nobody
    // asked for, so only the treatments that use it get one.
    assert.equal(tracksPointer('spotlight'), true);
    assert.equal(tracksPointer('lift'), false);
    assert.equal(tracksPointer('zoom'), false);
    assert.equal(tracksPointer('nonsense'), false);
  });
});

describe('resolveOrientation', () => {
  it('takes the one alternative and nothing else', () => {
    assert.equal(resolveOrientation('horizontal'), 'horizontal');
    assert.equal(resolveOrientation('vertical'), 'vertical');
    assert.equal(resolveOrientation('sideways'), 'vertical');
    assert.equal(resolveOrientation(undefined), 'vertical');
  });
});

describe('clampLines', () => {
  it('keeps a limit that was asked for', () => {
    assert.equal(clampLines(2), 2);
    assert.equal(clampLines('3'), 3);
  });

  it('says nothing rather than guessing when none was asked for', () => {
    // "No limit" and "one line" are different answers, and a fallback of one would quietly
    // hide most of a card.
    assert.equal(clampLines(undefined), null);
    assert.equal(clampLines(''), null);
    assert.equal(clampLines('abc'), null);
    assert.equal(clampLines(0), null);
    assert.equal(clampLines(-4), null);
  });

  it('holds the range', () => {
    assert.equal(clampLines(99), MAX_CLAMP);
    assert.equal(clampLines(1), MIN_CLAMP);
  });
});

describe('resolveRatio', () => {
  it('takes a shape CSS will accept', () => {
    assert.equal(resolveRatio('4 / 3'), '4 / 3');
    assert.equal(resolveRatio('16/9'), '16 / 9');
    assert.equal(resolveRatio('1.5'), '1.5');
  });

  it('falls back rather than passing nonsense through', () => {
    // An invalid `aspect-ratio` is ignored by the browser, and a card whose picture is
    // suddenly its natural size breaks every row it sits in.
    assert.equal(resolveRatio('wide'), '16 / 9');
    assert.equal(resolveRatio('4 / 0'), '16 / 9');
    assert.equal(resolveRatio('-4 / 3'), '16 / 9');
    assert.equal(resolveRatio(''), '16 / 9');
    assert.equal(resolveRatio(undefined), '16 / 9');
    assert.equal(resolveRatio('1 / 2 / 3'), '16 / 9');
  });

  it('takes a fallback of its own', () => {
    assert.equal(resolveRatio('nope', { fallback: '1 / 1' }), '1 / 1');
  });
});

describe('pointerPosition', () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };

  it('reports where the pointer is as a share of the card', () => {
    assert.deepEqual(pointerPosition({ point: { x: 200, y: 100 }, rect }), { x: 50, y: 50 });
    assert.deepEqual(pointerPosition({ point: { x: 100, y: 50 }, rect }), { x: 0, y: 0 });
    assert.deepEqual(pointerPosition({ point: { x: 300, y: 150 }, rect }), { x: 100, y: 100 });
  });

  it('holds the edges', () => {
    // A pointer can be over the card's shadow or a lifted control that sticks out, and a
    // spotlight running off the edge looks like a fault rather than an effect.
    assert.deepEqual(pointerPosition({ point: { x: -400, y: -400 }, rect }), { x: 0, y: 0 });
    assert.deepEqual(pointerPosition({ point: { x: 900, y: 900 }, rect }), { x: 100, y: 100 });
  });

  it('survives a card with no size and nonsense input', () => {
    assert.deepEqual(pointerPosition({ point: { x: 5, y: 5 }, rect: { width: 0, height: 0 } }), {
      x: 100,
      y: 100,
    });
    assert.deepEqual(pointerPosition(), { x: 0, y: 0 });
  });
});

describe('stateAttributes', () => {
  it('says nothing about a state a card is not in', () => {
    assert.deepEqual(stateAttributes(), {
      'aria-busy': null,
      'aria-disabled': null,
      'aria-current': null,
    });
  });

  it('says each state it is in', () => {
    assert.deepEqual(stateAttributes({ loading: true }), {
      'aria-busy': 'true',
      'aria-disabled': null,
      'aria-current': null,
    });
    assert.deepEqual(stateAttributes({ disabled: true, current: true }), {
      'aria-busy': null,
      'aria-disabled': 'true',
      'aria-current': 'true',
    });
  });
});
