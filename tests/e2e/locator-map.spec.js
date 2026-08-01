import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/locator-map/source/variants';
const VARIANTS = ['default', 'search', 'detail', 'regions', 'controls', 'states', 'adapter'];
const ORIGIN = 'http://127.0.0.1:5173';

/**
 * The origins `source/real-map.js` names, written out again rather than imported.
 *
 * This component is the one exception in the collection: it fetches a real map, so it cannot
 * be checked for reaching nowhere. What replaces that check is this list. Importing it from
 * the file under test would let a new origin added there approve itself, which is the opposite
 * of what the check is for.
 */
const ALLOWED_ORIGINS = [
  'https://unpkg.com',
  'https://tile.openstreetmap.org',
  'https://maps.googleapis.com',
  'https://maps.gstatic.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

const PROVIDER = /unpkg\.com|tile\.openstreetmap\.org|maps\.googleapis\.com|maps\.gstatic\.com/;

const blocked = new WeakSet();

/**
 * Notices the component's own faults and not somebody else's outage.
 *
 * A request that was deliberately aborted, or a tile server having a bad minute, writes to the
 * console. Counting that as a runtime error would make every test here a test of the network.
 * The text of those lines is only `Failed to load resource: net::ERR_FAILED` — which URL
 * failed is in the location rather than the message, so that is what has to be read.
 */
function trackRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    const from = `${message.text()} ${message.location()?.url ?? ''}`;

    if (message.type() === 'error' && !PROVIDER.test(from)) {
      errors.push(from);
    }
  });
  return errors;
}

function trackExternalRequests(page) {
  const seen = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== ORIGIN) {
      seen.push(url);
    }
  });
  return seen;
}

/**
 * Loads a variant with the provider unreachable.
 *
 * Most of what is worth measuring here belongs to the component rather than to the map behind
 * it: the projection, the ranking, the keyboard, the directory. Blocking the provider is how
 * those get measured against a surface that behaves the same way every run and needs nobody
 * else to be awake — `attachRealMap` fails, marks the element and leaves the drawing where the
 * element had already put it. That the real map arrives when it can is checked separately.
 */
async function ready(page, variant) {
  if (!blocked.has(page)) {
    blocked.add(page);
    await page.route(PROVIDER, (route) => route.abort());
  }

  // `domcontentloaded` rather than `load`: this page fetches a map from somebody else, and
  // waiting for every last tile to arrive would make navigation as slow as the slowest one.
  await page.goto(`${COMPONENT_BASE}/${variant}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => customElements.get('ui-locator-map'));
  await page.waitForFunction(() =>
    [...document.querySelectorAll('ui-locator-map')].every((map) =>
      map.hasAttribute('data-map-unavailable'),
    ),
  );
  await page.waitForTimeout(200);
}

/** Loads a variant with the provider allowed, and waits for it to actually be there. */
async function readyOnline(page, variant) {
  // `domcontentloaded` rather than `load`: this page fetches a map from somebody else, and
  // waiting for every last tile to arrive would make navigation as slow as the slowest one.
  await page.goto(`${COMPONENT_BASE}/${variant}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => customElements.get('ui-locator-map'));
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('ui-locator-map')].every((map) =>
        map.querySelector('.locator-map__surface'),
      ),
    undefined,
    { timeout: 20000 },
  );
  await page.waitForTimeout(300);
}

const viewOf = (page) => page.evaluate(() => document.querySelector('ui-locator-map').view);

/** Waits for the flight to finish rather than guessing how long it takes. */
async function settle(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const world = document.querySelector('.locator-map__world');
        let last = world.getBoundingClientRect().width;
        let steady = 0;
        const started = performance.now();

        const tick = () => {
          const now = world.getBoundingClientRect().width;
          steady = Math.abs(now - last) < 0.5 ? steady + 1 : 0;
          last = now;

          if (steady >= 6 || performance.now() - started > 3000) {
            resolve();
            return;
          }

          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      }),
  );
}

