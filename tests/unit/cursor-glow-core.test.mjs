import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_FADE,
  DEFAULT_SIZE,
  GLOWING_POINTERS,
  MAX_FADE,
  MAX_SIZE,
  MIN_FADE,
  MIN_SIZE,
  clampFade,
  clampSize,
  glowVariables,
  positionIn,
  shouldGlowFor,
} from '../../components/cursor-glow/source/cursor-glow-core.js';

const RECT = { left: 100, top: 40, width: 300, height: 200 };

describe('positionIn', () => {
  it('gives the pointer in the region own pixels', () => {
    assert.deepEqual(positionIn(RECT, { x: 160, y: 90 }), { x: 60, y: 50 });
    assert.deepEqual(positionIn(RECT, { x: 100, y: 40 }), { x: 0, y: 0 });
  });

  // A pointer captured during a drag reports from outside the box, and a light that
  // followed it there would be a light on nothing.
  it('keeps the light inside the region', () => {
    assert.deepEqual(positionIn(RECT, { x: 9000, y: 9000 }), { x: 300, y: 200 });
    assert.deepEqual(positionIn(RECT, { x: -50, y: -50 }), { x: 0, y: 0 });
  });

  it('survives a region with no size and a pointer that is not there', () => {
    assert.deepEqual(positionIn({ left: 0, top: 0, width: 0, height: 0 }, { x: 5, y: 5 }), {
      x: 0,
      y: 0,
    });
    assert.deepEqual(positionIn(null, null), { x: 0, y: 0 });
  });
});

describe('shouldGlowFor', () => {
  it('answers a mouse and a pen', () => {
    assert.deepEqual([...GLOWING_POINTERS], ['mouse', 'pen']);
    assert.equal(shouldGlowFor('mouse'), true);
    assert.equal(shouldGlowFor('pen'), true);
  });

  // A touch screen has no hover, and a glow left where a finger last touched is a smudge.
  it('lights nothing for a finger, or for a pointer with no type at all', () => {
    assert.equal(shouldGlowFor('touch'), false);
    assert.equal(shouldGlowFor(undefined), false);
    assert.equal(shouldGlowFor(''), false);
  });
});

describe('clampSize and clampFade', () => {
  it('keeps the light inside what can be seen', () => {
    assert.equal(clampSize(420), 420);
    assert.equal(clampSize('140'), 140);
    assert.equal(clampSize(2), MIN_SIZE);
    assert.equal(clampSize(99999), MAX_SIZE);
    assert.equal(clampSize('abc'), DEFAULT_SIZE);
  });

  it('keeps the fade inside what can be waited for', () => {
    assert.equal(clampFade(260), 260);
    assert.equal(clampFade(0), MIN_FADE);
    assert.equal(clampFade(99999), MAX_FADE);
    assert.equal(clampFade(null), DEFAULT_FADE);
  });
});

describe('glowVariables', () => {
  it('hands the gradient two numbers in pixels', () => {
    assert.deepEqual(glowVariables(60, 50), {
      '--cursor-glow-x': '60px',
      '--cursor-glow-y': '50px',
    });
  });

  it('rounds them rather than writing a fraction of a pixel a frame', () => {
    assert.deepEqual(glowVariables(60.12345, 50.987), {
      '--cursor-glow-x': '60.12px',
      '--cursor-glow-y': '50.99px',
    });
  });

  it('survives nonsense', () => {
    assert.deepEqual(glowVariables('x', undefined), {
      '--cursor-glow-x': '0px',
      '--cursor-glow-y': '0px',
    });
  });
});
