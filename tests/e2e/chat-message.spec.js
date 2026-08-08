import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/chat-message/source/variants';
const VARIANTS = ['default', 'image', 'reply', 'voice', 'attachment', 'states'];

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
  await page.waitForFunction(() => customElements.get('ui-chat-message'));
  await page.waitForFunction(() =>
    document.querySelector('ui-chat-message[data-run-start]') !== null,
  );
}

test('all six variants run independently without external requests or overflow', async ({
  page,
}) => {
  test.slow();

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
      await page.setViewportSize({ width, height: 900 });
      await ready(page, variant);

      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('ui-chat-message').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  // The pictures and the voice note live beside the component; nothing here reaches out.
  expect(externalRequests).toEqual([]);
  // The deliberately broken image in the Image variant is triggered by a button, not on load.
  expect(runtimeErrors).toEqual([]);
});

test('with no script the conversation is still readable', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${COMPONENT_BASE}/default/index.html`);

  const messages = page.locator('ui-chat-message');
  await expect(messages).toHaveCount(5);
  await expect(messages.first()).toContainText('Are we still on for three?');
  await expect(page.locator('.chat__bubble')).toHaveCount(0);

  await context.close();
});

test('every message says who is talking, even when the name is hidden', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  // The side a bubble sits on and the colour it is painted are the only things that normally
  // say who spoke, and a screen reader has neither.
  const spoken = await page.evaluate(() =>
    [...document.querySelectorAll('ui-chat-message')].map((message) => ({
      intro: message.querySelector('.chat__sr-only').textContent,
      nameVisible: !message.querySelector('.chat__author').hidden,
      direction: message.dataset.direction,
    })),
  );

  expect(spoken).toHaveLength(5);
  spoken.forEach((message) => {
    expect(message.intro.length).toBeGreaterThan(0);
    expect(message.intro).toMatch(message.direction === 'me' ? /^You/ : /^Mai/);
  });

  // The second message is a run continuation: nothing on screen names Mai, and the spoken
  // intro still does.
  expect(spoken[1].nameVisible).toBe(false);
  expect(spoken[1].intro).toMatch(/^Mai/);
});

test('runs are worked out from the neighbours, and a long silence breaks one', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  const runs = await page.evaluate(() =>
    [...document.querySelectorAll('ui-chat-message')].map((message) => ({
      start: message.hasAttribute('data-run-start'),
      end: message.hasAttribute('data-run-end'),
      avatar: !message.querySelector('.chat__avatar').hidden,
      footer: !message.querySelector('.chat__footer').hidden,
    })),
  );

  // Mai's first two messages are one run: one avatar at the top, one timestamp at the bottom.
  expect(runs[0]).toEqual({ start: true, end: false, avatar: true, footer: false });
  expect(runs[1]).toEqual({ start: false, end: true, avatar: false, footer: true });

  // Her last message is six hours later. Joining the run above would have given it a timestamp
  // from this morning — a message that reads as never having been sent.
  expect(runs[4].start).toBe(true);
});

test('the thread carries one live region, and the messages carry none', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  await expect(page.locator('.chat-thread')).toHaveAttribute('role', 'log');

  // A live region per bubble means every arrival interrupts the one before it.
  expect(
    await page.evaluate(
      () => document.querySelectorAll('ui-chat-message[aria-live], ui-chat-message [aria-live]').length,
    ),
  ).toBe(0);
});

test('a picture holds its own shape open and nothing moves when it arrives', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'image');
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));

  const measure = () =>
    page.evaluate(() => ({
      thread: Math.round(document.querySelector('.chat-thread').getBoundingClientRect().height),
      wide: Math.round(document.querySelector('#wide .chat__bubble').getBoundingClientRect().height),
      tall: Math.round(document.querySelector('#tall .chat__bubble').getBoundingClientRect().height),
    }));

  const loaded = await measure();

  // Each skeleton is the picture's own shape, taken from its width and height attributes —
  // a square placeholder that then grows into a 3:2 photograph does the jump anyway, twice.
  //
  // The *computed* aspect-ratio, not the custom property: the property is written by script
  // whether or not any rule consumes it, so reading it back proves only that script ran.
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('.chat__image-frame')].map((frame) =>
        getComputedStyle(frame).aspectRatio.replace(/\s+/g, ' ').trim(),
      ),
    ),
  ).toEqual(['1200 / 800', '900 / 1200']);

  await page.locator('[data-demo-target="wide"][data-demo-action="loading"]').click();
  await page.locator('[data-demo-target="tall"][data-demo-action="loading"]').click();
  const waiting = await measure();

  expect(waiting).toEqual(loaded);

  await page.locator('[data-demo-target="wide"][data-demo-action="loading"]').click();
  await page.locator('[data-demo-target="tall"][data-demo-action="loading"]').click();
  expect(await measure()).toEqual(loaded);
});

test('the box is the right shape before the picture has ever arrived', async ({ page }) => {
  // The test above toggles a state on an image the browser already has, so the picture is in
  // the layout the whole time and would hold the box open on its own. This one stops the
  // pictures from arriving at all, which is the only way to see whether the reservation is
  // doing anything.
  const held = [];

  await page.route('**/assets/*.svg', async (route) => {
    held.push(route);
  });

  await page.setViewportSize({ width: 960, height: 900 });
  // `load` never fires while the pictures are held, and that is the point — so wait for the
  // document rather than for the page to finish.
  await page.goto(`${COMPONENT_BASE}/image/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.chat__image-frame') !== null);

  const waiting = await page.evaluate(() =>
    [...document.querySelectorAll('.chat__image-frame')].map((frame) => {
      const box = frame.getBoundingClientRect();
      return Math.round((box.width / box.height) * 100) / 100;
    }),
  );

  // 1200/800 and 900/1200, held by nothing but the reservation.
  expect(waiting[0]).toBeCloseTo(1.5, 1);
  expect(waiting[1]).toBeCloseTo(0.75, 1);

  const before = await page.evaluate(() =>
    Math.round(document.querySelector('.chat-thread').getBoundingClientRect().height),
  );

  await page.unroute('**/assets/*.svg');
  await Promise.all(held.map((route) => route.continue().catch(() => {})));
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));

  // And when they land, nothing moves.
  expect(
    await page.evaluate(() =>
      Math.round(document.querySelector('.chat-thread').getBoundingClientRect().height),
    ),
  ).toBe(before);
});