test('all seven variants run independently and none of them overflows', async ({ page }) => {
  // Fourteen navigations in one test, each waiting for a blocked request to be refused. The
  // default budget is one page's worth and this is not one page.
  test.slow();

  const runtimeErrors = trackRuntimeErrors(page);

  for (const variant of VARIANTS) {
    for (const width of [960, 360]) {
      await page.setViewportSize({ width, height: 720 });
      await ready(page, variant);

      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('ui-locator-map').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  expect(runtimeErrors).toEqual([]);
});

test('every variant puts a real map up, and reaches nowhere it is not allowed to', async ({
  page,
}) => {
  // Seven navigations, each waiting on somebody else's server. Slow is the honest label.
  test.slow();

  const external = trackExternalRequests(page);
  const runtimeErrors = trackRuntimeErrors(page);

  await page.setViewportSize({ width: 960, height: 720 });

  for (const variant of VARIANTS) {
    await readyOnline(page, variant);

    // Every one of them, not just the first: the point of the change was that no page in this
    // catalog shows a drawing where a map belongs.
    const surfaces = await page.evaluate(() =>
      [...document.querySelectorAll('ui-locator-map')].map((map) => ({
        adapter: map.adapter?.constructor?.name,
        surface: Boolean(map.querySelector('.locator-map__surface')),
        drawing: Boolean(map.querySelector('.locator-map__drawing')),
        provider: map.getAttribute('data-map-provider'),
        unavailable: map.hasAttribute('data-map-unavailable'),
        // Tiles rather than only a container: a map that mounted but drew nothing is a grey
        // box wearing a provider's name.
        tiles: map.querySelectorAll('img.leaflet-tile').length,
      })),
    );

    expect(surfaces.length).toBeGreaterThan(0);
    surfaces.forEach((map) => {
      expect(map).toMatchObject({
        adapter: 'LeafletMap',
        surface: true,
        drawing: false,
        provider: 'leaflet',
        unavailable: false,
      });
      expect(map.tiles).toBeGreaterThan(0);
    });
  }

  // It really did go out, or the check below is a check of nothing.
  expect(external.length).toBeGreaterThan(0);

  // And only to the origins the component names. This replaces the reaches-nowhere rule the
  // rest of the collection is held to; it is narrowed, not dropped.
  const strangers = [...new Set(external.map((url) => url.origin))].filter(
    (origin) => !ALLOWED_ORIGINS.includes(origin),
  );
  expect(strangers).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('three maps on one page all get their own surface', async ({ page }) => {
  // Waits on somebody else's servers, and shares them with every other online test in this
  // file. The default budget is for a page that answers from disk.
  test.slow();

  await page.setViewportSize({ width: 960, height: 900 });
  await readyOnline(page, 'states');

  // The second and third asked for a provider the first had already sent for. Sharing one
  // request is the easy half; the hard half is that they must not end up waiting on a `load`
  // event that fired before they started listening.
  const surfaces = await page.evaluate(() => ({
    maps: document.querySelectorAll('ui-locator-map').length,
    surfaces: document.querySelectorAll('.locator-map__surface').length,
    scripts: document.querySelectorAll('script[src*="leaflet"]').length,
    sheets: document.querySelectorAll('link[href*="leaflet"]').length,
  }));

  expect(surfaces).toEqual({ maps: 3, surfaces: 3, scripts: 1, sheets: 1 });
});

test('the results list sits above the map, not behind its controls', async ({ page }) => {
  // Waits on somebody else's servers, and shares them with every other online test in this
  // file. The default budget is for a page that answers from disk.
  test.slow();

  await page.setViewportSize({ width: 960, height: 720 });
  await readyOnline(page, 'default');

  await page.locator('.locator-map__input').click();
  await page.locator('.locator-map__input').fill('ha');
  await page.waitForTimeout(200);

  const overlap = await page.evaluate(() => {
    const map = document.querySelector('ui-locator-map');
    const list = map.querySelector('.locator-map__results');
    const box = list.getBoundingClientRect();

    // Leaflet stacks its controls at `z-index: 1000`. Anywhere one of them sits under the
    // open list, the list has to come out on top — hit-testing follows paint order, so this
    // asks the browser what is actually in front rather than reading a number and hoping.
    const points = [...map.querySelectorAll('.leaflet-control')]
      .map((control) => control.getBoundingClientRect())
      .map((rect) => [rect.left + rect.width / 2, rect.top + rect.height / 2])
      .filter(([x, y]) => x > box.left && x < box.right && y > box.top && y < box.bottom);

    return {
      tested: points.length,
      inFront: points
        .map(([x, y]) => document.elementFromPoint(x, y))
        .filter((element) => !list.contains(element))
        .map((element) => element.className.toString().trim()),
    };
  });

  // At least one control really is underneath, or this proves nothing at all.
  expect(overlap.tested).toBeGreaterThan(0);
  expect(overlap.inFront).toEqual([]);
});

test('the provider is dressed in the component own tokens', async ({ page }) => {
  // Waits on somebody else's servers, and shares them with every other online test in this
  // file. The default budget is for a page that answers from disk.
  test.slow();

  const external = trackExternalRequests(page);

  await page.setViewportSize({ width: 960, height: 720 });
  await readyOnline(page, 'default');

  await page.locator('.locator-map__entry').first().click();
  await page.waitForTimeout(800);

  const skin = await page.evaluate(() => {
    const map = document.querySelector('ui-locator-map');
    const read = (selector, property) => {
      const element = map.querySelector(selector);
      return element ? getComputedStyle(element)[property] : null;
    };

    return {
      // A bright street map in a dark page reads as a hole punched in it.
      tiles: read('.leaflet-tile-pane', 'filter'),
      // The provider's pin is this component's pin, and the chosen one is marked the same way
      // the drawing marks it.
      pins: map.querySelectorAll('.locator-map__provider-pin .locator-map__pin').length,
      chosen: map.querySelectorAll('.locator-map__pin[data-selected]').length,
      pinColour: read('.locator-map__pin[data-selected]', 'backgroundColor'),
      accent: getComputedStyle(map).getPropertyValue('--locator-accent').trim(),
      // The zoom control matches the three the drawing puts in the same corner, rather than
      // arriving white.
      zoomBackground: read('.leaflet-control-zoom a', 'backgroundColor'),
      // Attribution is a licence condition, so it is restyled and not removed.
      attribution: map.querySelector('.leaflet-control-attribution')?.textContent.trim(),
    };
  });

  expect(skin.tiles).not.toBe('none');
  expect(skin.pins).toBe(9);
  expect(skin.chosen).toBe(1);
  expect(skin.accent).toBe('#86a0ff');
  expect(skin.pinColour).toBe('rgb(134, 160, 255)');
  expect(skin.zoomBackground).not.toBe('rgb(255, 255, 255)');
  expect(skin.attribution).toContain('OpenStreetMap');

  // And the provider's own pin images are never asked for, because they are never used.
  expect(external.filter((url) => /marker-icon|marker-shadow/.test(url.pathname))).toEqual([]);
});

test('a provider that cannot be reached leaves the drawing and says so', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  // Showing nothing at all when a third party is down would trade away the only thing this
  // component could guarantee.
  const map = page.locator('ui-locator-map');
  await expect(map).toHaveAttribute('data-map-unavailable', '');
  await expect(map).not.toHaveAttribute('data-map-provider');
  await expect(map.locator('.locator-map__drawing')).toBeVisible();
  await expect(map.locator('.locator-map__marker')).toHaveCount(9);
  await expect(page.locator('output')).toContainText('could not be loaded');

  // And the search still works over it.
  await page.locator('.locator-map__input').fill('da nang');
  await expect(page.locator('.locator-map__result[role="option"]')).toHaveCount(1);
});

test('with no script it is still every address', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${COMPONENT_BASE}/default/index.html`);

  // The markup is the data and the fallback at once, so what is left is a working directory
  // rather than an empty grey box. This is the part that survives having no provider, no
  // network and no script at all.
  const items = page.locator('.locator-map__places > li');
  await expect(items).toHaveCount(9);
  await expect(items.first().locator('h3')).toHaveText('Hanoi head office');
  await expect(items.first().locator('p')).toHaveText('72 Le Thanh Tong, Cua Nam');
  // The ward the coordinate is actually in, as OpenStreetMap has it. An address that names a
  // ward the map does not agree with reads as a wrong pin even when the pin is right.
  await expect(items.first()).toHaveAttribute('data-lat', '21.0235');

  // And nothing was invented: no map, no markers, no search.
  await expect(page.locator('.locator-map__marker')).toHaveCount(0);
  await expect(page.locator('.locator-map__input')).toHaveCount(0);

  await context.close();
});

test('markers land where the projection puts them', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  const placed = await page.evaluate(() => {
    const map = document.querySelector('ui-locator-map');
    const read = (name) => {
      const marker = [...map.querySelectorAll('.locator-map__marker')].find((node) =>
        node.getAttribute('aria-label').startsWith(name),
      );
      return {
        x: Number.parseFloat(marker.style.getPropertyValue('--marker-x')),
        y: Number.parseFloat(marker.style.getPropertyValue('--marker-y')),
      };
    };

    return { hanoi: read('Hanoi'), daNang: read('Da Nang'), canTho: read('Can Tho') };
  });

  // South is down and east is right, and the arithmetic is Web Mercator rather than a guess.
  expect(placed.daNang.y).toBeGreaterThan(placed.hanoi.y);
  expect(placed.daNang.x).toBeGreaterThan(placed.hanoi.x);
  expect(placed.canTho.y).toBeGreaterThan(placed.daNang.y);
  expect(placed.canTho.x).toBeLessThan(placed.daNang.x);

  // And inside the drawing rather than off the edge of it.
  Object.values(placed).forEach((point) => {
    expect(point.x).toBeGreaterThan(0);
    expect(point.x).toBeLessThan(100);
    expect(point.y).toBeGreaterThan(0);
    expect(point.y).toBeLessThan(100);
  });
});

test('choosing a result flies the map to that office', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  expect(await viewOf(page)).toEqual({ x: 0, y: 0, k: 1 });

  await page.locator('.locator-map__input').fill('da nang');
  await expect(page.locator('.locator-map__result[role="option"]')).toHaveCount(1);
  await page.locator('.locator-map__result[role="option"]').first().click();
  await settle(page);

  const view = await viewOf(page);
  expect(view.k).toBeGreaterThan(1);

  // And it landed on the office rather than near it.
  const centred = await page.evaluate(() => {
    const map = document.querySelector('ui-locator-map');
    const frame = map.querySelector('.locator-map__frame').getBoundingClientRect();
    const marker = map.querySelector('.locator-map__marker[data-selected]').getBoundingClientRect();

    return {
      offX: Math.round(marker.left + marker.width / 2 - (frame.left + frame.width / 2)),
      offY: Math.round(marker.top + marker.height / 2 - (frame.top + frame.height / 2)),
      name: map.querySelector('.locator-map__marker[data-selected]').getAttribute('aria-label'),
    };
  });

  expect(Math.abs(centred.offX)).toBeLessThanOrEqual(2);
  expect(Math.abs(centred.offY)).toBeLessThanOrEqual(2);
  expect(centred.name).toContain('Da Nang');
});

test('choosing a result moves the real map too', async ({ page }) => {
  // Waits on somebody else's servers, and shares them with every other online test in this
  // file. The default budget is for a page that answers from disk.
  test.slow();

  await page.setViewportSize({ width: 960, height: 720 });
  await readyOnline(page, 'default');

  const before = await viewOf(page);
  expect(before.zoom).toBeLessThan(10);

  // The demo line is written before the provider is fetched, so it starts out describing the
  // drawing's `{ x, y, k }`. It has to be rewritten when the real map lands, or the page
  // reports one surface's view underneath another's map.
  await expect(page.locator('output')).toContainText('zoom');

  await page.locator('.locator-map__input').fill('da nang');
  await expect(page.locator('.locator-map__result[role="option"]')).toHaveCount(1);
  await page.locator('.locator-map__result[role="option"]').first().click();
  await page.waitForTimeout(1500);

  // Bach Dang in Hai Chau, and the coordinate is the street's rather than the city's. Two
  // decimal places, not one: a city centroid would pass at one, which is exactly the mistake
  // this data used to make.
  const after = await viewOf(page);
  expect(after.zoom).toBe(16);
  expect(after.lat).toBeCloseTo(16.0739, 2);
  expect(after.lon).toBeCloseTo(108.2246, 2);

  // The component reports the choice whatever is underneath it.
  expect(await page.evaluate(() => document.querySelector('ui-locator-map').selected)).toBe(4);
});

test('the flight passes through the middle rather than jumping', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  const frames = await page.evaluate(async () => {
    const map = document.querySelector('ui-locator-map');
    const world = map.querySelector('.locator-map__world');
    const samples = [];

    map.flyTo(8);

    for (let frame = 0; frame < 20; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      samples.push(+world.getBoundingClientRect().width.toFixed(1));
    }

    return samples;
  });

  const start = frames[0];
  const end = Math.max(...frames);

  expect(end).toBeGreaterThan(start * 2);
  // Real intermediate widths, or it is not a flight, it is an arrival.
  expect(frames.filter((value) => value > start + 1 && value < end - 1).length).toBeGreaterThanOrEqual(5);
});

test('the markers keep their size however close the map gets', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'controls');

  // A pin that is not the chosen one. The chosen one is deliberately drawn larger, so
  // measuring it would report the selection style and call it a scaling fault.
  const pin = () =>
    page.evaluate(() =>
      Math.round(
        document
          .querySelector('.locator-map__marker:not([data-selected]) .locator-map__pin')
          .getBoundingClientRect().width,
      ),
    );
  const stroke = () =>
    page.evaluate(() => getComputedStyle(document.querySelector('.locator-map__land')).strokeWidth);

  const rest = { pin: await pin(), stroke: await stroke() };

  await page.evaluate(() => document.querySelector('ui-locator-map').flyTo(0));
  await settle(page);

  // A marker that scales with its map swallows the place it is pointing at, which is why no
  // map anyone has used does it. The coastline holds its width the same way.
  //
  // Polled rather than sampled once. `--map-k` is written the moment the flight starts while
  // the world eases into it, so mid-flight a pin really is smaller than it will end up — and
  // `settle` gives up after three seconds, which on a loaded machine can land inside that
  // window. What is being checked is where the pin ends, not every frame on the way.
  await expect.poll(pin, { timeout: 4000 }).toBe(rest.pin);
  expect(await stroke()).toBe(rest.stroke);
  expect((await viewOf(page)).k).toBeGreaterThan(3);
});

test('an unmarked query still matches, and the answer keeps its marks', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'search');

  // The pages in this repository are unaccented by policy, so the folding is proved here on
  // text the page is given at run time rather than text it ships with.
  const found = await page.evaluate(() => {
    const map = document.querySelector('ui-locator-map');
    const first = map.querySelector('.locator-map__places > li h3 button');
    // Spelled as escaped code points because a check in this repository refuses marked
    // letters in its own text. The letters still reach the page at run time.
    first.textContent = '\u0110\u00e0 N\u1eb5ng annexe';

    map.setAttribute('region', '');
    map.removeAttribute('region');

    const input = map.querySelector('.locator-map__input');
    input.value = 'da nang';
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));

    return [...map.querySelectorAll('.locator-map__result-name')].map((node) => ({
      text: node.textContent,
      marked: node.querySelector('mark')?.textContent ?? null,
    }));
  });

  expect(found.length).toBeGreaterThan(0);
  const annexe = found.find((result) => result.text.endsWith('annexe'));
  expect(annexe).toBeTruthy();
  // Cut from the original, so the marks come back rather than the folded spelling showing.
  expect(annexe.marked).toBe('\u0110\u00e0 N\u1eb5ng');
});

test('the results are ranked, and an empty answer says so', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'search');

  await page.locator('.locator-map__input').fill('ha');
  await page.waitForTimeout(150);

  const names = await page.evaluate(() =>
    [...document.querySelectorAll('.locator-map__result-name')].map((node) => node.textContent),
  );

  // Three names start with it, so they keep the order they are written in — a stable rule
  // rather than an alphabetical one nobody asked for.
  expect(names.slice(0, 3)).toEqual(['Ha Noi head office', 'Hai Phong depot', 'Ha Long site']);
  // And an office found only by its street — Da Nang is on Hai Chau — comes after all of
  // them. Somebody typing two letters means the city, not an address that happens to hold
  // them.
  expect(names).toContain('Da Nang office');
  expect(names.indexOf('Da Nang office')).toBe(names.length - 1);

  await page.locator('.locator-map__input').fill('zzz');
  await page.waitForTimeout(150);

  // Saying nothing at all would leave somebody wondering whether it was still working.
  await expect(page.locator('.locator-map__result--empty')).toHaveText(/No office matches/);
});

test('the search is a combobox the keyboard can use', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'search');

  const input = page.locator('.locator-map__input');
  await expect(input).toHaveAttribute('role', 'combobox');
  await expect(input).toHaveAttribute('aria-expanded', 'false');

  await input.click();
  await input.fill('ha');
  await page.waitForTimeout(150);
  await expect(input).toHaveAttribute('aria-expanded', 'true');

  const activeName = () =>
    page.evaluate(() => {
      const id = document.querySelector('.locator-map__input').getAttribute('aria-activedescendant');
      return document.getElementById(id)?.querySelector('.locator-map__result-name')?.textContent;
    });

  expect(await activeName()).toBe('Ha Noi head office');
  await page.keyboard.press('ArrowDown');
  expect(await activeName()).toBe('Hai Phong depot');

  await page.keyboard.press('Enter');
  await settle(page);

  expect(await page.evaluate(() => document.querySelector('ui-locator-map').selected)).toBe(1);
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(input).toHaveValue('Hai Phong depot');
});

test('Escape closes the list and leaves the map where it was', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'search');

  const before = await viewOf(page);
  await page.locator('.locator-map__input').click();
  await page.locator('.locator-map__input').fill('ha');
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');

  await expect(page.locator('.locator-map__input')).toHaveAttribute('aria-expanded', 'false');
  expect(await viewOf(page)).toEqual(before);
});

test('a marker and a directory entry both fly the map', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  await page.locator('.locator-map__marker').nth(1).click();
  await settle(page);
  expect(await page.evaluate(() => document.querySelector('ui-locator-map').selected)).toBe(1);

  await page.locator('.locator-map__entry').nth(5).click();
  await settle(page);
  expect(await page.evaluate(() => document.querySelector('ui-locator-map').selected)).toBe(5);

  // The name in the directory is a button, so the list works as well as the map.
  await expect(page.locator('.locator-map__entry').nth(5)).toHaveAttribute('data-selected', '');
});

test('the map can be got back out of', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'detail');

  await page.evaluate(() => document.querySelector('ui-locator-map').flyTo(3));
  await settle(page);
  expect((await viewOf(page)).k).toBeGreaterThan(1);

  // A map that can only be zoomed in is a trap.
  await page.locator('[data-action="reset"]').click();
  await settle(page);

  expect(await viewOf(page)).toEqual({ x: 0, y: 0, k: 1 });
  expect(await page.evaluate(() => document.querySelector('ui-locator-map').selected)).toBe(-1);
  await expect(page.locator('.locator-map__marker[data-selected]')).toHaveCount(0);
});

test('the map never leaves the frame, however hard it is pushed', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'controls');

  await page.evaluate(() => {
    const map = document.querySelector('ui-locator-map');
    map.zoomIn();
    map.zoomIn();
  });
  await settle(page);

  // A real pointer rather than dispatched `PointerEvent`s. A synthetic one carries no pointer
  // id the browser knows, so capture fails and the drag never starts — the test would then
  // pass because nothing moved, which is the opposite of what it claims to check.
  const box = await page.locator('.locator-map__frame').boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();

  // Drag much further than the map could possibly go.
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(box.x + 20 + step * 300, box.y + 20 + step * 300);
  }

  await page.mouse.up();
  await page.waitForTimeout(200);

  const pushed = await viewOf(page);

  // Past the edge the frame would show sea where the country used to be.
  expect(pushed.x).toBeLessThanOrEqual(0.001);
  expect(pushed.y).toBeLessThanOrEqual(0.001);
  expect(pushed.x).toBeGreaterThanOrEqual(1 - pushed.k - 0.001);
});

test('the keyboard moves the map, and one press is one step', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'controls');

  await page.locator('.locator-map__frame').focus();
  // Read after focusing, not before: focusing scrolls the frame into view, and counting that
  // as the keys scrolling the page would fail a test about something else entirely.
  const parked = await page.evaluate(() => window.scrollY);

  await page.keyboard.press('+');
  await settle(page);
  const zoomed = await viewOf(page);
  expect(zoomed.k).toBeGreaterThan(1);

  await page.keyboard.press('ArrowRight');
  await settle(page);
  expect((await viewOf(page)).x).toBeLessThan(zoomed.x);

  await page.keyboard.press('0');
  await settle(page);
  expect(await viewOf(page)).toEqual({ x: 0, y: 0, k: 1 });

  // Cancelled, or the frame scrolls the page as well as panning the map.
  expect(await page.evaluate(() => window.scrollY)).toBe(parked);
});

test('the zoom controls drive the real map as well', async ({ page }) => {
  // Waits on somebody else's servers, and shares them with every other online test in this
  // file. The default budget is for a page that answers from disk.
  test.slow();

  await page.setViewportSize({ width: 960, height: 720 });
  await readyOnline(page, 'controls');

  const zoom = () => page.evaluate(() => document.querySelector('ui-locator-map').view.zoom);
  const rest = await zoom();

  // Through the same `zoomBy` the drawing answers. Nothing in the component reaches past the
  // seven members into whatever is actually mounted.
  await page.evaluate(() => document.querySelector('ui-locator-map').zoomIn());
  await page.waitForTimeout(400);
  expect(await zoom()).toBe(rest + 1);

  await page.evaluate(() => document.querySelector('ui-locator-map').zoomOut());
  await page.waitForTimeout(400);
  expect(await zoom()).toBe(rest);
});

test('a region narrows the markers, the directory and the search together', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'regions');

  expect(await page.locator('.locator-map__marker').count()).toBe(10);

  await page.evaluate(() => document.querySelector('ui-locator-map').setAttribute('region', 'south'));
  await page.waitForTimeout(200);

  const south = await page.evaluate(() => {
    const map = document.querySelector('ui-locator-map');
    return {
      markers: map.querySelectorAll('.locator-map__marker').length,
      // Offices only. The group headings are list items too, and counting them would report
      // one more office than there is.
      shown: map.querySelectorAll(
        '.locator-map__places > li:not([hidden]):not(.locator-map__group)',
      ).length,
      visible: map.visible.length,
      places: map.places.length,
    };
  });

  // Leaving the filtered offices in the directory would mean a screen reader announcing
  // addresses that nothing on screen can show.
  expect(south).toEqual({ markers: 3, shown: 3, visible: 3, places: 10 });

  // And the search only ever sees what the map can show. Options rather than rows: the "no
  // office matches" line is a row too, and counting it would report a match that is not one.
  await page.locator('.locator-map__input').fill('ha');
  await page.waitForTimeout(150);
  expect(await page.locator('.locator-map__result[role="option"]').count()).toBe(0);
  await expect(page.locator('.locator-map__result--empty')).toBeVisible();
});

test('one office needs no special case, and none removes the directory', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  const single = page.locator('ui-locator-map').first();
  await expect(single.locator('.locator-map__marker')).toHaveCount(1);
  await expect(single.locator('.locator-map__input')).toBeVisible();

  const none = page.locator('ui-locator-map').nth(1);
  await expect(none).toHaveAttribute('data-empty', '');
  await expect(none.locator('.locator-map__marker')).toHaveCount(0);
  // The map is still there; there is simply nothing on it.
  await expect(none.locator('.locator-map__frame')).toBeVisible();
});

test('the search can be taken off without taking anything else', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  const bare = page.locator('ui-locator-map').nth(2);
  await expect(bare.locator('.locator-map__search')).toBeHidden();
  await expect(bare.locator('.locator-map__marker')).toHaveCount(2);
  await expect(bare.locator('.locator-map__entry')).toHaveCount(2);
  await expect(bare.locator('[data-action="reset"]')).toBeVisible();
});

test('the chosen office is announced and reported', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'detail');

  const reported = await page.evaluate(async () => {
    const map = document.querySelector('ui-locator-map');
    const seen = [];
    map.addEventListener('locator-select', (event) => seen.push(event.detail));

    map.flyTo(1);
    await new Promise((resolve) => setTimeout(resolve, 300));

    return { seen, status: map.querySelector('[role="status"]').textContent };
  });

  expect(reported.seen).toEqual([
    {
      index: 1,
      name: 'Da Nang office',
      address: '210 Bach Dang, Hai Chau',
      region: 'central',
    },
  ]);
  expect(reported.status).toBe('Da Nang office. 210 Bach Dang, Hai Chau');
});

test('every office has a directions link named for it, and none of them fetches anything', async ({
  page,
}) => {
  const external = trackExternalRequests(page);

  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  const links = await page.evaluate(() =>
    [...document.querySelectorAll('.locator-map__directions')].map((link) => ({
      href: link.getAttribute('href'),
      label: link.getAttribute('aria-label'),
      target: link.getAttribute('target'),
      rel: link.getAttribute('rel'),
    })),
  );

  expect(links).toHaveLength(9);
  expect(links[0].href).toBe(
    'https://www.google.com/maps/dir/?api=1&destination=21.0235%2C105.8573',
  );
  // Nine links all called "Directions" are nine links nobody can tell apart out of context.
  expect(links[0].label).toBe('Directions to Hanoi head office');
  expect(new Set(links.map((link) => link.label)).size).toBe(9);
  expect(links[0].target).toBe('_blank');
  expect(links[0].rel).toContain('noopener');

  // A link makes no request until it is pressed. Nine of them on the page cost nothing, which
  // is why they stay even where the map itself cannot be reached.
  expect(external.filter((url) => url.hostname === 'www.google.com')).toEqual([]);
});

test('the directory is grouped by region, a level above the offices', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'regions');

  const grouped = await page.evaluate(() => {
    const map = document.querySelector('ui-locator-map');
    return [...map.querySelectorAll('.locator-map__group')].map((group) => ({
      tag: group.querySelector('.locator-map__group-name').tagName,
      name: group.querySelector('.locator-map__group-name').textContent,
      count: group.querySelector('.locator-map__group-count').textContent,
    }));
  });

  // One level above the offices' own headings, or the outline of the page is a lie.
  expect(grouped).toEqual([
    { tag: 'H2', name: 'north', count: '3' },
    { tag: 'H2', name: 'central', count: '4' },
    { tag: 'H2', name: 'south', count: '3' },
  ]);

  // Each heading really does sit above its own offices.
  const ordered = await page.evaluate(() =>
    [...document.querySelectorAll('.locator-map__places > li')].map((item) =>
      item.classList.contains('locator-map__group')
        ? `# ${item.querySelector('.locator-map__group-name').textContent}`
        : item.dataset.region,
    ),
  );

  expect(ordered.slice(0, 4)).toEqual(['# north', 'north', 'north', 'north']);
});

