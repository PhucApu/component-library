import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..');
const THUMBNAIL_PATH = path.join(
  PROJECT_ROOT,
  'components',
  'temporal-picker',
  'preview',
  'thumbnail.svg',
);

test('temporal-picker thumbnail is a faithful static datetime miniature', async () => {
  const thumbnail = await fs.readFile(THUMBNAIL_PATH, 'utf8');

  assert.match(thumbnail, /viewBox="0 0 640 360"/);
  assert.match(thumbnail, /<title[^>]*>Temporal Picker datetime preview<\/title>/);
  assert.match(thumbnail, /<desc[^>]*>[^<]+<\/desc>/);

  for (const marker of [
    'September',
    '2027',
    '>18<',
    '>08<',
    '>45<',
    '>30<',
    '>Second<',
    '>Apply<',
  ]) {
    assert.ok(thumbnail.includes(marker), `missing thumbnail marker: ${marker}`);
  }

  assert.doesNotMatch(thumbnail, /<(?:animate|animateTransform|set|script|image)\b/i);
  assert.doesNotMatch(thumbnail, /(?:href|xlink:href)\s*=/i);
  assert.doesNotMatch(thumbnail, /data:image\//i);
});
