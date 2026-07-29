import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const COMPONENT_BASE = '/components/temporal-picker/source/variants';
const VARIANTS = [
  'year',
  'month',
  'date',
  'time',
  'datetime',
  'bounded-datetime',
];

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2027-09-18T08:45:30');
});

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

async function openPicker(page) {
  const picker = page.locator('temporal-picker');
  const trigger = picker.locator('[data-part="trigger"]');
  const panelId = await trigger.getAttribute('aria-controls');

  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    await trigger.click();
  }

  const panel = page.locator(`#${panelId}`);
  await expect(panel).toBeVisible();
  return { panel, picker, trigger };
}

async function chooseTimeOption(picker, part, value, query = String(value)) {
  const input = picker.locator(`input[data-time-part="${part}"]`);
  await input.click();
  await input.fill(query);
  const option = picker.locator(
    `[data-time-option="${part}"][data-value="${Number(value)}"]`,
  );
  await expect(option).toBeVisible();
  await option.click();
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
    await page.waitForFunction(() => customElements.get('temporal-picker'));

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveCSS(
      'background-color',
      'rgb(15, 17, 21)',
    );
    const picker = page.locator('temporal-picker');
    await expect(picker).toHaveAttribute(
      'data-mode',
      variant === 'bounded-datetime' ? 'datetime' : variant,
    );
    await expect(picker.locator('[data-part="trigger"]')).toBeVisible();
    await expect(page.locator('.temporal-demo__output')).not.toBeEmpty();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('calendar variants expose current markers while Time and Bounded Datetime suppress them', async ({
  page,
}) => {
  const expectations = [
    ['year', '[data-year="2027"]', 'true'],
    ['month', '[data-month="9"]', 'true'],
    ['date', '[data-day="2027-09-18"]', 'date'],
    ['datetime', '[data-day="2027-09-18"]', 'date'],
  ];

  for (const [variant, selector, ariaCurrent] of expectations) {
    await page.goto(`${COMPONENT_BASE}/${variant}/index.html`);
    const { picker } = await openPicker(page);
    const current = picker.locator(selector);
    await expect(current).toHaveClass(/is-current/);
    await expect(current).toHaveClass(/is-selected/);
    await expect(current).toHaveAttribute('aria-current', ariaCurrent);
    await expect(current).toHaveAttribute('aria-label', /Current|Today/);
  }

  await page.goto(`${COMPONENT_BASE}/time/index.html`);
  let controls = await openPicker(page);
  await expect(controls.picker.locator('.is-current')).toHaveCount(0);
  await expect(controls.picker.locator('[aria-current]')).toHaveCount(0);

  await page.goto(`${COMPONENT_BASE}/bounded-datetime/index.html`);
  controls = await openPicker(page);
  await expect(controls.picker).toHaveAttribute('current-indicator', 'off');
  await expect(controls.picker.locator('.is-current')).toHaveCount(0);
  await expect(controls.picker.locator('[aria-current]')).toHaveCount(0);

  const normalized = await controls.picker.evaluate((element) => {
    element.currentIndicator = 'invalid';
    return {
      attribute: element.getAttribute('current-indicator'),
      property: element.currentIndicator,
    };
  });
  expect(normalized).toEqual({ attribute: 'auto', property: 'auto' });
});

test('selected dates keep their accent fill on hover and focus', async ({ page }) => {
  for (const variant of ['date', 'datetime']) {
    await page.goto(`${COMPONENT_BASE}/${variant}/index.html`);
    const { picker } = await openPicker(page);
    const selected = picker.locator('[data-day="2027-09-18"]');
    const initial = await selected.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        color: style.color,
      };
    });

    await selected.hover();
    const hovered = await selected.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        color: style.color,
      };
    });
    expect(hovered).toEqual(initial);

    await selected.focus();
    const focused = await selected.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        color: style.color,
      };
    });
    expect(focused).toEqual(initial);
  }
});

