import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/autocomplete/source/variants';
const VARIANTS = ['single', 'multiple', 'free-text', 'grouped', 'async', 'restricted'];

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

async function openField(page, index = 0) {
  const field = page.locator('ui-autocomplete').nth(index);
  const input = field.locator('[data-part="input"]');
  await input.click();
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  return { field, input };
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
    await page.waitForFunction(() => customElements.get('ui-autocomplete'));

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('[data-part="input"]').first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('filtering ignores case and marks the matched run inside each suggestion', async ({
  page,
}) => {
  await page.goto(`${COMPONENT_BASE}/single/index.html`);
  const { input } = await openField(page);

  await input.fill('ho');
  await expect(page.getByRole('option')).toHaveText(['Ho Chi Minh City']);

  // The mark carries the label's own capitals, not the folded comparison text.
  await expect(page.locator('.autocomplete__mark').first()).toHaveText('Ho');

  await input.fill('kyo');
  await expect(page.getByRole('option')).toHaveText(['Kyoto', 'Tokyo']);

  await input.fill('zzz');
  await expect(page.getByRole('option')).toHaveCount(0);
  await expect(page.locator('.autocomplete__message')).toHaveText('No match');
});

test('an option label containing markup renders as text', async ({ page }) => {
  const runtimeErrors = trackRuntimeErrors(page);
  await page.goto(`${COMPONENT_BASE}/single/index.html`);

  await page.evaluate(() => {
    document.querySelector('ui-autocomplete').options = [
      { value: 'x', label: 'a<script>window.pwned = true;</script>b' },
    ];
  });

  const { input } = await openField(page);
  await input.fill('script');

  const option = page.getByRole('option').first();
  await expect(option).toContainText('<script>');
  expect(await option.locator('script').count()).toBe(0);
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
  expect(runtimeErrors).toEqual([]);
});

test('multiple mode adds chips, removes them by button and by Backspace', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/multiple/index.html`);
  const { field, input } = await openField(page);
  const output = page.locator('output');

  await expect(page.locator('.autocomplete__chip')).toHaveCount(2);
  await expect(output).toHaveText('["css","accessibility"]');

  await input.fill('test');
  await page.getByRole('option', { name: /Testing/ }).click();
  await expect(output).toHaveText('["css","accessibility","testing"]');

  // Reselecting a chosen option removes it again.
  await input.fill('test');
  await page.getByRole('option', { name: /Testing/ }).click();
  await expect(output).toHaveText('["css","accessibility"]');

  await field.locator('.autocomplete__chip-remove').first().click();
  await expect(output).toHaveText('["accessibility"]');

  await input.press('Backspace');
  await expect(output).toHaveText('""');
  await expect(page.locator('.autocomplete__chip')).toHaveCount(0);
});

test('keyboard navigation skips disabled options and group headings', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/grouped/index.html`);
  const { input } = await openField(page);

  // Opening already activates the first available option, so Enter takes the top match.
  await expect(input).toHaveAttribute('aria-activedescendant', /option-0$/);
  await input.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant', /option-1$/);

  // Sapporo sits at index 5 and is disabled, so End must stop past it.
  await input.press('End');
  const lastId = await input.getAttribute('aria-activedescendant');
  const lastLabel = await page.locator(`#${lastId}`).innerText();
  expect(lastLabel).toContain('Berlin');

  const disabled = page.getByRole('option', { name: /Sapporo/ });
  await expect(disabled).toBeDisabled();
  await expect(disabled).toHaveAttribute('aria-disabled', 'true');

  // Group headings are labels on the group, never options.
  await expect(page.getByRole('group', { name: 'Japan' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Japan', exact: true })).toHaveCount(0);
});

test('Enter commits the active option and Escape closes the list', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/single/index.html`);
  const { input } = await openField(page);
  const output = page.locator('output');

  // The top match is already active, so Enter commits it without any arrow key.
  await input.fill('kyo');
  await input.press('Enter');
  await expect(output).toHaveText('kyoto');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(input).toHaveValue('Kyoto');

  await input.click();
  await input.fill('nothing here');
  await input.press('Escape');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  // An abandoned query restores the committed label instead of leaving stray text.
  await expect(input).toHaveValue('Kyoto');
});

test('free text commits a value that matches no option', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/free-text/index.html`);
  const { input } = await openField(page);

  await input.fill('needs-triage');
  await input.press('Enter');
  await expect(page.locator('output')).toHaveText('["needs-triage"]');
  await expect(page.locator('.autocomplete__chip')).toHaveCount(1);
});

test('the async variant exposes loading then the fetched options', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/async/index.html`);
  const input = page.locator('[data-part="input"]');

  await input.click();
  await expect(page.locator('.autocomplete__message')).toHaveText('Loading suggestions');
  await expect(page.getByRole('option').first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('group', { name: 'Japan' })).toBeVisible();
});

test('a malformed value is preserved and marks the field invalid', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/multiple/index.html`);
  const field = page.locator('ui-autocomplete');
  const input = field.locator('[data-part="input"]');

  await field.evaluate((element) => element.setAttribute('value', '[oops'));

  await expect(input).toHaveAttribute('aria-invalid', '');
  // The consumer's value survives rather than being silently replaced.
  await expect(field).toHaveAttribute('value', '[oops');
  await expect(page.locator('.autocomplete__field')).toHaveClass(/is-invalid/);
});

test('read-only and disabled fields refuse to open', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/restricted/index.html`);

  const readOnly = page.locator('ui-autocomplete').nth(1).locator('[data-part="input"]');
  await readOnly.click();
  await expect(readOnly).toHaveAttribute('aria-expanded', 'false');

  const disabled = page.locator('ui-autocomplete').nth(2).locator('[data-part="input"]');
  await expect(disabled).toBeDisabled();

  const { input } = await openField(page, 0);
  await expect(page.getByRole('option', { name: /Business/ })).toBeDisabled();
  await input.press('End');
  const activeId = await input.getAttribute('aria-activedescendant');
  expect(await page.locator(`#${activeId}`).innerText()).toContain('Premium');
});

