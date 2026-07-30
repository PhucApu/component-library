import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/pagination/source/variants';
const VARIANTS = ['default', 'ranges', 'edges', 'sizes', 'compact', 'table'];

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
  await page.waitForFunction(() => customElements.get('ui-pagination'));
}

/** The pager written out: `*` marks the current page, `/` an unavailable control. */
const shape = (page, index = 0) =>
  page.evaluate(
    (i) =>
      [...document.querySelectorAll('ui-pagination')[i].querySelectorAll('li')]
        .map((item) => {
          const button = item.querySelector('button');
          if (!button) return item.textContent.trim();
          return `${button.getAttribute('aria-current') ? '*' : ''}${button.dataset.key}${
            button.disabled ? '/' : ''
          }`;
        })
        .join(' '),
    index,
  );

test('all six variants run independently without external requests or overflow', async ({
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
      await page.setViewportSize({ width, height: 760 });
      await ready(page, variant);

      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('ui-pagination').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('the pages shown follow the sibling and boundary counts', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'ranges');

  expect(await shape(page, 0)).toBe('previous 1 … 9 *10 11 … 24 next');
  expect(await shape(page, 1)).toBe('previous 1 … 8 9 *10 11 12 … 24 next');
  expect(await shape(page, 2)).toBe('previous 1 2 … 9 *10 11 … 23 24 next');
  expect(await shape(page, 3)).toBe('previous 1 … *10 … 24 next');
});

test('a gap standing for one page shows the page instead', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'ranges');

  // Page 7 of 9: collapsed on the left, and on the right only page 8 would be hidden, so
  // it stays. A mark in place of one number is the same width and one fewer thing anybody
  // can reach.
  expect(await shape(page, 4)).toBe('previous 1 … 5 6 *7 8 9 next');
});

test('every control says where it goes', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'default');

  const first = page.locator('ui-pagination').first();

  // "3" is not a destination.
  await expect(first.getByRole('button', { name: 'Go to page 3' })).toBeVisible();
  await expect(first.getByRole('button', { name: 'Go to previous page' })).toBeVisible();
  await expect(first.getByRole('button', { name: 'Go to next page' })).toBeVisible();

  // Exact, or "Page 1" also matches "Go to page 10".
  const current = first.getByRole('button', { name: 'Page 1', exact: true });
  await expect(current).toHaveAttribute('aria-current', 'page');
});

test('the ellipsis is not a control and is not announced', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'default');

  const gap = page.locator('ui-pagination').first().locator('.pagination__ellipsis');
  await expect(gap).toBeVisible();
  await expect(gap).toHaveAttribute('aria-hidden', 'true');

  // The pages behind it are reachable through the neighbouring numbers and the arrows, so
  // a control here would be a tab stop leading nowhere new.
  expect(await gap.evaluate((element) => element.tagName)).toBe('SPAN');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const spoken = nodes.map((node) => node.name?.value ?? '');
  expect(spoken.some((text) => text.includes('…'))).toBe(false);
});

test('focus stays on the control that was pressed', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'edges');

  const first = page.locator('ui-pagination').first();
  const focusedKey = () =>
    page.evaluate(() => document.activeElement?.dataset?.key ?? document.activeElement.tagName);

  await first.locator('button[data-key="6"]').click();
  expect(await shape(page, 0)).toBe('first previous 1 … 5 *6 7 … 12 next last');
  // The whole list was rebuilt underneath it.
  expect(await focusedKey()).toBe('6');

  await first.locator('button[data-key="next"]').click();
  expect(await focusedKey()).toBe('next');
});

test('reaching an end moves focus to the current page rather than losing it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'edges');

  const first = page.locator('ui-pagination').first();
  await first.locator('button[data-key="last"]').click();

  expect(await shape(page, 0)).toBe('first previous 1 … 8 9 10 11 *12 next/ last/');

  // A disabled element cannot hold focus, so without this the person is dropped to the top
  // of the document mid-task.
  expect(
    await page.evaluate(() => ({
      key: document.activeElement?.dataset?.key ?? null,
      current: document.activeElement?.getAttribute('aria-current'),
    })),
  ).toEqual({ key: '12', current: 'page' });
});

