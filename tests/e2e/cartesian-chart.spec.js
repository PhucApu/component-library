import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/cartesian-chart/source/variants';
const VARIANTS = ['default', 'bars', 'stacked', 'scales', 'interaction', 'table', 'states'];

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
  await page.waitForFunction(() => customElements.get('ui-cartesian-chart'));
  await page.waitForFunction(() => document.querySelector('.chart__line, .chart__bar') !== null);
  await page.waitForTimeout(200);
}

const chartAt = (page, index = 0) => page.locator('ui-cartesian-chart').nth(index);

test('all seven variants run independently without external requests or overflow', async ({
  page,
}) => {
  // Fourteen navigations in one test, each waiting for a first paint. The default budget is
  // one page's worth and this is not one page.
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
      await page.setViewportSize({ width, height: 760 });
      await ready(page, variant);

      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('ui-cartesian-chart').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  // Every mark is drawn from numbers already on the page. There is no tile server, no font
  // service and no charting library to fetch.
  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('with no script every variant is still a complete table of numbers', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto(`${COMPONENT_BASE}/default/index.html`);

  // The markup is the data and the fallback at once, so what is left is every number rather
  // than an empty box where a chart was going to be.
  const table = page.locator('ui-cartesian-chart table');
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(8);
  await expect(table.locator('tbody tr').first()).toContainText('$4,200');
  await expect(page.locator('caption')).toHaveText('Revenue by month');

  // And nothing was invented: no plot, no legend, no toggle.
  await expect(page.locator('.chart__canvas')).toHaveCount(0);
  await expect(page.locator('.chart__legend-button')).toHaveCount(0);

  await context.close();
});

test('there is no second value axis anywhere in the output', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'default');

  // Two scales on one plot invent a correlation the data does not have: where the lines
  // appear to cross depends on how the second axis was aligned, which is the author's choice
  // rather than the numbers'. A right-hand axis would show up as a second column of ticks.
  const axes = await page.evaluate(() => {
    const chart = document.querySelector('ui-cartesian-chart');
    const columns = new Set(
      [...chart.querySelectorAll('.chart__tick')].map((tick) =>
        Math.round(Number.parseFloat(tick.getAttribute('x'))),
      ),
    );

    return {
      tickColumns: columns.size,
      // And no API offers one either.
      attributes: ['y2-min', 'y2-max', 'y2-label', 'secondary-axis'].filter((name) =>
        chart.constructor.observedAttributes.includes(name),
      ),
    };
  });

  expect(axes).toEqual({ tickColumns: 1, attributes: [] });
});

test('columns are measured from zero, and a floor above zero does not lift them', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'bars');

  const floor = () =>
    page.evaluate(() => {
      const chart = document.querySelector('ui-cartesian-chart');
      return [...chart.querySelectorAll('.chart__tick')].map((tick) => tick.textContent)[0];
    });

  expect(await floor()).toBe('0');

  // A bar is read by its length, so a column chart floored at 1,000 would make 1,290 look
  // like nothing and 1,840 look like double what it is. The attribute is honoured downward
  // only, and this is the direction that lies.
  await chartAt(page).evaluate((chart) => chart.setAttribute('y-min', '1000'));
  await page.waitForTimeout(200);
  expect(await floor()).toBe('0');

  await chartAt(page).evaluate((chart) => chart.setAttribute('y-min', '-500'));
  await page.waitForTimeout(200);
  expect(Number.parseFloat((await floor()).replace(/,/g, ''))).toBeLessThanOrEqual(-500);
});

test('one series means one colour for every bar', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'bars');

  // Shading bars darker where they are taller spends the only free channel the chart has on
  // information the bar's own length already carries, and makes unordered categories look
  // ordered when they are not.
  const fills = await page.evaluate(() =>
    [...document.querySelectorAll('.chart__bar')].map((bar) => getComputedStyle(bar).fill),
  );

  expect(fills.length).toBe(5);
  expect(new Set(fills).size).toBe(1);
});

