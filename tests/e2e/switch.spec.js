import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/switch/source/variants';
const VARIANTS = ['default', 'placement', 'descriptions', 'group', 'pending', 'restricted'];

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

/** Replaces the demo's timed request with one that never settles. */
async function holdCommitOpen(page, selector) {
  await page.evaluate((target) => {
    document.querySelector(target).commit = () => new Promise(() => {});
  }, selector);
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
      await page.goto(`${COMPONENT_BASE}/${variant}/index.html`);
      await page.waitForFunction(() => customElements.get('ui-switch'));

      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('ui-switch').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('the switch role reports on and off without a hand-written aria-checked', async ({
  page,
}) => {
  await page.goto(`${COMPONENT_BASE}/default/index.html`);
  await page.waitForFunction(() => customElements.get('ui-switch'));

  // A native checkbox exposes its own checked state under role="switch". Writing
  // aria-checked as well would add a second copy of that state with nothing keeping it
  // honest, so the attribute must stay absent.
  await expect(page.locator('#wifi')).toHaveAttribute('role', 'switch');
  await expect(page.locator('#wifi')).not.toHaveAttribute('aria-checked', /.*/);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const readTree = async () => {
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    return nodes
      .filter((node) => node.role?.value === 'switch')
      .map((node) => ({
        name: node.name?.value,
        checked: node.properties?.find((property) => property.name === 'checked')?.value?.value,
      }));
  };

  expect(await readTree()).toEqual([
    { name: 'Wi-Fi', checked: 'false' },
    { name: 'Bluetooth', checked: 'true' },
    { name: 'Personal hotspot', checked: 'false' },
    { name: 'Nearby sharing', checked: 'true' },
  ]);

  await page.locator('#wifi').click();
  expect((await readTree())[0]).toEqual({ name: 'Wi-Fi', checked: 'true' });
});

test('clicking the label toggles the switch', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/default/index.html`);
  await page.waitForFunction(() => customElements.get('ui-switch'));

  await expect(page.locator('#wifi')).not.toBeChecked();
  await page.getByText('Wi-Fi', { exact: true }).click();
  await expect(page.locator('#wifi')).toBeChecked();
});

test('Space toggles and Enter is left to the form', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/default/index.html`);
  await page.waitForFunction(() => customElements.get('ui-switch'));

  const control = page.locator('#wifi');
  await control.focus();

  await page.keyboard.press('Enter');
  await expect(control).not.toBeChecked();

  await page.keyboard.press('Space');
  await expect(control).toBeChecked();
});

test('the native change event is the only one reporting an edit', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/default/index.html`);
  await page.waitForFunction(() => customElements.get('ui-switch'));

  await page.evaluate(() => {
    window.__seen = [];
    for (const type of ['change', 'input', 'switch-change']) {
      document.addEventListener(type, (event) => window.__seen.push(event.type));
    }
  });

  await page.locator('#wifi').click();

  // A `switch-change` event would give consumers two ways to hear the same toggle.
  expect(await page.evaluate(() => window.__seen)).toEqual(['input', 'change']);
});

test('supporting text describes the switch rather than renaming it', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/descriptions/index.html`);
  await page.waitForFunction(() => customElements.get('ui-switch'));

  const control = page.locator('#analytics');
  const describedBy = await control.getAttribute('aria-describedby');
  expect(describedBy).toBeTruthy();

  await expect(page.locator(`#${describedBy}`)).not.toBeEmpty();
  await expect(control).toHaveAccessibleName('Share usage analytics');
});

test('a pending commit locks the switch against every way of pressing it', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/pending/index.html`);
  await page.waitForFunction(() => customElements.get('ui-switch'));
  await holdCommitOpen(page, 'ui-switch:has(#backup)');

  await page.evaluate(() => {
    window.__changes = 0;
    document.addEventListener('change', () => (window.__changes += 1));
  });

  const host = page.locator('ui-switch:has(#backup)');
  await page.locator('#backup').click();

  await expect(host).toHaveAttribute('pending', '');
  await expect(page.locator('#backup')).toHaveAttribute('aria-disabled', 'true');
  await expect(host.locator('.switch__spinner')).toBeVisible();
  expect(await page.evaluate(() => window.__changes)).toBe(1);

  // Forced, because Playwright reads aria-disabled and would refuse on its own. What is
  // under test is whether the component drops the press, not whether the tool tries it.
  await page.locator('#backup').click({ force: true });
  await page.getByText('Nightly backup', { exact: true }).click({ force: true });
  await page.locator('#backup').focus();
  await page.keyboard.press('Space');

  expect(await page.evaluate(() => window.__changes)).toBe(1);
  await expect(page.locator('#backup')).toBeChecked();
});

test('the switch is never disabled while pending, so focus stays put', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/pending/index.html`);
  await page.waitForFunction(() => customElements.get('ui-switch'));
  await holdCommitOpen(page, 'ui-switch:has(#backup)');

  await page.locator('#backup').focus();
  await page.keyboard.press('Space');

  await expect(page.locator('ui-switch:has(#backup)')).toHaveAttribute('pending', '');
  // `disabled` would move focus to the body and drop a keyboard user out of the row.
  expect(await page.evaluate(() => document.querySelector('#backup').disabled)).toBe(false);
  expect(await page.evaluate(() => document.activeElement.id)).toBe('backup');
});

