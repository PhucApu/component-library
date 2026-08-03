import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/donut-chart/source/variants';
const VARIANTS = ['default', 'versus', 'folding', 'interaction', 'table', 'states'];

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
 * Points at the paint of a wedge.
 *
 * A wedge's bounding box has its centre in the hole, so `.hover()` aims at nothing and the
 * canvas takes the event. This walks out along the wedge's own mid-angle to the middle of the
 * ring — where a reader would actually put the pointer.
 */
async function hoverWedge(page, index) {
  const point = await page.evaluate((position) => {
    const chart = document.querySelector('ui-donut-chart');
    const frame = chart.querySelector('.donut__frame').getBoundingClientRect();
    const wedge = chart.querySelectorAll('.donut__slice')[position];
    const box = wedge.getBoundingClientRect();

    // The ring's middle radius, along the direction of this wedge's own bounding box.
    const cx = frame.left + frame.width / 2;
    const cy = frame.top + frame.height / 2;
    const towards = Math.atan2(box.top + box.height / 2 - cy, box.left + box.width / 2 - cx);
    const radius = Math.min(frame.width, frame.height) / 2;
    const middle = radius * 0.81;

    return { x: cx + Math.cos(towards) * middle, y: cy + Math.sin(towards) * middle };
  }, index);

  await page.mouse.move(point.x, point.y);
}

async function ready(page, variant) {
  await page.goto(`${COMPONENT_BASE}/${variant}/index.html`);
  await page.waitForFunction(() => customElements.get('ui-donut-chart'));
  await page.waitForFunction(() => document.querySelector('.donut__slice') !== null);
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
      await expect(page.locator('ui-donut-chart').first()).toBeVisible();
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

  const table = page.locator('ui-donut-chart table');
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(5);
  await expect(table.locator('tbody tr').first()).toContainText('18,400');
  await expect(page.locator('.donut__slice')).toHaveCount(0);

  await context.close();
});

test('never more than six wedges, whatever the table holds', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'folding');

  const chart = page.locator('#sources');

  // Past six the small wedges are slivers with labels that have nowhere to sit, so the form
  // stops answering the question it was drawn for.
  await expect(chart.locator('.donut__slice')).toHaveCount(6);
  expect(await chart.evaluate((node) => node.rows.length)).toBe(11);
});

test('the remainder is last, in the last slot, and the note says how many', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'folding');

  const chart = page.locator('#sources');
  const legend = chart.locator('.donut__legend-button');

  // An "Other" in the middle of a legend reads as a category somebody named rather than as
  // what is left over.
  await expect(legend).toHaveCount(6);
  await expect(legend.last()).toContainText('Other');
  await expect(legend.first()).not.toContainText('Other');

  // The last colour slot rather than a new hue.
  const slot = await chart.evaluate(
    (node) => node.querySelectorAll('.donut__legend-button')[5].dataset.slot,
  );
  expect(slot).toBe('5');

  await expect(chart.locator('.donut__note')).toHaveText(/6 smaller sources folded into Other/);
});

test('a table with extra value columns says which are not plotted', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'folding');

  const plans = page.locator('ui-donut-chart').nth(1);

  // A ring divides one total. Quietly drawing the first column would let somebody believe the
  // other two were in there somewhere.
  await expect(plans.locator('.donut__slice')).toHaveCount(3);
  await expect(plans.locator('.donut__note')).toContainText('Only the first value column is plotted');
});

test('what cannot be part of a whole is left out and counted', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 1200 });
  await ready(page, 'states');

  const adjustments = page.locator('ui-donut-chart').last();

  // A negative share of a total is not a thing: drawn, it would either invert a wedge or
  // quietly shrink everybody else.
  await expect(adjustments.locator('.donut__slice')).toHaveCount(2);
  await expect(adjustments.locator('.donut__note')).toContainText('1 negative values left out');
  expect(await adjustments.evaluate((node) => node.total)).toBe(6050);
});

