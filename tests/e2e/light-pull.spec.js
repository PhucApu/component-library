import { expect, test } from '@playwright/test';

const VARIANTS = ['default', 'physics', 'switching', 'sizes', 'states'];

function variantUrl(variant) {
  return `/components/light-pull/source/variants/${variant}/index.html`;
}

function pullState(page, index = 0) {
  return page.evaluate((position) => {
    const pull = document.querySelectorAll('ui-light-pull')[position];
    const handle = pull.querySelector('.light-pull__handle');
    const box = handle.getBoundingClientRect();

    return {
      on: pull.on,
      attribute: pull.hasAttribute('on'),
      swinging: pull.swinging,
      checked: handle.getAttribute('aria-checked'),
      role: handle.getAttribute('role'),
      handle: { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) },
    };
  }, index);
}

/** Drags with real time between the moves, because a shove has to have a speed. */
async function drag(page, from, moves, { pause = 16 } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();

  for (const move of moves) {
    await page.mouse.move(move.x, move.y);
    await page.waitForTimeout(pause);
  }

  await page.mouse.up();
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

      await expect(page.locator('ui-light-pull').first()).toHaveAttribute('data-enhanced', '');
      await expect(page.locator('.light-pull__line').first()).toHaveAttribute('d', /^M /);

      // Every cord has somewhere to hang, and hangs there. A path that reads correctly in
      // a box with no height is a cord nobody can see.
      const hung = await page.evaluate(() =>
        [...document.querySelectorAll('ui-light-pull')].map((pull) => {
          const field = pull.querySelector('.light-pull__field').getBoundingClientRect();
          const handle = pull.querySelector('.light-pull__handle').getBoundingClientRect();
          const middle = handle.top + handle.height / 2;

          return {
            height: Math.round(field.height),
            length: pull.length,
            inside: middle >= field.top - 2 && middle <= field.bottom + 2,
          };
        }),
      );

      hung.forEach((cord, index) => {
        expect(cord.height, `${variant} cord ${index} at ${width}px has a box`).toBeGreaterThan(
          cord.length,
        );
        expect(cord.inside, `${variant} cord ${index} at ${width}px hangs inside it`).toBe(true);
      });

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflows, `${variant} at ${width}px`).toBe(false);
    }
  }

  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('a cord hanging still asks for no frames', async ({ page }) => {
  await page.goto(variantUrl('default'));
  expect(await pullState(page)).toMatchObject({ swinging: false, on: false });

  // The claim is not that the loop is cheap while nothing moves; it is that there is no loop.
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

test('pulling past the catch works the switch, and a short tug does not', async ({ page }) => {
  await page.goto(variantUrl('default'));
  const start = (await pullState(page)).handle;

  await drag(
    page,
    start,
    Array.from({ length: 8 }, (unused, step) => ({ x: start.x, y: start.y + (step + 1) * 12 })),
  );
  await expect.poll(async () => (await pullState(page)).on).toBe(true);
  await expect(page.locator('.light-pull-demo__room')).toHaveAttribute('data-lit', '');

  // Let it settle before measuring from the handle again.
  await expect.poll(async () => (await pullState(page)).swinging, { timeout: 25000 }).toBe(false);

  const rest = (await pullState(page)).handle;
  await drag(
    page,
    rest,
    Array.from({ length: 4 }, (unused, step) => ({ x: rest.x, y: rest.y + (step + 1) * 5 })),
  );
  await page.waitForTimeout(400);
  expect(await pullState(page)).toMatchObject({ on: true });
});

test('let go after a sideways pull and the cord swings, then stops by itself', async ({
  page,
}) => {
  await page.goto(variantUrl('default'));
  const start = (await pullState(page)).handle;

  await drag(
    page,
    start,
    Array.from({ length: 10 }, (unused, step) => ({
      x: start.x - (step + 1) * 12,
      y: start.y + (step + 1) * 2,
    })),
  );

  const first = (await pullState(page)).handle;
  await page.waitForTimeout(180);
  const second = (await pullState(page)).handle;

  // It is still moving after the hand has gone.
  expect(Math.abs(second.x - first.x)).toBeGreaterThan(2);

  // And it stops on its own rather than swinging for ever.
  await expect.poll(async () => (await pullState(page)).swinging, { timeout: 25000 }).toBe(false);

  // Near enough under the nail to read as hanging: the last of the swing is a drift of a
  // few pixels, not a return to a saved position.
  const settled = (await pullState(page)).handle;
  expect(Math.abs(settled.x - start.x)).toBeLessThan(14);
});

test('taking hold half way up leaves the cord below the hand hanging free', async ({ page }) => {
  await page.goto(variantUrl('default'));
  const handle = (await pullState(page)).handle;
  const middle = { x: handle.x, y: Math.round(handle.y - 90) };

  await page.mouse.move(middle.x, middle.y);
  await page.mouse.down();

  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(middle.x + step * 9, middle.y);
    await page.waitForTimeout(16);
  }

  const held = await page.evaluate(() => {
    const pull = document.querySelector('ui-light-pull');
    return { held: pull._held?.index ?? null, joints: pull._points.length, last: pull._points.at(-1) };
  });

  await page.mouse.up();

  // The joint under the hand is not the handle, and the handle has fallen away below it.
  expect(held.held).toBeGreaterThan(0);
  expect(held.held).toBeLessThan(held.joints - 1);
});

test('the handle is a switch that works from the keyboard', async ({ page }) => {
  await page.goto(variantUrl('states'));
  const keyboard = page.locator('ui-light-pull').nth(1).locator('.light-pull__handle');

  await expect(keyboard).toHaveAttribute('role', 'switch');
  await expect(keyboard).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.light-pull__cord').first()).toHaveAttribute('aria-hidden', 'true');

  await keyboard.focus();
  await page.keyboard.press(' ');

  await expect(keyboard).toHaveAttribute('aria-checked', 'true');
  expect(await pullState(page, 1)).toMatchObject({ on: true, attribute: true });
});

test('a page can set the switch, and hears about every change', async ({ page }) => {
  await page.goto(variantUrl('switching'));

  const heard = await page.evaluate(async () => {
    const pull = document.querySelector('ui-light-pull');
    const seen = [];
    document.addEventListener('light-pull-change', (event) => seen.push(event.detail.on));

    pull.on = true;
    pull.on = false;
    pull.toggle();

    return seen;
  });

  expect(heard).toEqual([true, false, true]);
  // The room is lit by the page listening, not by the component reaching out.
  await expect(page.locator('.light-pull-demo__room')).toHaveAttribute('data-lit', '');
});

test('a cord opened on lights nothing until it is asked to', async ({ page }) => {
  await page.goto(variantUrl('states'));

  expect(await pullState(page)).toMatchObject({ on: true, checked: 'true' });
  await expect(page.locator('.light-pull-demo__room')).toHaveAttribute('data-lit', '');
});

test('reduced motion works the switch and leaves the cord where it hangs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(variantUrl('default'));

  const start = (await pullState(page)).handle;
  await page.locator('.light-pull__handle').press(' ');

  expect(await pullState(page)).toMatchObject({ on: true, swinging: false });
  expect((await pullState(page)).handle).toEqual(start);
});