test('filtering leaves one group, and matches a region however it is spelled', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'regions');

  // Written `south` in the markup, asked for as `SOUTH`. Making the author match their own
  // spelling exactly buys nothing.
  await page.evaluate(() => document.querySelector('ui-locator-map').setAttribute('region', 'SOUTH'));
  await page.waitForTimeout(200);

  const filtered = await page.evaluate(() => {
    const map = document.querySelector('ui-locator-map');
    return {
      visible: map.visible.length,
      groups: map.querySelectorAll('.locator-map__group').length,
      name: map.querySelector('.locator-map__group-name')?.textContent,
    };
  });

  expect(filtered).toEqual({ visible: 3, groups: 1, name: 'south' });
});

test('a different map can be put behind the same search', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'adapter');

  await page.locator('[data-demo-swap="grid"]').click();
  await page.waitForTimeout(300);

  // The map is not part of the component. Everything the search does has to keep working
  // over a surface the component has never heard of.
  const mounted = await page.evaluate(() => {
    const map = document.querySelector('ui-locator-map');
    return {
      adapter: map.adapter?.constructor?.name,
      grid: Boolean(map.querySelector('.grid-map')),
      drawing: Boolean(map.querySelector('.locator-map__drawing')),
      markers: map.querySelectorAll('.locator-map__marker').length,
    };
  });

  expect(mounted).toEqual({ adapter: 'GridMap', grid: true, drawing: false, markers: 5 });

  await page.locator('.locator-map__input').fill('da nang');
  await expect(page.locator('.locator-map__result[role="option"]')).toHaveCount(1);
  await page.locator('.locator-map__result[role="option"]').first().click();
  await page.waitForTimeout(600);

  const landed = await page.evaluate(() => {
    const map = document.querySelector('ui-locator-map');
    const frame = map.querySelector('.locator-map__frame').getBoundingClientRect();
    const marker = map.querySelector('.locator-map__marker[data-selected]').getBoundingClientRect();

    return {
      selected: map.selected,
      offX: Math.round(marker.left + marker.width / 2 - (frame.left + frame.width / 2)),
      offY: Math.round(marker.top + marker.height / 2 - (frame.top + frame.height / 2)),
      status: map.querySelector('[role="status"]').textContent,
    };
  });

  expect(landed.selected).toBe(2);
  expect(Math.abs(landed.offX)).toBeLessThanOrEqual(2);
  expect(Math.abs(landed.offY)).toBeLessThanOrEqual(2);
  expect(landed.status).toContain('Da Nang office');
});

