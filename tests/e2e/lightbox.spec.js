import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/lightbox/source/variants';
const VARIANTS = ['default', 'zoom', 'navigation', 'captions', 'aspect', 'single'];

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
  await page.waitForFunction(() => customElements.get('ui-lightbox'));
}

async function openAt(page, index = 0) {
  await page.locator('.lightbox__item').nth(index).click();
  await expect(page.locator('.lightbox__panel')).toBeVisible();
  await page.waitForTimeout(350);
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
    for (const width of [1000, 360]) {
      await page.setViewportSize({ width, height: 720 });
      await ready(page, variant);

      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('.lightbox__item').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('the viewer opens on the picture that was pressed', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'default');
  await openAt(page, 2);

  const state = await page.evaluate(() => {
    const host = document.querySelector('ui-lightbox');
    return {
      index: host.index,
      modal: host.querySelector('.lightbox__panel').matches(':modal'),
      counter: host.querySelector('.lightbox__counter').textContent,
      status: host.querySelector('[role="status"]').textContent,
      active: host.querySelector('.lightbox__thumb[data-active]')?.dataset.index,
    };
  });

  expect(state).toEqual({
    index: 2,
    modal: true,
    counter: '3 of 6',
    status: '3 of 6: Rolling desert dunes under a high midday sun',
    active: '2',
  });
});

test('focus cannot leave the viewer and comes back to the picture pressed', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'default');
  await openAt(page, 0);

  for (let index = 0; index < 14; index += 1) {
    await page.keyboard.press('Tab');
  }

  expect(
    await page.evaluate(() =>
      document.querySelector('.lightbox__panel').contains(document.activeElement),
    ),
  ).toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.locator('.lightbox__panel')).toBeHidden();

  // The dialog hands focus back to whatever it took it from, which is not necessarily the
  // picture that was pressed.
  expect(await page.evaluate(() => document.activeElement.getAttribute('href'))).toBe(
    '../../assets/harbour-sunrise.svg',
  );
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
});

test('opening lands focus on a control that is actually available', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'default');
  await openAt(page, 0);

  // `showModal()` lands on the first focusable control, which at life size is the shrink
  // button — and rendering immediately turns that button off. A disabled element cannot
  // hold focus, so it falls to the body and every key stops working.
  const landed = await page.evaluate(() => ({
    inside: document.querySelector('.lightbox__panel').contains(document.activeElement),
    disabled: document.activeElement.disabled ?? null,
    name: document.activeElement.getAttribute('aria-label'),
  }));

  expect(landed).toEqual({ inside: true, disabled: false, name: 'Close viewer' });

  // Which is what makes the keyboard work at all from the moment it opens.
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => document.querySelector('ui-lightbox').index)).toBe(1);
});

test('the wheel magnifies the picture and leaves the page where it was', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'zoom');
  await openAt(page, 0);

  // Watching `scrollY` alone would prove nothing: the page is already held still while the
  // viewer is open, so it cannot move whichever way the listener was registered. What the
  // claim is really about is the gesture being cancelled, so that is what this reads.
  await page.evaluate(() => {
    window.__wheel = [];
    document.addEventListener(
      'wheel',
      (event) => window.__wheel.push(event.defaultPrevented),
      { passive: true },
    );
  });

  await page.locator('.lightbox__frame').hover();
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(250);

  const after = await page.evaluate(() => ({
    scale: document.querySelector('ui-lightbox').scale,
    scrollY: window.scrollY,
    cancelled: window.__wheel,
  }));

  expect(after.scale).toBeGreaterThan(1);
  expect(after.scrollY).toBe(0);
  // A passive listener cannot cancel anything, and would leave this false.
  expect(after.cancelled).toContain(true);
});