test('a failed commit returns the switch to where it was and says so', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/pending/index.html`);
  await page.waitForFunction(() => customElements.get('ui-switch'));

  await page.evaluate(() => {
    window.__errors = [];
    document.addEventListener('switch-error', (event) =>
      window.__errors.push({
        checked: event.detail.checked,
        requested: event.detail.requested,
        reason: event.detail.reason.message,
      }),
    );
  });

  const control = page.locator('#backup');
  await control.focus();
  await page.keyboard.press('Space');

  const host = page.locator('ui-switch:has(#backup)');
  await expect(host.locator('[role="status"]')).toHaveText('Turning Nightly backup on');

  await expect(control).not.toBeChecked();
  await expect(host).not.toHaveAttribute('pending', /.*/);
  await expect(control).not.toHaveAttribute('aria-disabled', /.*/);
  await expect(host.locator('[role="status"]')).toHaveText('Could not turn Nightly backup on');

  expect(await page.evaluate(() => window.__errors)).toEqual([
    { checked: false, requested: true, reason: 'The network refused the change.' },
  ]);
  // Nothing pulled focus away while the request was failing.
  expect(await page.evaluate(() => document.activeElement.id)).toBe('backup');
});

test('a failure turning off puts the switch back on', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/pending/index.html`);
  await page.waitForFunction(() => customElements.get('ui-switch'));

  const control = page.locator('#retention');
  await expect(control).toBeChecked();

  await control.click();
  await expect(page.locator('ui-switch:has(#retention) [role="status"]')).toHaveText(
    'Could not turn Extended history off',
  );
  await expect(control).toBeChecked();
});

test('only the switches that are on are submitted', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/group/index.html`);
  await page.waitForFunction(() => customElements.get('ui-switch'));

  const submitted = () =>
    page.evaluate(() => [...new FormData(document.querySelector('form')).keys()]);

  expect(await submitted()).toEqual(['comments', 'reviews']);

  await page.locator('#comments').click();
  await page.locator('#releases').click();
  expect(await submitted()).toEqual(['reviews', 'releases']);
});

test('a disabled switch is left out however it was disabled', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/restricted/index.html`);
  await page.waitForFunction(() => customElements.get('ui-switch'));

  // `encryption` and `legacy-contacts` are both on, and neither may be submitted: one
  // carries the attribute itself, the other inherits it from a disabled fieldset.
  expect(
    await page.evaluate(() => [...new FormData(document.querySelector('form')).keys()]),
  ).toEqual([]);

  // A fieldset-disabled input reports `disabled === false`, so the host has to read the
  // pseudo-class or it would style those rows as if they were available.
  const flags = await page.evaluate(() =>
    [...document.querySelectorAll('ui-switch')].map((host) => ({
      id: host.control.id,
      attribute: host.control.disabled,
      marked: host.hasAttribute('data-disabled'),
    })),
  );

  expect(flags).toEqual([
    { id: 'beta', attribute: true, marked: true },
    { id: 'encryption', attribute: true, marked: true },
    { id: 'legacy-contacts', attribute: false, marked: true },
    { id: 'legacy-calendar', attribute: false, marked: true },
  ]);
});

test('placement moves the label without moving the switch out of reach', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/placement/index.html`);
  await page.waitForFunction(() => customElements.get('ui-switch'));

  const positions = await page.evaluate(() => {
    const read = (id) => ({
      control: document.querySelector(`#${id}`).getBoundingClientRect().x,
      label: document.querySelector(`label[for="${id}"]`).getBoundingClientRect().x,
    });
    return { end: read('autoplay'), start: read('digest') };
  });

  expect(positions.end.control).toBeLessThan(positions.end.label);
  expect(positions.start.label).toBeLessThan(positions.start.control);

  // The label still drives the control from either side.
  await page.getByText('Weekly digest', { exact: true }).click();
  await expect(page.locator('#digest')).not.toBeChecked();
});

