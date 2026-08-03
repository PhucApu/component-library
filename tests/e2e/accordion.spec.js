import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/accordion/source/variants';
const VARIANTS = ['default', 'exclusive', 'icons', 'actions', 'states', 'controlled'];

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
  await page.waitForFunction(() => customElements.get('ui-accordion'));
  await page.waitForTimeout(250);
}

const expandedOf = (page, selector = 'ui-accordion') =>
  page.evaluate((target) => document.querySelector(target).expanded, selector);

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
      await expect(page.locator('ui-accordion').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('the panels open and close with no script at all', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${COMPONENT_BASE}/default/index.html`);

  // The widget is `details` and `summary`, so the fallback is the widget rather than a
  // consolation prize. Nothing below depends on the custom element being defined.
  const second = page.locator('ui-accordion details').nth(1);
  await expect(second).not.toHaveAttribute('open', /.*/);

  await second.locator('summary').click();
  await expect(second).toHaveAttribute('open', /.*/);

  await second.locator('summary').click();
  await expect(second).not.toHaveAttribute('open', /.*/);

  await context.close();
});

test('a summary is given a heading and the panel a region that it names', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  const wired = await page.evaluate(() => {
    const group = document.querySelector('ui-accordion');

    return group.items.map((item) => {
      const heading = item.querySelector('.accordion__title');
      const panel = item.querySelector('.accordion__panel');

      return {
        heading: heading?.tagName,
        named: panel?.getAttribute('aria-labelledby') === heading?.id && Boolean(heading?.id),
        role: panel?.getAttribute('role'),
        title: heading?.textContent.trim(),
      };
    });
  });

  expect(wired.every((item) => item.heading === 'H3')).toBe(true);
  expect(wired.every((item) => item.named)).toBe(true);
  expect(wired.every((item) => item.role === 'region')).toBe(true);

  // A summary is a button and nothing else to the accessibility tree; without the heading
  // the panels cannot be jumped between, which is how most screen reader users move.
  const headings = await page.evaluate(async () => {
    const names = [];
    document.querySelectorAll('ui-accordion .accordion__title').forEach((node) => names.push(node.textContent.trim()));
    return names;
  });
  expect(headings[0]).toBe('What the component adds');
});

test('the heading level follows the attribute', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'controlled');

  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('.accordion__title')].map((node) => node.tagName),
    ),
  ).toEqual(['H4', 'H4', 'H4']);
});

test('panels stop being landmarks once there are too many of them', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  // Asking for the role and warning against landmark proliferation are both in the
  // Authoring Practices, so the count decides rather than an opinion.
  const roles = await page.evaluate(async () => {
    const group = document.querySelector('ui-accordion');
    const read = () =>
      [...group.querySelectorAll('.accordion__panel')].filter((panel) => panel.getAttribute('role') === 'region')
        .length;

    const few = read();

    for (let index = 0; index < 4; index += 1) {
      const item = document.createElement('details');
      item.innerHTML = `<summary>Extra ${index}</summary><p>More</p>`;
      group.insertBefore(item, group.querySelector('[role="status"]'));
    }

    group.setAttribute('heading-level', '3');
    await new Promise((resolve) => requestAnimationFrame(resolve));

    return { few, total: group.items.length, many: read() };
  });

  expect(roles.few).toBe(4);
  expect(roles.total).toBe(8);
  expect(roles.many).toBe(0);
});

test('a panel opens and closes by moving rather than jumping', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  const travel = (open) =>
    page.evaluate(async () => {
      const group = document.querySelector('ui-accordion');
      const item = group.items[1];
      const panel = item.querySelector('.accordion__panel');

      item.querySelector('summary').click();

      const samples = [];
      for (let frame = 0; frame < 18; frame += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        samples.push(+panel.getBoundingClientRect().height.toFixed(1));
      }

      await new Promise((resolve) => setTimeout(resolve, 400));

      return { samples, open: item.open, inline: panel.style.blockSize };
    }, open);

  const opening = await travel(true);
  const peak = Math.max(...opening.samples);

  expect(peak).toBeGreaterThan(20);
  expect(opening.samples[0]).toBeLessThan(peak / 2);
  // Real intermediate heights, or it is not an animation, it is an appearance.
  expect(opening.samples.filter((value) => value > 1 && value < peak - 1).length).toBeGreaterThanOrEqual(4);
  expect(opening.open).toBe(true);
  // Left at an inline height, the panel could never resize with its content again.
  expect(opening.inline).toBe('');

  const closing = await travel(false);
  const start = closing.samples[0];
  expect(start).toBeGreaterThan(20);
  expect(closing.samples.filter((value) => value > 1 && value < start - 1).length).toBeGreaterThanOrEqual(4);
  expect(closing.open).toBe(false);
  expect(closing.inline).toBe('');
});

test('the panel is still on show while it closes', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  // A closed `details` does not render its content, so closing by setting `open` first and
  // animating afterwards animates nothing. The panel has to stay open until the end.
  const during = await page.evaluate(async () => {
    const item = document.querySelector('ui-accordion').items[0];
    item.querySelector('summary').click();

    const states = [];
    for (let frame = 0; frame < 6; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      states.push(item.open);
    }

    return states;
  });

  expect(during.every(Boolean)).toBe(true);
});

test('the press is what opens the panel, not the browser', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  // `toggle` cannot be cancelled and arrives after `open` has changed, and `details` has no
  // `beforetoggle`, so the press is the only thing left that can be refused. Left alone, the
  // browser toggles `open` as well and the two cancel out.
  //
  // Measuring the panel height here would prove nothing: the animation drives it to zero on
  // the first frame whether or not the browser also acted. The cancellation and the state
  // afterwards are what actually distinguish the two.
  const pressed = await page.evaluate(async () => {
    const item = document.querySelector('ui-accordion').items[1];
    let cancelled = null;

    // On `document`, which is above the group. A listener on the `details` sits below the
    // handler that cancels the press and would always read `false`.
    document.addEventListener('click', (event) => (cancelled = event.defaultPrevented), { once: true });
    item.querySelector('summary').click();
    await new Promise((resolve) => setTimeout(resolve, 500));

    return { cancelled, open: item.open };
  });

  expect(pressed).toEqual({ cancelled: true, open: true });
});

test('one panel at a time, and the one that closed itself is announced', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'exclusive');

  expect(await expandedOf(page)).toEqual([0]);
  // The browser was doing this before the script arrived, so the names have to be gone or
  // it would still be doing it, instantly, over the top of the animation.
  expect(await page.locator('ui-accordion details[name]').count()).toBe(0);

  await page.locator('ui-accordion summary').nth(1).click();
  await page.waitForTimeout(500);

  expect(await expandedOf(page)).toEqual([1]);
  // Only the change nobody asked for. Closing the panel you just pressed needs no telling.
  await expect(page.locator('[role="status"]')).toHaveText('Standard delivery collapsed');

  await page.locator('ui-accordion summary').nth(1).click();
  await page.waitForTimeout(500);
  expect(await expandedOf(page)).toEqual([]);
});

test('opening everything in exclusive mode opens one', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'exclusive');

  await page.evaluate(() => document.querySelector('ui-accordion').expandAll());
  await page.waitForTimeout(500);

  // A group whose rule is one at a time cannot be left in a state that rule forbids, or the
  // next press looks as though it did nothing.
  expect(await expandedOf(page)).toEqual([0]);

  await page.evaluate(() => {
    document.querySelector('ui-accordion').expanded = [0, 1, 2];
  });
  await page.waitForTimeout(500);
  expect(await expandedOf(page)).toEqual([0]);
});

test('a disabled panel refuses to open and still takes focus', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'states');

  const summary = page.locator('summary[aria-disabled="true"]');
  await summary.click();
  await page.waitForTimeout(300);

  const state = await page.evaluate(() => {
    const off = document.querySelector('summary[aria-disabled="true"]');
    off.focus();

    return {
      shut: !off.parentElement.open,
      focused: document.activeElement === off,
      expanded: document.querySelector('ui-accordion').expanded,
      markerHidden: getComputedStyle(off.querySelector('.accordion__marker')).visibility,
    };
  });

  // Reachable on purpose. A header nobody can land on is a header nobody can discover is
  // unavailable, and a disabled element cannot hold focus at all — turn one off under the
  // finger and focus drops to the body, taking the keyboard with it.
  expect(state).toEqual({
    shut: true,
    focused: true,
    expanded: [0],
    markerHidden: 'hidden',
  });
});

test('the API cannot open a disabled panel either', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'states');

  await page.evaluate(() => document.querySelector('ui-accordion').expandAll());
  await page.waitForTimeout(500);

  const open = await expandedOf(page);
  const disabledIndex = await page.evaluate(() =>
    document.querySelector('ui-accordion').items.findIndex((item) => item.hasAttribute('data-disabled')),
  );

  expect(open).not.toContain(disabledIndex);
  expect(open.length).toBe(3);
});

test('the arrow keys walk the headers and wrap', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'states');

  const focusedTitle = () =>
    page.evaluate(() => document.activeElement.querySelector('.accordion__title')?.textContent.trim());

  await page.locator('ui-accordion summary').first().focus();
  await page.keyboard.press('ArrowDown');
  // Landed on, not stepped over: this one is disabled.
  expect(await focusedTitle()).toBe('Not available on this plan');

  await page.keyboard.press('ArrowDown');
  expect(await focusedTitle()).toBe('More than fits');

  await page.keyboard.press('End');
  expect(await focusedTitle()).toBe('Ordinary');

  await page.keyboard.press('ArrowDown');
  expect(await focusedTitle()).toBe('Open to begin with');

  await page.keyboard.press('ArrowUp');
  expect(await focusedTitle()).toBe('Ordinary');

  await page.keyboard.press('Home');
  expect(await focusedTitle()).toBe('Open to begin with');
});

test('Enter and Space still work, and the arrow keys leave the panel alone', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  await page.locator('ui-accordion summary').nth(1).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  expect(await expandedOf(page)).toContain(1);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  expect(await expandedOf(page)).not.toContain(1);

  // Inside the panel, arrows belong to whatever is in there.
  const moved = await page.evaluate(async () => {
    const group = document.querySelector('ui-accordion');
    const before = document.activeElement;
    group.items[0].querySelector('.accordion__panel').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    return document.activeElement === before;
  });
  expect(moved).toBe(true);
});

test('the group reports what it decided', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'controlled');

  const log = await page.evaluate(async () => {
    const group = document.querySelector('ui-accordion');
    const seen = [];
    group.addEventListener('accordion-toggle', (event) => seen.push(['toggle', event.detail]));
    group.addEventListener('accordion-change', (event) => seen.push(['change', event.detail]));

    group.items[1].querySelector('summary').click();
    await new Promise((resolve) => setTimeout(resolve, 400));
    group.collapseAll();
    await new Promise((resolve) => setTimeout(resolve, 400));

    return seen;
  });

  expect(log[0]).toEqual(['toggle', { index: 1, expanded: true, reason: 'pointer' }]);
  expect(log[1]).toEqual(['change', { expanded: [1], reason: 'pointer' }]);
  expect(log[2]).toEqual(['toggle', { index: 1, expanded: false, reason: 'api' }]);
  expect(log[3][1].expanded).toEqual([]);
});

test('the buttons outside the group drive it', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'controlled');

  await page.getByRole('button', { name: 'Open all' }).click();
  await page.waitForTimeout(500);
  expect(await expandedOf(page, '#faq')).toEqual([0, 1, 2]);

  await page.getByRole('button', { name: 'Close all' }).click();
  await page.waitForTimeout(500);
  expect(await expandedOf(page, '#faq')).toEqual([]);

  await page.getByRole('button', { name: 'Open the last' }).click();
  await page.waitForTimeout(500);
  expect(await expandedOf(page, '#faq')).toEqual([2]);
});

test('a marker the author wrote is the only marker', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'icons');

  const markers = await page.evaluate(() =>
    [...document.querySelectorAll('ui-accordion summary')].map((summary) => ({
      count: summary.querySelectorAll('.accordion__marker').length,
      // Building the heading sweeps up the summary, so a marker left in place would end up
      // inside it, out of sight of the check for one, and a second would be drawn.
      insideHeading: summary.querySelectorAll('.accordion__title .accordion__marker').length,
    })),
  );

  expect(markers.every((summary) => summary.count === 1)).toBe(true);
  expect(markers.every((summary) => summary.insideHeading === 0)).toBe(true);
});

test('the secondary text stays out of the heading that names the panel', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'icons');

  const first = await page.evaluate(() => {
    const summary = document.querySelector('ui-accordion summary');
    return {
      title: summary.querySelector('.accordion__title').textContent.trim(),
      meta: summary.querySelector('.accordion__meta')?.textContent.trim(),
      metaInHeading: summary.querySelectorAll('.accordion__title .accordion__meta').length,
    };
  });

  // The heading names the region, so anything swept into it becomes part of that name.
  expect(first).toEqual({ title: 'Invoice 4021', meta: 'Paid 14 March', metaInHeading: 0 });
});

test('the marker moves to the other side without moving the title', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'icons');

  const order = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('ui-accordion')];
    const read = (group) => {
      const summary = group.querySelector('summary');
      const title = summary.querySelector('.accordion__title').getBoundingClientRect();
      const marker = summary.querySelector('.accordion__marker').getBoundingClientRect();

      return {
        markerFirstOnScreen: marker.left < title.left,
        titleFirstInMarkup:
          summary.querySelector('.accordion__title').compareDocumentPosition(
            summary.querySelector('.accordion__marker'),
          ) & Node.DOCUMENT_POSITION_FOLLOWING,
      };
    };

    return { end: read(groups[0]), start: read(groups[1]) };
  });

  expect(order.end.markerFirstOnScreen).toBe(false);
  expect(order.start.markerFirstOnScreen).toBe(true);
  // Reordered by style, so the reading order is the same on both sides.
  expect(Boolean(order.end.titleFirstInMarkup)).toBe(true);
  expect(Boolean(order.start.titleFirstInMarkup)).toBe(true);
});

test('a panel the author wrapped is measured whole', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'actions');

  // Measuring the first child would be right for a panel with one child and quietly wrong
  // for this one: it would open to the height of its first paragraph.
  const opened = await page.evaluate(async () => {
    const group = document.querySelector('ui-accordion');
    const item = group.items[2];
    item.querySelector('summary').click();
    await new Promise((resolve) => setTimeout(resolve, 600));

    const panel = item.querySelector('.accordion__panel');
    const content = panel.querySelector('.accordion__content');

    return {
      panel: Math.round(panel.getBoundingClientRect().height),
      content: Math.round(content.getBoundingClientRect().height),
      actions: Math.round(content.querySelector('.accordion__actions').getBoundingClientRect().bottom),
      panelBottom: Math.round(panel.getBoundingClientRect().bottom),
    };
  });

  expect(opened.panel).toBe(opened.content);
  expect(opened.actions).toBeLessThanOrEqual(opened.panelBottom);
});

function measureSummaryContrast(page) {
  return page.evaluate(() => {
    const channels = (value) => {
      const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return value.startsWith('color(')
        ? numbers.slice(0, 3).map((n) => n * 255)
        : numbers.slice(0, 3);
    };
    const luminance = (rgb) => {
      const [r, g, b] = rgb.map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
    };

    const summary = document.querySelector('.accordion__summary');
    const background = channels(getComputedStyle(summary).backgroundColor);

    return {
      title: ratio(channels(getComputedStyle(summary.querySelector('.accordion__title')).color), background),
      marker: ratio(channels(getComputedStyle(summary.querySelector('.accordion__marker')).color), background),
      body: ratio(
        channels(getComputedStyle(document.querySelector('.accordion__content')).color),
        channels(getComputedStyle(document.querySelector('.accordion__panel')).backgroundColor).length
          ? channels(getComputedStyle(document.querySelector('ui-accordion')).backgroundColor)
          : [0, 0, 0],
      ),
    };
  });
}

// Both themes, because every colour is a light-dark() pair and the browser picks the half
// from the colour scheme. Measuring only the default would leave one palette unchecked.
for (const colorScheme of ['light', 'dark']) {
  test(`the summary and its title clear the contrast the rules ask for in the ${colorScheme} theme`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 960, height: 720 });
    await ready(page, 'default');

    const contrast = await measureSummaryContrast(page);

    expect(contrast.title, `title in ${colorScheme}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast.body, `body in ${colorScheme}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast.marker, `marker in ${colorScheme}`).toBeGreaterThanOrEqual(3);
  });
}

test('reduced motion removes the movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  expect(
    await page.evaluate(
      () => getComputedStyle(document.querySelector('.accordion__panel')).transitionDuration,
    ),
  ).toBe('0s');

  // And the element skips its own two steps, so the panel arrives at once rather than
  // travelling instantly and leaving an inline height behind.
  const jumped = await page.evaluate(async () => {
    const group = document.querySelector('ui-accordion');
    const item = group.items[1];
    const panel = item.querySelector('.accordion__panel');
    item.querySelector('summary').click();

    const samples = [];
    for (let frame = 0; frame < 5; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      samples.push(+panel.getBoundingClientRect().height.toFixed(1));
    }

    return { samples, inline: panel.style.blockSize, open: item.open };
  });

  expect(jumped.open).toBe(true);
  expect(jumped.inline).toBe('');
  expect(new Set(jumped.samples).size).toBe(1);
});
