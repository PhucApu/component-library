import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/breadcrumbs/source/variants';
const VARIANTS = ['default', 'separators', 'icons', 'collapsed', 'truncation', 'sizes'];

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
  await page.waitForFunction(() => customElements.get('ui-breadcrumbs'));
}

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
      await page.setViewportSize({ width, height: 720 });
      await ready(page, variant);

      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('ui-breadcrumbs').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('the divider never reaches the accessibility tree', async ({ page }) => {
  await ready(page, 'separators');

  // Generated content is exposed to assistive technology by default. The empty alternative
  // text is what removes it, and only the tree the browser actually builds can prove that.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');

  const spoken = nodes
    .filter((node) => node.role?.value === 'StaticText')
    .map((node) => node.name?.value ?? '');

  for (const text of spoken) {
    expect(text, `"${text}" contains a divider`).not.toMatch(/[/›→•]/);
  }

  // The dividers really are drawn, so the assertion above is not passing on an empty page.
  const drawn = await page.evaluate(() =>
    [...document.querySelectorAll('ui-breadcrumbs')].map(
      (trail) => getComputedStyle(trail.querySelectorAll('ol > li')[1], '::before').content,
    ),
  );
  expect(drawn).toEqual(['"/" / ""', '"›" / ""', '"→" / ""', '"•" / ""']);
});

test('the trail is a landmark holding an ordered list', async ({ page }) => {
  await ready(page, 'default');

  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).first()).toBeVisible();
  await expect(page.locator('ui-breadcrumbs').first().locator('ol > li')).toHaveCount(3);
});

test('the current page is marked whether or not the author wrote it', async ({ page }) => {
  await ready(page, 'sizes');

  const marked = await page.evaluate(() =>
    [...document.querySelectorAll('ui-breadcrumbs')].map(
      (trail) => trail.querySelector('[aria-current="page"]')?.textContent.trim() ?? null,
    ),
  );
  expect(marked).toEqual(['Members', 'Members']);

  // A trail written without the attribute still ends up marked.
  const filled = await page.evaluate(() => {
    const trail = document.createElement('ui-breadcrumbs');
    trail.innerHTML =
      '<nav aria-label="Test"><ol class="breadcrumbs__list">' +
      '<li><a href="#a">One</a></li><li><a href="#b">Two</a></li></ol></nav>';
    document.body.append(trail);
    return trail.querySelector('[aria-current="page"]')?.textContent.trim() ?? null;
  });
  expect(filled).toBe('Two');
});

test('the ellipsis is a button that names what it hides', async ({ page }) => {
  await ready(page, 'collapsed');

  const trail = page.locator('ui-breadcrumbs').first();
  await expect(trail).toHaveAttribute('data-collapsed', '');

  // A character here would leave the hidden levels unreachable by any means.
  const button = trail.getByRole('button', { name: 'Show 4 hidden levels' });
  await expect(button).toBeVisible();
  await expect(trail.locator('ol > li[hidden]')).toHaveCount(4);

  await button.click();
  await expect(trail).not.toHaveAttribute('data-collapsed', /.*/);
  await expect(trail.locator('ol > li[hidden]')).toHaveCount(0);
  await expect(trail.locator('ol > li:not([hidden])')).toHaveCount(6);
});

test('the ellipsis is reachable by keyboard alone', async ({ page }) => {
  await ready(page, 'collapsed');

  await page.locator('ui-breadcrumbs').first().locator('a').first().focus();
  await page.keyboard.press('Tab');

  await expect(page.locator('.breadcrumbs__expand').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('ui-breadcrumbs').first().locator('ol > li[hidden]')).toHaveCount(0);
});

test('how many levels stay at each end is honoured', async ({ page }) => {
  await ready(page, 'collapsed');

  const second = page.locator('ui-breadcrumbs').nth(1);
  await expect(second.getByRole('button', { name: 'Show 2 hidden levels' })).toBeVisible();

  const visible = await second.evaluate((trail) =>
    [...trail.querySelectorAll('ol > li:not([hidden])')].map((item) => item.textContent.trim()),
  );
  expect(visible).toEqual(['Workspace', 'Engineering', '…', 'Billing', 'Invoices']);
});

test('a trail that would hide one level stays whole', async ({ page }) => {
  await ready(page, 'collapsed');

  // Three levels, one kept either side: collapsing would put away a single level, which
  // costs a press and saves almost nothing.
  const third = page.locator('ui-breadcrumbs').nth(2);
  await expect(third).not.toHaveAttribute('data-collapsed', /.*/);
  await expect(third.locator('.breadcrumbs__expand')).toHaveCount(0);
  await expect(third.locator('ol > li[hidden]')).toHaveCount(0);
});

test('long labels give way but the current page does not', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'truncation');

  const measured = await page.evaluate(() => {
    const trail = document.querySelector('ui-breadcrumbs[data-truncate]');
    const links = [...trail.querySelectorAll('a')];
    return links.map((link) => ({
      text: link.textContent.trim(),
      clipped: link.scrollWidth > link.clientWidth + 1,
      title: link.getAttribute('title'),
    }));
  });

  expect(measured[0].clipped).toBe(true);
  expect(measured[0].title).toBeTruthy();
  // The one piece of the trail that has to stay readable.
  expect(measured.at(-1).clipped).toBe(false);
});

test('the compact size really is smaller', async ({ page }) => {
  await ready(page, 'sizes');

  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('ui-breadcrumbs')].map((trail) =>
      Number.parseFloat(getComputedStyle(trail).fontSize),
    ),
  );

  expect(sizes[1]).toBeLessThan(sizes[0]);
});

test('decorative icons stay out of the reading order', async ({ page }) => {
  await ready(page, 'icons');

  const hidden = await page.evaluate(() =>
    [...document.querySelectorAll('.breadcrumbs__icon')].every(
      (icon) => icon.getAttribute('aria-hidden') === 'true',
    ),
  );
  expect(hidden).toBe(true);

  await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
});

test('the trail still works with scripting disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${COMPONENT_BASE}/collapsed/index.html`);

  // The landmark, the ordering, and the links all come from the markup. Only collapsing is
  // lost, so every level stays reachable.
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).first()).toBeVisible();
  await expect(page.locator('ui-breadcrumbs').first().locator('ol > li')).toHaveCount(6);
  await expect(page.locator('ol > li[hidden]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Platform' }).first()).toHaveAttribute('href', '#b');

  await context.close();
});

test('links carry a visible focus ring', async ({ page }) => {
  await ready(page, 'default');

  const link = page.getByRole('link', { name: 'Home' }).first();
  await link.focus();

  const outline = await link.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
  });

  expect(outline.style).not.toBe('none');
  expect(outline.width).toBeGreaterThan(0);
});