test('panel and time listbox scrolling use dark component-owned scrollbars without resetting', async ({
  page,
}) => {
  await page.goto(`${COMPONENT_BASE}/time/index.html`);
  let controls = await openPicker(page);
  const minute = controls.picker.locator('input[data-time-part="minute"]');
  await minute.click();
  const listbox = controls.picker.locator('.temporal-picker__time-listbox');
  await listbox.evaluate((element) => {
    element.scrollTop = 0;
  });
  await listbox.hover();
  await page.mouse.wheel(0, 520);
  await expect
    .poll(() => listbox.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  const listboxState = await listbox.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollbarColor: getComputedStyle(element).scrollbarColor,
    scrollTop: element.scrollTop,
  }));
  expect(listboxState.scrollHeight).toBeGreaterThan(listboxState.clientHeight);
  expect(listboxState.scrollbarColor).toContain('rgb(74, 82, 96)');
  expect(listboxState.scrollbarColor).toContain('rgb(17, 19, 24)');
  await page.waitForTimeout(100);
  expect(await listbox.evaluate((element) => element.scrollTop)).toBeGreaterThanOrEqual(
    listboxState.scrollTop,
  );

  for (const variant of ['date', 'datetime']) {
    await page.setViewportSize({ width: 375, height: 420 });
    await page.goto(`${COMPONENT_BASE}/${variant}/index.html`);
    controls = await openPicker(page);
    const panel = controls.panel;
    await expect
      .poll(() =>
        panel.evaluate((element) => element.scrollHeight > element.clientHeight),
      )
      .toBe(true);
    await panel.evaluate((element) => {
      element.scrollTop = 0;
    });
    await panel.hover();
    await page.mouse.wheel(0, 420);
    await expect
      .poll(() => panel.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
  }
});

test('year, month and date variants commit immediately and restore trigger focus', async ({
  page,
}) => {
  await page.goto(`${COMPONENT_BASE}/year/index.html`);
  let controls = await openPicker(page);
  await controls.picker.locator('[data-year="2028"]').click();
  await expect(page.locator('output')).toHaveText('2028');
  await expect(controls.trigger).toBeFocused();
  await expect(controls.trigger).toHaveAttribute('aria-expanded', 'false');

  await page.goto(`${COMPONENT_BASE}/month/index.html`);
  controls = await openPicker(page);
  await controls.picker.locator('[data-month="10"]').click();
  await expect(page.locator('output')).toHaveText('2027-10');
  await expect(controls.trigger).toBeFocused();

  await page.goto(`${COMPONENT_BASE}/date/index.html`);
  controls = await openPicker(page);
  await expect(controls.picker.locator('[data-day="2027-09-09"]')).toBeEnabled();
  await expect(controls.picker.locator('[data-day="2027-09-10"]')).toBeEnabled();
  await controls.picker.locator('[data-day="2027-09-19"]').click();
  await expect(page.locator('output')).toHaveText('2027-09-19');
  await expect(controls.trigger).toBeFocused();
});

