import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/funnel-chart/source/variants';
const VARIANTS = ['default', 'shape', 'rates', 'compare', 'table', 'states'];

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
  await page.waitForFunction(() => customElements.get('ui-funnel-chart'));
  await page.waitForFunction(() => document.querySelector('.funnel__bar') !== null);
}

/** Every bar's start and end, and every drop region's, measured from the track's left edge. */
async function geometry(page, selector = 'ui-funnel-chart') {
  return page.evaluate((target) => {
    const chart = document.querySelector(target);
    const track = chart.querySelector('.funnel__track').getBoundingClientRect();

    return [...chart.querySelectorAll('.funnel__stage')].map((item) => {
      const bar = item.querySelector('.funnel__bar').getBoundingClientRect();
      const drop = item.querySelector('.funnel__drop');
      const region = drop ? drop.getBoundingClientRect() : null;

      return {
        barStart: Math.round(bar.left - track.left),
        barEnd: Math.round(bar.right - track.left),
        dropStart: region ? Math.round(region.left - track.left) : null,
        dropEnd: region ? Math.round(region.right - track.left) : null,
      };
    });
  }, selector);
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
      await expect(page.locator('ui-funnel-chart').first()).toBeVisible();
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

  const table = page.locator('ui-funnel-chart table');
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(5);
  await expect(table.locator('tbody tr').first()).toContainText('18,400');
  await expect(page.locator('.funnel__bar')).toHaveCount(0);

  await context.close();
});

test('no trapezoid: every bar starts at zero on one shared baseline', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  // The whole reason this is bars rather than the familiar tapering shape. A trapezoid hands
  // the eye an area to read, and a trapezoid's area is not proportional to its value, so every
  // drop comes out looking worse than it was. Length from a shared origin is read accurately.
  const rows = await geometry(page);

  expect(rows.map((row) => row.barStart)).toEqual([0, 0, 0, 0, 0]);

  // Monotonically shorter, and no shape is drawn as a polygon anywhere.
  const ends = rows.map((row) => row.barEnd);
  expect(ends).toEqual([...ends].sort((a, b) => b - a));
  await expect(page.locator('ui-funnel-chart polygon, ui-funnel-chart path')).toHaveCount(0);
});

test('the loss is drawn where it happened, back to the previous bar', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  const rows = await geometry(page);

  expect(rows[0].dropStart).toBeNull();

  // Each drop region begins exactly where its own bar ends and finishes exactly where the
  // previous bar did, so the piece that fell off is drawn at the size it actually was.
  rows.slice(1).forEach((row, index) => {
    expect(row.dropStart).toBe(row.barEnd);
    expect(row.dropEnd).toBe(rows[index].barEnd);
  });
});

test('one colour for every stage, until the shading is asked for', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'shape');

  const painted = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.funnel__bar')].map(
        (bar) => getComputedStyle(bar).backgroundColor,
      ),
    );

  // Position already carries the order and length already carries the value. Shading each
  // stage differently spends the only free channel restating what the layout already shows.
  expect(new Set(await painted()).size).toBe(1);

  await page.locator('[data-demo-shade="stages"]').click();
  const ramp = await painted();
  expect(new Set(ramp).size).toBe(6);

  // Past the ramp's length there is no seventh step that stays apart from the sixth, so it
  // falls back to one colour and says so rather than reusing a step.
  await page.evaluate(() => {
    const chart = document.querySelector('ui-funnel-chart');
    const row = document.createElement('tr');
    row.innerHTML = '<th scope="row">Archived</th><td data-value="900">900</td>';
    chart.querySelector('tbody').append(row);
    chart.refresh();
  });

  expect(new Set(await painted()).size).toBe(1);
  await expect(page.locator('ui-funnel-chart .funnel__note')).toContainText(
    'More than 6 stages',
  );
});

