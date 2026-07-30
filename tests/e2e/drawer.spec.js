import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/drawer/source/variants';
const VARIANTS = ['default', 'anchor', 'inline', 'responsive', 'scrolling', 'dismissal'];

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
  await page.waitForFunction(() => customElements.get('ui-drawer'));
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
      await expect(page.locator('ui-drawer').first()).toBeAttached();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('focus cannot leave an open modal panel', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  await page.locator('#menu-button').click();
  await expect(page.locator('.drawer__panel')).toBeVisible();

  // Far more presses than there are stops inside, so a leak would show.
  for (let index = 0; index < 14; index += 1) {
    await page.keyboard.press('Tab');
  }

  const inside = await page.evaluate(() =>
    document.querySelector('.drawer__panel').contains(document.activeElement),
  );
  expect(inside).toBe(true);
});

test('the page behind a modal panel cannot be scrolled', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 600 });
  await ready(page, 'scrolling');

  // showModal() puts the dialog in the top layer and leaves the document free to move.
  await page.locator('#long-button').click();
  await expect(page.locator('.drawer__panel')).toBeVisible();

  // A wheel gesture, not `window.scrollTo`. Programmatic scrolling works regardless of
  // `overflow: hidden`, so scripting the scroll would prove nothing at all.
  await page.mouse.move(900, 300);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(200);

  const locked = await page.evaluate(() => ({
    scrollY: Math.round(window.scrollY),
    overflow: document.documentElement.style.overflow,
  }));
  expect(locked.overflow).toBe('hidden');
  expect(locked.scrollY).toBe(0);

  await page.keyboard.press('Escape');
  await expect(page.locator('.drawer__panel')).toBeHidden();

  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(200);

  const released = await page.evaluate(() => ({
    scrollY: Math.round(window.scrollY),
    overflow: document.documentElement.style.overflow,
  }));
  expect(released.overflow).toBe('');
  expect(released.scrollY).toBeGreaterThan(0);
});

test('Escape closes and hands focus back to the trigger', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  await page.locator('#menu-button').click();
  await expect(page.locator('.drawer__panel')).toBeVisible();
  await expect(page.locator('#menu-button')).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(page.locator('.drawer__panel')).toBeHidden();
  await expect(page.locator('#menu-button')).toHaveAttribute('aria-expanded', 'false');

  // Closing the dialog properly is what returns focus; removing it would not.
  await expect(page.locator('#menu-button')).toBeFocused();
});

test('a press on the backdrop closes, a press inside does not', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  const panel = page.locator('.drawer__panel');

  await page.locator('#menu-button').click();
  await expect(panel).toBeVisible();
  // Wait for the slide to finish. Mid-entry the panel does not yet cover the point below,
  // so the press would land on the backdrop and the check would be testing the animation.
  await page.waitForTimeout(320);

  await page.mouse.click(120, 400);
  await page.waitForTimeout(300);
  await expect(panel).toBeVisible();

  // The backdrop is painted, not built, so this press lands on the dialog itself.
  await page.mouse.click(900, 400);
  await expect(panel).toBeHidden();
});

test('a panel that needs an answer ignores the backdrop but still answers Escape', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'dismissal');

  const panel = page.locator('#held .drawer__panel');
  await page.locator('#held-button').click();
  await expect(panel).toBeVisible();
  // Let the slide settle, so the press below is judged against where the panel rests
  // rather than against where it happened to be mid-animation.
  await page.waitForTimeout(320);

  await page.mouse.click(480, 80);
  await page.waitForTimeout(300);
  await expect(panel).toBeVisible();

  // Taking away every way out would trap someone who opened this by accident.
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('every way out reports its own reason', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'dismissal');

  await page.evaluate(() => {
    window.__reasons = [];
    document.addEventListener('drawer-close', (event) =>
      window.__reasons.push(event.detail.reason),
    );
  });

  const open = async () => {
    await page.locator('#free-button').click();
    await expect(page.locator('#free .drawer__panel')).toBeVisible();
  };

  await open();
  await page.keyboard.press('Escape');
  await expect(page.locator('#free .drawer__panel')).toBeHidden();

  await open();
  await page.mouse.click(300, 400);
  await expect(page.locator('#free .drawer__panel')).toBeHidden();

  await open();
  await page.locator('#free .drawer__close').click();
  await expect(page.locator('#free .drawer__panel')).toBeHidden();

  await open();
  await page.evaluate(() => document.querySelector('#free').close());
  await expect(page.locator('#free .drawer__panel')).toBeHidden();

  expect(await page.evaluate(() => window.__reasons)).toEqual([
    'escape',
    'backdrop',
    'close',
    'api',
  ]);
});