test('hiding a series never repaints the survivors', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'interaction');

  const swatches = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.chart__legend-swatch')].map(
        (swatch) => getComputedStyle(swatch).backgroundColor,
      ),
    );

  const before = await swatches();
  expect(before.length).toBe(3);

  await page.locator('.chart__legend-button').first().click();
  await page.waitForTimeout(200);

  // Colour follows the entity, never its rank. Hiding "Free" must not promote "Team" to blue:
  // a reader who learned that orange means Team gets to keep it.
  const after = await swatches();
  expect(after).toEqual(before);
  await expect(page.locator('.chart__legend-button').first()).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.locator('.chart__series')).toHaveCount(2);
});

test('the last visible series will not switch itself off', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'interaction');

  const buttons = page.locator('.chart__legend-button');
  await buttons.nth(0).click();
  await buttons.nth(1).click();
  await page.waitForTimeout(150);
  await buttons.nth(2).click();
  await page.waitForTimeout(150);

  // An empty plot under a full legend reads as a fault rather than as a choice.
  expect(await chartAt(page).evaluate((chart) => chart.visible.length)).toBe(1);
  await expect(page.locator('.chart__series')).toHaveCount(1);
});

test('a hidden series is struck through as well as faded', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'interaction');

  await page.locator('.chart__legend-button').first().click();
  await page.waitForTimeout(150);

  // State never rests on colour alone, and a fade is not readable to everyone.
  expect(
    await page.evaluate(
      () => getComputedStyle(document.querySelector('.chart__legend-button')).textDecorationLine,
    ),
  ).toContain('line-through');
});

test('gridlines are solid hairlines, never dashed', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'default');

  // Dashing adds noise to every band at once and reads as a threshold when it is only a grid.
  const grid = await page.evaluate(() => {
    const line = document.querySelector('.chart__grid-line');
    const style = getComputedStyle(line);
    return { dash: style.strokeDasharray, width: style.strokeWidth };
  });

  expect(['none', '']).toContain(grid.dash);
  expect(grid.width).toBe('1px');
});

test('no label is ever clipped by the frame', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });

  for (const variant of VARIANTS) {
    await ready(page, variant);

    // A label that will not fit is dropped, not cropped. The measuring node is excluded
    // deliberately: it is parked far off-canvas and would fail this for ever.
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll('ui-cartesian-chart')].flatMap((chart) => {
        const frame = chart.querySelector('.chart__frame').getBoundingClientRect();

        return [...chart.querySelectorAll('.chart__canvas text:not(.chart__measure)')]
          .filter((node) => {
            const rect = node.getBoundingClientRect();
            return (
              rect.width > 0 &&
              (rect.left < frame.left - 0.5 ||
                rect.right > frame.right + 0.5 ||
                rect.top < frame.top - 0.5 ||
                rect.bottom > frame.bottom + 0.5)
            );
          })
          .map((node) => node.textContent);
      }),
    );

    expect(clipped, `clipped labels in ${variant}`).toEqual([]);
  }
});

test('the frame holds the axis band, so the card grows no nested scrollbar', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'default');

  const fit = await page.evaluate(() => {
    const chart = document.querySelector('ui-cartesian-chart');
    const frame = chart.querySelector('.chart__frame');
    const categories = [...chart.querySelectorAll('.chart__category')];
    const box = frame.getBoundingClientRect();

    return {
      scrolls: frame.scrollHeight > frame.clientHeight + 1,
      // The category labels are inside the frame, not in a band below it.
      labelsInside: categories.every((node) => node.getBoundingClientRect().bottom <= box.bottom),
    };
  });

  expect(fit).toEqual({ scrolls: false, labelsInside: true });
});