test('swapping the map tears the old one down', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'adapter');

  await page.locator('[data-demo-swap="grid"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-demo-swap="drawing"]').click();
  await page.waitForTimeout(400);

  const swapped = await page.evaluate(() => {
    const map = document.querySelector('ui-locator-map');
    return {
      adapter: map.adapter?.constructor?.name,
      grid: Boolean(map.querySelector('.grid-map')),
      drawing: Boolean(map.querySelector('.locator-map__drawing')),
      // Two surfaces in one frame would mean the old one was abandoned rather than removed.
      worlds: map.querySelectorAll('.locator-map__world').length,
      markers: map.querySelectorAll('.locator-map__marker').length,
    };
  });

  expect(swapped).toEqual({
    adapter: 'DrawingMap',
    grid: false,
    drawing: true,
    worlds: 1,
    markers: 5,
  });
});

test('the real map can be swapped out and back without the search losing its place', async ({
  page,
}) => {
  // Waits on somebody else's servers, twice over: once to arrive and once to come back.
  test.slow();

  await page.setViewportSize({ width: 960, height: 720 });
  await readyOnline(page, 'adapter');

  await page.locator('.locator-map__input').fill('da nang');
  await expect(page.locator('.locator-map__result[role="option"]')).toHaveCount(1);
  await page.locator('.locator-map__result[role="option"]').first().click();
  await page.waitForTimeout(800);

  await page.locator('[data-demo-swap="grid"]').click();
  await page.waitForTimeout(400);

  const onGrid = await page.evaluate(() => {
    const map = document.querySelector('ui-locator-map');
    return {
      adapter: map.adapter?.constructor?.name,
      surfaces: map.querySelectorAll('.locator-map__surface').length,
      selected: map.selected,
      typed: map.querySelector('.locator-map__input').value,
      // The claim goes with the surface it was about. Leaving it behind would have the page
      // announcing Leaflet over a grid drawn on this very page.
      provider: map.getAttribute('data-map-provider'),
    };
  });

  // The old surface goes rather than sitting behind the new one, and what was chosen is still
  // chosen: the choice belongs to the component, not to the map.
  expect(onGrid).toEqual({
    adapter: 'GridMap',
    surfaces: 0,
    selected: 2,
    typed: 'Da Nang office',
    provider: null,
  });

  await page.locator('[data-demo-swap="real"]').click();
  await page.waitForFunction(
    () => document.querySelector('ui-locator-map').adapter?.constructor?.name === 'LeafletMap',
    undefined,
    { timeout: 20000 },
  );

  expect(
    await page.evaluate(() => ({
      surfaces: document.querySelectorAll('.locator-map__surface').length,
      worlds: document.querySelectorAll('.locator-map__world').length,
      provider: document.querySelector('ui-locator-map').getAttribute('data-map-provider'),
    })),
  ).toEqual({ surfaces: 1, worlds: 0, provider: 'leaflet' });
});

