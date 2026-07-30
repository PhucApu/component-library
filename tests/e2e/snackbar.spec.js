import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/snackbar/source/variants';
const VARIANTS = ['default', 'severity', 'action', 'placement', 'queue', 'timing'];

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
  await page.waitForFunction(() => customElements.get('ui-snackbar'));
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
      await expect(page.locator('ui-snackbar')).toBeAttached();

      await page.locator('.snackbar-demo__button').first().click();
      await expect(page.locator('.snackbar__surface')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('both live regions exist and are empty before anything is said', async ({ page }) => {
  await ready(page, 'default');

  // A region built together with its first message is routinely never announced, so both
  // have to be waiting in the document from the start.
  const regions = await page.evaluate(() =>
    [...document.querySelectorAll('ui-snackbar .snackbar__live')].map((region) => ({
      role: region.getAttribute('role'),
      text: region.textContent,
    })),
  );

  expect(regions).toEqual([
    { role: 'status', text: '' },
    { role: 'alert', text: '' },
  ]);
});

/** Raises a message with no clock on it, so a loaded machine cannot expire it mid-test. */
function raise(page, severity, message) {
  return page.evaluate(
    ([level, text]) =>
      document.querySelector('ui-snackbar').show({ message: text, severity: level, duration: 0 }),
    [severity, message],
  );
}

test('severity chooses which region speaks', async ({ page }) => {
  await ready(page, 'severity');

  const polite = page.locator('[role="status"]');
  const assertive = page.locator('[role="alert"]');

  await raise(page, 'success', 'Invoice sent to the billing address');
  await expect(polite).toHaveText('Invoice sent to the billing address');
  await expect(assertive).toBeEmpty();

  await page.locator('.snackbar__close').click();
  await raise(page, 'error', 'Upload failed: the connection was lost');
  await expect(assertive).toHaveText('Upload failed: the connection was lost');
  await expect(polite).toBeEmpty();
});

test('the visible text is not announced twice, and the action keeps its name', async ({
  page,
}) => {
  await ready(page, 'action');
  await page.getByRole('button', { name: 'Delete message' }).click();
  await expect(page.locator('.snackbar__surface')).toBeVisible();

  // aria-hidden sits on the paragraph. On the surface it would take the action button
  // out of the accessibility tree along with the text.
  await expect(page.locator('.snackbar__message')).toHaveAttribute('aria-hidden', 'true');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');

  const buttons = nodes
    .filter((node) => node.role?.value === 'button' && node.name?.value)
    .map((node) => node.name.value);
  expect(buttons).toContain('Undo');
  expect(buttons).toContain('Dismiss');

  // The sentence reaches the reader once, through the live region.
  const duplicated = nodes.filter((node) => node.name?.value === 'Message moved to Trash');
  expect(duplicated).toHaveLength(0);
});

test('showing a message never moves focus', async ({ page }) => {
  await ready(page, 'default');

  const trigger = page.getByRole('button', { name: 'Save draft' });
  await trigger.focus();
  const before = await page.evaluate(() => document.activeElement.textContent.trim());

  await page.keyboard.press('Enter');
  await expect(page.locator('.snackbar__surface')).toBeVisible();

  const after = await page.evaluate(() => document.activeElement.textContent.trim());
  expect(after).toBe(before);
});

test('a message carrying an action outlives the default window', async ({ page }) => {
  await ready(page, 'action');
  await page.getByRole('button', { name: 'Delete message' }).click();

  const surface = page.locator('.snackbar__surface');
  await expect(surface).toBeVisible();

  // Well past the five seconds an ordinary message would get.
  await page.waitForTimeout(6500);
  await expect(surface).toBeVisible();
  await expect(page.locator('.snackbar__message')).toHaveText('Message moved to Trash');
});

test('a message with nothing to act on clears itself', async ({ page }) => {
  await ready(page, 'timing');
  await page.getByRole('button', { name: 'Short' }).click();

  const surface = page.locator('.snackbar__surface');
  await expect(surface).toBeVisible();
  await expect(surface).toBeHidden({ timeout: 4000 });
});

test('choosing the action runs it, closes, and says why', async ({ page }) => {
  await ready(page, 'action');

  await page.evaluate(() => {
    window.__reasons = [];
    document.addEventListener('snackbar-dismiss', (event) =>
      window.__reasons.push(event.detail.reason),
    );
  });

  await page.getByRole('button', { name: 'Delete message' }).click();
  await page.locator('.snackbar__action').click();

  await expect(page.locator('.snackbar__surface')).toBeHidden();
  expect(await page.evaluate(() => window.__reasons)).toEqual(['action']);
  await expect(page.locator('output')).toContainText('chose "Undo"');
});

test('every way of closing reports its own reason', async ({ page }) => {
  await ready(page, 'timing');
  await page.evaluate(() => {
    window.__reasons = [];
    document.addEventListener('snackbar-dismiss', (event) =>
      window.__reasons.push(event.detail.reason),
    );
  });

  await page.getByRole('button', { name: 'Short' }).click();
  await expect(page.locator('.snackbar__surface')).toBeHidden({ timeout: 4000 });

  await page.getByRole('button', { name: 'Until dismissed' }).click();
  await page.locator('.snackbar__close').click();
  await expect(page.locator('.snackbar__surface')).toBeHidden();

  await page.getByRole('button', { name: 'Long' }).click();
  await page.evaluate(() => document.querySelector('ui-snackbar').clear());
  await expect(page.locator('.snackbar__surface')).toBeHidden();

  expect(await page.evaluate(() => window.__reasons)).toEqual(['timeout', 'dismiss', 'clear']);
});

test('Escape closes from inside the message and is left alone outside it', async ({ page }) => {
  await ready(page, 'action');
  await page.getByRole('button', { name: 'Delete message' }).click();

  const surface = page.locator('.snackbar__surface');
  await expect(surface).toBeVisible();

  // A document-level listener here would take Escape away from any dialog or picker open
  // on the same page.
  await page.getByRole('button', { name: 'Delete message' }).focus();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await expect(surface).toBeVisible();

  await page.locator('.snackbar__action').focus();
  await page.keyboard.press('Escape');
  await expect(surface).toBeHidden();
});

test('hovering holds the message, and it resumes with the time that was left', async ({
  page,
}) => {
  await ready(page, 'timing');
  await page.getByRole('button', { name: 'Short' }).click();

  const surface = page.locator('.snackbar__surface');
  await expect(surface).toBeVisible();

  await surface.hover();
  await page.waitForTimeout(3000);
  // Two seconds have long passed; the pointer is what is keeping it here.
  await expect(surface).toBeVisible();

  await page.mouse.move(5, 5);
  await expect(surface).toBeHidden({ timeout: 4000 });
});

test('focus inside the message holds it too', async ({ page }) => {
  await ready(page, 'timing');
  await page.getByRole('button', { name: 'Short' }).click();

  const surface = page.locator('.snackbar__surface');
  await page.locator('.snackbar__close').focus();
  await page.waitForTimeout(3000);
  await expect(surface).toBeVisible();
});

test('messages raised together arrive one at a time, in order', async ({ page }) => {
  await ready(page, 'queue');

  await page.evaluate(() => {
    window.__shown = [];
    document.addEventListener('snackbar-show', (event) =>
      window.__shown.push(event.detail.message),
    );
  });

  await page.getByRole('button', { name: 'Fire four at once' }).click();

  expect(await page.evaluate(() => document.querySelector('ui-snackbar').pending)).toBe(3);
  await expect(page.locator('.snackbar__message')).toHaveText('First in');

  await expect
    .poll(async () => page.evaluate(() => window.__shown), { timeout: 15000 })
    .toEqual(['First in', 'Second in', 'Third in', 'Fourth in']);
});

test('the region is emptied between messages, so the second one is a fresh mutation', async ({
  page,
}) => {
  await ready(page, 'queue');

  // Asserting that the text merely changes proves nothing: it changes under a naive
  // implementation too. What makes the second message audible is the region going back to
  // empty in between, so that is what this watches.
  await page.evaluate(() => {
    window.__writes = [];
    const region = document.querySelector('[role="status"]');
    new MutationObserver(() => window.__writes.push(region.textContent)).observe(region, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });

  await page.getByRole('button', { name: 'Fire four at once' }).click();

  await expect
    .poll(
      async () => {
        const writes = await page.evaluate(() => window.__writes);
        const collapsed = writes.filter((value, index) => value !== writes[index - 1]);
        // Only judge once three distinct states exist; the queue keeps going afterwards.
        return collapsed.length >= 3 ? collapsed.slice(0, 3) : null;
      },
      { timeout: 15000 },
    )
    .toEqual(['First in', '', 'Second in']);
});

test('an urgent message displaces a calm one, and never the other way round', async ({
  page,
}) => {
  await ready(page, 'severity');
  await page.evaluate(() => {
    window.__reasons = [];
    document.addEventListener('snackbar-dismiss', (event) =>
      window.__reasons.push(`${event.detail.severity}:${event.detail.reason}`),
    );
  });

  // No clocks anywhere here, so nothing can expire between the steps and pretend to be a
  // preemption that never happened.
  await raise(page, 'success', 'Invoice sent');
  await expect(page.locator('.snackbar__message')).toHaveText('Invoice sent');

  await raise(page, 'error', 'Upload failed');
  await expect(page.locator('.snackbar__message')).toHaveText('Upload failed');
  expect(await page.evaluate(() => window.__reasons)).toEqual(['success:preempted']);

  // The reverse must not happen: ordinary news waits for the problem to finish.
  await raise(page, 'info', 'Sync runs again soon');
  await page.waitForTimeout(400);
  await expect(page.locator('.snackbar__message')).toHaveText('Upload failed');
  expect(await page.evaluate(() => document.querySelector('ui-snackbar').pending)).toBe(1);
});

test('each placement anchors where it says', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'placement');

  const box = async (placement) => {
    await page.getByRole('button', { name: placement, exact: true }).click();
    // Wait for this placement's own message, not merely for something to be on screen:
    // the previous one is still leaving and would be measured at the old anchor.
    await expect(page.locator('.snackbar__message')).toHaveText(`Anchored ${placement}`);
    await expect(page.locator('ui-snackbar')).toHaveAttribute('data-placement', placement);
    await page.waitForTimeout(300);
    return page.locator('.snackbar__surface').boundingBox();
  };

  const topStart = await box('top-start');
  const bottomEnd = await box('bottom-end');
  const topCenter = await box('top-center');

  expect(topStart.y).toBeLessThan(120);
  // The popover user-agent rule pins all four edges; without resetting them every bottom
  // and end anchor collapses to the top-left corner.
  expect(bottomEnd.y).toBeGreaterThan(600);
  expect(bottomEnd.x + bottomEnd.width).toBeGreaterThan(900);
  expect(topStart.x).toBeLessThan(bottomEnd.x);
  // Centred within a couple of pixels of the viewport middle.
  expect(Math.abs(topCenter.x + topCenter.width / 2 - 480)).toBeLessThan(3);
});

