import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..');
const COMPONENT = path.join(PROJECT_ROOT, 'components', 'locator-map');
const THUMBNAIL_PATH = path.join(COMPONENT, 'preview', 'thumbnail.svg');

/**
 * The card on the catalog page is this file, not a screenshot.
 *
 * `poster.png` and `demo.webm` are regenerated from the running variant, so they follow the
 * component whether anyone remembers them or not. The thumbnail is drawn by hand, which means
 * it goes stale silently — it advertised the built-in drawing for a while after every variant
 * had moved to a real provider, and nothing failed.
 */
test('locator-map thumbnail shows the surface the component actually mounts', async () => {
  const thumbnail = await fs.readFile(THUMBNAIL_PATH, 'utf8');

  assert.match(thumbnail, /viewBox="0 0 640 360"/);
  assert.match(thumbnail, /role="img"/);
  assert.match(thumbnail, /aria-label="[^"]*street map[^"]*"/);

  // The coastline path the drawing uses. Its presence here would mean the card is advertising
  // a surface no variant puts up any more.
  const coastline = await fs.readFile(path.join(COMPONENT, 'source', 'shared.js'), 'utf8');
  const opening = coastline.match(/'(M\d+ \d+)',/)?.[1];

  assert.ok(opening, 'expected to find the drawing coastline in shared.js');
  assert.ok(
    !thumbnail.includes(opening),
    `the thumbnail still draws the built-in country outline (${opening})`,
  );

  // What a provider's map looks like instead: roads, water, the control in its corner, and
  // the attribution that is a licence condition rather than decoration.
  for (const marker of ['OpenStreetMap', '#132433', '#333e4c', '#86a0ff', '#ff8a5b']) {
    assert.ok(thumbnail.includes(marker), `missing thumbnail marker: ${marker}`);
  }

  // The addresses on the card are the demo data, so they have to be the demo data.
  const variant = await fs.readFile(
    path.join(COMPONENT, 'source', 'variants', 'default', 'index.html'),
    'utf8',
  );

  for (const address of ['210 Bach Dang, Hai Chau', '72 Le Thanh Tong, Cua Nam']) {
    assert.ok(thumbnail.includes(address), `thumbnail is missing ${address}`);
    assert.ok(variant.includes(address), `the Default variant no longer says ${address}`);
  }

  // Static and self-contained: the card is shown far from the component that owns it.
  assert.doesNotMatch(thumbnail, /<(?:animate|animateTransform|set|script|image)\b/i);
  assert.doesNotMatch(thumbnail, /(?:href|xlink:href)\s*=/i);
  assert.doesNotMatch(thumbnail, /data:image\//i);
});