test('the largest drop is marked once, by count, in words as well as colour', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  const chart = page.locator('ui-funnel-chart');

  await expect(chart.locator('.funnel__stage[data-worst]')).toHaveCount(1);
  await expect(chart.locator('.funnel__stage[data-worst] .funnel__name')).toHaveText(
    'Added to cart',
  );

  // Not carried by the fill alone, so it survives a greyscale print and a colour-blind reader.
  await expect(chart.locator('.funnel__flag')).toHaveText('Largest drop');

  // By count rather than by rate: the marked step keeps 33.7%, but a later step keeps 67.6%
  // and would be the marked one if rate decided it.
  const worst = await chart.evaluate((node) => node.largestDrop);
  expect(worst.drop).toBe(12200);
});

test('both rates are printed and each is named', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'rates');

  const third = page.locator('.funnel__stage').nth(2);

  // Printing only one of the two is the commonest fault in the form: the from-the-top rate
  // hides a broken step behind every loss above it, and the step rate never reaches the
  // number the business actually earns.
  await expect(third.locator('.funnel__rate')).toHaveCount(2);
  await expect(third).toContainText('of previous');
  await expect(third).toContainText('of the top');

  // A rate is something a reader has to turn back into people first. The count already is
  // the sentence.
  await expect(third.locator('.funnel__loss')).toContainText('lost');

  await page.locator('[data-demo-rates="step"]').click();
  await expect(third.locator('.funnel__rate')).toHaveCount(1);
  await expect(third).not.toContainText('of the top');
});

test('the second stage does not print the same rate twice', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  // On the second stage the previous stage *is* the top, so the two rates are the same figure
  // and printing both reads as a mistake.
  const second = page.locator('.funnel__stage').nth(1);
  await expect(second.locator('.funnel__rate')).toHaveCount(1);
  await expect(second).toContainText('of previous');
  await expect(second).not.toContainText('of the top');
});

test('a pinned ceiling makes two funnels comparable rather than merely adjacent', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ready(page, 'compare');

  const tops = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('ui-funnel-chart')].map((chart) =>
        Math.round(chart.querySelector('.funnel__bar').getBoundingClientRect().width),
      ),
    );

  // Unpinned, each funnel scales to its own first stage, so 6,900 draws the same length as
  // 18,400 and every pair of bars below invites a comparison that is not there.
  const [desktopBefore, mobileBefore] = await tops();
  expect(mobileBefore).toBe(desktopBefore);

  await page.locator('[data-demo-action="max"]').click();

  const [desktopAfter, mobileAfter] = await tops();
  expect(desktopAfter).toBe(desktopBefore);
  expect(mobileAfter / desktopAfter).toBeCloseTo(6900 / 18400, 2);

  // The rates never depended on the drawing, which is the useful half of the lesson: a shape
  // can mislead while every number beside it stays true.
  await expect(page.locator('#mobile .funnel__rate').first()).toContainText('35.9%');
});

test('a stage that grew is named rather than drawn', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  const chart = page.locator('ui-funnel-chart').first();

  await expect(chart.locator('.funnel__note')).toContainText('Joined a workspace');
  await expect(chart.locator('.funnel__note')).toContainText('not a funnel');

  // No bar longer than the one it came from, and no negative drop region drawn.
  const rows = await geometry(page, 'ui-funnel-chart');
  const risen = rows[3];
  expect(risen.dropStart).toBeNull();
  expect(risen.barEnd).toBeLessThanOrEqual(rows[0].barEnd);
});

test('a first stage, a single stage, and an empty top report no invented rate', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  const charts = page.locator('ui-funnel-chart');

  // A first stage is not "100% of the previous stage"; there is no previous stage.
  await expect(charts.first().locator('.funnel__stage').first().locator('.funnel__rate')).toHaveCount(
    0,
  );

  // One stage: nothing to convert, so no summary line reporting a rate against itself.
  await expect(charts.nth(1).locator('.funnel__summary')).toBeHidden();

  // Nobody entered, so every rate is a division by zero. Absent is the truthful answer.
  const cold = charts.nth(2);
  await expect(cold.locator('.funnel__stage')).toHaveCount(3);
  await expect(cold.locator('.funnel__rate')).toHaveCount(0);
  await expect(cold.locator('.funnel__summary')).toBeHidden();
  expect(await cold.textContent()).not.toContain('NaN');
});

