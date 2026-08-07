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

  // The surface colours below are the dark half of the pairs, so the scheme is pinned.
  // The light half is covered by the catalog's own per-preview theme test.
  await page.emulateMedia({ colorScheme: 'dark' });

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
  // Named for the dark scrollbars, so the scheme that produces them is pinned.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${COMPONENT_BASE}/time/index.html`);
  let controls = await openPicker(page);
  const minute = controls.picker.locator('input[data-time-part="minute"]');
  await minute.click();
  // Opening seeds the query with the current value, so lift it to get a scrollable list.
  await minute.press('End');
  const listbox = controls.picker.locator('.temporal-picker__time-listbox');
  await expect(controls.picker.getByRole('option')).toHaveCount(60);
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
  // Opening a field that already holds 45 seeds the query, so only that option shows.
  await expect(picker.getByRole('option')).toHaveCount(1);
  await expect(minute).toHaveAttribute('aria-activedescendant', /minute-45$/);
  // The first navigation key lifts the seed and holds the current value.
  await minute.press('End');
  await expect(picker.getByRole('option')).toHaveCount(60);
  await expect(minute).toHaveAttribute('aria-activedescendant', /minute-45$/);
  // Later presses navigate normally.
  await minute.press('End');
  await expect(minute).toHaveAttribute('aria-activedescendant', /minute-59$/);
  await minute.press('Tab');
  await expect(minute).toHaveAttribute('aria-expanded', 'false');
  await expect(second).toBeFocused();

  await second.fill('99');
  await expect(picker.locator('.temporal-picker__time-status')).toHaveText('No match');
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

