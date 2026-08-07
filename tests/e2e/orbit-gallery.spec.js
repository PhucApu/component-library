import { expect, test } from '@playwright/test';

const VARIANTS = ['default', 'density', 'drag', 'speed', 'states'];

function variantUrl(variant) {
  return `/components/orbit-gallery/source/variants/${variant}/index.html`;
}

/**
 * The ring is never still, so every pointer action here is driven through the mouse at a
 * measured point rather than through a locator. Playwright waits for an element to hold a
 * stable box before it will click or hover it, and a drifting ring never offers one.
 */
async function stageCentre(page, index = 0) {
  const box = await page.locator('.orbit__stage').nth(index).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function ringAngle(page, index = 0) {
  return page.evaluate(
    (position) =>
      Number.parseFloat(
        getComputedStyle(document.querySelectorAll('.orbit__ring')[position]).getPropertyValue(
          '--orbit-angle',
        ),
      ),
    index,
  );
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

      const gallery = page.locator('ui-orbit-gallery').first();
      await expect(gallery).toHaveAttribute('data-enhanced', '');
      await expect(page.locator('.orbit__ring').first()).toBeVisible();

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflows, `${variant} at ${width}px`).toBe(false);
    }
  }

  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('the ring drifts, stops where it stands under the pointer, and carries on from there', async ({
  page,
}) => {
  await page.goto(variantUrl('default'));

  const first = await ringAngle(page);
  await expect.poll(() => ringAngle(page)).not.toBe(first);

  // A drifting ring singles nothing out, however many pictures pass the front.
  await expect(page.locator('.orbit__ring.is-centred')).toHaveCount(0);

  const centre = await stageCentre(page);
  await page.mouse.move(centre.x, centre.y);
  await page.waitForTimeout(200);
  const stopped = await ringAngle(page);

  // Stopped where it stood: no snapping to the nearest picture, and no drifting on.
  await page.waitForTimeout(500);
  expect(await ringAngle(page)).toBe(stopped);

  // Pointing at a picture that is not at the front leaves it exactly as it was: pointing
  // is how the ring is stopped, not how a picture is chosen from it.
  const aside = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.orbit__item')];
    const candidate = items.find(
      (item) =>
        !item.hasAttribute('data-front') && getComputedStyle(item).pointerEvents !== 'none',
    );
    const box = candidate.getBoundingClientRect();
    return {
      index: items.indexOf(candidate),
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
  });

  await page.mouse.move(aside.x, aside.y);
  await page.waitForTimeout(350);

  const pointedAt = await page.evaluate((index) => {
    const item = document.querySelectorAll('.orbit__item')[index];
    return {
      hovered: item.matches(':hover'),
      lift: getComputedStyle(item).getPropertyValue('--orbit-lift').trim(),
      zoom: getComputedStyle(item.querySelector('.orbit__tile')).transform,
    };
  }, aside.index);

  expect(pointedAt.hovered).toBe(true);
  expect(pointedAt.lift).toBe('0px');
  expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(pointedAt.zoom);

  await page.mouse.move(2, 2);
  await expect.poll(() => ringAngle(page)).not.toBe(stopped);

  // Carried on from the angle it stopped at rather than from where it was heading.
  expect(Math.abs((await ringAngle(page)) - stopped)).toBeLessThan(30);
});

test('dragging turns the ring, and letting go while moving coasts and settles', async ({
  page,
}) => {
  await page.goto(variantUrl('drag'));

  // The drift is off in this variant, so anything that moves came from the pointer.
  const resting = await ringAngle(page);
  await page.waitForTimeout(400);
  expect(await ringAngle(page)).toBe(resting);

  const centre = await stageCentre(page);
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x - 240, centre.y, { steps: 12 });
  const dragged = await ringAngle(page);
  expect(dragged).not.toBe(resting);

  await page.mouse.up();
  await expect.poll(() => ringAngle(page)).not.toBe(dragged);

  // A throw settles rather than crawling on forever.
  await expect
    .poll(async () => {
      const before = await ringAngle(page);
      await page.waitForTimeout(220);
      return (await ringAngle(page)) === before;
    })
    .toBe(true);

  // And it stops on a picture rather than between two: six pictures, sixty degrees apart.
  const settled = Math.abs((await ringAngle(page)) % 60);
  expect(Math.min(settled, 60 - settled)).toBeLessThan(0.01);
});