test('a page change is announced', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'table');
  await page.waitForTimeout(200);

  const status = page.locator('[role="status"]');
  // Present and empty before there is anything to say.
  await expect(status).toBeEmpty();

  await page.locator('button[data-key="3"]').click();
  await expect(status).toHaveText('Page 3 of 6, showing 11 to 15 of 26');
});

test('an announcement that has stopped being true is cleared', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'table');
  await page.waitForTimeout(200);

  const status = page.locator('[role="status"]');
  await page.locator('button[data-key="3"]').click();
  await expect(status).toHaveText('Page 3 of 6, showing 11 to 15 of 26');

  // A new page size moves both the page and the count underneath that sentence.
  await page.selectOption('[data-demo-per-page]', '10');
  await expect(status).toBeEmpty();

  expect(
    await page.evaluate(() => ({
      count: document.querySelector('ui-pagination').count,
      page: document.querySelector('ui-pagination').page,
    })),
  ).toEqual({ count: 3, page: 1 });
});

test('the table follows the page it is given', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'table');
  await page.waitForTimeout(200);

  const orders = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('tbody tr')].map((row) => row.cells[0].textContent),
    );

  expect(await orders()).toEqual(['AP-1001', 'AP-1002', 'AP-1003', 'AP-1004', 'AP-1005']);
  await expect(page.locator('[data-demo-range]')).toHaveText('Showing 1 to 5 of 26');

  await page.locator('button[data-key="last"]').click();
  // Twenty-six rows in fives leaves one on the final page.
  expect(await orders()).toEqual(['AP-1026']);
  await expect(page.locator('[data-demo-range]')).toHaveText('Showing 26 to 26 of 26');
});

test('the combined arrangement references nothing outside the component', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));

  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'table');
  await page.waitForTimeout(200);

  // Reaching for another component would leave the packaged download broken.
  const outside = requests.filter(
    (path) => path.startsWith('/components/') && !path.startsWith('/components/pagination/'),
  );
  expect(outside).toEqual([]);

  // And the table really is plain markup rather than a component.
  expect(await page.evaluate(() => document.querySelectorAll('ui-table').length)).toBe(0);
  await expect(page.locator('table caption')).toHaveText('Orders');
});

test('the compact arrangement states the position and keeps both arrows', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'compact');

  const first = page.locator('ui-pagination').first();
  await expect(first.locator('.pagination__compact')).toHaveText('Page 7 of 42');
  await expect(first.locator('.pagination__button')).toHaveCount(2);

  await first.locator('button[data-key="next"]').click();
  await expect(first.locator('.pagination__compact')).toHaveText('Page 8 of 42');
});

test('a single page leaves nowhere to go', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'edges');

  expect(await shape(page, 3)).toBe('first/ previous/ *1 next/ last/');
});

test('every control clears the minimum target size', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'sizes');

  const smallest = await page.evaluate(() =>
    Math.min(
      ...[...document.querySelectorAll('.pagination__button')].flatMap((button) => {
        const box = button.getBoundingClientRect();
        return [box.width, box.height];
      }),
    ),
  );

  expect(smallest).toBeGreaterThanOrEqual(24);
});

test('a disabled pager cannot be moved', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'sizes');

  const off = page.locator('ui-pagination').nth(2);
  const buttons = off.locator('.pagination__button');
  const count = await buttons.count();

  for (let index = 0; index < count; index += 1) {
    await expect(buttons.nth(index)).toBeDisabled();
  }

  await buttons.first().click({ force: true });
  expect(await off.evaluate((element) => element.page)).toBe(4);
});