test('a picture that fails says so, keeps its box, and keeps its alt text', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'image');
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));

  const height = () =>
    page.evaluate(() =>
      Math.round(document.querySelector('.chat-thread').getBoundingClientRect().height),
    );

  const before = await height();
  await page.locator('[data-demo-action="break"]').click();

  // A broken-image icon says nothing at all.
  await expect(page.locator('#wide .chat__image-status')).toHaveText(
    'That image could not be loaded',
  );
  expect(await height()).toBe(before);

  // The alt is still the message. A picture message with no alt is a message with no content.
  expect(await page.locator('#wide img').getAttribute('alt')).toMatch(/market street/i);
});

test('every picture in the collection carries alt text', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'image');

  const alts = await page.evaluate(() =>
    [...document.querySelectorAll('ui-chat-message img')].map((image) => image.getAttribute('alt')),
  );

  expect(alts.length).toBeGreaterThan(0);
  alts.forEach((alt) => {
    expect(alt).toBeTruthy();
    // "image" or "photo" as the whole alt describes the format, not the message.
    expect(alt.trim().length).toBeGreaterThan(12);
  });
});

test('a quotation is shortened and can be followed back', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'reply');

  const original = await page.locator('#msg-budget .chat__bubble p').textContent();
  const quote = await page.locator('.chat__quote-text').first().textContent();

  // Quoting a long message whole doubles the thread for anybody reading it aloud.
  expect(original.replace(/\s+/g, ' ').trim().length).toBeGreaterThan(quote.length);
  expect(quote).toMatch(/…$/);

  const link = page.locator('.chat__quote-link').first();
  await expect(link).toHaveAttribute('href', '#msg-budget');
  await expect(link).toHaveAttribute('aria-label', 'Go to the message from Linh');

  await link.click();

  // A quotation that only scrolls leaves a keyboard user exactly where they were.
  await expect(page.locator('#msg-budget')).toBeFocused();
  await expect(page.locator('#msg-budget')).toHaveAttribute('data-highlight', '');
});

