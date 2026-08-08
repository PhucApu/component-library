import { expect, test } from '@playwright/test';

const VARIANTS = ['default', 'content', 'drag', 'pace', 'states'];

function variantUrl(variant) {
  return `/components/flip-book/source/variants/${variant}/index.html`;
}

function bookState(page, index = 0) {
  return page.evaluate((position) => {
    const book = document.querySelectorAll('ui-flip-book')[position];
    return {
      page: book.page,
      pages: book.pages,
      leaves: book.leaves,
      turned: book.turned,
      attribute: book.getAttribute('page'),
    };
  }, index);
}

/**
 * Drags across the spread with real time between the moves.
 *
 * A synthetic drag with no time in it looks like an infinitely fast flick, and a flick
 * commits a turn however short it is — so a test for the short drag that falls back has to
 * take long enough to be a slow one.
 */
async function dragBy(page, box, share, { steps = 8, pause = 26 } = {}) {
  const y = box.y + box.height / 2;
  const from = box.x + box.width * 0.88;

  await page.mouse.move(from, y);
  await page.mouse.down();

  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(from + (box.width * share * step) / steps, y);
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

      await expect(page.locator('ui-flip-book').first()).toHaveAttribute('data-enhanced', '');
      await expect(page.locator('.flip-book__leaf').first()).toBeVisible();

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflows, `${variant} at ${width}px`).toBe(false);
    }
  }

  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('the book opens closed, with every leaf on the right and none of them turned', async ({
  page,
}) => {
  await page.goto(variantUrl('default'));

  expect(await bookState(page)).toMatchObject({ page: 1, pages: 8, leaves: 4, turned: 0 });

  const angles = await page.evaluate(() =>
    [...document.querySelectorAll('.flip-book__leaf')].map((leaf) =>
      getComputedStyle(leaf).getPropertyValue('--flip-angle').trim(),
    ),
  );
  expect(angles).toEqual(['0deg', '0deg', '0deg', '0deg']);

  // The pile has a thickness: each leaf below the top one is offset a little further.
  const offsets = await page.evaluate(() =>
    [...document.querySelectorAll('.flip-book__leaf')].map((leaf) =>
      Number.parseFloat(getComputedStyle(leaf).getPropertyValue('--flip-offset')),
    ),
  );
  expect(offsets[1]).toBeGreaterThan(offsets[0]);
  expect(offsets[3]).toBeGreaterThan(offsets[1]);

  // Nothing is announced for a book nobody has touched yet.
  await expect(page.locator('.flip-book__status')).toHaveText('');
});

test('an arrow turns one leaf, and a leaf carries two pages', async ({ page }) => {
  await page.goto(variantUrl('default'));

  await page.locator('.flip-book__arrow--next').click();
  await expect.poll(async () => (await bookState(page)).turned).toBe(1);

  // One turn moves on by two pages, because the leaf that turned carried both of them.
  const after = await bookState(page);
  expect(after.page).toBe(3);
  expect(after.attribute).toBe('3');
  await expect(page.locator('.flip-book__status')).toHaveText('Pages 2 and 3 of 8');

  await page.locator('.flip-book__arrow--previous').click();
  await expect.poll(async () => (await bookState(page)).page).toBe(1);
});

test('dragging past half way turns the page, and a short slow drag falls back', async ({
  page,
}) => {
  await page.goto(variantUrl('drag'));
  const box = await page.locator('.flip-book__spread').first().boundingBox();

  // The spread is two pages wide, so a third of it is well past half a page.
  await dragBy(page, box, -0.34);
  await expect.poll(async () => (await bookState(page)).turned).toBe(1);

  const held = await bookState(page);
  await dragBy(page, box, -0.06, { steps: 6, pause: 40 });
  await page.waitForTimeout(600);
  expect(await bookState(page)).toMatchObject({ page: held.page, turned: held.turned });
});

test('no-drag takes the gesture away and leaves the arrows', async ({ page }) => {
  await page.goto(variantUrl('drag'));
  const fixed = page.locator('ui-flip-book').nth(1);
  const box = await fixed.locator('.flip-book__spread').boundingBox();

  await dragBy(page, box, -0.4);
  await page.waitForTimeout(400);
  expect(await bookState(page, 1)).toMatchObject({ turned: 0 });

  await fixed.locator('.flip-book__arrow--next').click();
  await expect.poll(async () => (await bookState(page, 1)).turned).toBe(1);
});

test('the book and its two arrows are the only tab stops, and the keys turn it', async ({
  page,
}) => {
  await page.goto(variantUrl('default'));

  // The pages are not controls, so none of them is a tab stop of its own.
  await expect(page.locator('.flip-book__leaves [tabindex]')).toHaveCount(0);
  await expect(page.locator('.flip-book__stage')).toHaveAttribute('tabindex', '0');
  await expect(page.locator('.flip-book__stage button')).toHaveCount(2);

  await page.locator('.flip-book__stage').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await bookState(page)).page).toBe(3);

  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await bookState(page)).page).toBe(1);

  await page.keyboard.press('End');
  await expect.poll(async () => (await bookState(page)).page).toBe(8);

  await page.keyboard.press('Home');
  await expect.poll(async () => (await bookState(page)).page).toBe(1);
});

test('an end of the book is a real end', async ({ page }) => {
  await page.goto(variantUrl('states'));

  // One page is a leaf with a blank back: turning it would show nothing.
  const single = page.locator('ui-flip-book').first();
  await expect(single.locator('.flip-book__arrow--next')).toBeDisabled();
  await expect(single.locator('.flip-book__arrow--previous')).toBeDisabled();
  await expect(single.locator('.flip-book__face[data-blank]')).toHaveCount(1);

  // Two pages are one leaf, which can be turned exactly once.
  const pair = page.locator('ui-flip-book').nth(1);
  await expect(pair.locator('.flip-book__arrow--next')).toBeEnabled();
  await pair.locator('.flip-book__arrow--next').click();
  await expect.poll(async () => (await bookState(page, 1)).page).toBe(2);
  await expect(pair.locator('.flip-book__arrow--next')).toBeDisabled();
  await expect(pair.locator('.flip-book__arrow--previous')).toBeEnabled();
});

test('a page keeps its own link, and a drag across it does not follow it', async ({ page }) => {
  await page.goto(variantUrl('content'));

  // Pages are moved into the leaves, so the author's own elements are still there.
  const link = page.locator('.flip-book__leaf a').first();
  await expect(link).toHaveCount(1);

  const box = await page.locator('.flip-book__spread').boundingBox();
  const before = await bookState(page);

  await page.mouse.move(box.x + box.width * 0.86, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(700);

  expect((await bookState(page)).turned).toBeGreaterThan(before.turned);
  expect(page.url()).not.toContain('#a-link');
});

test('reduced motion turns the page without travelling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(variantUrl('default'));

  await page.locator('.flip-book__arrow--next').click();

  // No arc to wait for: the page has already changed on the next read.
  expect(await bookState(page)).toMatchObject({ page: 3, turned: 1 });
});

test('goTo opens the book at a page instead of riffling to it', async ({ page }) => {
  await page.goto(variantUrl('default'));

  await page.locator('[data-demo-action="last"]').click();
  expect(await bookState(page)).toMatchObject({ page: 8, turned: 4 });

  await page.locator('[data-demo-action="first"]').click();
  expect(await bookState(page)).toMatchObject({ page: 1, turned: 0 });
});
