import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/card/source/variants';
const VARIANTS = ['default', 'effects', 'product', 'horizontal', 'grid', 'states'];

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
  await page.waitForFunction(() => customElements.get('ui-card'));
  await page.waitForTimeout(250);
}

async function dragAcross(page, locator) {
  const box = await locator.boundingBox();
  // Along the first line rather than through the middle of the block: a two-line paragraph
  // has its midpoint in the gap between the lines, where there is nothing to take hold of.
  const y = box.y + 8;

  await page.evaluate(() => getSelection().removeAllRanges());
  await page.mouse.move(box.x + 6, y);
  await page.mouse.down();
  await page.waitForTimeout(80);

  for (let step = 1; step <= 16; step += 1) {
    await page.mouse.move(box.x + 6 + ((box.width - 16) * step) / 16, y);
    await page.waitForTimeout(10);
  }

  await page.waitForTimeout(80);
  await page.mouse.up();
  await page.waitForTimeout(150);

  return page.evaluate(() => String(getSelection()).trim());
}

/**
 * Watches whether a press was allowed to follow the card's link.
 *
 * On the card in the bubble phase, deliberately. The component decides during capture, so by
 * here it has had its say; the demo page cancels every link on `document` so that a demo does
 * not navigate away, and a listener up there would read that instead and report `false`
 * whatever the component did.
 */
async function watchFollow(page) {
  await page.evaluate(() => {
    window.__followed = false;
    document.querySelectorAll('ui-card').forEach((card) => {
      card.addEventListener('click', (event) => {
        if (event.target.closest('a') && !event.defaultPrevented) {
          window.__followed = true;
        }
      });
    });
  });
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
      await expect(page.locator('ui-card').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('the whole card is the link, and the link is still called the title', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  const hit = await page.evaluate(() => {
    const card = document.querySelector('ui-card[interactive]');
    const box = card.getBoundingClientRect();
    const at = (x, y) => document.elementFromPoint(x, y)?.className ?? '';

    return {
      farCorner: at(box.right - 6, box.top + 6),
      overText: at(box.left + 30, box.top + box.height * 0.72),
      overFooter: at(box.left + 30, box.bottom - 12),
    };
  });

  expect(hit.farCorner).toContain('card__link');
  expect(hit.overText).toContain('card__link');
  expect(hit.overFooter).toContain('card__link');

  // Wrapping the card in an anchor instead produces a link named "" — one a screen reader
  // announces as nothing at all. The stretched link keeps the title as its name.
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('ui-card[interactive] .card__link')].map((link) =>
      link.textContent.trim(),
    ),
  );
  expect(names[0]).toBe('A quiet week in the harbour');
});

test('a control inside an interactive card is still reachable by the pointer', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'product');

  // The failure this guards against is silent: without lifting, the button is hit-tested as
  // the link. It looks pressable and it is not.
  const overButton = await page.evaluate(() => {
    const button = document.querySelector('ui-card[interactive] button');
    const box = button.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + 8, box.top + 8);

    return {
      className: hit?.className ?? '',
      isTheButton: hit === button,
      lifted: getComputedStyle(button).position,
    };
  });

  expect(overButton.isTheButton).toBe(true);
  expect(overButton.lifted).toBe('relative');
});

test('pressing a control does not follow the card', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'product');

  await page.evaluate(() => {
    window.__followed = false;
    document.addEventListener(
      'click',
      (event) => {
        if (event.target.closest('a')) {
          window.__followed = true;
        }
      },
      true,
    );
  });

  await page.locator('ui-card button').first().click();
  await page.waitForTimeout(200);

  expect(await page.evaluate(() => window.__followed)).toBe(false);
});

test('a whole-card link covers the words, and leaving it off gives them back', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  const cards = page.locator('.card-demo__grid').nth(1).locator('ui-card');

  // The control group is what makes this measurable at all: without it a drag that selects
  // nothing proves only that the drag did not work.
  const plain = await dragAcross(page, cards.nth(0).locator('.card__text'));
  const covered = await dragAcross(page, cards.nth(1).locator('.card__text'));

  expect(plain.length).toBeGreaterThan(10);
  expect(covered).toBe('');
});

test('a drag across the card produces no press to guard against', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  // This is written down because the obvious next change to this component is to add a guard
  // that cancels the click a drag "produces" — and there is no such click. A drag of any
  // real length over a link fires nothing at all. A guard would therefore only ever catch a
  // drag too short for the browser to notice, which is the small wobble of a hand that meant
  // to click, and cancelling that breaks clicking for the people least able to afford it.
  await page.evaluate(() => {
    window.__clicks = 0;
    document
      .querySelector('ui-card[interactive]')
      .addEventListener('click', () => (window.__clicks += 1));
  });

  const card = page.locator('ui-card[interactive]').first();
  const box = await card.boundingBox();
  const y = box.y + box.height * 0.75;

  await page.mouse.move(box.x + 20, y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(box.x + 20 + step * 18, y);
  }
  await page.mouse.up();
  await page.waitForTimeout(250);

  expect(await page.evaluate(() => window.__clicks)).toBe(0);

  // And a plain press does fire one, which is what proves the drag fired nothing rather than
  // the card being inert.
  await page.mouse.click(box.x + 30, y);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__clicks)).toBe(1);
});