test('the adapter contract is small enough to be worth having', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  // Written here rather than imported: what is being checked is that the component asks for
  // nothing beyond these, which is what makes a provider's map a plausible substitute.
  const calls = await page.evaluate(async () => {
    const map = document.querySelector('ui-locator-map');
    const seen = [];

    map.adapter = {
      mount: (frame, options) => seen.push(['mount', typeof options.onSelect]),
      update: ({ places, selected }) => seen.push(['update', places.length, selected]),
      flyTo: (place, { zoom }) => seen.push(['flyTo', place.name, zoom]),
      reset: () => seen.push(['reset']),
      zoomBy: (factor) => seen.push(['zoomBy', factor]),
      destroy: () => seen.push(['destroy']),
      view: { note: 'anything the adapter likes' },
    };

    map.flyTo(2);
    map.zoomIn();
    map.reset();

    return { seen, view: map.view };
  });

  // Mounted, told what to draw, asked to fly, told what to draw again — and nothing else.
  // The zoom asked for is the variant's `focus-zoom`, passed through untouched: what a
  // provider does with 16 is the provider's business.
  expect(calls.seen).toEqual([
    ['mount', 'function'],
    ['update', 9, -1],
    ['flyTo', 'Vinh branch', 16],
    ['update', 9, 2],
    ['zoomBy', 1.6],
    ['reset'],
    ['update', 9, -1],
  ]);
  // The view is whatever the adapter says it is; the component never reads into it.
  expect(calls.view).toEqual({ note: 'anything the adapter likes' });
});