test('two series get a legend and one series gets no legend box', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'default');
  await expect(page.locator('.chart__legend')).toBeVisible();
  await expect(page.locator('.chart__legend-button')).toHaveCount(2);

  await ready(page, 'bars');
  // One colour, and the caption already says what is plotted. A box holding a single swatch
  // restates the title and costs a line.
  await expect(page.locator('.chart__legend').first()).toBeHidden();
});

test('the keyboard reads exactly what the pointer reads', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'interaction');

  const readout = () =>
    page.evaluate(() =>
      document.querySelector('.chart__readout').textContent.replace(/\s+/g, ' ').trim(),
    );

  await page.locator('.chart__frame').hover({ position: { x: 120, y: 140 } });
  await page.waitForTimeout(150);
  const hovered = await readout();
  expect(hovered).toContain('W1');

  await page.mouse.move(0, 0);
  await page.locator('.chart__frame').focus();
  await page.keyboard.press('Home');
  await page.waitForTimeout(150);

  // A value only a mouse can reach is a value half the room cannot.
  expect(await readout()).toBe(hovered);
  // And it is announced, not only drawn.
  expect(await page.evaluate(() => document.querySelector('[role="status"]').textContent)).toContain(
    'W1',
  );
});

test('every value in the read-out is also in the table', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'interaction');

  await page.locator('.chart__frame').focus();
  await page.keyboard.press('End');
  await page.waitForTimeout(150);

  // A tooltip enhances and never gates. Nothing is reachable only by hovering.
  const both = await page.evaluate(() => {
    const chart = document.querySelector('ui-cartesian-chart');
    const shown = [...chart.querySelectorAll('.chart__readout-value')].map(
      (node) => node.textContent,
    );
    const lastRow = [...chart.querySelectorAll('tbody tr')].at(-1);
    const cells = [...lastRow.querySelectorAll('td')].map((cell) => cell.textContent.trim());

    return { shown, cells };
  });

  expect(both.shown.length).toBe(3);
  both.shown.forEach((value) => expect(both.cells).toContain(value));
});

test('the crosshair stays away until something is being read', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'default');

  // `Element.hidden` is defined on HTMLElement and does nothing at all on an SVG node, so
  // setting it as a property left a hairline parked at x=0 down the left of every chart.
  const parked = await page.evaluate(() => {
    const line = document.querySelector('.chart__crosshair');
    return { attribute: line.hasAttribute('hidden'), display: getComputedStyle(line).display };
  });

  expect(parked).toEqual({ attribute: true, display: 'none' });

  await page.locator('.chart__frame').hover({ position: { x: 400, y: 120 } });
  await page.waitForTimeout(150);

  const reading = await page.evaluate(() => {
    const group = document.querySelector('.chart__crosshair');
    const line = group.querySelector('.chart__crosshair-line');

    return {
      shown: !group.hasAttribute('hidden'),
      // Moved by transform rather than by coordinate, so it is composited and can be carried
      // from one category to the next instead of teleporting.
      x: Math.round(group.getBoundingClientRect().left),
      frameLeft: Math.round(document.querySelector('.chart__frame').getBoundingClientRect().left),
      lineX: line.getAttribute('x1'),
      rings: group.querySelectorAll('.chart__read-mark:not([hidden])').length,
    };
  });

  expect(reading.shown).toBe(true);
  expect(reading.lineX).toBe('0');
  expect(reading.x - reading.frameLeft).toBeGreaterThan(50);
  // The marks being read answer too, or the chart looks inert while a box floats beside it.
  expect(reading.rings).toBe(2);
});