test('a press that did not travel still follows the card', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  await watchFollow(page);

  const card = page.locator('ui-card[interactive]').first();
  const box = await card.boundingBox();
  await page.mouse.click(box.x + 30, box.y + box.height * 0.75);
  await page.waitForTimeout(200);

  expect(await page.evaluate(() => window.__followed)).toBe(true);
});

test('every treatment answers focus as well as the pointer', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'effects');

  // A treatment that only appears under the pointer tells a keyboard user nothing, and a
  // touch screen has no hovering at all.
  const byFocus = await page.evaluate(async () => {
    // One at a time. Focusing all four and then reading them measures nothing: only the last
    // one still has focus, and the other three report their resting state.
    //
    // Waited out rather than slept through: a fixed delay just longer than the transition is
    // a delay that fails on a loaded machine, which is what happened the first time.
    // Waits for the value to stop changing, not merely to have changed: a transition read
    // the moment it differs returns whatever frame it happened to be on.
    const settle = async (read, limit = 3000) => {
      const started = performance.now();
      let last = read();
      let steady = 0;

      while (performance.now() - started < limit) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const now = read();
        steady = now === last ? steady + 1 : 0;
        last = now;

        if (steady >= 5) {
          return now;
        }
      }

      return last;
    };

    const probe = async (selector, measure) => {
      const card = document.querySelector(selector);
      const read = () => measure(card);
      const before = read();

      card.querySelector('a, button').focus();
      const after = await settle(read);

      document.activeElement.blur();
      await settle(read);

      return { before, after };
    };

    return {
      zoom: await probe('ui-card[effect="zoom"]', (card) =>
        getComputedStyle(card.querySelector('.card__media img')).scale,
      ),
      border: await probe('ui-card[effect="border"]', (card) =>
        getComputedStyle(card, '::after').opacity,
      ),
      reveal: await probe('ui-card[effect="reveal"]', (card) =>
        getComputedStyle(card.querySelector('.card__reveal')).opacity,
      ),
    };
  });

  expect(byFocus.reveal).toEqual({ before: '0', after: '1' });
  expect(byFocus.zoom.after).not.toBe(byFocus.zoom.before);
  expect(byFocus.border.after).not.toBe(byFocus.border.before);
});

test('the card wears the focus ring, not the link inside it', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);

  const ring = await page.evaluate(() => {
    const link = document.activeElement;
    const card = link.closest('ui-card');

    return {
      onLink: getComputedStyle(link).outlineStyle,
      onCard: getComputedStyle(card).outlineStyle,
      focused: link.className,
    };
  });

  expect(ring.focused).toContain('card__link');
  // The card is what is being activated, so the card is what is ringed.
  expect(ring.onCard).not.toBe('none');
  expect(ring.onLink).toBe('none');
});

test('cards in a row are the same height with their footers in line', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'grid');

  const row = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.card-demo__grid')][0].querySelectorAll('ui-card');
    return {
      heights: [...cards].map((card) => Math.round(card.getBoundingClientRect().height)),
      footers: [...cards].map((card) =>
        Math.round(card.querySelector('.card__footer').getBoundingClientRect().bottom),
      ),
    };
  });

  expect(new Set(row.heights).size).toBe(1);
  expect(new Set(row.footers).size).toBe(1);
});

test('a clamped description stops at the line it was given', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'grid');

  const clamped = await page.evaluate(() => {
    // The one with enough words to be cut. Clamping a single line to two lines proves
    // nothing at all.
    const card = [...document.querySelectorAll('ui-card[clamp]')].find(
      (node) => node.querySelector('.card__text').textContent.trim().length > 120,
    );
    const text = card.querySelector('.card__text');
    const style = getComputedStyle(text);

    return {
      lines: style.webkitLineClamp,
      clipped: text.scrollHeight > text.clientHeight + 1,
      unclamped: document
        .querySelectorAll('.card-demo__grid')[1]
        .querySelector('ui-card')
        .hasAttribute('data-clamped'),
    };
  });

  expect(clamped.lines).toBe('2');
  expect(clamped.clipped).toBe(true);
  // No limit and one line are different answers, so nothing is applied where none was asked.
  expect(clamped.unclamped).toBe(false);
});

test('a horizontal card puts the picture beside the words and keeps its footer down', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'horizontal');

  const beside = await page.evaluate(() => {
    const card = document.querySelector('ui-card[orientation="horizontal"]');
    const media = card.querySelector('.card__media').getBoundingClientRect();
    const body = card.querySelector('.card__body').getBoundingClientRect();
    const footer = card.querySelector('.card__footer').getBoundingClientRect();
    const box = card.getBoundingClientRect();

    return {
      sideBySide: media.right <= body.left + 1,
      // Within the card's own border, which the box includes and the media does not.
      mediaFullHeight: Math.abs(media.height - box.height) <= 3,
      footerAtBottom: Math.abs(footer.bottom - box.bottom) <= 3,
    };
  });

  expect(beside).toEqual({ sideBySide: true, mediaFullHeight: true, footerAtBottom: true });
});