test('the words on the map clear the contrast the rules ask for', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  const contrast = await page.evaluate(() => {
    const channels = (value) => {
      const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return value.startsWith('color(')
        ? numbers.slice(0, 3).map((n) => n * 255)
        : numbers.slice(0, 3);
    };
    const luminance = (rgb) => {
      const [r, g, b] = rgb.map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
    };

    const map = document.querySelector('ui-locator-map');
    const surface = channels(getComputedStyle(map.querySelector('.locator-map__places > li')).backgroundColor);
    const sea = channels(getComputedStyle(map.querySelector('.locator-map__frame')).backgroundColor);

    return {
      entry: ratio(channels(getComputedStyle(map.querySelector('.locator-map__entry')).color), surface),
      address: ratio(channels(getComputedStyle(map.querySelector('.locator-map__places p')).color), surface),
      // A marker over the sea is a user interface boundary rather than text.
      marker: ratio(channels(getComputedStyle(map.querySelector('.locator-map__pin')).backgroundColor), sea),
      land: ratio(channels(getComputedStyle(map.querySelector('.locator-map__land')).fill), sea),
    };
  });

  expect(contrast.entry).toBeGreaterThanOrEqual(4.5);
  expect(contrast.address).toBeGreaterThanOrEqual(4.5);
  expect(contrast.marker).toBeGreaterThanOrEqual(3);
  expect(contrast.land).toBeGreaterThanOrEqual(1.2);
});