test('the list matches the field, stays anchored, and is not clipped by an ancestor', async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${COMPONENT_BASE}/single/index.html`);

    // A scrolling ancestor is exactly what would clip a list rendered inline.
    await page.evaluate(() => {
      const host = document.querySelector('ui-autocomplete');
      const scroller = document.createElement('div');
      scroller.style.cssText = 'overflow:auto;max-height:120px;';
      host.parentNode.insertBefore(scroller, host);
      scroller.append(host);
    });

    const { input } = await openField(page);
    await input.fill('a');

    const geometry = await page.evaluate(() => {
      const list = document
        .querySelector('.autocomplete__listbox')
        .getBoundingClientRect();
      const field = document.querySelector('.autocomplete__field').getBoundingClientRect();
      return {
        widthDelta: Math.abs(list.width - field.width),
        leftDelta: Math.abs(list.left - field.left),
        verticalGap: Math.min(
          Math.abs(list.top - field.bottom),
          Math.abs(field.top - list.bottom),
        ),
        insideViewport:
          list.left >= 0 &&
          list.top >= 0 &&
          list.right <= window.innerWidth &&
          list.bottom <= window.innerHeight,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });

    expect(geometry.widthDelta).toBeLessThan(1);
    expect(geometry.leftDelta).toBeLessThan(1);
    expect(geometry.verticalGap).toBeLessThan(12);
    expect(geometry.insideViewport).toBe(true);
    expect(geometry.overflow).toBe(false);
  }
});

test('the clear and toggle buttons stay pinned right as chips fill several rows', async ({
  page,
}) => {
  await page.goto(`${COMPONENT_BASE}/multiple/index.html`);
  await page.waitForFunction(() => customElements.get('ui-autocomplete'));

  await page.evaluate(() => {
    document.querySelector('ui-autocomplete').value = JSON.stringify([
      'html',
      'css',
      'javascript',
      'accessibility',
      'performance',
      'testing',
      'design-systems',
      'documentation',
    ]);
  });

  const geometry = await page.evaluate(() => {
    const field = document.querySelector('.autocomplete__field').getBoundingClientRect();
    const entry = document.querySelector('.autocomplete__entry').getBoundingClientRect();
    const clear = document.querySelector('[data-action="clear"]').getBoundingClientRect();
    const chips = [...document.querySelectorAll('.autocomplete__chip')].map((chip) =>
      chip.getBoundingClientRect(),
    );

    return {
      rows: new Set(chips.map((chip) => Math.round(chip.top))).size,
      actionsBesideEntry: Math.round(clear.left) >= Math.round(entry.right) - 1,
      chipsClearOfButtons: chips.every(
        (chip) => Math.round(chip.right) <= Math.round(clear.left),
      ),
      verticallyCentred:
        Math.abs(
          Math.round(clear.top - field.top) - Math.round(field.bottom - clear.bottom),
        ) <= 2,
    };
  });

  // More than one row is the whole point: as direct children of a wrapping field the
  // buttons used to be carried down onto the last row with the chips.
  expect(geometry.rows).toBeGreaterThan(1);
  expect(geometry.actionsBesideEntry).toBe(true);
  expect(geometry.chipsClearOfButtons).toBe(true);
  expect(geometry.verticallyCentred).toBe(true);
});

test('the field shows one focus indicator and focus wins over hover', async ({ page }) => {
  // Border colour transitions over 140ms, so measurements would race the animation.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${COMPONENT_BASE}/multiple/index.html`);
  const field = page.locator('.autocomplete__field');
  const input = page.locator('[data-part="input"]');

  const borderColor = () =>
    field.evaluate((element) => getComputedStyle(element).borderTopColor);

  const resting = await borderColor();
  await field.hover();
  const hovered = await borderColor();
  expect(hovered).not.toBe(resting);

  await input.click();
  await expect(field).toHaveClass(/is-focused/);

  const focused = await input.evaluate((element) => ({
    matchesFocusVisible: element.matches(':focus-visible'),
    outlineStyle: getComputedStyle(element).outlineStyle,
    fieldBorder: getComputedStyle(element.closest('.autocomplete__field')).borderTopColor,
    fieldShadow: getComputedStyle(element.closest('.autocomplete__field')).boxShadow,
  }));

  // A text input matches :focus-visible even on a mouse click, so its own outline would
  // draw a second rectangle inside a surface that is already showing focus.
  expect(focused.matchesFocusVisible).toBe(true);
  expect(focused.outlineStyle).toBe('none');

  // The pointer still rests on the field, so the focused border must differ from both
  // the resting and the hover colour. Hover is the more specific selector and used to
  // win here, leaving focus with no colour of its own.
  expect(focused.fieldShadow).not.toBe('none');
  expect(focused.fieldBorder).not.toBe(resting);
  expect(focused.fieldBorder).not.toBe(hovered);
});

test('pointer activity outside the field closes the list', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/single/index.html`);
  const { input } = await openField(page);

  await page.mouse.click(5, 5);
  await expect(input).toHaveAttribute('aria-expanded', 'false');
});

test('result counts stay in a screen-reader-only live region', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/single/index.html`);
  const { input } = await openField(page);
  const status = page.locator('[data-part="status"]');

  await input.fill('kyo');
  await expect(status).toHaveText('2 results');

  await input.fill('hue');
  await expect(status).toHaveText('1 result');
  // Present for assistive technology, never shown on screen.
  expect(await status.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(2);
});