test('a total of zero says so rather than drawing an empty ring', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 1200 });
  await ready(page, 'states');

  const refunds = page.locator('ui-donut-chart').nth(2);

  await expect(refunds.locator('.donut__empty')).toHaveText('Nothing to divide');
  await expect(refunds.locator('.donut__slice')).toHaveCount(0);
  // An empty circle beside a legend looks like a chart that failed to load.
  await expect(refunds.locator('.donut__centre')).toBeHidden();
});

test('one slice is a whole ring with no notch cut into it', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 1200 });
  await ready(page, 'states');

  const single = page.locator('ui-donut-chart').nth(1);
  await expect(single.locator('.donut__slice')).toHaveCount(1);

  // A full turn cannot be one SVG arc — its start and end are the same point — so it is drawn
  // as two half circles. A gap would leave a bite out of a circle, which reads as a fault.
  const path = await single.locator('.donut__slice').getAttribute('d');
  expect((path.match(/A/g) ?? []).length).toBe(4);
  expect((path.match(/M/g) ?? []).length).toBe(2);
});

test('the legend carries a number and a share for every wedge', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  // A ring is read by angle and nobody reads angle accurately, so this is where the values
  // live. The legend is not a colour key.
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.donut__legend-button')].map((button) => ({
      value: button.querySelector('.donut__legend-value').textContent,
      share: button.querySelector('.donut__legend-share').textContent,
    })),
  );

  expect(rows.length).toBe(5);
  rows.forEach((row) => {
    expect(row.value).toMatch(/\d/);
    expect(row.share).toMatch(/%$/);
  });
});

test('hiding a wedge leaves the survivors their colours and recalculates the rest', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'interaction');

  const swatches = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.donut__legend-swatch')].map(
        (swatch) => getComputedStyle(swatch).backgroundColor,
      ),
    );

  const before = await swatches();
  const total = await page.locator('ui-donut-chart').evaluate((node) => node.total);

  await page.locator('.donut__legend-button').first().click();
  await page.waitForTimeout(200);

  // Colour follows the row it was written in, never its rank among what is currently shown.
  expect(await swatches()).toEqual(before);
  await expect(page.locator('.donut__slice')).toHaveCount(4);

  // The shares recalculate against what is left, because that is what a part-to-whole chart
  // is for, and the total in the hole follows.
  const after = await page.locator('ui-donut-chart').evaluate((node) => node.total);
  expect(after).toBeLessThan(total);
  await expect(page.locator('.donut__centre-value')).toHaveText(
    after.toLocaleString('en-US'),
  );

  const shares = await page.evaluate(() =>
    [...document.querySelectorAll('.donut__legend-button')]
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
      .map((button) => Number.parseFloat(button.querySelector('.donut__legend-share').textContent)),
  );
  expect(Math.round(shares.reduce((sum, share) => sum + share, 0))).toBe(100);
});

test('the last visible wedge will not switch itself off', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'interaction');

  const buttons = page.locator('.donut__legend-button');

  for (const index of [0, 1, 2, 3, 4]) {
    await buttons.nth(index).click();
    await page.waitForTimeout(120);
  }

  // An empty ring under a full legend reads as a fault rather than as a choice.
  await expect(page.locator('.donut__slice')).toHaveCount(1);
});

test('a hidden row is struck through as well as faded', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'interaction');

  await page.locator('.donut__legend-button').first().click();
  await page.waitForTimeout(150);

  expect(
    await page.evaluate(
      () => getComputedStyle(document.querySelector('.donut__legend-button')).textDecorationLine,
    ),
  ).toContain('line-through');
});

test('the hole holds the total, and the wedge being read while one is', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  // The middle of a ring is where the reader is already looking, and it was empty. A panel
  // beside the pointer would cover wedges while saying less.
  await expect(page.locator('.donut__centre-label')).toHaveText('Total');
  await expect(page.locator('.donut__centre-value')).toHaveText('39,700');
  await expect(page.locator('.donut__centre-share')).toBeHidden();

  // Aimed at a point on the arc rather than at the middle of its bounding box, which for a
  // wedge falls in the hole. A reader points at the paint; a bounding box is not the paint.
  await hoverWedge(page, 0);
  await page.waitForTimeout(150);

  await expect(page.locator('.donut__centre-label')).toHaveText('Organic search');
  await expect(page.locator('.donut__centre-value')).toHaveText('18,400');
  await expect(page.locator('.donut__centre-share')).toHaveText('46.3%');
});