test('following the pointer does no work while the answer has not changed', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'default');

  await page.evaluate(() => {
    window.reads = 0;
    window.rebuilds = 0;
    document.addEventListener('chart-read', () => {
      window.reads += 1;
    });
    new MutationObserver((records) => {
      window.rebuilds += records.filter((record) => record.type === 'childList').length;
    }).observe(document.querySelector('.chart__readout'), { childList: true });
  });

  const box = await page.locator('.chart__frame').boundingBox();
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width - 30, box.y + box.height / 2, { steps: 120 });
  await page.waitForTimeout(250);

  // A pointer reports about a hundred times across a plot with eight categories in it.
  // Answering every report tore the panel down and built it again 483 times for 8 distinct
  // values, each rebuild forcing a layout to position itself, and that is what made following
  // the pointer feel like it was catching. One read per category is the floor.
  const work = await page.evaluate(() => ({ reads: window.reads, rebuilds: window.rebuilds }));

  expect(work.reads).toBeLessThanOrEqual(8);
  expect(work.rebuilds).toBeLessThan(60);
});

test('the panel and the hairline glide between categories rather than jumping', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'default');

  await page.locator('.chart__frame').hover({ position: { x: 200, y: 140 } });
  await page.waitForTimeout(200);

  const moving = await page.evaluate(() => {
    const readout = getComputedStyle(document.querySelector('.chart__readout'));
    const crosshair = getComputedStyle(document.querySelector('.chart__crosshair'));

    return {
      // `inset-inline-start` is a layout property and cannot be transitioned, which is why
      // the panel used to jump. A translate can be.
      readoutProperty: readout.transitionProperty,
      readoutDuration: readout.transitionDuration,
      readoutInset: readout.insetInlineStart,
      crosshairProperty: crosshair.transitionProperty,
    };
  });

  expect(moving.readoutProperty).toBe('transform');
  expect(moving.crosshairProperty).toBe('transform');
  expect(Number.parseFloat(moving.readoutDuration)).toBeGreaterThan(0);
  expect(moving.readoutInset).toBe('0px');
});

test('bars round the data end and keep the baseline square', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'bars');

  // A rect with `rx` rounds all four corners, which lifts every bar off the very zero it is
  // measured from and turns a stack into a column of separate pills.
  const shape = await page.evaluate(() => {
    const bar = document.querySelector('.chart__bar');
    return { tag: bar.tagName, arcs: (bar.getAttribute('d').match(/A/g) ?? []).length };
  });

  expect(shape).toEqual({ tag: 'path', arcs: 2 });
});

test('a stack is separated by the surface, and only its outer end is rounded', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'stacked');

  const stack = await page.evaluate(() => {
    const chart = document.querySelector('ui-cartesian-chart');
    const segments = [...chart.querySelectorAll('.chart__bar[data-index="0"]')];
    const boxes = segments.map((segment) => segment.getBoundingClientRect());

    return {
      segments: segments.length,
      arcs: segments.map((segment) => (segment.getAttribute('d').match(/A/g) ?? []).length),
      // Bottom of one band to the top of the next.
      gaps: boxes
        .slice(0, -1)
        .map((box, index) => Math.round(box.top - boxes[index + 1].bottom)),
    };
  });

  expect(stack.segments).toBe(3);
  // Interior segments are square; only the one furthest from the baseline is rounded.
  expect(stack.arcs).toEqual([0, 0, 2]);
  stack.gaps.forEach((gap) => expect(Math.abs(gap)).toBeLessThanOrEqual(3));
});

test('an empty cell breaks the line rather than plotting zero', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'table');

  // Zero says "we sold nothing"; empty says "we did not measure". Drawing the gap as zero
  // would put a confident dip in a quarter nobody measured.
  const broken = await page.evaluate(() => {
    const chart = document.querySelector('ui-cartesian-chart');
    const series = [...chart.querySelectorAll('.chart__series')];
    const americas = series[1];
    const line = americas.querySelector('.chart__line').getAttribute('d');
    const area = americas.querySelector('.chart__area').getAttribute('d');

    return {
      runs: (line.match(/M/g) ?? []).length,
      areaRuns: (area.match(/M/g) ?? []).length,
      values: chart.series[1].values,
    };
  });

  expect(broken.values[2]).toBe(null);
  expect(broken.runs).toBe(2);
  expect(broken.areaRuns).toBe(2);
});