test('the point under the pointer stays under the pointer', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'default');
  await openAt(page, 0);

  const measured = await page.evaluate(async () => {
    const host = document.querySelector('ui-lightbox');
    const frame = host.querySelector('.lightbox__frame');
    const image = host.querySelector('.lightbox__image');

    host.resetZoom();
    // Settle before reading, or the previous transition is caught mid-flight and reports
    // a drift that is not there.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const rect = frame.getBoundingClientRect();
    const pointer = { x: 120, y: -60 };
    const screen = {
      x: rect.left + rect.width / 2 + pointer.x,
      y: rect.top + rect.height / 2 + pointer.y,
    };
    const where = () => {
      const box = image.getBoundingClientRect();
      return {
        u: +((screen.x - box.left) / box.width).toFixed(3),
        v: +((screen.y - box.top) / box.height).toFixed(3),
      };
    };

    const before = where();
    host.setZoom(2.5, pointer);
    await new Promise((resolve) => setTimeout(resolve, 300));

    return { before, after: where(), applied: getComputedStyle(image).translate };
  });

  expect(measured.after).toEqual(measured.before);
  // What the rule predicts: 120 - 120 * 2.5, and -60 + 60 * 2.5.
  expect(measured.applied).toBe('-180px 90px');
});

test('arrows change picture at rest and drag once magnified', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'default');
  await openAt(page, 0);

  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => document.querySelector('ui-lightbox').index)).toBe(1);

  await page.evaluate(() => document.querySelector('ui-lightbox').setZoom(3));
  await page.waitForTimeout(250);

  const before = await page.evaluate(() => getComputedStyle(document.querySelector('.lightbox__image')).translate);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => ({
    translate: getComputedStyle(document.querySelector('.lightbox__image')).translate,
    index: document.querySelector('ui-lightbox').index,
  }));

  // Magnifying is what switches the mode, so the picture must not change here.
  expect(after.index).toBe(1);
  expect(after.translate).not.toBe(before);
});

test('the strip arrows move the strip and never the picture', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'navigation');
  await openAt(page, 0);

  const strip = () =>
    page.evaluate(() => {
      const thumbs = document.querySelector('.lightbox__thumbs');
      return {
        left: Math.round(thumbs.scrollLeft),
        overflows: thumbs.scrollWidth > thumbs.clientWidth,
        index: document.querySelector('ui-lightbox').index,
        prevOff: document.querySelector('[data-action="strip-prev"]').disabled,
        nextOff: document.querySelector('[data-action="strip-next"]').disabled,
      };
    });

  const start = await strip();
  expect(start).toMatchObject({ left: 0, overflows: true, index: 0, prevOff: true, nextOff: false });

  await page.locator('[data-action="strip-next"]').click();
  await page.waitForTimeout(600);

  const moved = await strip();
  expect(moved.left).toBeGreaterThan(0);
  expect(moved.index).toBe(0);
  expect(moved.prevOff).toBe(false);
});

test('the strip brings the current thumbnail back into view', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'navigation');
  await openAt(page, 0);

  // A mark showing where you are is no use if nobody can see it.
  await page.evaluate(() => document.querySelector('ui-lightbox').goTo(13));
  await page.waitForTimeout(300);

  const visible = await page.evaluate(() => {
    const thumbs = document.querySelector('.lightbox__thumbs');
    const active = thumbs.querySelector('[data-active]');
    const strip = thumbs.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    return box.left >= strip.left - 1 && box.right <= strip.right + 1;
  });

  expect(visible).toBe(true);
});

test('a thumbnail changes the picture', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'default');
  await openAt(page, 0);

  await page.locator('.lightbox__thumb').nth(4).click();
  await page.waitForTimeout(200);

  expect(
    await page.evaluate(() => ({
      index: document.querySelector('ui-lightbox').index,
      counter: document.querySelector('.lightbox__counter').textContent,
    })),
  ).toEqual({ index: 4, counter: '5 of 6' });
});

test('the ends are real ends unless the set loops', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });

  await ready(page, 'default');
  await openAt(page, 0);
  await expect(page.locator('[data-action="previous"]')).toBeDisabled();

  await ready(page, 'navigation');
  await openAt(page, 0);
  await expect(page.locator('[data-action="previous"]')).toBeEnabled();

  await page.locator('[data-action="previous"]').click();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.querySelector('ui-lightbox').index)).toBe(13);
});

