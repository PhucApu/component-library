import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/table/source/variants';
const VARIANTS = ['default', 'sortable', 'selectable', 'sticky', 'expandable', 'dense'];

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
  await page.waitForFunction(() => customElements.get('ui-table'));
}

const hosts = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('tbody tr')].map((row) => row.cells[0].textContent.trim()),
  );

test('all six variants run independently without external requests or page overflow', async ({
  page,
}) => {
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
      await page.setViewportSize({ width, height: 720 });
      await ready(page, variant);

      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('table')).toBeVisible();
      // The table scrolls inside its own box; the page never does.
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('the scroll region takes focus while it overflows and gives it back when it fits', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await ready(page, 'default');

  const read = async () => {
    await page.waitForTimeout(200);
    return page.evaluate(() => {
      const scroller = document.querySelector('.table__scroll');
      return {
        overflowing: document.querySelector('ui-table').hasAttribute('data-overflowing'),
        tabindex: scroller.getAttribute('tabindex'),
        role: scroller.getAttribute('role'),
        label: scroller.getAttribute('aria-label'),
      };
    });
  };

  // Wide enough for the table: a tab stop here would lead nowhere.
  expect(await read()).toEqual({
    overflowing: false,
    tabindex: null,
    role: null,
    label: null,
  });

  await page.setViewportSize({ width: 420, height: 720 });
  expect(await read()).toEqual({
    overflowing: true,
    tabindex: '0',
    role: 'region',
    label: 'Recent orders, scrollable',
  });

  // And back again, which is the half that is easy to forget.
  await page.setViewportSize({ width: 1280, height: 720 });
  expect((await read()).tabindex).toBe(null);
});

test('the scroll region can actually be scrolled from the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 520, height: 720 });
  await ready(page, 'dense');
  await page.waitForTimeout(200);

  const scroller = page.locator('.table__scroll');
  await expect(scroller).toHaveAttribute('tabindex', '0');

  await scroller.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);

  expect(await scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
});

test('sorting cycles through three states and comes back to the source order', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 720 });
  await ready(page, 'sortable');

  const source = await hosts(page);
  const cores = page.locator('th[data-column="cores"] .table__sort');

  await cores.click();
  const ascending = await hosts(page);
  expect(ascending).not.toEqual(source);
  expect(ascending).toEqual(['delta-07', 'atlas-01', 'cinder-04', 'beacon-11', 'ember-02']);

  await cores.click();
  expect(await hosts(page)).toEqual([...ascending].reverse());

  // Without a third state there is no way back to how the data arrived.
  await cores.click();
  expect(await hosts(page)).toEqual(source);
});

test('aria-sort lives on the header cell, and only on the active one', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 720 });
  await ready(page, 'sortable');

  const states = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('th[data-sortable]')].map(
        (header) => `${header.dataset.column}:${header.getAttribute('aria-sort')}`,
      ),
    );

  expect(await states()).toEqual([
    'host:none',
    'region:none',
    'cores:none',
    'cost:none',
  ]);

  await page.locator('th[data-column="cores"] .table__sort').click();
  expect(await states()).toEqual([
    'host:none',
    'region:none',
    'cores:ascending',
    'cost:none',
  ]);

  // The state belongs to the column, not to the control inside it.
  const onButton = await page.evaluate(() =>
    document.querySelector('.table__sort').hasAttribute('aria-sort'),
  );
  expect(onButton).toBe(false);
});

test('a blank cell stays last in both directions', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 720 });
  await ready(page, 'sortable');

  const region = page.locator('th[data-column="region"] .table__sort');

  await region.click();
  expect((await hosts(page)).at(-1)).toBe('delta-07');

  // No value is not a small value, so reversing must not drag the blank to the top.
  await region.click();
  expect((await hosts(page)).at(-1)).toBe('delta-07');
});

test('a numeric column sorts by value, not by digit', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 720 });
  await ready(page, 'sortable');

  await page.locator('th[data-column="cost"] .table__sort').click();
  const costs = await page.evaluate(() =>
    [...document.querySelectorAll('tbody tr')].map((row) => row.cells[3].textContent.trim()),
  );

  // As text "$1,420" would sort before "$96".
  expect(costs).toEqual(['$96', '$184', '$1,420', '$2,960', '']);
});

test('the header checkbox reaches all three states', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'selectable');

  const state = () =>
    page.evaluate(() => {
      const all = document.querySelector('.table__select-all');
      return {
        checked: all.checked,
        indeterminate: all.indeterminate,
        state: document.querySelector('ui-table').dataset.selection,
        selected: document.querySelector('ui-table').selected,
      };
    });

  expect(await state()).toEqual({
    checked: false,
    indeterminate: false,
    state: 'none',
    selected: [],
  });

  // Partly selected exists only as a property, never as an attribute.
  await page.locator('tbody input[type="checkbox"]').first().check();
  expect(await state()).toEqual({
    checked: false,
    indeterminate: true,
    state: 'some',
    selected: ['ha'],
  });
});