test('data-value wins, and the read-out shows the text as it was written', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'table');

  await page.locator('.chart__frame').focus();
  await page.keyboard.press('Home');
  await page.waitForTimeout(150);

  const read = await page.evaluate(() => {
    const chart = document.querySelector('ui-cartesian-chart');
    return {
      plotted: chart.series[0].values[0],
      shown: chart.querySelector('.chart__readout-value').textContent,
    };
  });

  // The cell reads `18.4 TB` and the scale gets `18.4`.
  expect(read).toEqual({ plotted: 18.4, shown: '18.4 TB' });
});

test('the table is in the page whether it is shown or collapsed', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'table');

  const toggle = page.locator('.chart__table-toggle');
  const table = page.locator('ui-cartesian-chart table');

  // Collapsed it is hidden from the eye and never from the page, so a screen reader still has
  // every number while the drawing beside it stays aria-hidden.
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(
    await table.evaluate((node) => getComputedStyle(node).display !== 'none'),
  ).toBe(true);
  await expect(page.locator('.chart__canvas')).toHaveAttribute('aria-hidden', 'true');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(table).toBeVisible();
  await expect(toggle).toHaveText('Hide the table');
});

test('the ninth series is left to the table rather than given an invented colour', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  const many = page.locator('#many');

  // A generated ninth hue is indistinguishable from one already on screen under colour-vision
  // simulation, so it is not drawn and the note says where to find it.
  await expect(many.locator('.chart__series')).toHaveCount(8);
  await expect(many.locator('.chart__note')).toHaveText('2 more in the table');

  await page.locator('[data-demo-action="fold"]').click();

  // Waited for rather than slept through: the re-render is a frame away, and under load a
  // fixed pause is a guess that sometimes loses.
  await expect(many.locator('.chart__legend-button').last()).toContainText('Other');

  // Folding sums the tail, which changes what the author wrote — so it is asked for.
  await expect(many.locator('.chart__series')).toHaveCount(8);
  await expect(many.locator('.chart__note')).toBeHidden();
});

test('refetching holds the previous render and a failure keeps the table', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  const single = page.locator('#single');
  const bars = () => single.locator('.chart__bar').count();

  expect(await bars()).toBe(5);

  await page.locator('[data-demo-action="loading"]').click();
  await page.waitForTimeout(200);

  // No skeleton: the shape the reader is looking at is held, faded, rather than thrown away.
  expect(await bars()).toBe(5);
  expect(
    await single.evaluate((chart) =>
      Number.parseFloat(getComputedStyle(chart.querySelector('.chart__canvas')).opacity),
    ),
  ).toBeLessThan(1);

  await page.locator('[data-demo-action="loading"]').click();
  await page.locator('[data-demo-action="error"]').click();
  await page.waitForTimeout(200);

  await expect(single.locator('.chart__empty')).toHaveText('That report could not be loaded');
  // The numbers that did arrive are still readable.
  await expect(single.locator('tbody tr')).toHaveCount(5);
});

test('nothing to plot says so rather than drawing an empty grid', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  const empty = page.locator('ui-cartesian-chart').nth(1);

  await expect(empty.locator('.chart__empty')).toHaveText('No data to plot');
  await expect(empty.locator('.chart__bar')).toHaveCount(0);
  await expect(empty.locator('.chart__grid-line')).toHaveCount(0);
});

test('category labels are thinned rather than turned on their side', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 760 });
  await ready(page, 'scales');

  const axis = await page.evaluate(() => {
    const chart = document.querySelector('ui-cartesian-chart');
    const labels = [...chart.querySelectorAll('.chart__category')];

    return {
      shown: labels.map((node) => node.textContent),
      total: chart.categories.length,
      rotated: labels.some((node) => (node.getAttribute('transform') ?? '').includes('rotate')),
    };
  });

  // A rotated label is slower to read, and on a narrow screen the axis ends up taller than
  // the plot it belongs to.
  expect(axis.rotated).toBe(false);
  expect(axis.shown.length).toBeLessThan(axis.total);
  // The last category is the one a reader looks for first on a time axis.
  expect(axis.shown.at(-1)).toBe('22:00');
});

