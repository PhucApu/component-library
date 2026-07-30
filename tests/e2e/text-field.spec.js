import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/text-field/source/variants';
const VARIANTS = [
  'default',
  'filled',
  'validation',
  'adorned',
  'multiline',
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
    await page.waitForFunction(() => customElements.get('ui-text-field'));

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.text-field__control').first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('the label is wired to its own control', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/default/index.html`);
  await page.waitForFunction(() => customElements.get('ui-text-field'));

  await page.getByText('Full name', { exact: true }).click();
  await expect(page.locator('#full-name')).toBeFocused();
});

test('a required field stays quiet until the person interacts', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/validation/index.html`);
  await page.waitForFunction(() => customElements.get('ui-text-field'));

  const field = page.locator('ui-text-field').first();
  const input = page.locator('#email');

  // Invalid from the moment it renders, yet nothing may say so yet. Read `validity`
  // rather than calling checkValidity(), which fires an `invalid` event and would mark
  // the field interacted before the assertion below.
  expect(await input.evaluate((element) => element.validity.valid)).toBe(false);
  await expect(field).not.toHaveAttribute('data-invalid', /.*/);
  await expect(input).not.toHaveAttribute('aria-invalid', /.*/);
  await expect(page.locator('.text-field__error')).toHaveCount(0);

  await input.click();
  await input.blur();

  await expect(field).toHaveAttribute('data-invalid', '');
  await expect(input).toHaveAttribute('aria-invalid', '');
  await expect(page.locator('.text-field__error').first()).not.toBeEmpty();
});

test('an error clears as soon as the value becomes valid', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/validation/index.html`);
  await page.waitForFunction(() => customElements.get('ui-text-field'));

  const input = page.locator('#email');
  await input.click();
  await input.blur();
  await expect(page.locator('ui-text-field').first()).toHaveAttribute('data-invalid', '');

  await input.fill('ha.linh@example.com');
  await expect(page.locator('ui-text-field').first()).not.toHaveAttribute('data-invalid', /.*/);
});

test('an author message replaces the browser message', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/validation/index.html`);
  await page.waitForFunction(() => customElements.get('ui-text-field'));

  const handle = page.locator('#handle');
  await handle.fill('ab');
  await handle.blur();

  await expect(page.locator('ui-text-field').nth(1).locator('.text-field__error')).toHaveText(
    'Use four to sixteen lowercase letters or digits.',
  );
});

test('the hint and the error are both referenced by the control', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/validation/index.html`);
  await page.waitForFunction(() => customElements.get('ui-text-field'));

  const input = page.locator('#email');
  await input.click();
  await input.blur();

  const ids = (await input.getAttribute('aria-describedby')).split(' ');
  expect(ids.length).toBe(2);

  for (const id of ids) {
    await expect(page.locator(`#${id}`)).not.toBeEmpty();
  }
});

test('the character counter is not inside a live region', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/multiline/index.html`);
  await page.waitForFunction(() => customElements.get('ui-text-field'));

  const textarea = page.locator('#summary');
  await textarea.fill('A short summary.');

  const counter = page.locator('.text-field__counter');
  await expect(counter).toHaveText('16 / 160');

  // A live counter would announce a number after every keystroke.
  const live = await counter.evaluate((element) => element.closest('[aria-live]') !== null);
  expect(live).toBe(false);
  await expect(counter).toHaveAttribute('aria-hidden', 'true');
});

test('the counter announces only as the limit approaches', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/multiline/index.html`);
  await page.waitForFunction(() => customElements.get('ui-text-field'));

  const textarea = page.locator('#summary');
  const live = page.locator('[aria-live="polite"].text-field__sr-only');

  await textarea.fill('x'.repeat(20));
  await expect(live).toBeEmpty();

  await textarea.fill('x'.repeat(150));
  await expect(live).toHaveText('10 characters left');

  await textarea.fill('x'.repeat(160));
  await expect(live).toHaveText('Character limit reached');
});

test('a field without a limit shows no counter', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/multiline/index.html`);
  await page.waitForFunction(() => customElements.get('ui-text-field'));

  const plain = page.locator('ui-text-field').nth(1);
  await expect(plain.locator('.text-field__counter')).toHaveCount(0);
});

test('the reveal button renames itself for the next action', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/adorned/index.html`);
  await page.waitForFunction(() => customElements.get('ui-text-field'));

  const input = page.locator('#password');
  const reveal = page.locator('.text-field__reveal');

  await expect(input).toHaveAttribute('type', 'password');
  await expect(reveal).toHaveAttribute('aria-label', 'Show password');

  await reveal.click();
  await expect(input).toHaveAttribute('type', 'text');
  await expect(reveal).toHaveAttribute('aria-label', 'Hide password');

  await reveal.click();
  await expect(input).toHaveAttribute('type', 'password');
});

test('read-only is submitted and disabled is not', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/restricted/index.html`);
  await page.waitForFunction(() => customElements.get('ui-text-field'));

  const submitted = await page.evaluate(() =>
    [...new FormData(document.querySelector('form')).keys()],
  );

  // This is the whole difference between the two attributes.
  expect(submitted).toContain('account');
  expect(submitted).not.toContain('legacy');
});

test('the frame owns the only focus indicator', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${COMPONENT_BASE}/default/index.html`);
  await page.waitForFunction(() => customElements.get('ui-text-field'));

  const frame = page.locator('.text-field__control').first();
  const resting = await frame.evaluate((element) => getComputedStyle(element).borderTopColor);

  await frame.hover();
  const hovered = await frame.evaluate((element) => getComputedStyle(element).borderTopColor);
  expect(hovered).not.toBe(resting);

  await page.locator('#full-name').click();
  const focused = await page.evaluate(() => {
    const input = document.querySelector('#full-name');
    const control = input.closest('.text-field__control');
    return {
      inputOutline: getComputedStyle(input).outlineStyle,
      border: getComputedStyle(control).borderTopColor,
      shadow: getComputedStyle(control).boxShadow,
    };
  });

  expect(focused.inputOutline).toBe('none');
  expect(focused.shadow).not.toBe('none');
  // The pointer still rests on the frame, so this also proves hover does not win.
  expect(focused.border).not.toBe(hovered);
  expect(focused.border).not.toBe(resting);
});

test('the fields still work with scripting disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${COMPONENT_BASE}/restricted/index.html`);

  // The label association and the values come from the markup, not from script.
  await expect(page.locator('#account')).toHaveValue('AC-9174');
  await expect(page.locator('label[for="account"]')).toBeVisible();

  await page.goto(`${COMPONENT_BASE}/default/index.html`);
  await page.locator('#full-name').fill('Ha Linh');
  await expect(page.locator('#full-name')).toHaveValue('Ha Linh');

  await context.close();
});
