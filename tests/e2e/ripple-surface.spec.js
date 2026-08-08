import { expect, test } from '@playwright/test';

const VARIANTS = ['default', 'wake', 'drop', 'tuning', 'states'];

function variantUrl(variant) {
  return `/components/ripple-surface/source/variants/${variant}/index.html`;
}

function aliveCount(page, index = 0) {
  return page.evaluate(
    (position) => document.querySelectorAll('ui-ripple-surface')[position].count,
    index,
  );
}

/** Draws a path across a surface the way a pointer crossing it would. */
async function sweep(page, box, steps = 18) {
  await page.mouse.move(box.x + 24, box.y + box.height / 2);

  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(
      box.x + 24 + (step * (box.width - 48)) / steps,
      box.y + box.height / 2 + Math.sin(step / 3) * (box.height / 6),
    );
  }
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

      const surface = page.locator('ui-ripple-surface').first();
      await expect(surface).toHaveAttribute('data-enhanced', '');

      const canvas = surface.locator('canvas');
      await expect(canvas).toHaveAttribute('aria-hidden', 'true');
      await expect(canvas).toHaveCSS('pointer-events', 'none');

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflows, `${variant} at ${width}px`).toBe(false);
    }
  }

  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('a still surface draws nothing and asks for no frames', async ({ page }) => {
  await page.goto(variantUrl('default'));
  expect(await aliveCount(page)).toBe(0);

  // The claim is not that the loop is cheap while idle; it is that there is no loop. A
  // shimmering surface would ask for a frame on every page it was ever placed on.
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

test('crossing the surface leaves a wake that fades back to stillness', async ({ page }) => {
  await page.goto(variantUrl('default'));
  const box = await page.locator('ui-ripple-surface').boundingBox();

  await sweep(page, box);
  expect(await aliveCount(page)).toBeGreaterThan(3);

  await page.mouse.move(4, 4);
  // Every mark dies on its own, and the loop stops with the last of them.
  await expect.poll(() => aliveCount(page), { timeout: 4000 }).toBe(0);
});

test('the wake meets in a point at the pointer and opens out behind it', async ({ page }) => {
  await page.goto(variantUrl('wake'));
  const box = await page.locator('ui-ripple-surface').first().boundingBox();
  const y = box.y + box.height / 2;

  // A straight run, so the shape under test is the V and not the path.
  await page.mouse.move(box.x + 30, y);
  for (let step = 1; step <= 24; step += 1) {
    await page.mouse.move(box.x + 30 + step * 22, y);
  }

  // Measured off the canvas itself: how tall the painted band is at two distances behind
  // the pointer. A wake is narrow at the prow and wider further back; a row of stamped
  // marks would be the same height all the way along.
  const spread = await page.evaluate((headX) => {
    const canvas = document.querySelector('.ripple-surface__canvas');
    const surface = canvas.closest('ui-ripple-surface').getBoundingClientRect();
    const ratio = canvas.width / surface.width;
    const context = canvas.getContext('2d');

    const bandAt = (cssX) => {
      const column = Math.round(cssX * ratio);
      const pixels = context.getImageData(column, 0, 1, canvas.height).data;
      let top = -1;
      let bottom = -1;

      for (let row = 0; row < canvas.height; row += 1) {
        if (pixels[row * 4 + 3] > 6) {
          top = top === -1 ? row : top;
          bottom = row;
        }
      }

      return top === -1 ? 0 : (bottom - top) / ratio;
    };

    return {
      ahead: bandAt(headX + 8),
      near: bandAt(headX - 24),
      far: bandAt(headX - 220),
    };
  }, box.x + 30 + 24 * 22 - box.x);

  // Nothing is drawn in front of the pointer: the sides arrive at the same place there,
  // which is the point of the wake.
  expect(spread.ahead).toBe(0);
  expect(spread.near).toBeGreaterThan(0);
  expect(spread.far).toBeGreaterThan(spread.near * 2);
});

test('a press sends out one set of rings and nothing else', async ({ page }) => {
  await page.goto(variantUrl('drop'));
  const surface = page.locator('ui-ripple-surface').first();
  const box = await surface.boundingBox();

  // The wake is off in this variant, so what is alive came from the press alone.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  expect(await aliveCount(page)).toBe(0);

  await page.mouse.down();
  await page.mouse.up();
  expect(await aliveCount(page)).toBe(3);

  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.up();
  // Sets overlap rather than replacing one another.
  expect(await aliveCount(page)).toBe(6);

  await surface.evaluate((element) => element.clear());
  expect(await aliveCount(page)).toBe(0);

  await surface.evaluate((element) => element.drop(20, 20));
  expect(await aliveCount(page)).toBe(3);
});

test('no-wake and no-drop each take one half away and leave the other', async ({ page }) => {
  await page.goto(variantUrl('wake'));
  const surface = page.locator('ui-ripple-surface').first();
  const box = await surface.boundingBox();

  // Arriving on the surface is already a crossing, so the first mark is the wake's own.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const beforePress = await aliveCount(page);

  await page.mouse.down();
  await page.mouse.up();
  expect(await aliveCount(page)).toBe(beforePress);

  await sweep(page, box, 10);
  expect(await aliveCount(page)).toBeGreaterThan(beforePress);
});

test('the content under the surface keeps its own presses', async ({ page }) => {
  await page.goto(variantUrl('default'));
  const button = page.locator('[data-demo-count]');

  await button.click();
  await expect(button).toHaveText('Pressed 1 time, under the water');

  // And the press reached the water on its way past.
  expect(await aliveCount(page)).toBeGreaterThan(0);
});

test('the ripple cap holds however long the pointer is swept', async ({ page }) => {
  await page.goto(variantUrl('tuning'));

  const capped = page.locator('ui-ripple-surface').last();
  const box = await capped.boundingBox();

  for (let pass = 0; pass < 3; pass += 1) {
    await sweep(page, box, 30);
  }

  expect(await capped.evaluate((element) => element.count)).toBeLessThanOrEqual(8);
});

test('reduced motion leaves the water flat', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(variantUrl('default'));
  const box = await page.locator('ui-ripple-surface').boundingBox();

  await sweep(page, box, 12);
  await page.mouse.down();
  await page.mouse.up();

  // Not slower ripples: none. Spreading is the whole of what this component does.
  expect(await aliveCount(page)).toBe(0);
});

test('the canvas follows the box it covers, in device pixels', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(variantUrl('default'));

  const measure = () =>
    page.evaluate(() => {
      const surface = document.querySelector('ui-ripple-surface');
      const canvas = surface.querySelector('canvas');
      const box = surface.getBoundingClientRect();
      return {
        boxWidth: Math.round(box.width),
        pixels: canvas.width,
        ratio: Math.min(3, Math.max(1, window.devicePixelRatio || 1)),
      };
    });

  const wide = await measure();
  expect(wide.pixels).toBe(Math.round(wide.boxWidth * wide.ratio));

  await page.setViewportSize({ width: 700, height: 900 });
  await expect
    .poll(async () => {
      const narrow = await measure();
      return narrow.pixels === Math.round(narrow.boxWidth * narrow.ratio);
    })
    .toBe(true);

  const narrow = await measure();
  expect(narrow.boxWidth).toBeLessThan(wide.boxWidth);
});