test('loading holds the bars and an error keeps the table', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  const cold = page.locator('#cold');
  const list = cold.locator('.funnel__list');

  await expect(list).toHaveCSS('opacity', '1');

  // Held at reduced opacity rather than replaced, so the shape being read does not vanish
  // while it refreshes.
  await page.locator('[data-demo-action="loading"]').click();
  await expect(list).toHaveCSS('opacity', '0.45');
  await expect(cold.locator('.funnel__stage')).toHaveCount(3);
  await page.locator('[data-demo-action="loading"]').click();
  await expect(list).toHaveCSS('opacity', '1');

  // An error says what happened and leaves the table alone — the data was already on the page.
  await page.locator('[data-demo-action="error"]').click();
  await expect(cold.locator('.funnel__empty')).toHaveText('That funnel could not be loaded');
  await expect(list).toBeHidden();
  await expect(cold.locator('table tbody tr')).toHaveCount(3);

  await page.locator('[data-demo-action="error"]').click();
  await expect(list).toBeVisible();
  await expect(cold.locator('.funnel__bar')).toHaveCount(3);
});

test('the table toggle names the next action and keeps the table readable while collapsed', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'table');

  const toggle = page.locator('.funnel__table-toggle');
  const wrap = page.locator('.funnel__table-wrap');

  // Clipped rather than display:none while collapsed, so the table stays the accessible
  // content even when it is not on screen.
  await expect(toggle).toHaveText('Show the table');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(wrap).toHaveClass(/funnel__sr-only/);

  await toggle.click();
  await expect(toggle).toHaveText('Hide the table');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(wrap).not.toHaveClass(/funnel__sr-only/);
});

test('the picture is one tab stop and the table is the accessible content', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  const chart = page.locator('ui-funnel-chart');

  // Every word in the list is either already in the table or already in the summary above, so
  // exposing both would read the funnel twice.
  await expect(chart.locator('.funnel__list')).toHaveAttribute('aria-hidden', 'true');

  // A focusable element inside an aria-hidden subtree is a trap for a keyboard user.
  expect(
    await chart.evaluate(
      (node) => node.querySelectorAll('.funnel__list button, .funnel__list [tabindex]').length,
    ),
  ).toBe(0);

  expect(
    await chart.evaluate(
      (node) => node.querySelectorAll('[tabindex]:not([tabindex="-1"]), button, a[href]').length,
    ),
  ).toBe(2);
});

test('the arrows walk the stages and say what they landed on', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  const chart = page.locator('ui-funnel-chart');
  const status = chart.locator('[role="status"]');

  // Present and empty beforehand, or the first announcement is the region appearing rather
  // than the reading changing, and it is missed.
  await expect(status).toHaveText('');

  await chart.locator('.funnel__frame').focus();
  await page.keyboard.press('ArrowDown');

  // No trailing punctuation from a template writing the commas its values were meant to fill.
  await expect(status).toHaveText('Viewed product, 18,400');
  await expect(chart.locator('.funnel__stage[data-active] .funnel__name')).toHaveText(
    'Viewed product',
  );

  await page.keyboard.press('ArrowDown');
  await expect(status).toContainText('Added to cart');
  await expect(status).toContainText('of previous');
  await expect(status).toContainText('Largest drop');

  await page.keyboard.press('End');
  await expect(chart.locator('.funnel__stage[data-active] .funnel__name')).toHaveText('Paid');

  // No wrapping at the ends: a list that jumps from bottom to top loses the reader's place.
  await page.keyboard.press('ArrowDown');
  await expect(chart.locator('.funnel__stage[data-active] .funnel__name')).toHaveText('Paid');

  await page.keyboard.press('Escape');
  await expect(chart.locator('.funnel__stage[data-active]')).toHaveCount(0);
});