test('the time dropdown dismisses on pointer activity outside it', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/datetime/index.html`);
  const { picker, trigger } = await openPicker(page);
  const dropdown = picker.locator('.temporal-picker__time-options');
  const minute = picker.locator('input[data-time-part="minute"]');

  await minute.click();
  await expect(dropdown).toBeVisible();

  // A calendar day sits inside the panel but outside the dropdown.
  await picker.locator('[data-day]:not(:disabled)').nth(10).click();
  await expect(dropdown).toBeHidden();
  await expect(minute).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  // Switching straight to another time input keeps a dropdown open.
  await minute.click();
  await expect(dropdown).toBeVisible();
  await picker.locator('input[data-time-part="second"]').click();
  await expect(dropdown).toBeVisible();
  await expect(minute).toHaveAttribute('aria-expanded', 'false');
  await expect(picker.locator('input[data-time-part="second"]')).toHaveAttribute(
    'aria-expanded',
    'true',
  );

  // Outside the component entirely closes the panel and the dropdown with it.
  await page.mouse.click(5, 5);
  await expect(dropdown).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
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
          return {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: rect.width,
          };
        }),
      );

      // One row of three, at every width and in every time-capable mode. Moving the datetime
      // clock beside the calendar moved the whole row; it did not stand the fields up.
      expect(new Set(geometry.map(({ top }) => top)).size).toBe(1);
      // Three distinct lefts, so "one row" cannot pass by the fields having collapsed onto
      // each other.
      expect(new Set(geometry.map(({ left }) => left)).size).toBe(3);
      expect(geometry.every(({ width }) => width >= 48)).toBe(true);

      await picker.locator('input[data-time-part="minute"]').click();
      const listbox = picker.locator('.temporal-picker__time-listbox');
      await expect(listbox).toBeVisible();
      const anchoring = await page.evaluate(() => {
        const list = document
          .querySelector('.temporal-picker__time-options')
          .getBoundingClientRect();
        const input = document
          .querySelector('input[data-time-part="minute"]')
          .getBoundingClientRect();
        return {
          inputWidth: input.width,
          leftDelta: Math.abs(list.left - input.left),
          listWidth: list.width,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          // The dropdown may flip above the input when space below runs short.
          verticalGap: Math.min(
            Math.abs(list.top - input.bottom),
            Math.abs(input.top - list.bottom),
          ),
        };
      });
      expect(Math.abs(anchoring.listWidth - anchoring.inputWidth)).toBeLessThan(1);
      expect(anchoring.leftDelta).toBeLessThan(1);
      expect(anchoring.verticalGap).toBeLessThan(12);
      expect(anchoring.overflow).toBe(false);

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

test('a wide datetime panel puts the clock beside the calendar, not under it', async ({
  page,
}) => {
  test.slow();

  for (const variant of ['datetime', 'bounded-datetime']) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${COMPONENT_BASE}/${variant}/index.html`);
    const { panel } = await openPicker(page);

    const layout = await panel.evaluate((element) => {
      const box = (selector) => {
        const rect = element.querySelector(selector).getBoundingClientRect();
        return {
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
        };
      };

      return {
        panelHeight: Math.round(element.getBoundingClientRect().height),
        header: box('.temporal-picker__calendar-header'),
        grid: box('.temporal-picker__day-grid'),
        time: box('.temporal-picker__datetime-time'),
        dayCell: box('.temporal-picker__day').width,
        separatorsShown: [...element.querySelectorAll('.temporal-picker__time-separator')]
          .filter((mark) => getComputedStyle(mark).display !== 'none').length,
        inputs: [...element.querySelectorAll('.temporal-picker__time-input')].map((input) => {
          const rect = input.getBoundingClientRect();
          return { left: Math.round(rect.left), top: Math.round(rect.top), width: rect.width };
        }),
      };
    });

    // Clear of the calendar entirely rather than merely offset from it.
    expect(layout.time.left).toBeGreaterThanOrEqual(layout.grid.right);

    // Top-aligned with the month heading, and the rule beside it runs the calendar's height.
    expect(Math.abs(layout.time.top - layout.header.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.time.bottom - layout.grid.bottom)).toBeLessThanOrEqual(1);

    // The row stays a row inside the right column, colons and all — the same arrangement the
    // time-only picker uses. Only its position on the panel changed.
    expect(new Set(layout.inputs.map(({ top }) => top)).size).toBe(1);
    expect(new Set(layout.inputs.map(({ left }) => left)).size).toBe(3);
    expect(layout.separatorsShown).toBe(2);
    expect(layout.inputs.every(({ width }) => width >= 48)).toBe(true);
    await expect(panel.locator('.temporal-picker__field > span')).toHaveCount(3);

    // Widening the panel must not come out of the calendar. Both halves of that are asserted:
    // a cell keeps its full size, and the grid is actually wide enough to hold seven of them.
    // The grid alone is not enough — a `.temporal-picker__day` keeps its 40px and simply
    // overflows a collapsed track, so a panel showing no calendar at all still measures 40.
    expect(layout.dayCell).toBe(40);
    expect(layout.grid.width).toBeGreaterThanOrEqual(280);

    // The point of the move. Measured at 417 against the stacked panel's 507, and asserted
    // loosely so a font metric cannot turn a layout win into a failing build.
    expect(layout.panelHeight).toBeLessThan(470);
  }
});