test('an inline panel is not a dialog and takes none of its behaviour', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'inline');

  const host = page.locator('ui-drawer');
  await expect(host).toHaveAttribute('data-mode', 'inline');

  const state = await page.evaluate(() => ({
    tag: document.querySelector('.drawer__panel').tagName,
    modal: document.querySelector('ui-drawer').modal,
    // A panel that interrupts nothing must not hold the page still.
    overflow: document.documentElement.style.overflow,
    focusMoved: document.activeElement.closest('.drawer__panel') !== null,
  }));

  expect(state).toEqual({ tag: 'NAV', modal: false, overflow: '', focusMoved: false });

  // Escape belongs to whatever else is open on the page.
  await page.keyboard.press('Escape');
  await expect(host).toHaveAttribute('open', '');
});

test('an inline panel gives its width back when closed', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'inline');
  await page.waitForTimeout(350);

  const width = () =>
    page.evaluate(() =>
      Math.round(document.querySelector('.drawer__panel').getBoundingClientRect().width),
    );

  expect(await width()).toBeGreaterThan(200);

  await page.locator('#inline-button').click();
  await page.waitForTimeout(350);
  expect(await width()).toBeLessThan(4);
});

test('a trigger owned by a drawer is not wired twice', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'inline');
  await page.waitForTimeout(350);

  // Two listeners on one button toggle twice per press, and the panel looks dead.
  const host = page.locator('ui-drawer');
  await expect(host).toHaveAttribute('open', '');

  await page.locator('#inline-button').click();
  await expect(host).not.toHaveAttribute('open', /.*/);

  await page.locator('#inline-button').click();
  await expect(host).toHaveAttribute('open', '');
});

test('each anchor comes from its own edge', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'anchor');

  const rest = async (id) => {
    await page.locator(`[data-drawer-open="${id}"]`).click();
    await expect(page.locator(`#${id} .drawer__panel`)).toBeVisible();
    await page.waitForTimeout(320);
    const box = await page.locator(`#${id} .drawer__panel`).boundingBox();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(320);
    return box;
  };

  const start = await rest('d-start');
  const end = await rest('d-end');
  const top = await rest('d-top');
  const bottom = await rest('d-bottom');

  expect(Math.round(start.x)).toBe(0);
  expect(Math.round(end.x + end.width)).toBe(960);
  expect(Math.round(top.y)).toBe(0);
  expect(Math.round(bottom.y + bottom.height)).toBe(720);
});

test('the panel body scrolls while its header stays put', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 600 });
  await ready(page, 'scrolling');

  await page.locator('#long-button').click();
  await expect(page.locator('.drawer__panel')).toBeVisible();
  await page.waitForTimeout(300);

  const measured = await page.evaluate(async () => {
    const header = document.querySelector('.drawer__header');
    const body = document.querySelector('.drawer__body');
    const before = header.getBoundingClientRect().top;

    body.scrollTop = 300;
    await new Promise((resolve) => requestAnimationFrame(resolve));

    return {
      scrolled: body.scrollTop,
      headerMoved: Math.abs(header.getBoundingClientRect().top - before),
    };
  });

  expect(measured.scrolled).toBeGreaterThan(0);
  expect(measured.headerMoved).toBeLessThan(2);
});

test('the panel is toned to the page around it', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  await page.locator('#menu-button').click();
  await expect(page.locator('.drawer__panel')).toBeVisible();

  // A modal panel is a sibling of the main content, not a child of it, so an override
  // scoped to the demo container never reaches it and the panel stays on its light
  // defaults — a white slab over a dark page.
  const measured = await page.evaluate(() => {
    const linear = (channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (colour) => {
      const [r, g, b] = colour.match(/[\d.]+/g).slice(0, 3).map(Number);
      return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    };
    const ratio = (a, b) => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (light + 0.05) / (dark + 0.05);
    };

    const panel = getComputedStyle(document.querySelector('.drawer__panel'));
    const card = getComputedStyle(document.querySelector('.drawer-demo__card'));

    return {
      panel: panel.backgroundColor,
      againstCard: ratio(panel.backgroundColor, card.backgroundColor),
      textOnPanel: ratio(panel.color, panel.backgroundColor),
    };
  });

  expect(measured.panel).not.toBe('rgb(255, 255, 255)');
  // Effectively the same tone as the surfaces beside it.
  expect(measured.againstCard).toBeLessThan(1.2);
  expect(measured.textOnPanel).toBeGreaterThanOrEqual(4.5);
});

test('reduced motion removes the slide', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  await page.locator('#menu-button').click();
  const panel = page.locator('.drawer__panel');
  await expect(panel).toBeVisible();

  expect(await panel.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe(
    '0s',
  );
});

test('the drawer slides in rather than appearing', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  // The opening reading is taken in the same task as show(). Waiting for a frame would let
  // a loaded machine deliver it after the slide had finished.
  const captured = await page.evaluate(async () => {
    const drawer = document.querySelector('ui-drawer');
    const panel = drawer.querySelector('.drawer__panel');
    const read = () => Math.round(panel.getBoundingClientRect().x);

    drawer.show();
    const first = read();

    await new Promise((resolve) => setTimeout(resolve, 500));
    return { first, last: read() };
  });

  // Anchored at the start edge, so it arrives from off-screen on that side.
  expect(captured.first).toBeLessThan(captured.last - 40);
  expect(captured.last).toBe(0);
});
