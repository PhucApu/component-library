import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/heatmap-chart/source/variants';
const VARIANTS = ['default', 'calendar', 'cohort', 'scale', 'table', 'states'];

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

/**
 * The six steps as the colours they actually resolve to.
 *
 * `getPropertyValue('--cell-colour')` hands back the stored value — `light-dark(#1c5cab,
 * #86b6ef)` — not the `var()` that was written and not the colour that was painted. Asking a
 * probe element what it computed to is the only way to compare a cell against a step.
 */
async function stepColours(page, index = 0) {
  return page.evaluate((position) => {
    const chart = document.querySelectorAll('ui-heatmap-chart')[position];
    const probe = document.createElement('span');
    chart.append(probe);

    const colours = [0, 1, 2, 3, 4, 5].map((step) => {
      probe.style.background = `var(--heat-step-${step})`;
      return getComputedStyle(probe).backgroundColor;
    });

    probe.remove();
    return colours;
  }, index);
}

async function ready(page, variant) {
  await page.goto(`${COMPONENT_BASE}/${variant}/index.html`);
  await page.waitForFunction(() => customElements.get('ui-heatmap-chart'));
  await page.waitForFunction(() => document.querySelector('.heat__cell') !== null);
  await page.waitForTimeout(150);
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
      await expect(page.locator('ui-heatmap-chart').first()).toBeVisible();
      // A wide grid scrolls inside its own box rather than pushing the document sideways.
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('with no script every variant is still a complete table', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${COMPONENT_BASE}/default/index.html`);

  const table = page.locator('ui-heatmap-chart table');
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(7);
  await expect(table.locator('tbody tr').first()).toContainText('186');
  await expect(page.locator('.heat__cell')).toHaveCount(0);

  await context.close();
});

test('an empty cell draws no square and a written zero draws the quietest one', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'calendar');

  // This is the fault an activity calendar loses most often, and it is invisible in the
  // picture: collapsing the two says "nobody worked" about a month nobody has reached yet.
  const steps = await stepColours(page);
  const corner = await page.evaluate((zeroColour) => {
    const chart = document.querySelector('ui-heatmap-chart');
    const cells = [...chart.querySelectorAll('.heat__cell')];
    const outside = cells.filter((cell) => cell.hasAttribute('data-outside'));

    return {
      total: cells.length,
      outside: outside.length,
      zeroes: cells.filter(
        (cell) =>
          !cell.hasAttribute('data-outside') &&
          getComputedStyle(cell).backgroundColor === zeroColour,
      ).length,
      outsidePainted: outside.map((cell) => getComputedStyle(cell).backgroundColor),
    };
  }, steps[0]);

  // Two days at the end of the last weekend have not happened yet.
  expect(corner.outside).toBe(2);
  expect(corner.zeroes).toBeGreaterThan(10);
  // No square at all, rather than a square coloured to mean nothing.
  corner.outsidePainted.forEach((colour) => expect(colour).toBe('rgba(0, 0, 0, 0)'));
});

test('never more than five steps, plus one for a measured zero', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  // Past about seven classes the neighbouring steps blur and the reader is back to consulting
  // the legend for every cell.
  await expect(page.locator('.heat__scale-swatch')).toHaveCount(6);
  expect(await page.locator('ui-heatmap-chart').evaluate((node) => node.thresholds.length)).toBe(5);
});

test('the scale legend is there whenever there is a scale, and gone when there is not', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 1100 });
  await ready(page, 'default');
  await expect(page.locator('.heat__scale')).toBeVisible();

  await ready(page, 'states');

  // Every reading is a measured zero: there is no scale to describe, so five steps that
  // describe nothing would be furniture rather than information.
  const zeroes = page.locator('ui-heatmap-chart').nth(1);
  await expect(zeroes.locator('.heat__cell')).toHaveCount(6);
  await expect(zeroes.locator('.heat__scale')).toBeHidden();
});

test('no number is printed inside a square', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  // A heatmap with a figure in every cell is a table — and printing one would mean choosing
  // the ink per step, since one grey cannot sit on both ends of a ramp.
  const text = await page.evaluate(() =>
    [...document.querySelectorAll('.heat__cell')].map((cell) => cell.textContent.trim()),
  );

  expect(new Set(text)).toEqual(new Set(['']));
});

test('the grid is a picture and the table is the content', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'table');

  const tree = await page.evaluate(() => {
    const chart = document.querySelector('ui-heatmap-chart');
    const grid = chart.querySelector('.heat__grid');

    return {
      gridHidden: grid.getAttribute('aria-hidden'),
      // Nothing focusable inside an aria-hidden subtree: that is a trap for anyone arriving
      // by keyboard.
      focusable: grid.querySelectorAll('button, a, [tabindex]').length,
      frameStops: chart.querySelectorAll('[tabindex="0"]').length,
      tableShown: getComputedStyle(chart.querySelector('table')).display !== 'none',
    };
  });

  expect(tree).toEqual({
    gridHidden: 'true',
    focusable: 0,
    frameStops: 1,
    tableShown: true,
  });
});

test('four arrows walk the grid and step over the holes', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'cohort');

  const at = () =>
    page.evaluate(() => {
      const active = document.querySelector('.heat__cell[data-active]');
      return active ? { row: active.dataset.row, column: active.dataset.column } : null;
    });

  await page.locator('.heat__frame').focus();
  await page.keyboard.press('ArrowRight');
  expect(await at()).toEqual({ row: '0', column: '0' });

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  expect(await at()).toEqual({ row: '2', column: '0' });

  // A grid has two directions, so it takes four keys.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  expect(await at()).toEqual({ row: '1', column: '2' });

  // And it is announced, not only drawn.
  expect(await page.evaluate(() => document.querySelector('[role="status"]').textContent)).toContain(
    'February',
  );

  await page.keyboard.press('Escape');
  expect(await at()).toBe(null);
});

test('the keyboard does not stop on a cell that has nothing to read', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'cohort');

  await page.locator('.heat__frame').focus();
  await page.keyboard.press('End');

  // `End` lands on the last readable cell. On a triangle the last cell of the grid is a hole,
  // and a keyboard that stops there feels broken.
  const landed = await page.evaluate(() => {
    const active = document.querySelector('.heat__cell[data-active]');
    return { outside: active?.hasAttribute('data-outside'), row: active?.dataset.row };
  });

  expect(landed.outside).toBe(false);
  expect(landed.row).toBe('5');
});

test('the cell being read is ringed rather than recoloured', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  const before = await page.evaluate(
    () => getComputedStyle(document.querySelector('.heat__cell')).backgroundColor,
  );

  await page.locator('.heat__cell').first().hover();
  await page.waitForTimeout(200);

  const reading = await page.evaluate(() => {
    const cell = document.querySelector('.heat__cell');
    const style = getComputedStyle(cell);
    return { active: cell.hasAttribute('data-active'), fill: style.backgroundColor, outline: style.outlineColor };
  });

  expect(reading.active).toBe(true);
  // Its colour is its value; changing it would be changing the reading.
  expect(reading.fill).toBe(before);
  expect(reading.outline).not.toBe('rgba(0, 0, 0, 0)');
  await expect(page.locator('.heat__readout')).toBeVisible();
});

test('a pinned ceiling makes two grids agree', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'cohort');

  const chart = page.locator('#retention');

  // Without it each grid scales to its own busiest cell, and two retention charts side by
  // side use the same colours for different numbers.
  expect(await chart.evaluate((node) => node.thresholds)).toEqual([20, 40, 60, 80, 100]);

  await page.locator('[data-demo-action="max"]').click();
  await page.waitForTimeout(200);

  const loose = await chart.evaluate((node) => node.thresholds);
  expect(loose.at(-1)).toBe(100);
  expect(loose).toEqual([20, 40, 60, 80, 100]);
});

test('rank-based steps differ from equal slices, and the grid says so', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'scale');

  const chart = page.locator('ui-heatmap-chart');

  const linear = await chart.evaluate((node) => node.thresholds);
  await expect(page.locator('.heat__note')).toBeHidden();

  await page.locator('[data-demo-scale="quantile"]').click();
  await page.waitForTimeout(200);

  const quantile = await chart.evaluate((node) => node.thresholds);

  // One endpoint at four hundred against a field of single digits flattens everything else
  // into step one; dividing by rank brings the quiet end back.
  expect(quantile).not.toEqual(linear);
  expect(quantile[0]).toBeLessThan(linear[0]);

  // A reader who assumes a linear scale reads a quantile grid backwards, so it is said out
  // loud rather than left to be inferred.
  await expect(page.locator('.heat__note')).toBeVisible();
  await expect(page.locator('.heat__note')).toContainText('equal numbers of cells');
});

test('nothing to show says so rather than drawing an empty grid', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 1100 });
  await ready(page, 'states');

  const nothing = page.locator('ui-heatmap-chart').nth(2);

  await expect(nothing.locator('.heat__empty')).toHaveText('Nothing to show');
  await expect(nothing.locator('.heat__cell')).toHaveCount(0);
  await expect(nothing.locator('.heat__scale')).toBeHidden();
});

test('one cell is its own scale and needs no special case', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 1100 });
  await ready(page, 'states');

  const single = page.locator('ui-heatmap-chart').last();

  await expect(single.locator('.heat__cell')).toHaveCount(1);

  // It is the busiest cell there is, so it takes the last step.
  const charts = await page.locator('ui-heatmap-chart').count();
  const steps = await stepColours(page, charts - 1);

  expect(
    await single.evaluate((node) => getComputedStyle(node.querySelector('.heat__cell')).backgroundColor),
  ).toBe(steps[5]);
});

test('refetching holds the grid and a failure keeps the table', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 1100 });
  await ready(page, 'states');

  const live = page.locator('#live');

  await page.locator('[data-demo-action="loading"]').click();
  await page.waitForTimeout(200);

  await expect(live.locator('.heat__cell')).toHaveCount(8);
  expect(
    await live.evaluate((node) =>
      Number.parseFloat(getComputedStyle(node.querySelector('.heat__grid')).opacity),
    ),
  ).toBeLessThan(1);

  await page.locator('[data-demo-action="loading"]').click();
  await page.locator('[data-demo-action="error"]').click();
  await page.waitForTimeout(200);

  await expect(live.locator('.heat__empty')).toHaveText('That grid could not be loaded');
  await expect(live.locator('tbody tr')).toHaveCount(2);
});

test('the scale runs the right way in each theme', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });

  const readSteps = async () =>
    page.evaluate(() => {
      const chart = document.querySelector('ui-heatmap-chart');
      const probe = document.createElement('span');
      chart.append(probe);

      const luminance = (value) => {
        const [r, g, b] = value.match(/[\d.]+/g).slice(0, 3).map(Number);
        return [r, g, b]
          .map((channel) => {
            const s = channel / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, part, index) => sum + part * [0.2126, 0.7152, 0.0722][index], 0);
      };

      const steps = [1, 2, 3, 4, 5].map((index) => {
        probe.style.background = `var(--heat-step-${index})`;
        return luminance(getComputedStyle(probe).backgroundColor);
      });

      probe.remove();
      return steps;
    });

  await page.emulateMedia({ colorScheme: 'light' });
  await ready(page, 'default');
  const light = await readSteps();

  await page.emulateMedia({ colorScheme: 'dark' });
  await ready(page, 'default');
  const dark = await readSteps();

  // On a light surface more is darker. On a dark one more is brighter, or the busiest cells
  // sink into the background and the whole grid reads inverted.
  light.forEach((value, index) => {
    if (index > 0) expect(value, `light step ${index + 1}`).toBeLessThan(light[index - 1]);
  });
  dark.forEach((value, index) => {
    if (index > 0) expect(value, `dark step ${index + 1}`).toBeGreaterThan(dark[index - 1]);
  });
});

test('the words on the chart clear the contrast the rules ask for', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });

  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
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

      const chart = document.querySelector('ui-heatmap-chart');
      const surface = channels(getComputedStyle(chart.querySelector('.heat__frame')).backgroundColor);

      return {
        rowLabel: ratio(channels(getComputedStyle(chart.querySelector('.heat__row-label')).color), surface),
        columnLabel: ratio(channels(getComputedStyle(chart.querySelector('.heat__column-label')).color), surface),
        scale: ratio(channels(getComputedStyle(chart.querySelector('.heat__scale')).color), surface),
      };
    });

    Object.entries(contrast).forEach(([part, value]) => {
      expect(value, `${part} in ${colorScheme}`).toBeGreaterThanOrEqual(4.5);
    });
  }
});
