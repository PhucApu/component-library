import { expect, test } from '@playwright/test';

const VARIANTS = ['default', 'grid', 'content', 'sizes', 'states'];

function variantUrl(variant) {
  return `/components/flip-card/source/variants/${variant}/index.html`;
}

function cardState(page, index = 0) {
  return page.evaluate((position) => {
    const card = document.querySelectorAll('ui-flip-card')[position];
    const front = card.querySelector('.flip-card__face--front');
    const back = card.querySelector('.flip-card__face--back');

    return {
      flipped: card.flipped,
      attribute: card.hasAttribute('flipped'),
      frontInert: front?.inert ?? null,
      backInert: back?.inert ?? null,
      height: Math.round(card.getBoundingClientRect().height),
    };
  }, index);
}

/** Everything a keyboard could reach: what is inside an inert subtree is not reachable. */
function reachable(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('ui-flip-card a[href], ui-flip-card button')]
      .filter((node) => !node.closest('[inert]'))
      .map((node) => node.textContent.trim()),
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

      await expect(page.locator('ui-flip-card').first()).toHaveAttribute('data-enhanced', '');
      await expect(page.locator('.flip-card__face--front').first()).toBeVisible();

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflows, `${variant} at ${width}px`).toBe(false);
    }
  }

  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('a press on the card turns it, and the attribute says so', async ({ page }) => {
  await page.goto(variantUrl('default'));
  expect(await cardState(page)).toMatchObject({ flipped: false, attribute: false });

  const box = await page.locator('ui-flip-card').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + 40);

  await expect.poll(async () => (await cardState(page)).flipped).toBe(true);
  expect(await cardState(page)).toMatchObject({ attribute: true });

  await page.mouse.click(box.x + box.width / 2, box.y + 40);
  await expect.poll(async () => (await cardState(page)).flipped).toBe(false);
});

test('the face turned away is out of the page, not merely out of sight', async ({ page }) => {
  await page.goto(variantUrl('default'));

  // The link on the back exists in the document and cannot be reached.
  await expect(page.locator('ui-flip-card a')).toHaveCount(1);
  expect(await reachable(page)).toEqual(['Details']);
  expect(await cardState(page)).toMatchObject({ frontInert: false, backInert: true });

  await page.getByRole('button', { name: 'Details' }).click();
  await expect.poll(async () => (await cardState(page)).flipped).toBe(true);

  expect(await reachable(page)).toEqual(['Read the note on this plate', 'Back to the front']);
  expect(await cardState(page)).toMatchObject({ frontInert: true, backInert: false });
});

test('a control on the back does its own job without turning the card', async ({ page }) => {
  await page.goto(variantUrl('content'));

  await page.locator('ui-flip-card').first().locator('.flip-card__face--front').click();
  await expect.poll(async () => (await cardState(page)).flipped).toBe(true);

  const counter = page.locator('[data-demo-count]');
  await counter.click();
  await expect(counter).toHaveText('Pressed 1 time');
  // Still on the back: the press belonged to the button, not to the card.
  expect(await cardState(page)).toMatchObject({ flipped: true });

  await page.locator('ui-flip-card a').first().click();
  expect(await cardState(page)).toMatchObject({ flipped: true });
});

test('the keyboard turns the card and focus follows it round', async ({ page }) => {
  await page.goto(variantUrl('default'));

  await page.getByRole('button', { name: 'Details' }).focus();
  await page.keyboard.press('Enter');

  await expect.poll(async () => (await cardState(page)).flipped).toBe(true);
  // The control that was used has just been turned away, so focus goes with the card.
  await expect(page.getByRole('button', { name: 'Back to the front' })).toBeFocused();

  await page.keyboard.press(' ');
  await expect.poll(async () => (await cardState(page)).flipped).toBe(false);
  await expect(page.getByRole('button', { name: 'Details' })).toBeFocused();
});

test('an author-supplied toggle is used instead of an added one', async ({ page }) => {
  await page.goto(variantUrl('content'));
  const authored = page.locator('ui-flip-card').nth(1);

  await expect(authored.getByRole('button', { name: 'What is this?' })).toHaveCount(1);
  await expect(authored.getByRole('button', { name: 'Details' })).toHaveCount(0);

  await authored.getByRole('button', { name: 'What is this?' }).click();
  await expect.poll(async () => (await cardState(page, 1)).flipped).toBe(true);
});

test('turning a card in a grid does not move the cards beside it', async ({ page }) => {
  await page.goto(variantUrl('grid'));

  const before = await page.evaluate(() =>
    [...document.querySelectorAll('ui-flip-card')].map((card) =>
      Math.round(card.getBoundingClientRect().top),
    ),
  );

  await page.locator('ui-flip-card').first().locator('.flip-card__face--front').click();
  await expect.poll(async () => (await cardState(page)).flipped).toBe(true);
  await page.waitForTimeout(700);

  const after = await page.evaluate(() =>
    [...document.querySelectorAll('ui-flip-card')].map((card) =>
      Math.round(card.getBoundingClientRect().top),
    ),
  );

  expect(after).toEqual(before);
});

test('a card with one face has no control and does not turn', async ({ page }) => {
  await page.goto(variantUrl('states'));
  const single = page.locator('ui-flip-card').first();

  await expect(single).toHaveAttribute('data-single', '');
  await expect(single.locator('.flip-card__toggle')).toHaveCount(0);

  await single.locator('.flip-card__face--front').click();
  await page.waitForTimeout(300);
  expect(await cardState(page)).toMatchObject({ flipped: false });
});

test('a card can be opened on its back, and reduced motion turns without an arc', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(variantUrl('states'));

  // The second card carries the attribute in the markup.
  expect(await cardState(page, 1)).toMatchObject({ flipped: true, frontInert: true });

  await page.locator('ui-flip-card').nth(1).getByRole('button', { name: 'Back to the front' }).click();
  // No arc to wait for: it has already arrived.
  expect(await cardState(page, 1)).toMatchObject({ flipped: false });
});