test('the wedge being read comes out of the ring and the rest step back', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  // Nothing is emphasised until something is being read: a ring that dims itself at rest is
  // a ring that looks broken.
  const resting = await page.evaluate(() => ({
    reading: document.querySelector('.donut__frame').hasAttribute('data-reading'),
    opacities: [...document.querySelectorAll('.donut__slice')].map(
      (wedge) => getComputedStyle(wedge).opacity,
    ),
  }));

  expect(resting.reading).toBe(false);
  expect(new Set(resting.opacities)).toEqual(new Set(['1']));

  await hoverWedge(page, 1);
  await page.waitForTimeout(300);

  const reading = await page.evaluate(() => {
    const wedges = [...document.querySelectorAll('.donut__slice')];
    const active = wedges.findIndex((wedge) => wedge.hasAttribute('data-active'));

    return {
      active,
      activeOpacity: getComputedStyle(wedges[active]).opacity,
      others: wedges
        .filter((unused, index) => index !== active)
        .map((wedge) => Number.parseFloat(getComputedStyle(wedge).opacity)),
      translate: getComputedStyle(wedges[active]).translate,
      resting: wedges
        .filter((unused, index) => index !== active)
        .map((wedge) => getComputedStyle(wedge).translate),
    };
  });

  expect(reading.active).toBe(1);
  // The one being read keeps its full weight — the emphasis is on it, not taken from it.
  expect(reading.activeOpacity).toBe('1');
  reading.others.forEach((opacity) => expect(opacity).toBeLessThan(0.5));

  // Out along its own middle angle, so it leaves the ring rather than sliding sideways.
  const [x, y] = reading.translate.split(' ').map(Number.parseFloat);
  expect(Math.round(Math.hypot(x, y))).toBe(7);
  reading.resting.forEach((value) => expect(value).toBe('none'));
});

test('the lifted wedge is not clipped by the edge of the frame', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  // The ring is sized with the lift already subtracted. Sized without it, a wedge would be
  // cropped at exactly the moment somebody was looking at it.
  for (const index of [0, 1, 2, 3, 4]) {
    await hoverWedge(page, index);
    await page.waitForTimeout(250);

    const fits = await page.evaluate(() => {
      const frame = document.querySelector('.donut__frame').getBoundingClientRect();
      const active = document.querySelector('.donut__slice[data-active]').getBoundingClientRect();

      return (
        active.left >= frame.left - 0.5 &&
        active.right <= frame.right + 0.5 &&
        active.top >= frame.top - 0.5 &&
        active.bottom <= frame.bottom + 0.5
      );
    });

    expect(fits, `wedge ${index} stays inside the frame`).toBe(true);
  }
});

test('pointing at a legend row lifts its wedge', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  // The row and the wedge are the same thing said twice. A reader going down a list of
  // numbers should not have to go back to the ring to find which one is which.
  await page.locator('.donut__legend-button').nth(2).hover();
  await page.waitForTimeout(250);

  const linked = await page.evaluate(() => {
    const wedges = [...document.querySelectorAll('.donut__slice')];

    return {
      active: wedges.findIndex((wedge) => wedge.hasAttribute('data-active')),
      centre: document.querySelector('.donut__centre').textContent.replace(/\s+/g, ' ').trim(),
    };
  });

  expect(linked.active).toBe(2);
  expect(linked.centre).toContain('Paid search');
});

test('the keyboard lifts the same wedge the pointer does', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  await page.locator('.donut__frame').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(250);

  // Emphasis is not a pointer feature. Focus produces the same lift, the same dimming and the
  // same reading in the hole.
  const walked = await page.evaluate(() => {
    const wedges = [...document.querySelectorAll('.donut__slice')];
    const active = wedges.findIndex((wedge) => wedge.hasAttribute('data-active'));

    return {
      active,
      reading: document.querySelector('.donut__frame').hasAttribute('data-reading'),
      lifted: getComputedStyle(wedges[active]).translate !== 'none',
      dimmed: Number.parseFloat(getComputedStyle(wedges[(active + 1) % wedges.length]).opacity),
    };
  });

  expect(walked.active).toBe(1);
  expect(walked.reading).toBe(true);
  expect(walked.lifted).toBe(true);
  expect(walked.dimmed).toBeLessThan(0.5);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  expect(
    await page.evaluate(() => document.querySelector('.donut__frame').hasAttribute('data-reading')),
  ).toBe(false);
});