test('a voice note plays, names its length, and yields to the next one', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'voice');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('audio')].every((audio) => Number.isFinite(audio.duration)),
  );

  const players = page.locator('.chat__play');
  await expect(players.first()).toHaveAttribute('aria-label', /Voice message, 0:0\d/);

  // The bars are a fixed pattern, not an analysis. A waveform drawn to look real for audio it
  // never measured would be a picture that lies.
  await expect(page.locator('.chat__wave').first()).toHaveAttribute('aria-hidden', 'true');

  await players.first().click();
  await expect(players.first()).toHaveAttribute('aria-label', /^Pause/);

  await players.nth(1).click();
  // Two voice notes talking over each other is nobody's idea of a conversation.
  await expect(players.first()).not.toHaveAttribute('aria-label', /^Pause/);
  expect(await page.evaluate(() => document.querySelectorAll('audio')[0].paused)).toBe(true);

  await page.evaluate(() => document.querySelectorAll('audio').forEach((audio) => audio.pause()));
});

test('every voice note has a transcript behind a real disclosure', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'voice');

  const notes = await page.evaluate(
    () => document.querySelectorAll('ui-chat-message audio').length,
  );
  const transcripts = page.locator('[data-transcript]');

  // Audio is not an accessible format. A voice note with no transcript is a message some
  // people simply cannot read.
  await expect(transcripts).toHaveCount(notes);

  const toggle = page.locator('.chat__transcript-toggle').first();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(transcripts.first()).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(transcripts.first()).toBeVisible();

  // Normalised here rather than left to the matcher: the phrase is wrapped across two lines in
  // the source, and a regular expression run over raw text content never sees it.
  const spoken = await transcripts
    .first()
    .evaluate((node) => node.textContent.replace(/\s+/g, ' ').trim());

  expect(spoken).toMatch(/projector cable/i);
  expect(spoken.length).toBeGreaterThan(40);
});

test('an attachment is named and sized before it is opened', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'attachment');

  const file = page.locator('.chat__file').first();

  await expect(file).toHaveAttribute('aria-label', 'Download Quarterly review.pdf');
  await expect(file.locator('.chat__file-name')).toHaveText('Quarterly review.pdf');
  // Bytes are for machines.
  await expect(file.locator('.chat__file-size')).toHaveText('2.3 MB');
  await expect(page.locator('.chat__file').nth(1).locator('.chat__file-size')).toHaveText('47 KB');
});

test('a delivery state is a glyph and a word, never a colour', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  const status = page.locator('#cycle .chat__status');
  const shapes = new Set();

  for (const state of ['sending', 'sent', 'delivered', 'read']) {
    await page.locator(`[data-demo-status="${state}"]`).click();
    await expect(status).toHaveAttribute('data-status', state);

    // The word is the part that survives a greyscale print and a colour-blind reader.
    await expect(status.locator('.chat__status-word')).toHaveText(
      { sending: 'Sending', sent: 'Sent', delivered: 'Delivered', read: 'Read' }[state],
    );

    // And each state draws a different shape, so two grey ticks against two blue ticks is not
    // the only difference on offer.
    shapes.add(await status.locator('svg').innerHTML());
  }

  expect(shapes.size).toBe(4);
});