test('the summary states the overall rate and the worst step in words', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  // Visible rather than screen-reader-only. These are the two findings the chart exists to
  // produce, and neither is in the table — both are computed.
  const summary = page.locator('.funnel__summary');

  await expect(summary).toBeVisible();
  await expect(summary).toContainText('11.6% overall');
  await expect(summary).toContainText('Largest drop at Added to cart');
  await expect(summary).toContainText('12,200 lost');
});

test('the ordinal ramp clears its contrast floors in both themes', async ({ page }) => {
  test.slow();

  const luminance = (hex) => {
    const channels = [1, 3, 5]
      .map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255)
      .map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 960, height: 900 });
    await ready(page, 'shape');
    await page.locator('[data-demo-shade="stages"]').click();

    // Read the paint rather than the token: getPropertyValue on a custom property returns the
    // stored `light-dark(...)` text, not the colour the browser actually painted.
    const painted = await page.evaluate(() => {
      const hex = (colour) =>
        `#${colour
          .match(/\d+/g)
          .slice(0, 3)
          .map((n) => Number(n).toString(16).padStart(2, '0'))
          .join('')}`;
      const chart = document.querySelector('ui-funnel-chart');

      return {
        surface: hex(getComputedStyle(chart.querySelector('.funnel__frame')).backgroundColor),
        steps: [...chart.querySelectorAll('.funnel__bar')].map((bar) =>
          hex(getComputedStyle(bar).backgroundColor),
        ),
      };
    });

    expect(painted.steps).toHaveLength(6);

    // Ordinal marks are discrete things that all have to be seen. Unlike a sequential ramp,
    // no step is allowed to recede toward the surface — a funnel stage is a bar, not a shade
    // of nothing — so every step clears 2:1, including the palest.
    painted.steps.forEach((step) => {
      expect(contrast(step, painted.surface)).toBeGreaterThanOrEqual(2);
    });

    painted.steps.slice(1).forEach((step, index) => {
      expect(contrast(step, painted.steps[index])).toBeGreaterThanOrEqual(1.2);
    });
  }

  await page.emulateMedia({ colorScheme: null });
});

test('the default bar and the largest-drop label clear their own floors', async ({ page }) => {
  const luminance = (hex) => {
    const channels = [1, 3, 5]
      .map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255)
      .map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 960, height: 900 });
    await ready(page, 'default');

    const painted = await page.evaluate(() => {
      const hex = (colour) =>
        `#${colour
          .match(/\d+/g)
          .slice(0, 3)
          .map((n) => Number(n).toString(16).padStart(2, '0'))
          .join('')}`;
      const chart = document.querySelector('ui-funnel-chart');
      const worst = chart.querySelector('.funnel__stage[data-worst]');

      return {
        surface: hex(getComputedStyle(chart.querySelector('.funnel__frame')).backgroundColor),
        bar: hex(getComputedStyle(chart.querySelector('.funnel__bar')).backgroundColor),
        drop: hex(
          getComputedStyle(
            chart.querySelector('.funnel__stage:not([data-worst]) .funnel__drop'),
          ).backgroundColor,
        ),
        flagInk: hex(getComputedStyle(worst.querySelector('.funnel__flag')).color),
        flagFill: hex(getComputedStyle(worst.querySelector('.funnel__flag')).backgroundColor),
      };
    });

    // The bar is a UI mark carrying the value.
    expect(contrast(painted.bar, painted.surface)).toBeGreaterThanOrEqual(3);
    // The drop region has to read as an area rather than as blank paper.
    expect(contrast(painted.drop, painted.surface)).toBeGreaterThanOrEqual(1.2);
    expect(contrast(painted.drop, painted.bar)).toBeGreaterThanOrEqual(2);
    // The marking has to be separable from an ordinary drop without reading the word.
    expect(contrast(painted.flagFill, painted.drop)).toBeGreaterThanOrEqual(1.15);
    // The label is a word, and it sits on its own fill rather than on the card.
    expect(contrast(painted.flagInk, painted.flagFill)).toBeGreaterThanOrEqual(4.5);
  }

  await page.emulateMedia({ colorScheme: null });
});
