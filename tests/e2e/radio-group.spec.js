import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/radio-group/source/variants';
const VARIANTS = [
  'default',
  'horizontal',
  'descriptions',
  'cards',
  'validation',
  'restricted',
];

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
    await page.waitForFunction(() => customElements.get('ui-radio-group'));

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('fieldset legend').first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('choosing an option reports the value and checks exactly one radio', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/default/index.html`);
  const group = page.locator('ui-radio-group');
  const output = page.locator('output');

  await expect(output).toHaveText('standard');

  await page.locator('label:has(input[value="overnight"])').click();
  await expect(output).toHaveText('overnight');
  await expect(group).toHaveAttribute('value', 'overnight');
  await expect(page.locator('input[type="radio"]:checked')).toHaveCount(1);
});

test('arrow keys move between options and skip a disabled one', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/restricted/index.html`);
  const output = page.locator('output');

  await page.locator('input[value="single"]').focus();
  await page.keyboard.press('ArrowDown');
  await expect(output).toHaveText('double');

  // Suite is disabled, so the browser wraps past it back to the first option.
  await page.keyboard.press('ArrowDown');
  await expect(output).toHaveText('single');
  await expect(page.locator('input[value="suite"]')).toBeDisabled();
  await expect(page.locator('input[value="suite"]')).not.toBeChecked();
});

test('a disabled group refuses every option', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/restricted/index.html`);
  const disabledGroup = page.locator('ui-radio-group[disabled]');

  for (const input of await disabledGroup.locator('input[type="radio"]').all()) {
    await expect(input).toBeDisabled();
  }
});

test('assigning value from script checks the matching radio', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/cards/index.html`);

  await page.evaluate(() => {
    document.querySelector('ui-radio-group').value = 'team';
  });

  await expect(page.locator('input[value="team"]')).toBeChecked();
  await expect(page.locator('label.is-checked')).toHaveCount(1);
  await expect(page.locator('label.is-checked')).toContainText('Team');
});

test('a value matching no option is kept and marks the group invalid', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/default/index.html`);
  const group = page.locator('ui-radio-group');

  await group.evaluate((element) => element.setAttribute('value', 'teleport'));

  // Preserved rather than blanked, so the consumer's mistake stays visible.
  await expect(group).toHaveAttribute('value', 'teleport');
  await expect(group).toHaveAttribute('data-invalid', '');
  await expect(page.locator('input[type="radio"]:checked')).toHaveCount(0);
  await expect(page.locator('input[value="standard"]')).toHaveAttribute('aria-invalid', '');
});

test('the error message is announced and tied to the fieldset', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/validation/index.html`);
  const fieldset = page.locator('fieldset');
  const error = page.locator('.radio-group__error');

  await expect(error).toHaveText('Choose how we should reach you.');
  await expect(error).toHaveAttribute('role', 'alert');
  const describedBy = await fieldset.getAttribute('aria-describedby');
  expect(describedBy).toBe(await error.getAttribute('id'));

  await page.locator('label:has(input[value="phone"])').click();
  await expect(error).toHaveCount(0);
  await expect(fieldset).not.toHaveAttribute('aria-describedby', /.+/);
});

test('exactly one focus indicator appears on the focused option', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${COMPONENT_BASE}/cards/index.html`);

  await page.locator('input[value="pro"]').focus();

  const outlines = await page.evaluate(() => {
    const input = document.querySelector('input[value="pro"]');
    const label = input.closest('label');
    const outlineOf = (element) => getComputedStyle(element).outlineStyle;
    return { input: outlineOf(input), label: outlineOf(label) };
  });

  // The input is the real control, so the label must not draw a second ring.
  expect(outlines.input).not.toBe('none');
  expect(outlines.label).toBe('none');
});

test('the group still works with scripting disabled', async ({ browser }) => {
  // This is the point of enhancing native radios rather than rebuilding them.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${COMPONENT_BASE}/default/index.html`);

  await expect(page.locator('input[type="radio"]')).toHaveCount(3);
  await expect(page.locator('input[value="standard"]')).toHaveAttribute('name', 'delivery');

  await page.locator('label:has(input[value="express"])').click();
  await expect(page.locator('input[value="express"]')).toBeChecked();

  await page.locator('label:has(input[value="overnight"])').click();
  await expect(page.locator('input[value="overnight"]')).toBeChecked();
  // Without a shared name in the markup both would stay checked.
  await expect(page.locator('input[value="express"]')).not.toBeChecked();

  await context.close();
});

test('the row layout wraps instead of overflowing on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${COMPONENT_BASE}/horizontal/index.html`);

  const rows = await page.evaluate(
    () =>
      new Set(
        [...document.querySelectorAll('label')].map((label) =>
          Math.round(label.getBoundingClientRect().top),
        ),
      ).size,
  );

  expect(rows).toBeGreaterThan(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  ).toBe(false);
});