test('a message raised while another is leaving survives the exit', async ({ page }) => {
  await ready(page, 'placement');

  // Clearing and showing in the same tick is an ordinary thing to do, and it leaves the
  // first message's exit timer running against a surface that now belongs to the second.
  await page.getByRole('button', { name: 'top-start', exact: true }).click();
  await expect(page.locator('.snackbar__message')).toHaveText('Anchored top-start');

  await page.getByRole('button', { name: 'bottom-end', exact: true }).click();
  await expect(page.locator('.snackbar__message')).toHaveText('Anchored bottom-end');

  // Long enough for the first exit to have fired.
  await page.waitForTimeout(600);
  await expect(page.locator('.snackbar__surface')).toBeVisible();
  await expect(page.locator('.snackbar__message')).toHaveText('Anchored bottom-end');
});

test('the surface meets contrast at every severity', async ({ page }) => {
  await ready(page, 'severity');

  for (const level of ['Info', 'Success', 'Warning', 'Error']) {
    await page.getByRole('button', { name: level }).click();
    await expect(page.locator('.snackbar__surface')).toBeVisible();

    const measured = await page.evaluate(() => {
      const linear = (channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (colour) => {
        const [r, g, b] = colour.match(/\d+/g).map(Number);
        return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
      };
      const ratio = (a, b) => {
        const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (light + 0.05) / (dark + 0.05);
      };

      const surface = document.querySelector('.snackbar__surface');
      const style = getComputedStyle(surface);
      return {
        text: ratio(
          getComputedStyle(surface.querySelector('.snackbar__message')).color,
          style.backgroundColor,
        ),
        action: ratio(
          getComputedStyle(surface.querySelector('.snackbar__action')).color,
          style.backgroundColor,
        ),
        icon: ratio(
          getComputedStyle(surface.querySelector('.snackbar__icon')).color,
          style.backgroundColor,
        ),
        edge: ratio(style.borderTopColor, getComputedStyle(document.body).backgroundColor),
      };
    });

    expect(measured.text, `${level} text`).toBeGreaterThanOrEqual(4.5);
    expect(measured.action, `${level} action`).toBeGreaterThanOrEqual(4.5);
    expect(measured.icon, `${level} icon`).toBeGreaterThanOrEqual(3);
    expect(measured.edge, `${level} edge`).toBeGreaterThanOrEqual(3);

    await page.locator('.snackbar__close').click();
    await expect(page.locator('.snackbar__surface')).toBeHidden();
  }
});

/**
 * Shows a message and reports the state at the instant it was raised, the frames that
 * followed, and where it settled.
 *
 * The opening reading is taken in the same task as `show()`. Waiting for a frame would let
 * a loaded machine deliver it after the animation had finished, and the check would then
 * pass against a component that never animated at all.
 */
async function captureArrival(page) {
  return page.evaluate(async () => {
    const surface = document.querySelector('.snackbar__surface');
    const read = () => ({
      opacity: Number(getComputedStyle(surface).opacity),
      y: Math.round(surface.getBoundingClientRect().y),
    });

    document.querySelector('ui-snackbar').show({ message: 'Draft saved', duration: 0 });
    const first = read();

    const frames = [];
    await new Promise((resolve) => {
      let count = 0;
      const tick = () => {
        frames.push(read());
        count += 1;
        if (count < 14) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    return { first, frames, last: read() };
  });
}

test('the message slides in rather than appearing', async ({ page }) => {
  await ready(page, 'default');

  // Sampled every frame. Asserting that it ends up visible is not enough: the first
  // version of this component reached its final opacity on the very first frame and no
  // test noticed, because every check only looked at the settled state.
  const { first, frames, last } = await captureArrival(page);

  expect(first.opacity).toBeLessThan(0.4);
  expect(last.opacity).toBeGreaterThan(0.9);

  // Anchored at the bottom, so it travels upwards into place.
  expect(first.y).toBeGreaterThan(last.y + 8);

  // Genuinely interpolated rather than snapped through a couple of states.
  expect(new Set(frames.map((frame) => frame.opacity)).size).toBeGreaterThan(3);
  expect(new Set(frames.map((frame) => frame.y)).size).toBeGreaterThan(3);
});

/** Replays an arrival and reports which edge it came from. */
async function arrivalOf(page, placement) {
  return page.evaluate(async (target) => {
    const bar = document.querySelector('ui-snackbar');
    const surface = bar.querySelector('.snackbar__surface');

    bar.clear();
    await new Promise((resolve) => setTimeout(resolve, 400));
    bar.setAttribute('placement', target);

    bar.show({ message: `Anchored ${target}`, duration: 0 });
    // Read synchronously, in the same task as show(). Waiting for a frame would let a
    // loaded machine deliver it after the animation had already finished, leaving a
    // delta of zero that still classifies as a confident direction.
    const start = surface.getBoundingClientRect();

    await new Promise((resolve) => setTimeout(resolve, 600));
    const end = surface.getBoundingClientRect();

    const dx = end.x - start.x;
    const dy = end.y - start.y;

    // Refuse to guess rather than report a direction that was never travelled.
    if (Math.hypot(dx, dy) < 8) {
      return `no-motion(${Math.round(dx)},${Math.round(dy)})`;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'left' : 'right';
    }

    return dy > 0 ? 'above' : 'below';
  }, placement);
}

test('each anchor arrives from its own edge', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'placement');

  // A corner slides in sideways out of the edge it is pinned to; only the centred anchors
  // travel vertically.
  expect(await arrivalOf(page, 'top-start')).toBe('left');
  expect(await arrivalOf(page, 'bottom-start')).toBe('left');
  expect(await arrivalOf(page, 'top-end')).toBe('right');
  expect(await arrivalOf(page, 'bottom-end')).toBe('right');
  expect(await arrivalOf(page, 'top-center')).toBe('above');
  expect(await arrivalOf(page, 'bottom-center')).toBe('below');
});

test('the sideways arrival follows the writing direction', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'placement');
  await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));

  // The anchors are named by logical edge, so the motion has to flip with them rather
  // than staying pinned to physical left and right.
  expect(await arrivalOf(page, 'top-start')).toBe('right');
  expect(await arrivalOf(page, 'bottom-end')).toBe('left');
});

test('it still slides in where the Popover API is missing', async ({ page }) => {
  // Without popover support nothing else forces a style flush between rendering the
  // surface and moving it into place, so this is the path the explicit reflow read exists
  // for. The stylesheet keeps the surface pinned on its own.
  await page.addInitScript(() => {
    delete HTMLElement.prototype.showPopover;
    delete HTMLElement.prototype.hidePopover;
  });
  await ready(page, 'default');

  const { first, last } = await captureArrival(page);

  expect(first.opacity).toBeLessThan(0.4);
  expect(last.opacity).toBeGreaterThan(0.9);
  expect(first.y).toBeGreaterThan(last.y + 8);
  await expect(page.locator('.snackbar__surface')).toBeVisible();
});

test('reduced motion removes the transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page, 'default');
  await page.getByRole('button', { name: 'Save draft' }).click();

  const surface = page.locator('.snackbar__surface');
  await expect(surface).toBeVisible();
  expect(await surface.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
});