test('a picture dragged round to the front is the one singled out', async ({ page }) => {
  await page.goto(variantUrl('drag'));

  const centre = await stageCentre(page);
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x - 150, centre.y, { steps: 10 });
  await page.mouse.up();

  await expect(page.locator('.orbit__ring').first()).toHaveClass(/is-centred/);

  const lift = await page
    .locator('.orbit__item[data-front]')
    .first()
    .evaluate((item) => getComputedStyle(item).getPropertyValue('--orbit-lift').trim());
  expect(lift).toBe('90px');

  // The lift and the fade are transitions, so they are polled to their end state rather
  // than read on the frame the class arrived.
  await expect
    .poll(() =>
      page
        .locator('.orbit__item[data-front] .orbit__tile')
        .first()
        .evaluate((tile) => getComputedStyle(tile).transform),
    )
    .toContain('1.14');

  await expect
    .poll(() =>
      page
        .locator('.orbit__item:not([data-front]) .orbit__tile')
        .first()
        .evaluate((tile) => Number(getComputedStyle(tile).opacity)),
    )
    .toBeLessThan(0.5);
});

test('no-drag takes the gesture away and leaves the ring alone', async ({ page }) => {
  await page.goto(variantUrl('drag'));

  const centre = await stageCentre(page, 1);
  const gallery = page.locator('ui-orbit-gallery').nth(1);
  await gallery.evaluate((element) => element.pause());
  const before = await ringAngle(page, 1);

  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x - 240, centre.y, { steps: 8 });
  await page.mouse.up();

  expect(await ringAngle(page, 1)).toBe(before);
});

test('an arrow either side turns the ring one picture and holds it there', async ({ page }) => {
  await page.goto(variantUrl('default'));

  const previous = page.getByRole('button', { name: 'Previous picture' });
  const next = page.getByRole('button', { name: 'Next picture' });
  const indexOf = () => page.evaluate(() => document.querySelector('ui-orbit-gallery').index);

  await next.click();
  await expect(page.locator('.orbit__ring')).toHaveClass(/is-centred/);
  const after = await indexOf();

  await next.click();
  await expect.poll(indexOf).toBe((after + 1) % 8);

  await previous.click();
  await expect.poll(indexOf).toBe(after);
  await expect(page.locator('.orbit__ring')).toHaveClass(/is-centred/);

  // Turning the ring deliberately stops the drift, or the picture just chosen would be
  // carried straight back off the front. Pointer and focus are both taken off the ring so
  // that what holds it can only be the deliberate turn.
  await page.mouse.move(2, 2);
  await page.evaluate(() => document.activeElement.blur());
  const held = await ringAngle(page);
  await page.waitForTimeout(600);
  expect(await ringAngle(page)).toBe(held);

  // And the page can hand the ring back to the drift.
  await page.locator('ui-orbit-gallery').evaluate((element) => element.resume());
  await expect.poll(() => ringAngle(page)).not.toBe(held);
});

test('a drag that starts on an arrow turns the ring instead of pressing it', async ({ page }) => {
  await page.goto(variantUrl('drag'));

  // Counting presses rather than pictures: a drag and a press can land on the same
  // picture, so only the button firing tells the two apart.
  await page.evaluate(() => {
    const gallery = document.querySelector('ui-orbit-gallery');
    const step = gallery.step.bind(gallery);
    window.__presses = 0;
    gallery.step = (delta) => {
      window.__presses += 1;
      return step(delta);
    };
  });

  const next = page.locator('.orbit__arrow--next').first();
  const box = await next.boundingBox();
  const before = await ringAngle(page);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 240, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();

  await expect(page.locator('.orbit__ring').first()).toHaveClass(/is-centred/);
  expect(await ringAngle(page)).not.toBe(before);
  expect(await page.evaluate(() => window.__presses)).toBe(0);

  // The same button, pressed rather than dragged, still fires.
  await next.click();
  expect(await page.evaluate(() => window.__presses)).toBe(1);
});