test('a datetime panel too narrow to split keeps the clock underneath', async ({ page }) => {
  // Below the threshold not one of the two-column rules applies, so the narrow layout is the
  // original stacked one rather than a second layout to keep in step with the first. Measured
  // just under the 37rem line, where an off-by-one in the breakpoint would show.
  await page.setViewportSize({ width: 584, height: 900 });
  await page.goto(`${COMPONENT_BASE}/datetime/index.html`);
  const { panel } = await openPicker(page);

  const layout = await panel.evaluate((element) => {
    const box = (selector) => {
      const rect = element.querySelector(selector).getBoundingClientRect();
      return { left: Math.round(rect.left), top: Math.round(rect.top) };
    };
    return {
      grid: box('.temporal-picker__day-grid'),
      time: box('.temporal-picker__datetime-time'),
      separatorsShown: [...element.querySelectorAll('.temporal-picker__time-separator')]
        .filter((mark) => getComputedStyle(mark).display !== 'none').length,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  expect(layout.time.top).toBeGreaterThan(layout.grid.top);
  expect(Math.abs(layout.time.left - layout.grid.left)).toBeLessThanOrEqual(1);
  expect(layout.separatorsShown).toBe(2);
  expect(layout.overflow).toBe(false);
});

test('the time-only picker is untouched by the datetime layout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${COMPONENT_BASE}/time/index.html`);
  const { panel } = await openPicker(page);

  // Every two-column rule is scoped to the datetime panel, and a time panel has no calendar
  // to sit beside in the first place.
  await expect(panel).toHaveAttribute('data-mode', 'time');
  await expect(panel.locator('.temporal-picker__datetime-time')).toHaveCount(0);

  const layout = await panel.evaluate((element) => ({
    width: Math.round(element.getBoundingClientRect().width),
    columns: getComputedStyle(
      element.querySelector('.temporal-picker__time-controls'),
    ).gridTemplateColumns.split(' ').length,
    separatorsShown: [...element.querySelectorAll('.temporal-picker__time-separator')]
      .filter((mark) => getComputedStyle(mark).display !== 'none').length,
  }));

  expect(layout.width).toBe(352);
  expect(layout.columns).toBe(5);
  expect(layout.separatorsShown).toBe(2);
});

test('the time dropdown clears the calendar when the clock sits beside it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${COMPONENT_BASE}/datetime/index.html`);
  const { panel, picker } = await openPicker(page);

  await picker.locator('input[data-time-part="hour"]').click();
  await expect(picker.locator('.temporal-picker__time-listbox')).toBeVisible();

  const anchoring = await page.evaluate(() => {
    const list = document
      .querySelector('.temporal-picker__time-options')
      .getBoundingClientRect();
    const input = document
      .querySelector('input[data-time-part="hour"]')
      .getBoundingClientRect();
    const grid = document
      .querySelector('.temporal-picker__day-grid')
      .getBoundingClientRect();

    return {
      clearsCalendar: list.left >= grid.right,
      insideViewport: list.left >= 0 && list.right <= window.innerWidth,
      leftDelta: Math.abs(list.left - input.left),
      widthDelta: Math.abs(list.width - input.width),
    };
  });

  // Moving the input to the right column moves the dropdown with it, and there it covers
  // nothing a reader was looking at.
  expect(anchoring.clearsCalendar).toBe(true);
  expect(anchoring.insideViewport).toBe(true);
  expect(anchoring.leftDelta).toBeLessThan(1);
  expect(anchoring.widthDelta).toBeLessThan(1);

  await expect(panel).toBeVisible();
});

test('fixed-position fallback portals the panel without losing theme tokens', async ({
  page,
}) => {
  // The panel is moved to the end of the body, so this checks it still resolves the
  // document's tokens from there. Pinned dark because that is the surface asserted below.
  await page.emulateMedia({ colorScheme: 'dark' });
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

test('switching source files leaves the code pane and its copy button in place', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/component.html?id=temporal-picker');
  const pane = page.locator('#source-content');
  await expect(pane).toContainText(':root');

  await page.evaluate(() => {
    window.paneHeights = [];
    const pre = document.querySelector('#source-content');
    new ResizeObserver(() => {
      window.paneHeights.push(Math.round(pre.getBoundingClientRect().height));
    }).observe(pre);
  });

  await page.locator('#source-file-select').click();
  await page.locator('.file-select__option', { hasText: 'temporal-picker.js' }).click();
  await expect(pane).toContainText('class TemporalPicker');

  // Swapping in a placeholder while fetching would collapse the pane to its min-height
  // and snap it back, which reads as the whole page reloading.
  const heights = await page.evaluate(() => [...new Set(window.paneHeights)]);
  expect(heights).toHaveLength(1);
  expect(await pane.evaluate((element) => element.scrollTop)).toBe(0);

  // The copy button has to clear the scrollbar, whose width varies per platform.
  const clearance = await page.evaluate(() => {
    const pre = document.querySelector('#source-content');
    const button = document.querySelector('[data-copy-for="source-content"]');
    const scrollbar = pre.offsetWidth - pre.clientWidth;
    return Math.round(
      pre.getBoundingClientRect().right - scrollbar - button.getBoundingClientRect().right,
    );
  });
  expect(clearance).toBeGreaterThanOrEqual(0);
});

test('real detail page follows the vertical layout and exposes source and download contracts', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let zipBody = Buffer.from('temporal-picker-test-zip');
  let packaged = false;
  try {
    zipBody = await readFile(
      path.resolve('dist', 'downloads', 'temporal-picker-0.3.0.zip'),
    );
    packaged = true;
  } catch {
    // Standalone E2E runs can validate the browser contract before packaging.
  }

  if (packaged) {
    // Request the real path rather than the mocked route below. A server that falls back
    // to index.html still answers 200, so assert the archive signature, not the header:
    // a wrong content type is exactly what made a saved HTML page look like a bad ZIP.
    const archive = await request.get('/downloads/temporal-picker-0.3.0.zip');
    expect(archive.status()).toBe(200);
    expect((await archive.body()).subarray(0, 4).toString('hex')).toBe('504b0304');
  }

  await page.route('**/downloads/temporal-picker-0.3.0.zip', (route) =>
    route.fulfill({
      body: zipBody,
      contentType: 'application/zip',
    }),
  );
  // This preview paints itself dark whatever the catalog is showing, so the stage is
  // asserted against the dark catalog theme, where the two are supposed to meet without
  // a seam. Nothing is stored, so the catalog follows this preference.
  await page.emulateMedia({ colorScheme: 'dark' });
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
  await expect(previewFrame).toHaveCSS('height', '720px');
  // The demo must fill the fixed frame, otherwise its background stops short of the
  // stage and leaves a visible seam.
  await expect
    .poll(() =>
      page
        .frameLocator('#component-preview')
        .locator('main.temporal-demo')
        .evaluate((main) => main.getBoundingClientRect().height - window.innerHeight),
    )
    .toBeGreaterThanOrEqual(0);
  // The dark inset surface, which is what this preview's own background matches.
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
  const previewTrigger = page
    .frameLocator('#component-preview')
    .locator('[data-part="trigger"]');
  await previewTrigger.click();
  await expect(previewTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(previewFrame).toHaveCSS('height', '720px');
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
    };
  });
  // Opening the picker must not resize the stage or push the page around it.
  expect(Math.abs(openGeometry.stageHeight - closedGeometry.stageHeight)).toBeLessThan(1);
  expect(openGeometry.sourceTop).toBe(closedGeometry.sourceTop);
  expect(openGeometry.frameBottom).toBeLessThanOrEqual(openGeometry.sourceViewportTop);
  const previewHour = page
    .frameLocator('#component-preview')
    .locator('input[data-time-part="hour"]');
  await page.evaluate(() => window.scrollBy(0, 400));
  await previewHour.click();
  await previewHour.press('Escape');
  await expect(previewHour).toHaveAttribute('aria-expanded', 'false');
  await expect(previewTrigger).toHaveAttribute('aria-expanded', 'true');
  await previewHour.press('Escape');
  await expect(previewTrigger).toHaveAttribute('aria-expanded', 'false');
  await expect(previewFrame).toHaveCSS('height', '720px');

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
  // The distributable files do not vary per variant, so switching variants leaves the
  // source picker alone.
  await expect(page.locator('#source-file-select')).toHaveAttribute(
    'data-value',
    'temporal-picker.css',
  );
  await page.locator('#source-file-select').click();
  await page.locator('.file-select__option', { hasText: 'temporal-picker.html' }).click();
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
  // The three-file prompt is optional, so it only appears when the component ships one.
  await page.getByText('Prompt', { exact: true }).click();
  const standaloneLink = page.getByRole('link', {
    name: 'Download three-file prompt',
    exact: true,
  });
  await expect(standaloneLink).toHaveAttribute(
    'download',
    'temporal-picker-PROMPT-STANDALONE.md',
  );
  const standaloneEvent = page.waitForEvent('download');
  await standaloneLink.click();
  const standaloneDownload = await standaloneEvent;
  expect(await readFile(await standaloneDownload.path(), 'utf8')).toContain(
    'Recreate Temporal Picker as three files',
  );
  await page.getByText('Design System', { exact: true }).click();

  const designDownloadEvent = page.waitForEvent('download');
  await designLink.click();
  const designDownload = await designDownloadEvent;
  expect(designDownload.suggestedFilename()).toBe('temporal-picker-DESIGN.md');
  expect(await readFile(await designDownload.path(), 'utf8')).toContain(
    'Temporal Picker - Design Specification',
  );

  // The ZIP button lives inside Source Code, so reopening it is part of the flow.
  await page.getByText('Source Code', { exact: true }).click();
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