test('state survives without colour and the compact target stays reachable', async ({ page }) => {
  await page.goto(`${COMPONENT_BASE}/default/index.html`);
  await page.waitForFunction(() => customElements.get('ui-switch'));

  const measured = await page.evaluate(() => {
    const linear = (channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (colour) => {
      const [r, g, b] = colour.match(/\d+/g).map(Number);
      return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    };
    const ratio = (a, b) => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (light + 0.05) / (dark + 0.05);
    };

    const off = document.querySelector('#wifi');
    const on = document.querySelector('#bluetooth');
    const compact = document.querySelector('#hotspot');
    const surface = getComputedStyle(document.querySelector('.switch-demo__card')).backgroundColor;
    const offStyle = getComputedStyle(off);
    const onStyle = getComputedStyle(on);
    const offThumb = getComputedStyle(off, '::before');
    const onThumb = getComputedStyle(on, '::before');

    const box = compact.getBoundingClientRect();
    const centreX = box.left + box.width / 2;
    const centreY = box.top + box.height / 2;

    return {
      offBorderOnSurface: ratio(offStyle.borderTopColor, surface),
      thumbEdgeOnOffTrack: ratio(offThumb.borderTopColor, offStyle.backgroundColor),
      onTrackOnSurface: ratio(onStyle.backgroundColor, surface),
      thumbOnOnTrack: ratio(onThumb.backgroundColor, onStyle.backgroundColor),
      // Position, not colour, is the primary signal, so the two thumbs must sit apart.
      thumbOffsetOff: offThumb.translate,
      thumbOffsetOn: onThumb.translate,
      compactDrawnHeight: box.height,
      compactHitsAbove: document.elementFromPoint(centreX, centreY - 11) === compact,
      compactHitsBelow: document.elementFromPoint(centreX, centreY + 11) === compact,
    };
  });

  expect(measured.offBorderOnSurface).toBeGreaterThanOrEqual(3);
  expect(measured.thumbEdgeOnOffTrack).toBeGreaterThanOrEqual(3);
  expect(measured.onTrackOnSurface).toBeGreaterThanOrEqual(3);
  expect(measured.thumbOnOnTrack).toBeGreaterThanOrEqual(3);
  expect(measured.thumbOffsetOff).not.toBe(measured.thumbOffsetOn);

  // WCAG 2.2 asks for 24px. The compact track is drawn smaller than that on purpose, so
  // the hit area has to be carried past the paint.
  expect(measured.compactDrawnHeight).toBeLessThan(24);
  expect(measured.compactHitsAbove).toBe(true);
  expect(measured.compactHitsBelow).toBe(true);
});

test('reduced motion stops the thumb and the spinner', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${COMPONENT_BASE}/pending/index.html`);
  await page.waitForFunction(() => customElements.get('ui-switch'));
  await holdCommitOpen(page, 'ui-switch:has(#backup)');

  await page.locator('#backup').click();

  const motion = await page.evaluate(() => {
    const control = document.querySelector('#backup');
    return {
      track: getComputedStyle(control).transitionDuration,
      thumb: getComputedStyle(control, '::before').transitionDuration,
      spinner: getComputedStyle(document.querySelector('.switch__spinner')).animationName,
    };
  });

  expect(motion.track).toBe('0s');
  expect(motion.thumb).toBe('0s');
  expect(motion.spinner).toBe('none');
  // The busy state is still carried by the dimmed track and the status message.
  await expect(page.locator('ui-switch:has(#backup) [role="status"]')).not.toBeEmpty();
});

test('the switch is drawn and works with scripting disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${COMPONENT_BASE}/default/index.html`);

  // The track and the thumb come from CSS on the checkbox itself, so a page with no
  // script running still shows a switch rather than a default checkbox.
  const drawn = await page.evaluate(() => {
    const control = document.querySelector('#wifi');
    const style = getComputedStyle(control);
    const box = control.getBoundingClientRect();
    return {
      appearance: style.appearance,
      radius: style.borderTopLeftRadius,
      width: box.width,
      height: box.height,
      thumbWidth: getComputedStyle(control, '::before').width,
      role: control.getAttribute('role'),
    };
  });

  expect(drawn.appearance).toBe('none');
  expect(drawn.radius).toBe('999px');
  expect(drawn.width).toBeGreaterThan(drawn.height);
  expect(drawn.thumbWidth).toBe('18px');
  // The role is the one thing script adds, so without it this is announced as a checkbox.
  expect(drawn.role).toBe(null);

  await page.getByText('Wi-Fi', { exact: true }).click();
  await expect(page.locator('#wifi')).toBeChecked();

  await context.close();
});