test('time and datetime preserve draft until Apply', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/time/index.html`);
  let controls = await openPicker(page);
  await chooseTimeOption(controls.picker, 'hour', 9, '9');
  await chooseTimeOption(controls.picker, 'second', 31, '31');
  await expect(page.locator('output')).toHaveText('08:45:30');
  await controls.picker.locator('[data-action="apply"]').click();
  await expect(page.locator('output')).toHaveText('09:45:31');
  await expect(controls.trigger).toBeFocused();

  await page.goto(`${COMPONENT_BASE}/datetime/index.html`);
  controls = await openPicker(page);
  await controls.picker.locator('[data-day="2027-09-19"]').click();
  await chooseTimeOption(controls.picker, 'hour', 10, '10');
  await chooseTimeOption(controls.picker, 'minute', 30, '30');
  await chooseTimeOption(controls.picker, 'second', 15, '15');
  await expect(page.locator('output')).toHaveText('2027-09-18T08:45:30');
  await controls.picker.locator('[data-action="apply"]').click();
  await expect(page.locator('output')).toHaveText('2027-09-19T10:30:15');
  await expect(controls.trigger).toBeFocused();
});

test('searchable time comboboxes filter, expose ARIA state and keep one listbox open', async ({
  page,
}) => {
  await page.goto(`${COMPONENT_BASE}/time/index.html`);
  const { picker } = await openPicker(page);
  const hour = picker.locator('input[data-time-part="hour"]');
  const minute = picker.locator('input[data-time-part="minute"]');
  const second = picker.locator('input[data-time-part="second"]');

  await expect(picker.getByRole('combobox')).toHaveCount(3);
  await expect(hour).toHaveValue('08');
  await expect(minute).toHaveValue('45');
  await expect(second).toHaveValue('30');

  await hour.click();
  await expect(hour).toHaveAttribute('aria-expanded', 'true');
  await hour.fill('8');
  await expect(hour).toHaveAttribute('aria-activedescendant', /hour-8$/);
  await expect(picker.getByRole('option', { name: /^08/ })).toBeVisible();
  await expect(picker.locator('.temporal-picker__time-status')).toHaveText('1 result');
  await hour.press('Enter');
  await expect(hour).toHaveValue('08');
  await expect(hour).toHaveAttribute('aria-expanded', 'false');

  await minute.click();
  await expect(minute).toHaveAttribute('aria-expanded', 'true');
  await expect(hour).toHaveAttribute('aria-expanded', 'false');
  await expect(picker.locator('.temporal-picker__time-listbox:visible')).toHaveCount(1);
  await minute.press('End');
  await expect(minute).toHaveAttribute('aria-activedescendant', /minute-59$/);
  await minute.press('Tab');
  await expect(minute).toHaveAttribute('aria-expanded', 'false');
  await expect(second).toBeFocused();

  await second.fill('99');
  await expect(picker.locator('.temporal-picker__time-status')).toHaveText(
    'No matching values',
  );
  await expect(picker.locator('.temporal-picker__time-empty')).toBeVisible();
  await second.press('Escape');
  await expect(second).toHaveAttribute('aria-expanded', 'false');
  await expect(picker.locator('[data-part="trigger"]')).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await second.press('Escape');
  await expect(picker.locator('[data-part="trigger"]')).toBeFocused();
});

test('Clear, disabled, invalid bounds, external sync and multiple IDs remain controlled', async ({
  page,
}) => {
  await page.goto(`${COMPONENT_BASE}/time/index.html`);
  const picker = page.locator('temporal-picker');
  const trigger = picker.locator('[data-part="trigger"]');

  await picker.evaluate((element) => {
    element.disabled = true;
  });
  await expect(trigger).toBeDisabled();

  await picker.evaluate((element) => {
    element.disabled = false;
  });
  await openPicker(page);
  await picker.evaluate((element) => {
    element.value = '10:15:20';
  });
  await expect(picker.locator('input[data-time-part="hour"]')).toHaveValue('10');
  await expect(picker.locator('input[data-time-part="minute"]')).toHaveValue('15');
  await expect(picker.locator('input[data-time-part="second"]')).toHaveValue('20');
  await picker.locator('[data-action="clear"]').click();
  await expect(page.locator('output')).toHaveText('""');

  await picker.evaluate((element) => {
    element.value = '08:45:30';
    element.min = '18:00:00';
    element.max = '08:00:00';
    element.open();
  });
  await expect(picker.locator('[role="alert"]')).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-invalid');
  await picker.locator('[data-action="close"]').click();

  const ids = await page.evaluate(() => {
    const first = document.querySelector('temporal-picker');
    const second = document.createElement('temporal-picker');
    second.setAttribute('mode', 'date');
    document.body.append(second);
    return [
      first.querySelector('[data-part="panel"]').id,
      second.querySelector('[data-part="panel"]').id,
    ];
  });
  expect(new Set(ids).size).toBe(2);
});

test('bounded datetime exposes dynamic unavailable dates, hours, minutes and seconds', async ({
  page,
}) => {
  await page.goto(`${COMPONENT_BASE}/bounded-datetime/index.html`);
  const { picker } = await openPicker(page);

  await expect(picker.locator('[data-day="2027-09-09"]')).toBeDisabled();
  await expect(picker.locator('[data-day="2027-09-10"]')).toBeEnabled();
  await expect(picker.locator('[data-day="2027-09-24"]')).toBeEnabled();
  await expect(picker.locator('[data-day="2027-09-25"]')).toBeDisabled();

  await picker.locator('[data-day="2027-09-24"]').click();
  const hour = picker.locator('input[data-time-part="hour"]');
  await hour.click();
  await hour.fill('19');
  await expect(
    picker.locator('[data-time-option="hour"][data-value="19"]'),
  ).toBeDisabled();
  await expect(
    picker.locator('[data-time-option="hour"][data-value="19"]'),
  ).toContainText('Unavailable');
  await expect(hour).not.toHaveAttribute('aria-activedescendant');
  await hour.fill('18');
  await expect(
    picker.locator('[data-time-option="hour"][data-value="18"]'),
  ).toBeEnabled();
  await picker.locator('[data-time-option="hour"][data-value="18"]').click();

  const minute = picker.locator('input[data-time-part="minute"]');
  await minute.click();
  await expect(minute).toHaveAttribute('aria-activedescendant', /minute-0$/);
  await expect(
    picker.locator('[data-time-option="minute"][data-value="45"]'),
  ).toContainText('Selected, unavailable');
  await expect(
    picker.locator('[data-time-option="minute"][data-value="0"]'),
  ).toBeEnabled();
  await expect(
    picker.locator('[data-time-option="minute"][data-value="1"]'),
  ).toBeDisabled();
  await picker.locator('[data-time-option="minute"][data-value="0"]').click();

  const second = picker.locator('input[data-time-part="second"]');
  await second.click();
  await expect(
    picker.locator('[data-time-option="second"][data-value="0"]'),
  ).toBeEnabled();
  await expect(
    picker.locator('[data-time-option="second"][data-value="1"]'),
  ).toBeDisabled();
});

test('calendar keyboard navigation, Escape and outside click follow focus contract', async ({
  page,
}) => {
  await page.goto(`${COMPONENT_BASE}/date/index.html`);
  let controls = await openPicker(page);
  const selectedDay = controls.picker.locator('[data-day="2027-09-18"]');
  await expect(selectedDay).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(controls.picker.locator('[data-day="2027-09-19"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('output')).toHaveText('2027-09-19');
  await expect(controls.trigger).toBeFocused();

  controls = await openPicker(page);
  await page.keyboard.press('Escape');
  await expect(controls.trigger).toBeFocused();
  await expect(controls.trigger).toHaveAttribute('aria-expanded', 'false');

  await page.evaluate(() => {
    const outside = document.createElement('button');
    outside.id = 'outside-target';
    outside.textContent = 'Outside target';
    document.body.append(outside);
  });
  controls = await openPicker(page);
  await page.locator('#outside-target').click();
  await expect(page.locator('#outside-target')).toBeFocused();
  await expect(controls.trigger).toHaveAttribute('aria-expanded', 'false');
});

test('month and year grids use roving keyboard focus', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/month/index.html`);
  let controls = await openPicker(page);
  await expect(controls.picker.locator('[data-month="9"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(controls.picker.locator('[data-month="10"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('output')).toHaveText('2027-10');

  await page.goto(`${COMPONENT_BASE}/year/index.html`);
  controls = await openPicker(page);
  await expect(controls.picker.locator('[data-year="2027"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(controls.picker.locator('[data-year="2028"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('output')).toHaveText('2028');
});

test('popover collision and reduced motion stay safe on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${COMPONENT_BASE}/time/index.html`);
  const picker = page.locator('temporal-picker');

  await picker.evaluate((element) => {
    element.style.position = 'fixed';
    element.style.left = '12px';
    element.style.bottom = '8px';
  });
  const { trigger } = await openPicker(page);
  const panel = picker.locator('[data-part="panel"]');
  await expect(panel).toHaveAttribute('data-placement', 'top');
  const timeInputs = picker.locator('input[data-time-part]');
  await expect(timeInputs).toHaveCount(3);
  const inputGeometry = await timeInputs.evaluateAll((inputs) =>
    inputs.map((input) => {
      const rect = input.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width };
    }),
  );
  expect(new Set(inputGeometry.map(({ top }) => Math.round(top))).size).toBe(1);
  expect(inputGeometry.every(({ width }) => width > 48)).toBe(true);
  await picker.locator('input[data-time-part="second"]').click();
  await expect(picker.locator('.temporal-picker__time-listbox')).toBeVisible();

  const geometry = await panel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      transitionDuration: getComputedStyle(element).transitionDuration,
    };
  });

  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(375);
  expect(geometry.bottom).toBeLessThanOrEqual(667);
  expect(geometry.transitionDuration).toBe('0s');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  ).toBe(false);
  await page.keyboard.press('Escape');
  await expect(picker.locator('input[data-time-part="second"]')).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('time-capable variants keep responsive geometry at all visual QA viewports', async ({
  page,
}) => {
  const viewports = [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ];

  for (const variant of ['time', 'datetime', 'bounded-datetime']) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto(`${COMPONENT_BASE}/${variant}/index.html`);
      const { panel, picker } = await openPicker(page);
      const inputs = picker.locator('input[data-time-part]');
      await expect(inputs).toHaveCount(3);

      const geometry = await inputs.evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { top: Math.round(rect.top), width: rect.width };
        }),
      );
      expect(new Set(geometry.map(({ top }) => top)).size).toBe(1);
      expect(geometry.every(({ width }) => width >= 48)).toBe(true);

      await picker.locator('input[data-time-part="minute"]').click();
      const listbox = picker.locator('.temporal-picker__time-listbox');
      await expect(listbox).toBeVisible();
      const widths = await page.evaluate(() => {
        const list = document.querySelector('.temporal-picker__time-options');
        const controls = document.querySelector('.temporal-picker__time-controls');
        return {
          controls: controls.getBoundingClientRect().width,
          list: list.getBoundingClientRect().width,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      expect(Math.abs(widths.controls - widths.list)).toBeLessThan(1);
      expect(widths.overflow).toBe(false);

      const panelBox = await panel.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          top: rect.top,
        };
      });
      expect(panelBox.left).toBeGreaterThanOrEqual(0);
      expect(panelBox.right).toBeLessThanOrEqual(viewport.width);
      expect(panelBox.top).toBeGreaterThanOrEqual(0);
      expect(panelBox.bottom).toBeLessThanOrEqual(viewport.height);
    }
  }
});

