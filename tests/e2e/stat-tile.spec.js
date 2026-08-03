import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/stat-tile/source/variants';
const VARIANTS = ['default', 'row', 'delta', 'meter', 'hero', 'states'];

function trackRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  return errors;
}

async function ready(page, variant) {
  await page.goto(`${COMPONENT_BASE}/${variant}/index.html`);
  await page.waitForFunction(() => customElements.get('ui-stat-tile'));
  await page.waitForTimeout(200);
}

test('all six variants run independently without external requests or overflow', async ({
  page,
}) => {
  test.slow();

  const runtimeErrors = trackRuntimeErrors(page);
  const externalRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== 'http://127.0.0.1:5173') {
      externalRequests.push(request.url());
    }
  });

  for (const variant of VARIANTS) {
    for (const width of [960, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await ready(page, variant);

      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('ui-stat-tile').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('with no script the headline is untouched', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${COMPONENT_BASE}/default/index.html`);

  // The label, the value and the change are ordinary paragraphs. Only the sparkline needs the
  // script, and it is context rather than the headline.
  await expect(page.locator('.stat-tile__label')).toHaveText('Revenue');
  await expect(page.locator('.stat-tile__value')).toHaveText('$48,290');
  await expect(page.locator('.stat-tile__delta')).toContainText('vs last month');
  await expect(page.locator('.stat-tile__spark')).toHaveCount(0);

  await context.close();
});

test('the same rise is good news or bad news depending on what it is', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'delta');

  const tone = () => page.locator('ui-stat-tile').first().evaluate((tile) => tile.tone);
  const colour = () =>
    page.evaluate(() => getComputedStyle(document.querySelector('.stat-tile__change')).color);

  // Costs rising twelve per cent and revenue rising twelve per cent are the same arrow and
  // opposite news. This is the whole reason the attribute exists.
  expect(await tone()).toBe('good');
  const good = await colour();

  await page.locator('[data-demo-up="bad"]').click();
  await page.waitForTimeout(150);
  expect(await tone()).toBe('bad');
  const bad = await colour();

  await page.locator('[data-demo-up="neutral"]').click();
  await page.waitForTimeout(150);
  expect(await tone()).toBe('none');
  const neither = await colour();

  expect(good).not.toBe(bad);
  expect(neither).not.toBe(good);
  expect(neither).not.toBe(bad);
});

test('a change is never carried by colour alone', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'row');

  // Arrow, word, then colour — in that order of reliability. It is what survives a grey-scale
  // print-out and the reader who cannot separate red from green, and it is what makes the
  // light-theme status inks legal at all.
  const changes = await page.evaluate(() =>
    [...document.querySelectorAll('.stat-tile__change')].map((node) => ({
      words: node.textContent.trim(),
      arrow: node.querySelectorAll('svg path').length,
    })),
  );

  expect(changes.length).toBe(4);
  changes.forEach((change) => {
    expect(change.arrow).toBe(1);
    expect(change.words).toMatch(/^(up|down) \d/);
  });
});

test('no change shows no arrow and says so', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'delta');

  const flat = page.locator('ui-stat-tile').filter({ hasText: 'Open tickets' });

  // A flat arrow or a zero in green both suggest something happened.
  await expect(flat.locator('.stat-tile__change')).toHaveText('no change');
  expect(
    await flat.locator('.stat-tile__arrow').evaluate((node) => node.hasAttribute('hidden')),
  ).toBe(true);

  // And a tile with nothing to compare against has no line at all rather than an empty one.
  const bare = page.locator('ui-stat-tile').filter({ hasText: 'Median order' });
  await expect(bare.locator('.stat-tile__change')).toHaveCount(0);
});

test('no status colour is also a series colour', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'meter');

  // A hue that means "critical" cannot also mean "the third product line". The series palette
  // is written out here rather than imported: what is being checked is that the two sets stay
  // apart, and reading both from one file would let a collision approve itself.
  const SERIES = [
    '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948',
    '#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767',
  ];

  const status = await page.evaluate(() => {
    const tile = document.querySelector('ui-stat-tile');
    const read = (name) => getComputedStyle(tile).getPropertyValue(name).trim();

    return [
      read('--stat-meter-ok'),
      read('--stat-meter-warning'),
      read('--stat-meter-critical'),
      read('--stat-good'),
      read('--stat-bad'),
    ];
  });

  const reserved = status.filter((value) => value.startsWith('#')).map((value) => value.toLowerCase());
  reserved.forEach((value) => expect(SERIES).not.toContain(value));
});

test('the meter fills to its fraction and stops at the limit', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'meter');

  const width = () =>
    page.evaluate(() => document.querySelector('#storage .stat-tile__meter-fill').style.inlineSize);

  await page.locator('[data-demo-share="0.42"]').click();
  await page.waitForTimeout(150);
  expect(width()).resolves.toBe('42%');

  await page.locator('[data-demo-share="1.3"]').click();
  await page.waitForTimeout(150);
  // A bar drawn beyond its own track has stopped measuring anything.
  expect(await width()).toBe('100%');
});

test('the meter says its condition in words, not only in colour', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'meter');

  const condition = () =>
    page.evaluate(() => {
      const node = document.querySelector('#storage .stat-tile__condition');
      return { text: node.textContent, hidden: node.hidden };
    });

  await page.locator('[data-demo-share="0.42"]').click();
  await page.waitForTimeout(150);
  expect(await condition()).toEqual({ text: '', hidden: true });

  // Amber on a light surface reaches only 1.70 against its own track and no lighter step of
  // amber can pass. The word is what carries the state there, so it is not optional.
  await page.locator('[data-demo-share="0.79"]').click();
  await page.waitForTimeout(150);
  expect(await condition()).toEqual({ text: 'nearing the limit', hidden: false });

  await page.locator('[data-demo-share="0.94"]').click();
  await page.waitForTimeout(150);
  expect(await condition()).toEqual({ text: 'at the limit', hidden: false });
});

test('the meter track is the fill own hue rather than grey', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'meter');

  const bar = await page.evaluate(() => {
    const meter = document.querySelector('#storage .stat-tile__meter');
    const fill = meter.querySelector('.stat-tile__meter-fill');
    const channels = (value) => value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];

    return { track: channels(getComputedStyle(meter).backgroundColor), fill: channels(getComputedStyle(fill).backgroundColor) };
  });

  // A grey track under a coloured fill is two different things touching. Same hue means the
  // channels lean the same way: this fill is blue, so blue leads in both.
  expect(bar.fill[2]).toBeGreaterThan(bar.fill[0]);
  expect(bar.track[2]).toBeGreaterThan(bar.track[0]);
});

test('the meter is announced as a measurement', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'meter');

  const meter = page.locator('#storage .stat-tile__meter');
  await expect(meter).toHaveAttribute('role', 'meter');
  await expect(meter).toHaveAttribute('aria-valuemin', '0');
  await expect(meter).toHaveAttribute('aria-valuemax', '1024');
  await expect(meter).toHaveAttribute('aria-valuenow', '430');
  await expect(meter).toHaveAttribute('aria-label', /430 GB of 1 TB/);
});

test('the sparkline readings stay in the page after it is drawn', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  const trend = page.locator('.stat-tile__trend');

  // Hidden from the eye and never from the page. There is no toggle because the value and the
  // change are already on screen, so twelve readings do not earn a control of their own.
  await expect(trend).toHaveClass(/stat-tile__sr-only/);
  expect(await trend.evaluate((node) => getComputedStyle(node).display)).not.toBe('none');
  await expect(trend.locator('li')).toHaveCount(12);
  await expect(page.locator('.stat-tile__spark')).toHaveAttribute('aria-hidden', 'true');
});

test('one reading draws no sparkline, because one point has no direction', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  const single = page.locator('ui-stat-tile').filter({ hasText: 'Single reading' });

  await expect(single.locator('.stat-tile__trend li')).toHaveCount(1);
  await expect(single.locator('.stat-tile__spark')).toHaveCount(0);
});

test('a value nobody has yet says so, and zero is a real measurement', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  // A dash is a character somebody has to decode; a zero is a claim.
  const missing = page.locator('ui-stat-tile').filter({ hasText: 'Refunds this week' });
  await expect(missing.locator('.stat-tile__value')).toHaveText('Not available');

  const zero = page.locator('ui-stat-tile').filter({ hasText: 'Deliveries' });
  await expect(zero.locator('.stat-tile__value')).toHaveText('0');
  expect(await zero.evaluate((tile) => tile.value)).toBe(0);
});

test('refetching holds the number and a failure keeps the label', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  const live = page.locator('#live');

  await page.locator('[data-demo-action="loading"]').click();
  await page.waitForTimeout(200);

  // No skeleton: the figure the reader is looking at is held, faded.
  await expect(live.locator('.stat-tile__value')).toHaveText('3,412');
  expect(
    await live.evaluate((tile) =>
      Number.parseFloat(getComputedStyle(tile.querySelector('.stat-tile__value')).opacity),
    ),
  ).toBeLessThan(1);

  await page.locator('[data-demo-action="loading"]').click();
  await page.locator('[data-demo-action="error"]').click();
  await page.waitForTimeout(200);

  await expect(live.locator('.stat-tile__note')).toHaveText('That figure could not be loaded');
  // The tile still names the number that is missing.
  await expect(live.locator('.stat-tile__label')).toHaveText('Active sessions');
  await expect(live.locator('.stat-tile__spark')).toBeHidden();
});

test('no-trend drops the drawing and keeps the readings', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  await page.locator('[data-demo-action="trend"]').click();
  await page.waitForTimeout(200);

  await expect(page.locator('#live .stat-tile__spark')).toBeHidden();
  await expect(page.locator('#live .stat-tile__trend li')).toHaveCount(12);
});

test('tiles in a row share their row lines', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await ready(page, 'row');

  // Without subgrid a longer label in one card pushes that card's number out of step with the
  // rest, which reads as sloppiness before anyone can say why.
  const lines = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.stat-row > ui-stat-tile')].slice(0, 4);

    return {
      supported: CSS.supports('grid-template-rows', 'subgrid'),
      values: tiles.map((tile) =>
        Math.round(tile.querySelector('.stat-tile__value').getBoundingClientRect().top),
      ),
      deltas: tiles.map((tile) =>
        Math.round(tile.querySelector('.stat-tile__delta').getBoundingClientRect().top),
      ),
    };
  });

  if (lines.supported) {
    expect(new Set(lines.values).size).toBe(1);
    expect(new Set(lines.deltas).size).toBe(1);
  }
});

test('the hero value keeps proportional figures', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'hero');

  const figure = await page.evaluate(() => {
    const value = document.querySelector('.stat-tile__value');
    const change = document.querySelector('.stat-tile__change');
    const style = getComputedStyle(value);

    return {
      numeric: style.fontVariantNumeric,
      size: Number.parseFloat(style.fontSize),
      family: style.fontFamily,
      // The change is a column of numbers, so it keeps tabular.
      changeNumeric: getComputedStyle(change).fontVariantNumeric,
    };
  });

  // Equal-width digits make 1,284 look loose at display size, because a 1 is given the width
  // of a 0. Tabular belongs in columns that line up, and a headline is not a column.
  expect(figure.numeric).not.toContain('tabular-nums');
  expect(figure.changeNumeric).toContain('tabular-nums');
  expect(figure.size).toBeGreaterThanOrEqual(48);
  // The same sans as everything else: a display or serif face reads as off-brand decoration.
  expect(figure.family).toContain('Inter');
});

test('refresh picks up numbers the page rewrote in place', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'meter');

  const before = await page.locator('#storage').evaluate((tile) => tile.value);

  await page.evaluate(() => {
    const value = document.querySelector('#storage .stat-tile__value');
    value.dataset.value = '900';
    value.textContent = '900 GB';
  });

  // The numbers live in text nodes, so the element cannot know until it is told.
  expect(await page.locator('#storage').evaluate((tile) => tile.value)).toBe(before);

  await page.locator('#storage').evaluate((tile) => tile.refresh());
  expect(await page.locator('#storage').evaluate((tile) => tile.value)).toBe(900);
  await expect(page.locator('#storage .stat-tile__condition')).toHaveText('nearing the limit');
});

test('reduced motion removes the meter transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'meter');

  const motion = await page.evaluate(() => {
    const tile = document.querySelector('ui-stat-tile');
    return {
      token: getComputedStyle(tile).getPropertyValue('--stat-motion').trim(),
      fill: getComputedStyle(tile.querySelector('.stat-tile__meter-fill')).transitionDuration,
    };
  });

  expect(motion.token).toBe('0ms');
  expect(Number.parseFloat(motion.fill)).toBe(0);
});

test('the words on a tile clear the contrast the rules ask for', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });

  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    await ready(page, 'row');

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

      const tiles = [...document.querySelectorAll('ui-stat-tile')];
      const surface = channels(getComputedStyle(tiles[0]).backgroundColor);
      const good = tiles[0].querySelector('.stat-tile__change');
      const bad = tiles[1].querySelector('.stat-tile__change');

      return {
        label: ratio(channels(getComputedStyle(tiles[0].querySelector('.stat-tile__label')).color), surface),
        value: ratio(channels(getComputedStyle(tiles[0].querySelector('.stat-tile__value')).color), surface),
        good: ratio(channels(getComputedStyle(good).color), surface),
        bad: ratio(channels(getComputedStyle(bad).color), surface),
      };
    });

    // The delta ink is text, so it is held to 4.5 rather than the 3 a mark has to clear. The
    // status *fills* would not pass here, which is why the delta uses different steps.
    expect(contrast.label, `label in ${colorScheme}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast.value, `value in ${colorScheme}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast.good, `good delta in ${colorScheme}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast.bad, `bad delta in ${colorScheme}`).toBeGreaterThanOrEqual(4.5);
  }
});