test('a failure keeps its receipt mid-run and offers a way out', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  const broken = page.locator('#broken');

  await expect(broken.locator('.chat__status-word')).toHaveText('Not sent');
  await expect(broken.locator('.chat__retry')).toBeVisible();

  await broken.locator('.chat__retry').click();
  // The page answers `chat-retry`; the component only asks.
  await expect(broken).toHaveAttribute('status', 'sending');
  await expect(broken).toHaveAttribute('status', 'delivered');
  await expect(broken.locator('.chat__retry')).toHaveCount(0);
});

test('a system notice is not somebody talking', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  const system = page.locator('ui-chat-message[type="system"]');

  await expect(system).toHaveAttribute('data-run-start', '');
  await expect(system).toHaveAttribute('data-run-end', '');
  await expect(system.locator('.chat__avatar')).toBeHidden();

  // The message after it starts its own run rather than joining a notice.
  await expect(page.locator('ui-chat-message').nth(1)).toHaveAttribute('data-run-start', '');
});

test('nothing a message contains can break the thread', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await ready(page, 'states');

  // A URL somebody pasted is the everyday version of this.
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  ).toBe(false);

  const overflowing = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return [...document.querySelectorAll('.chat__bubble')]
      .filter((bubble) => bubble.getBoundingClientRect().right > width + 1).length;
  });

  expect(overflowing).toBe(0);
});

test('the palette clears its floors in both themes', async ({ page }) => {
  test.slow();

  const luminance = (hex) => {
    const channels = [1, 3, 5]
      .map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255)
      .map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 960, height: 900 });
    await ready(page, 'reply');

    const painted = await page.evaluate(() => {
      const hex = (colour) =>
        `#${colour
          .match(/\d+/g)
          .slice(0, 3)
          .map((n) => Number(n).toString(16).padStart(2, '0'))
          .join('')}`;
      const theirs = document.querySelector('ui-chat-message[data-direction="them"]');
      const mine = document.querySelector('ui-chat-message[data-direction="me"]');
      const page_ = document.querySelector('.chat-demo');

      return {
        surface: hex(getComputedStyle(page_).backgroundColor),
        theirBubble: hex(getComputedStyle(theirs.querySelector('.chat__bubble')).backgroundColor),
        theirInk: hex(getComputedStyle(theirs.querySelector('.chat__bubble')).color),
        myBubble: hex(getComputedStyle(mine.querySelector('.chat__bubble')).backgroundColor),
        myInk: hex(getComputedStyle(mine.querySelector('.chat__bubble')).color),
        myQuote: hex(getComputedStyle(mine.querySelector('.chat__quote')).backgroundColor),
        myQuoteInk: hex(getComputedStyle(mine.querySelector('.chat__quote')).color),
        meta: hex(getComputedStyle(theirs.querySelector('.chat__footer')).color),
      };
    });

    // Words, wherever they sit.
    expect(contrast(painted.theirInk, painted.theirBubble)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(painted.myInk, painted.myBubble)).toBeGreaterThanOrEqual(4.5);
    // The quotation gets its own surface rather than being dimmer text on a saturated accent,
    // which is where "muted" quietly misses 4.5 while looking perfectly fine.
    expect(contrast(painted.myQuoteInk, painted.myQuote)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(painted.meta, painted.surface)).toBeGreaterThanOrEqual(4.5);

    // Shapes. A bubble is a grouping, not a control, so it is held to reading as a shape
    // rather than to a control's 3:1 — the speaker is a word regardless.
    expect(contrast(painted.theirBubble, painted.surface)).toBeGreaterThanOrEqual(1.2);
    expect(contrast(painted.myBubble, painted.surface)).toBeGreaterThanOrEqual(1.2);
    expect(contrast(painted.theirBubble, painted.myBubble)).toBeGreaterThanOrEqual(1.5);
  }

  await page.emulateMedia({ colorScheme: null });
});