test('fixed-position fallback portals the panel without losing theme tokens', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLElement.prototype, 'showPopover', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(HTMLElement.prototype, 'hidePopover', {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto(`${COMPONENT_BASE}/date/index.html`);
  const { picker, trigger } = await openPicker(page);
  const panel = page.locator('body > [data-part="panel"]');

  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS('background-color', 'rgb(23, 26, 32)');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(picker.locator('[data-part="panel"]')).toBeHidden();
});

test('real detail page follows the vertical layout and exposes source and download contracts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let zipBody = Buffer.from('temporal-picker-test-zip');
  try {
    zipBody = await readFile(
      path.resolve('dist', 'downloads', 'temporal-picker-0.3.0.zip'),
    );
  } catch {
    // Standalone E2E runs can validate the browser contract before packaging.
  }

  await page.route('**/downloads/temporal-picker-0.3.0.zip', (route) =>
    route.fulfill({
      body: zipBody,
      contentType: 'application/zip',
    }),
  );
  await page.goto('/component.html?id=temporal-picker');

  await expect(
    page.getByRole('heading', { name: 'Temporal Picker', level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Inputs' })).toHaveAttribute(
    'href',
    './index.html#inputs',
  );
  await expect(page.locator('#variant-controls button')).toHaveCount(6);
  await expect(page.locator('#component-technologies .tag')).toHaveText([
    'html',
    'css',
    'javascript',
  ]);
  const previewFrame = page.locator('#component-preview');
  await expect
    .poll(() =>
      previewFrame.evaluate((element) =>
        Math.round(element.getBoundingClientRect().height),
      ),
    )
    .toBeLessThan(720);
  await expect(page.locator('.preview-stage')).toHaveCSS(
    'background-color',
    'rgb(15, 17, 21)',
  );
  await expect(
    page.frameLocator('#component-preview').locator('[data-part="trigger"]'),
  ).toHaveAttribute('aria-expanded', 'false');

  const stageWidth = await page.locator('.preview-stage').evaluate((element) => ({
    stage: element.getBoundingClientRect().width,
    parent: element.parentElement.getBoundingClientRect().width,
  }));
  expect(Math.abs(stageWidth.stage - stageWidth.parent)).toBeLessThan(1);

  const closedGeometry = await page.evaluate(() => ({
    sourceTop:
      document.querySelector('#source-package-title').getBoundingClientRect().top +
      window.scrollY,
    stageHeight: document.querySelector('.preview-stage').getBoundingClientRect().height,
  }));
  await page
    .frameLocator('#component-preview')
    .locator('[data-part="trigger"]')
    .click();
  await expect(previewFrame).toHaveClass(/is-preview-open/);
  await expect(previewFrame).toHaveCSS('height', '720px');
  await expect(page.locator('.preview-stage')).toHaveClass(/is-preview-open/);
  const openGeometry = await page.evaluate(() => {
    const frame = document.querySelector('#component-preview').getBoundingClientRect();
    const stage = document.querySelector('.preview-stage');
    return {
      frameBottom: frame.bottom,
      sourceTop:
        document.querySelector('#source-package-title').getBoundingClientRect().top +
        window.scrollY,
      sourceViewportTop: document
        .querySelector('#source-package-title')
        .getBoundingClientRect().top,
      stageHeight: stage.getBoundingClientRect().height,
      stageZIndex: Number(getComputedStyle(stage).zIndex),
    };
  });
  expect(Math.abs(openGeometry.stageHeight - closedGeometry.stageHeight)).toBeLessThan(1);
  expect(openGeometry.sourceTop).toBe(closedGeometry.sourceTop);
  expect(openGeometry.frameBottom).toBeGreaterThan(openGeometry.sourceViewportTop);
  expect(openGeometry.stageZIndex).toBeGreaterThan(0);
  const previewHour = page
    .frameLocator('#component-preview')
    .locator('input[data-time-part="hour"]');
  await page.evaluate(() => window.scrollBy(0, 400));
  await previewHour.click();
  await previewHour.press('Escape');
  await expect(previewHour).toHaveAttribute('aria-expanded', 'false');
  await expect(previewFrame).toHaveClass(/is-preview-open/);
  await previewHour.press('Escape');
  await expect(previewFrame).not.toHaveClass(/is-preview-open/);
  await expect
    .poll(() =>
      previewFrame.evaluate((element) =>
        Math.round(element.getBoundingClientRect().height),
      ),
    )
    .toBeLessThan(720);

  const orderedSelectors = [
    '#component-group-link',
    '#component-name',
    '#component-description',
    '#component-technologies',
    '#preview-title',
    '#variant-controls',
    '.preview-stage',
    '.active-variant',
    '#source-package-title',
    '.source-accordions',
  ];
  const topPositions = await page.evaluate((selectors) =>
    selectors.map((selector) => document.querySelector(selector).getBoundingClientRect().top),
    orderedSelectors,
  );
  expect(topPositions.every((position, index) => index === 0 || position > topPositions[index - 1]))
    .toBe(true);

  await page.getByRole('button', { name: 'Date', exact: true }).click();
  await expect(page.locator('#active-variant-name')).toHaveText('Date');
  await expect(page.locator('#active-variant-description')).toContainText(
    'six-week Gregorian calendar',
  );
  await expect(page.locator('#source-file-select')).toHaveValue(
    'source/variants/date/index.html',
  );
  await page.getByText('Source Code', { exact: true }).click();
  await expect(page.locator('#source-content')).toContainText('<temporal-picker');
  await page.getByText('Prompt', { exact: true }).click();

  const promptLink = page.getByRole('link', {
    name: 'Download PROMPT.md',
    exact: true,
  });
  await expect(promptLink).toHaveAttribute(
    'download',
    'temporal-picker-PROMPT.md',
  );
  const promptDownloadEvent = page.waitForEvent('download');
  await promptLink.click();
  const promptDownload = await promptDownloadEvent;
  expect(promptDownload.suggestedFilename()).toBe('temporal-picker-PROMPT.md');
  expect(await readFile(await promptDownload.path(), 'utf8')).toContain(
    'Recreate Temporal Picker',
  );

  await page.getByText('Design System', { exact: true }).click();
  const designLink = page.getByRole('link', {
    name: 'Download DESIGN.md',
    exact: true,
  });
  await expect(designLink).toHaveAttribute(
    'download',
    'temporal-picker-DESIGN.md',
  );
  const designDownloadEvent = page.waitForEvent('download');
  await designLink.click();
  const designDownload = await designDownloadEvent;
  expect(designDownload.suggestedFilename()).toBe('temporal-picker-DESIGN.md');
  expect(await readFile(await designDownload.path(), 'utf8')).toContain(
    'Temporal Picker - Design Specification',
  );

  const zipLink = page.getByRole('link', {
    name: 'Download component ZIP',
    exact: true,
  });
  await expect(zipLink).toHaveAttribute(
    'download',
    'temporal-picker-0.3.0.zip',
  );
  const zipDownloadEvent = page.waitForEvent('download');
  await zipLink.click();
  const zipDownload = await zipDownloadEvent;
  expect(zipDownload.suggestedFilename()).toBe('temporal-picker-0.3.0.zip');

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