test('the keyboard reads what the pointer reads, from one tab stop', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  const hovered = await page.evaluate(async () => {
    const wedge = document.querySelector('.donut__slice');
    wedge.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
    return document.querySelector('.donut__centre').textContent.replace(/\s+/g, ' ').trim();
  });

  await page.evaluate(() => document.querySelector('.donut__frame').blur());

  // Six wedges that each cost a tab press is a chart people learn to skip.
  const stops = await page.evaluate(
    () => document.querySelectorAll('.donut__frame[tabindex="0"]').length,
  );
  const inner = await page.evaluate(
    () => [...document.querySelectorAll('.donut__slice')].filter((node) => node.getAttribute('tabindex') === '0').length,
  );

  expect(stops).toBe(1);
  expect(inner).toBe(0);

  await page.locator('.donut__frame').focus();
  await page.keyboard.press('Home');
  await page.waitForTimeout(150);

  expect(
    await page.evaluate(() =>
      document.querySelector('.donut__centre').textContent.replace(/\s+/g, ' ').trim(),
    ),
  ).toBe(hovered);

  // And it is announced, not only drawn.
  expect(await page.evaluate(() => document.querySelector('[role="status"]').textContent)).toContain(
    'Organic search',
  );
});

test('the table is in the page whether it is shown or collapsed', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'table');

  const toggle = page.locator('.donut__table-toggle');
  const table = page.locator('ui-donut-chart table');

  // On a ring the table is not a second way to read the values — it is the only accurate one.
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(await table.evaluate((node) => getComputedStyle(node).display !== 'none')).toBe(true);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(table).toBeVisible();
});

test('the wedges are separated by the surface rather than by a stroke', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  const marks = await page.evaluate(() =>
    [...document.querySelectorAll('.donut__slice')].map((slice) => ({
      stroke: getComputedStyle(slice).stroke,
      width: getComputedStyle(slice).strokeWidth,
    })),
  );

  // A stroke around a wedge is ink with the weight of data doing a spacer's job — and the gap
  // is already taken out of the wedge itself.
  marks.forEach((mark) => {
    expect(['none', 'rgba(0, 0, 0, 0)']).toContain(mark.stroke);
  });
});

test('refetching holds the ring and a failure keeps the table', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 1200 });
  await ready(page, 'states');

  const live = page.locator('#live');

  await page.locator('[data-demo-action="loading"]').click();
  await page.waitForTimeout(200);

  await expect(live.locator('.donut__slice')).toHaveCount(3);
  expect(
    await live.evaluate((node) =>
      Number.parseFloat(getComputedStyle(node.querySelector('.donut__canvas')).opacity),
    ),
  ).toBeLessThan(1);

  await page.locator('[data-demo-action="loading"]').click();
  await page.locator('[data-demo-action="error"]').click();
  await page.waitForTimeout(200);

  await expect(live.locator('.donut__empty')).toHaveText('That breakdown could not be loaded');
  await expect(live.locator('tbody tr')).toHaveCount(3);
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

      const chart = document.querySelector('ui-donut-chart');
      const surface = channels(getComputedStyle(chart.querySelector('.donut__frame')).backgroundColor);

      return {
        total: ratio(channels(getComputedStyle(chart.querySelector('.donut__centre-value')).color), surface),
        label: ratio(channels(getComputedStyle(chart.querySelector('.donut__centre-label')).color), surface),
        legend: ratio(channels(getComputedStyle(chart.querySelector('.donut__legend-button')).color), surface),
        value: ratio(channels(getComputedStyle(chart.querySelector('.donut__legend-value')).color), surface),
      };
    });

    Object.entries(contrast).forEach(([part, value]) => {
      expect(value, `${part} in ${colorScheme}`).toBeGreaterThanOrEqual(4.5);
    });
  }
});