test('a horizontal card with no picture keeps no column for one', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'horizontal');

  const bare = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('ui-card[orientation="horizontal"]')];
    const without = cards.find((card) => !card.querySelector('.card__media'));
    const body = without.querySelector('.card__body').getBoundingClientRect();
    const box = without.getBoundingClientRect();

    return { gapAtStart: Math.round(body.left - box.left) };
  });

  // Anything more than the padding would be a column reserved for a picture nobody supplied.
  expect(bare.gapAtStart).toBeLessThan(24);
});

test('a card that is loading says so, and one that is unavailable says so in words', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  await expect(page.locator('ui-card[loading]').first()).toHaveAttribute('aria-busy', 'true');

  const off = page.locator('ui-card[disabled]').first();
  await expect(off).toHaveAttribute('aria-disabled', 'true');
  await expect(off.locator('.card__link')).toHaveAttribute('aria-disabled', 'true');
  // Not colour alone: the badge says it.
  await expect(off.locator('.card__badge')).toHaveText('Out of stock');

  await expect(page.locator('ui-card[current]').first()).toHaveAttribute('aria-current', 'true');
});

test('an unavailable card refuses the press and keeps its tab stop', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  await watchFollow(page);

  const off = page.locator('ui-card[disabled]').first();
  const box = await off.boundingBox();
  await page.mouse.click(box.x + 30, box.y + box.height * 0.75);
  await page.waitForTimeout(200);

  expect(await page.evaluate(() => window.__followed)).toBe(false);

  // A control nobody can reach is a control nobody can discover is unavailable, and a
  // disabled element cannot hold focus at all.
  const focusable = await page.evaluate(() => {
    const link = document.querySelector('ui-card[disabled] .card__link');
    link.focus();
    return document.activeElement === link;
  });
  expect(focusable).toBe(true);
});

test('the spotlight follows the pointer, and only that card listens', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'effects');

  const card = page.locator('ui-card[effect="spotlight"]');
  const box = await card.boundingBox();

  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
  await page.waitForTimeout(150);
  const first = await card.evaluate((node) => node.style.getPropertyValue('--card-x'));

  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8);
  await page.waitForTimeout(150);
  const second = await card.evaluate((node) => node.style.getPropertyValue('--card-x'));

  expect(first).not.toBe(second);
  expect(Number.parseFloat(second)).toBeGreaterThan(Number.parseFloat(first));

  // A listener on every card in a grid, firing on every pointer move, is a cost nobody
  // asked for.
  const lift = page.locator('ui-card[effect="lift"]').first();
  const liftBox = await lift.boundingBox();
  await page.mouse.move(liftBox.x + liftBox.width * 0.7, liftBox.y + liftBox.height * 0.7);
  await page.waitForTimeout(150);
  expect(await lift.evaluate((node) => node.style.getPropertyValue('--card-x'))).toBe('');
});

test('the words in a card clear the contrast the rules ask for', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'product');

  const contrast = await page.evaluate(() => {
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

    const card = document.querySelector('ui-card');
    const surface = channels(getComputedStyle(card).backgroundColor);
    const badge = card.querySelector('.card__badge');

    return {
      title: ratio(channels(getComputedStyle(card.querySelector('.card__title a')).color), surface),
      meta: ratio(channels(getComputedStyle(card.querySelector('.card__rating')).color), surface),
      price: ratio(channels(getComputedStyle(card.querySelector('.card__price')).color), surface),
      badge: ratio(
        channels(getComputedStyle(badge).color),
        channels(getComputedStyle(badge).backgroundColor),
      ),
    };
  });

  expect(contrast.title).toBeGreaterThanOrEqual(4.5);
  expect(contrast.meta).toBeGreaterThanOrEqual(4.5);
  expect(contrast.price).toBeGreaterThanOrEqual(4.5);
  expect(contrast.badge).toBeGreaterThanOrEqual(4.5);
});

test('reduced motion removes the treatments and stills the shimmer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  // A shimmer is movement that starts on its own and never stops, which is the thing that
  // setting exists for.
  const still = await page.evaluate(() => {
    const skeleton = document.querySelector('.card__skeleton');
    const card = document.querySelector('ui-card');
    return {
      animation: getComputedStyle(skeleton).animationName,
      transition: getComputedStyle(card).transitionDuration,
    };
  });

  expect(still.animation).toBe('none');
  expect(still.transition).toBe('0s');
});

test('the card needs no script to be a card', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${COMPONENT_BASE}/default/index.html`);

  // Nearly all of this component is stylesheet, so with no script the cards still lay out,
  // still show their pictures, and their titles are still links.
  const card = page.locator('ui-card').first();
  await expect(card).toBeVisible();
  await expect(card.locator('.card__media img')).toBeVisible();
  await expect(card.locator('.card__title a')).toHaveAttribute('href', '#quiet-week');

  const box = await card.boundingBox();
  expect(box.height).toBeGreaterThan(100);

  await context.close();
});