test('the picture is fitted whole rather than clipped, at any shape', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'aspect');

  for (const index of [0, 1, 2]) {
    await openAt(page, index);

    const fits = await page.evaluate(() => {
      const frame = document.querySelector('.lightbox__frame').getBoundingClientRect();
      const image = document.querySelector('.lightbox__image').getBoundingClientRect();
      return {
        width: image.width <= frame.width + 1,
        height: image.height <= frame.height + 1,
      };
    });

    expect(fits, `picture ${index}`).toEqual({ width: true, height: true });

    await page.keyboard.press('Escape');
    await expect(page.locator('.lightbox__panel')).toBeHidden();
  }
});

test('one picture leaves no arrows and no strip', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'single');
  await openAt(page, 0);

  // Controls that could never do anything are furniture, and they take tab stops with them.
  await expect(page.locator('[data-action="previous"]')).toBeHidden();
  await expect(page.locator('[data-action="next"]')).toBeHidden();
  await expect(page.locator('.lightbox__strip')).toBeHidden();

  // Magnifying is about this picture rather than about the set, so it still works.
  await page.locator('[data-action="zoom-in"]').click();
  expect(await page.evaluate(() => document.querySelector('ui-lightbox').scale)).toBeGreaterThan(1);
});

test('a caption sits beside the alternative text rather than replacing it', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'captions');
  await openAt(page, 0);

  await expect(page.locator('.lightbox__caption')).toHaveText(
    'Bergsee Pass, 2,140 m. Shot at first light in early June.',
  );
  await expect(page.locator('.lightbox__image')).toHaveAttribute(
    'alt',
    'A glacier pass between two snow-streaked peaks',
  );

  // The third picture carries no caption, so nothing is shown for it.
  await page.evaluate(() => document.querySelector('ui-lightbox').goTo(2));
  await expect(page.locator('.lightbox__caption')).toBeHidden();
});

test('a press on the backdrop closes and one on the picture does not', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'default');
  await openAt(page, 0);

  const geometry = await page.evaluate(() => {
    const frame = document.querySelector('.lightbox__frame').getBoundingClientRect();
    const host = document.querySelector('ui-lightbox');
    const image = document.querySelector('.lightbox__image');
    const fit = Math.min(frame.width / image.naturalWidth, frame.height / image.naturalHeight);
    void host;
    return {
      centre: { x: frame.left + frame.width / 2, y: frame.top + frame.height / 2 },
      drawn: { width: image.naturalWidth * fit, height: image.naturalHeight * fit },
      frame: { width: frame.width, height: frame.height },
    };
  });

  // On the picture itself: nothing happens.
  await page.mouse.click(geometry.centre.x, geometry.centre.y);
  await page.waitForTimeout(200);
  await expect(page.locator('.lightbox__panel')).toBeVisible();

  // On the dark surround beside it. The element fills the frame, so this press still
  // arrives on the image and only the drawn rectangle tells them apart.
  const beside = geometry.centre.x + geometry.drawn.width / 2 + 20;
  expect(beside).toBeLessThan(geometry.centre.x + geometry.frame.width / 2);

  await page.mouse.click(beside, geometry.centre.y);
  await page.waitForTimeout(250);
  await expect(page.locator('.lightbox__panel')).toBeHidden();
});

test('the gallery still works with scripting disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1000, height: 720 });
  await page.goto(`${COMPONENT_BASE}/default/index.html`);

  // Links to the full pictures, which is the fallback worth keeping.
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('.lightbox__item')].map((item) => ({
      tag: item.tagName,
      href: item.getAttribute('href'),
      alt: item.querySelector('img')?.getAttribute('alt'),
    })),
  );

  expect(links).toHaveLength(6);
  expect(links[0]).toEqual({
    tag: 'A',
    href: '../../assets/harbour-sunrise.svg',
    alt: 'Sunrise over a quiet harbour, two moored boats in silhouette',
  });

  // And no viewer is left lying visible over the page.
  expect(await page.locator('.lightbox__panel').count()).toBe(0);

  await context.close();
});

test('reduced motion removes the movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'default');
  await openAt(page, 0);

  const motion = await page.evaluate(() => ({
    panel: getComputedStyle(document.querySelector('.lightbox__panel')).transitionDuration,
    image: getComputedStyle(document.querySelector('.lightbox__image')).transitionDuration,
  }));

  expect(motion.panel).toBe('0s');
  expect(motion.image).toBe('0s');
});