test('the horizontal bar gives long names a line each', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'bars');

  await page.locator('[data-demo-type="bar"]').click();
  await page.waitForTimeout(250);

  const sideways = await page.evaluate(() => {
    const chart = document.querySelector('ui-cartesian-chart');
    const labels = [...chart.querySelectorAll('.chart__category')];
    const bars = [...chart.querySelectorAll('.chart__bar')].map((bar) =>
      bar.getBoundingClientRect(),
    );

    return {
      labels: labels.length,
      anchored: labels.every((node) => node.getAttribute('text-anchor') === 'end'),
      // Every bar starts on the same left edge, which is the baseline.
      leftEdges: new Set(bars.map((box) => Math.round(box.left))).size,
      widening: bars[0].width > bars.at(-1).width,
    };
  });

  expect(sideways).toEqual({ labels: 5, anchored: true, leftEdges: 1, widening: true });
});

test('reduced motion removes the draw-in rather than shortening it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'default');

  const motion = await page.evaluate(() => {
    const chart = document.querySelector('ui-cartesian-chart');
    const style = getComputedStyle(chart.querySelector('.chart__series'));

    return {
      name: style.animationName,
      token: getComputedStyle(chart).getPropertyValue('--chart-motion').trim(),
      readToken: getComputedStyle(chart).getPropertyValue('--chart-read-motion').trim(),
      // The glide is motion too, and asking for stillness has to reach it.
      readout: getComputedStyle(chart.querySelector('.chart__readout')).transitionDuration,
    };
  });

  expect(motion.name).toBe('none');
  expect(motion.token).toBe('0ms');
  expect(motion.readToken).toBe('0ms');
  expect(Number.parseFloat(motion.readout)).toBe(0);
});

test('the words on the chart clear the contrast the rules ask for', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });

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

      const chart = document.querySelector('ui-cartesian-chart');
      const surface = channels(
        getComputedStyle(chart.querySelector('.chart__frame')).backgroundColor,
      );

      return {
        tick: ratio(channels(getComputedStyle(chart.querySelector('.chart__tick')).fill), surface),
        // Text never wears the data colour, so the value labels are held to the text rule.
        value: ratio(
          channels(getComputedStyle(chart.querySelector('.chart__value-label')).fill),
          surface,
        ),
        legend: ratio(
          channels(getComputedStyle(chart.querySelector('.chart__legend-button')).color),
          channels(getComputedStyle(document.body).backgroundColor),
        ),
      };
    });

    expect(contrast.tick, `axis ticks in ${colorScheme}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast.value, `value labels in ${colorScheme}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast.legend, `legend in ${colorScheme}`).toBeGreaterThanOrEqual(4.5);
  }
});

test('the chart is redrawn at the size it is given rather than stretched', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 760 });
  await ready(page, 'default');

  const wide = await page.evaluate(() => {
    const svg = document.querySelector('.chart__canvas');
    const label = document.querySelector('.chart__tick');
    return { width: svg.getAttribute('width'), letter: label.getBoundingClientRect().width };
  });

  await page.setViewportSize({ width: 420, height: 760 });
  await page.waitForTimeout(400);

  const narrow = await page.evaluate(() => {
    const svg = document.querySelector('.chart__canvas');
    const label = document.querySelector('.chart__tick');
    return { width: svg.getAttribute('width'), letter: label.getBoundingClientRect().width };
  });

  // Scaling a viewBox stretches the text with it. The text is the same size at both widths
  // because the chart is redrawn rather than scaled.
  expect(Number(narrow.width)).toBeLessThan(Number(wide.width));
  expect(Math.abs(narrow.letter - wide.letter)).toBeLessThan(1.5);
});