test('an unavailable row does not stop select-all reaching all', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'selectable');

  // Counting a row the header cannot operate would leave it ticking every row it can,
  // finding the count short, and drawing itself half-on again immediately.
  await page.locator('.table__select-all').check();

  const state = await page.evaluate(() => {
    const all = document.querySelector('.table__select-all');
    const table = document.querySelector('ui-table');
    return {
      checked: all.checked,
      indeterminate: all.indeterminate,
      state: table.dataset.selection,
      selected: table.selected,
      disabledStillOff: !document.querySelector('input[disabled]').checked,
    };
  });

  expect(state).toEqual({
    checked: true,
    indeterminate: false,
    state: 'all',
    selected: ['ha', 'marcus', 'priya'],
    disabledStillOff: true,
  });
});

test('a detail row opens in place and renames its trigger', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'expandable');

  const trigger = page.locator('[data-expands="inv-2"]');
  const detail = page.locator('[data-detail="inv-2"]');

  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toHaveAttribute('aria-label', 'Show details');
  await expect(detail).toBeHidden();

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(trigger).toHaveAttribute('aria-label', 'Hide details');
  await expect(detail).toBeVisible();

  // A real row spanning the columns, not a floating panel beside the table.
  expect(await detail.evaluate((row) => row.cells[0].colSpan)).toBe(4);
});

test('a detail row travels with its parent when the table is sorted', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 720 });
  await ready(page, 'expandable');

  await page.locator('[data-expands="inv-3"]').click();
  await expect(page.locator('[data-detail="inv-3"]')).toBeVisible();

  await page.evaluate(() => {
    const table = document.querySelector('ui-table');
    const header = document.querySelectorAll('th')[3];
    header.dataset.sortable = '';
    header.dataset.column = 'amount';
    table.sortBy(header, 'ascending');
  });

  // A detail separated from its parent is worse than no detail at all.
  const adjacency = await page.evaluate(() => {
    const parent = document.querySelector('[data-key="inv-3"]');
    return parent.nextElementSibling?.dataset.detail ?? null;
  });
  expect(adjacency).toBe('inv-3');
});

test('a sticky header keeps its underline while the rows move', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'sticky');

  const measured = await page.evaluate(async () => {
    const scroller = document.querySelector('.table__scroll');
    const header = document.querySelector('thead th');
    const before = header.getBoundingClientRect().top;

    scroller.scrollTop = 400;
    await new Promise((resolve) => requestAnimationFrame(resolve));

    return {
      collapse: getComputedStyle(document.querySelector('table')).borderCollapse,
      position: getComputedStyle(header).position,
      scrolled: scroller.scrollTop,
      travelled: before - header.getBoundingClientRect().top,
      // Where it comes to rest: flush with the top of the box it scrolls inside.
      restingOffset: header.getBoundingClientRect().top - scroller.getBoundingClientRect().top,
      underline: getComputedStyle(header).borderBottomWidth,
    };
  });

  expect(measured.collapse).toBe('separate');
  expect(measured.position).toBe('sticky');
  expect(measured.scrolled).toBeGreaterThan(0);

  // It travels far enough to clear the caption above it, then stops. Asserting it never
  // moves at all would be asserting the caption does not exist.
  expect(measured.travelled).toBeGreaterThan(0);
  expect(measured.travelled).toBeLessThan(measured.scrolled);
  expect(Math.abs(measured.restingOffset)).toBeLessThan(2);

  // A collapsed border belongs to whichever cell scrolls away first.
  expect(Number.parseFloat(measured.underline)).toBeGreaterThan(0);
});

test('the compact density really is tighter', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 720 });

  await ready(page, 'default');
  const comfortable = await page.evaluate(
    () => document.querySelector('tbody td').getBoundingClientRect().height,
  );

  await ready(page, 'dense');
  const compact = await page.evaluate(
    () => document.querySelector('tbody td').getBoundingClientRect().height,
  );

  expect(compact).toBeLessThan(comfortable);
});

test('the table still works with scripting disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.setViewportSize({ width: 420, height: 720 });
  await page.goto(`${COMPONENT_BASE}/selectable/index.html`);

  // The structure is entirely in the markup.
  await expect(page.locator('table caption')).toHaveText('Team members');
  await expect(page.locator('tbody tr')).toHaveCount(4);

  // Individual checkboxes still tick; only select-all needs script.
  const box = page.locator('tbody input[type="checkbox"]').first();
  await box.check();
  await expect(box).toBeChecked();

  // A table that genuinely overflows still scrolls by pointer, with no tabindex on it,
  // because the wrapper is written in the markup rather than created by script.
  await page.goto(`${COMPONENT_BASE}/dense/index.html`);
  const scrolled = await page.evaluate(() => {
    const scroller = document.querySelector('.table__scroll');
    scroller.scrollLeft = 60;
    return {
      overflows: scroller.scrollWidth > scroller.clientWidth,
      scrollLeft: scroller.scrollLeft,
      tabindex: scroller.getAttribute('tabindex'),
    };
  });
  expect(scrolled.overflows).toBe(true);
  expect(scrolled.scrollLeft).toBeGreaterThan(0);
  expect(scrolled.tabindex).toBe(null);

  await context.close();
});
