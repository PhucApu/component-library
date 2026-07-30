import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/chip/source/variants';
const VARIANTS = ['static', 'removable', 'action', 'filter', 'adorned', 'appearance'];

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
 * Computes the contrast ratio of every chip label against the surface it really sits on.
 */
async function measureContrast(page) {
  return page.evaluate(() => {
    const parse = (color) => {
      const parts = color.match(/[\d.]+/g)?.map(Number) ?? [];
      return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 };
    };
    const channel = (value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ({ r, g, b }) =>
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const effectiveBackground = (element) => {
      let node = element;
      while (node) {
        const parsed = parse(getComputedStyle(node).backgroundColor);
        if (parsed.a > 0) return parsed;
        node = node.parentElement;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };

    return [...document.querySelectorAll('ui-chip:not([disabled])')].map((chip) => {
      const control = chip.querySelector('.chip__control');
      const foreground = luminance(parse(getComputedStyle(control).color));
      const background = luminance(effectiveBackground(chip));
      const [light, dark] =
        foreground > background ? [foreground, background] : [background, foreground];
      return {
        intent: chip.dataset.intent,
        appearance: chip.dataset.appearance,
        ratio: (light + 0.05) / (dark + 0.05),
      };
    });
  });
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
    await page.setViewportSize({ width: 960, height: 720 });
    await page.goto(`${COMPONENT_BASE}/${variant}/index.html`);
    await page.waitForFunction(() => customElements.get('ui-chip'));

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('ui-chip').first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('no interactive element is nested inside another', async ({ page }) => {
  for (const variant of VARIANTS) {
    await page.goto(`${COMPONENT_BASE}/${variant}/index.html`);
    await page.waitForFunction(() => customElements.get('ui-chip'));

    // A button inside a button or a link is invalid markup that assistive technology
    // handles unpredictably, which is why the remove button is a sibling.
    const nested = await page.evaluate(
      () => document.querySelectorAll('button button, a button, button a, a a').length,
    );
    expect(nested, `nested interactive elements in ${variant}`).toBe(0);
  }
});

test('a static chip is not reachable by keyboard', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/static/index.html`);
  await page.waitForFunction(() => customElements.get('ui-chip'));

  await page.keyboard.press('Tab');

  // Nothing in the page is focusable, so focus stays on the body rather than visiting a
  // label the user cannot act on.
  const active = await page.evaluate(() => document.activeElement.tagName);
  expect(active).toBe('BODY');
});

test('each remove button is named after its own chip', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/removable/index.html`);
  await page.waitForFunction(() => customElements.get('ui-chip'));

  const names = await page
    .locator('.chip__remove')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')));

  expect(names).toEqual([
    'Remove Ha Linh',
    'Remove Minh Quan',
    'Remove Design team',
    'Remove Owner',
  ]);
  expect(new Set(names).size).toBe(names.length);
});

test('removing reports the label and leaves the decision to the page', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/removable/index.html`);
  await page.waitForFunction(() => customElements.get('ui-chip'));

  const detail = await page.evaluate(
    () =>
      new Promise((resolve) => {
        document.addEventListener(
          'chip-remove',
          (event) => {
            // Reported before anything removes the chip: the component never removes itself.
            resolve({
              label: event.detail.label,
              stillPresent: document.body.contains(event.target),
            });
          },
          { once: true, capture: true },
        );
        document.querySelector('ui-chip .chip__remove').click();
      }),
  );

  expect(detail).toEqual({ label: 'Ha Linh', stillPresent: true });
  await expect(page.locator('output')).toHaveText('removed: Ha Linh');
  await expect(page.locator('ui-chip')).toHaveCount(3);
});

test('Backspace removes only while focus is inside the chip', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/removable/index.html`);
  await page.waitForFunction(() => customElements.get('ui-chip'));

  await page.locator('ui-chip .chip__remove').first().focus();
  await page.keyboard.press('Backspace');
  await expect(page.locator('output')).toHaveText('removed: Ha Linh');

  // With focus outside every chip the key must do nothing.
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Backspace');
  await expect(page.locator('ui-chip')).toHaveCount(3);
});

test('a filter chip reports its state through aria-pressed', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/filter/index.html`);
  await page.waitForFunction(() => customElements.get('ui-chip'));

  const open = page.locator('ui-chip').first().locator('button');
  const review = page.locator('ui-chip').nth(1).locator('button');

  await expect(open).toHaveAttribute('aria-pressed', 'true');
  await expect(review).toHaveAttribute('aria-pressed', 'false');

  await review.click();
  await expect(review).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('ui-chip').nth(1)).toHaveAttribute('data-selected', '');
  await expect(page.locator('output')).toContainText('In review');

  await review.click();
  await expect(review).toHaveAttribute('aria-pressed', 'false');
});

test('a disabled link chip cannot navigate', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/action/index.html`);
  await page.waitForFunction(() => customElements.get('ui-chip'));

  const anchor = page.locator('ui-chip[disabled] a');

  // The browser ignores `disabled` on an anchor, so the href has to go instead.
  await expect(anchor).not.toHaveAttribute('href', /.*/);
  await expect(anchor).toHaveAttribute('aria-disabled', 'true');

  const before = page.url();
  await anchor.click();
  expect(page.url()).toBe(before);
});

test('a disabled button chip cannot be activated', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/action/index.html`);
  await page.waitForFunction(() => customElements.get('ui-chip'));

  const button = page.locator('ui-chip[disabled] button');
  await expect(button).toBeDisabled();

  const fired = await page.evaluate(() => {
    let seen = false;
    document.addEventListener('chip-toggle', () => {
      seen = true;
    });
    document.querySelector('ui-chip[disabled] button').dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    return seen;
  });
  expect(fired).toBe(false);
});

test('enabling a link chip again restores its destination', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/action/index.html`);
  await page.waitForFunction(() => customElements.get('ui-chip'));

  await page.evaluate(() => {
    document.querySelector('ui-chip[disabled]:has(a)').removeAttribute('disabled');
  });

  const anchor = page.locator('ui-chip:has(a[href="#archive"]) a');
  await expect(anchor).toHaveAttribute('href', '#archive');
  await expect(anchor).not.toHaveAttribute('aria-disabled', /.*/);
});

test('every intent meets the contrast minimum for its label', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/appearance/index.html`);
  await page.waitForFunction(() => customElements.get('ui-chip'));

  const measured = await measureContrast(page);
  expect(measured.length).toBeGreaterThan(9);

  for (const { appearance, intent, ratio } of measured) {
    expect(ratio, `${appearance} ${intent} contrast`).toBeGreaterThanOrEqual(4.5);
  }
});

test('rows of chips wrap on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${COMPONENT_BASE}/appearance/index.html`);
  await page.waitForFunction(() => customElements.get('ui-chip'));

  const rows = await page.evaluate(
    () =>
      new Set(
        [...document.querySelectorAll('.chip-demo__row')[0].children].map((chip) =>
          Math.round(chip.getBoundingClientRect().top),
        ),
      ).size,
  );

  expect(rows).toBeGreaterThan(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  ).toBe(false);
});