test('reduced motion removes the flight rather than slowing it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  const frames = await page.evaluate(async () => {
    const map = document.querySelector('ui-locator-map');
    const world = map.querySelector('.locator-map__world');
    const samples = [];

    map.flyTo(7);

    for (let frame = 0; frame < 5; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      samples.push(+world.getBoundingClientRect().width.toFixed(1));
    }

    // On the frame, which is what the adapter is handed. The host declares the property; the
    // adapter is what writes a value to it.
    return {
      samples,
      flight: map.querySelector('.locator-map__frame').style.getPropertyValue('--map-flight'),
    };
  });

  // Slowing a movement down is answering a different request from the one that was made.
  expect(frames.flight).toBe('0ms');
  expect(new Set(frames.samples).size).toBe(1);
});

test('reduced motion reaches the real map too', async ({ page }) => {
  // Waits on somebody else's servers, and shares them with every other online test in this
  // file. The default budget is for a page that answers from disk.
  test.slow();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 960, height: 720 });
  await readyOnline(page, 'default');

  const arrival = await page.evaluate(async () => {
    const map = document.querySelector('ui-locator-map');
    map.flyTo(4);
    // One frame. A flight would still be somewhere over the middle of the country.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return map.view;
  });

  // Arrived rather than travelling: `reduced` is passed to the adapter, and Leaflet is asked
  // to set the view rather than fly to it.
  expect(arrival.zoom).toBe(16);
  expect(arrival.lat).toBeCloseTo(16.0739, 2);
});
