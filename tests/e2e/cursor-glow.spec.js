import { expect, test } from '@playwright/test';

const VARIANTS = ['default', 'content', 'grid', 'tuning', 'states'];

function variantUrl(variant) {
  return `/components/cursor-glow/source/variants/${variant}/index.html`;
}

function glowState(page, index = 0) {
  return page.evaluate((position) => {
    const region = document.querySelectorAll('ui-cursor-glow')[position];
    const light = region.querySelector('.cursor-glow__light');
    const styles = getComputedStyle(region);

    return {
      active: region.active,
      attribute: region.hasAttribute('data-active'),
      x: styles.getPropertyValue('--cursor-glow-x').trim(),
      y: styles.getPropertyValue('--cursor-glow-y').trim(),
      opacity: Number(getComputedStyle(light).opacity),
      events: getComputedStyle(light).pointerEvents,
      hidden: light.getAttribute('aria-hidden'),
    };
  }, index);
}

test('all five variants run independently without external requests or overflow', async ({
  page,
}) => {
  const external = [];
  const errors = [];

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== 'http://127.0.0.1:5173') {
      external.push(request.url());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));

  for (const variant of VARIANTS) {
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(variantUrl(variant));

      await expect(page.locator('ui-cursor-glow').first()).toHaveAttribute('data-enhanced', '');
      await expect(page.locator('.cursor-glow__light').first()).toHaveAttribute(
        'aria-hidden',
        'true',
      );

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflows, `${variant} at ${width}px`).toBe(false);
    }
  }

  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('the light is centred on the pointer, in the region own pixels', async ({ page }) => {
  await page.goto(variantUrl('default'));
  const box = await page.locator('ui-cursor-glow').boundingBox();

  await page.mouse.move(box.x + 120, box.y + 60);
  await expect.poll(async () => (await glowState(page)).x).toBe('120px');
  expect(await glowState(page)).toMatchObject({ y: '60px', active: true, attribute: true });

  await page.mouse.move(box.x + box.width - 40, box.y + box.height - 30);
  await expect
    .poll(async () => (await glowState(page)).x)
    .toBe(`${Math.round((box.width - 40) * 100) / 100}px`);
});

test('it comes up on arrival and goes out where the pointer left', async ({ page }) => {
  await page.goto(variantUrl('default'));
  expect(await glowState(page)).toMatchObject({ active: false, opacity: 0 });

  const box = await page.locator('ui-cursor-glow').boundingBox();
  await page.mouse.move(box.x + 100, box.y + 80);
  await expect.poll(async () => (await glowState(page)).opacity).toBeGreaterThan(0.9);

  await page.mouse.move(4, 4);
  await expect.poll(async () => (await glowState(page)).opacity).toBe(0);

  // The position stays put, so it fades out where it stood rather than leaving by a corner.
  expect(await glowState(page)).toMatchObject({ x: '100px', y: '80px', active: false });
});

test('a still pointer costs no animation frames', async ({ page }) => {
  await page.goto(variantUrl('default'));
  const box = await page.locator('ui-cursor-glow').boundingBox();
  await page.mouse.move(box.x + 100, box.y + 80);
  await page.waitForTimeout(120);

  const idleFrames = await page.evaluate(async () => {
    let frames = 0;
    const original = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      frames += 1;
      return original.call(window, callback);
    };
    await new Promise((resolve) => {
      setTimeout(resolve, 400);
    });
    window.requestAnimationFrame = original;
    return frames;
  });

  expect(idleFrames).toBe(0);
});

test('the light is not a lid: everything under it still works', async ({ page }) => {
  await page.goto(variantUrl('content'));

  expect(await glowState(page)).toMatchObject({ events: 'none', hidden: 'true' });

  const button = page.locator('[data-demo-count]');
  await button.click();
  await expect(button).toHaveText('Pressed 1 time, under the light');

  // And the press reached the region on its way past, so the light is live over it.
  expect(await glowState(page)).toMatchObject({ active: true });

  const selected = await page.evaluate(() => {
    const paragraph = document.querySelector('.glow-demo__reading p');
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString().length;
  });

  expect(selected).toBeGreaterThan(20);
});

test('a finger lights nothing', async ({ page }) => {
  await page.goto(variantUrl('default'));
  const box = await page.locator('ui-cursor-glow').boundingBox();

  // A touch screen has no hover, so a glow left under a finger would be a smudge.
  await page.evaluate(
    ({ x, y }) => {
      const region = document.querySelector('ui-cursor-glow');
      ['pointerenter', 'pointermove'].forEach((type) => {
        region.dispatchEvent(
          new PointerEvent(type, { pointerType: 'touch', clientX: x, clientY: y, bubbles: true }),
        );
      });
    },
    { x: box.x + 90, y: box.y + 70 },
  );

  await page.waitForTimeout(120);
  expect(await glowState(page)).toMatchObject({ active: false, opacity: 0, x: '50%' });
});

test('in a grid, only the region under the pointer is lit', async ({ page }) => {
  await page.goto(variantUrl('grid'));
  const first = await page.locator('ui-cursor-glow').first().boundingBox();
  const second = await page.locator('ui-cursor-glow').nth(1).boundingBox();

  await page.mouse.move(first.x + 40, first.y + 40);
  await expect.poll(async () => (await glowState(page, 0)).active).toBe(true);
  expect(await glowState(page, 1)).toMatchObject({ active: false });

  await page.mouse.move(second.x + 40, second.y + 40);
  await expect.poll(async () => (await glowState(page, 1)).active).toBe(true);
  expect(await glowState(page, 0)).toMatchObject({ active: false });
});

test('the position is measured rather than remembered, so scrolling cannot leave it behind', async ({
  page,
}) => {
  await page.goto(variantUrl('states'));
  const scroller = page.locator('.glow-demo__scroller');
  const region = page.locator('.glow-demo__scroller ui-cursor-glow');
  const index = await page.evaluate(() => {
    const regions = [...document.querySelectorAll('ui-cursor-glow')];
    return regions.indexOf(document.querySelector('.glow-demo__scroller ui-cursor-glow'));
  });

  const before = await region.boundingBox();
  await page.mouse.move(before.x + 60, before.y + 60);
  await expect.poll(async () => (await glowState(page, index)).y).toBe('60px');

  await scroller.evaluate((box) => {
    box.scrollTop = 80;
  });

  const after = await region.boundingBox();
  await page.mouse.move(after.x + 60, after.y + 60);
  // Sixty pixels down the region as it now stands, not sixty from where it used to be.
  await expect.poll(async () => (await glowState(page, index)).y).toBe('60px');
});

test('reduced motion keeps the light and removes the fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(variantUrl('default'));
  const box = await page.locator('ui-cursor-glow').boundingBox();

  await page.mouse.move(box.x + 90, box.y + 70);
  await expect.poll(async () => (await glowState(page)).x).toBe('90px');

  // No transition to wait through: it is simply on.
  expect(await glowState(page)).toMatchObject({ opacity: 1 });

  const transition = await page
    .locator('.cursor-glow__light')
    .evaluate((light) => getComputedStyle(light).transitionDuration);
  expect(transition).toBe('0s');
});