test('the ring and its two arrows are the only tab stops, and the arrow keys turn it', async ({
  page,
}) => {
  await page.goto(variantUrl('default'));

  // The pictures are not controls, so none of them is a tab stop of its own.
  await expect(page.locator('.orbit__ring [tabindex]')).toHaveCount(0);
  await expect(page.locator('.orbit__ring button')).toHaveCount(0);
  await expect(page.locator('.orbit__stage')).toHaveAttribute('tabindex', '0');
  await expect(page.locator('.orbit__stage button:not([hidden])')).toHaveCount(2);

  await page.locator('.orbit__stage').focus();
  await expect(page.locator('.orbit__stage')).toBeFocused();

  // Focus holds the ring still, which is what makes the front picture worth lifting.
  const held = await ringAngle(page);
  await page.waitForTimeout(400);
  expect(await ringAngle(page)).toBe(held);

  const indexOf = () =>
    page.evaluate(() => document.querySelector('ui-orbit-gallery').index);
  const total = await page.evaluate(() => document.querySelector('ui-orbit-gallery').items.length);

  const before = await indexOf();
  await page.keyboard.press('ArrowRight');
  await expect.poll(indexOf).toBe((before + 1) % total);

  await page.keyboard.press('ArrowLeft');
  await expect.poll(indexOf).toBe(before);

  await page.keyboard.press('End');
  await expect.poll(indexOf).toBe(total - 1);

  await page.keyboard.press('Home');
  await expect.poll(indexOf).toBe(0);

  // The index reads the target while the ring is still travelling to it, so the picture is
  // singled out once it has arrived rather than the moment it becomes the nearest one.
  await expect(page.locator('.orbit__ring')).toHaveClass(/is-centred/);

  const lift = await page
    .locator('.orbit__item[data-front]')
    .evaluate((item) => getComputedStyle(item).getPropertyValue('--orbit-lift').trim());
  expect(lift).toBe('90px');
});

test('the status region is quiet while the ring drifts and speaks once it stops', async ({
  page,
}) => {
  await page.goto(variantUrl('default'));

  const status = page.locator('.orbit__status');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  // A live region naming every picture a turn goes past would never stop talking.
  await expect(status).toHaveText('');

  await page.locator('.orbit__stage').focus();
  await expect(status).toHaveText(/^Picture \d+ of 8: .+/);

  const spoken = await status.textContent();
  const alt = await page
    .locator('.orbit__item[data-front] img')
    .evaluate((image) => image.alt);
  expect(spoken).toContain(alt);
});

test('the far half of the ring is beyond the reach of the pointer', async ({ page }) => {
  await page.goto(variantUrl('default'));
  await page.locator('.orbit__stage').focus();

  const reach = await page.evaluate(() =>
    [...document.querySelectorAll('.orbit__item')].map((item) => ({
      opacity: Number(item.style.getPropertyValue('--orbit-depth-opacity')),
      events: getComputedStyle(item).pointerEvents,
    })),
  );

  expect(reach.some((item) => item.events === 'none')).toBe(true);

  for (const item of reach) {
    // A picture hidden by its own backface must not be able to stop the ring.
    expect(item.events === 'none' ? item.opacity < 0.4 : item.opacity >= 0.28).toBe(true);
  }
});

test('reduced motion removes the drift and the coasting but keeps the keyboard', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(variantUrl('default'));

  const resting = await ringAngle(page);
  await page.waitForTimeout(600);
  expect(await ringAngle(page)).toBe(resting);

  const centre = await stageCentre(page);
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x - 200, centre.y, { steps: 8 });
  await page.mouse.up();

  // Dragging is a gesture the reader performs, so it stays; the coasting after it does not.
  const released = await ringAngle(page);
  await page.waitForTimeout(400);
  expect(await ringAngle(page)).toBe(released);

  await page.locator('.orbit__stage').focus();
  const before = await page.evaluate(() => document.querySelector('ui-orbit-gallery').index);
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => page.evaluate(() => document.querySelector('ui-orbit-gallery').index))
    .toBe((before + 1) % 8);
});

test('a missing picture keeps its place, and one picture stands still', async ({ page }) => {
  await page.goto(variantUrl('states'));

  const missing = page.locator('ui-orbit-gallery').nth(1);
  await expect(missing.locator('.orbit__item')).toHaveCount(5);
  await expect(missing.locator('.orbit__item[data-unavailable]')).toHaveCount(1);
  await expect(missing.locator('.orbit__unavailable')).toHaveText('Picture unavailable');

  const single = page.locator('ui-orbit-gallery').nth(2);
  expect(
    await single.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--orbit-radius').trim(),
    ),
  ).toBe('0px');

  // Nowhere to step to, so the controls for stepping are not drawn.
  await expect(single.locator('.orbit__arrow')).toHaveCount(2);
  await expect(single.locator('.orbit__arrow:not([hidden])')).toHaveCount(0);

  // One picture has no ring to be on, so nothing turns it away from the reader.
  const angleOf = () => ringAngle(page, 2);
  const resting = await angleOf();
  await page.waitForTimeout(500);
  expect(await angleOf()).toBe(resting);

  // The first ring on this page ships paused, and resuming is what starts it.
  const held = page.locator('ui-orbit-gallery').first();
  const before = await ringAngle(page, 0);
  await page.waitForTimeout(400);
  expect(await ringAngle(page, 0)).toBe(before);

  await held.evaluate((element) => element.resume());
  await expect.poll(() => ringAngle(page, 0)).not.toBe(before);
});
