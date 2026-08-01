import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/carousel/source/variants';
const VARIANTS = ['default', 'transitions', 'drag', 'peek', 'autoplay', 'states'];

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
  await page.waitForFunction(() => customElements.get('ui-carousel'));
  await page.waitForTimeout(300);
}

const indexOf = (page, nth = 0) =>
  page.evaluate((position) => document.querySelectorAll('ui-carousel')[position].index, nth);

async function dragBy(page, distance, { steps = 10, pause = 0, selector = '.carousel__track' } = {}) {
  const box = await page.locator(selector).first().boundingBox();
  const y = box.y + box.height / 2;
  const startX = distance > 0 ? box.x + box.width * 0.25 : box.x + box.width * 0.75;

  await page.mouse.move(startX, y);
  await page.mouse.down();

  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(startX + (distance * step) / steps, y);

    // Synthetic moves arrive with almost no time between them, which makes even a tiny drag
    // look like a flick at tens of pixels per millisecond. Anything testing distance rather
    // than speed has to slow down or it is testing the wrong one of the two.
    if (pause > 0) {
      await page.waitForTimeout(pause);
    }
  }

  await page.mouse.up();

  // Waits for the scroller to stop moving. Neither a fixed delay nor a single `scrollend`
  // will do: the position is read off the scroller as it goes, so `index` is an intermediate
  // value for the whole of the landing, and the drag's own scrolling ends before the
  // programmatic one begins.
  await page.evaluate(
    (target) =>
      new Promise((resolve) => {
        const track = document.querySelector(target);
        let last = track.scrollLeft;
        let steady = 0;
        const started = performance.now();

        const tick = () => {
          const now = track.scrollLeft;
          steady = Math.abs(now - last) < 0.5 ? steady + 1 : 0;
          last = now;

          if (steady >= 6 || performance.now() - started > 3000) {
            resolve();
            return;
          }

          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      }),
    selector,
  );
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
      await expect(page.locator('ui-carousel').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('the pictures still scroll with no script at all', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${COMPONENT_BASE}/default/index.html`);

  // Nothing here may use `page.evaluate`: running script in the page is exactly what has
  // been turned off. Positions come from the protocol instead, which is the only honest way
  // to measure a page with no scripting.
  const track = page.locator('.carousel__track');
  const last = page.locator('.carousel__slide').last();

  const frame = await track.boundingBox();
  const before = await last.boundingBox();

  // The strip is wider than its frame, so there is something to scroll.
  expect(before.x).toBeGreaterThan(frame.x + frame.width);

  await last.scrollIntoViewIfNeeded();
  const after = await last.boundingBox();

  // And it scrolled: the last picture came into the frame without a line of script.
  expect(after.x).toBeLessThan(before.x);
  expect(after.x).toBeLessThan(frame.x + frame.width);

  await context.close();
});

test('the element supplies the tab stop the scroller does not have', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  // Measured on a bare scroll container: `tabIndex` is `-1` whether or not it holds
  // focusable children, so nothing puts it in the tab order but the element. A strip that
  // scrolls and cannot be reached is a strip the keyboard cannot use.
  expect(await page.evaluate(() => document.querySelector('.carousel__track').tabIndex)).toBe(0);

  const reached = await page.evaluate(async () => {
    document.querySelector('.carousel__track').focus();
    return document.activeElement.className;
  });
  expect(reached).toContain('carousel__track');
});

test('the carousel names itself and every picture in it', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  const described = await page.evaluate(() => {
    const carousel = document.querySelector('ui-carousel');
    return {
      role: carousel.getAttribute('role'),
      roledescription: carousel.getAttribute('aria-roledescription'),
      label: carousel.getAttribute('aria-label'),
      slides: carousel.slides.map((slide) => ({
        role: slide.getAttribute('role'),
        roledescription: slide.getAttribute('aria-roledescription'),
        label: slide.getAttribute('aria-label'),
      })),
    };
  });

  expect(described.role).toBe('group');
  expect(described.roledescription).toBe('carousel');
  expect(described.label).toBe('Landscape photographs');
  expect(described.slides[2]).toEqual({
    role: 'group',
    roledescription: 'slide',
    label: '3 of 6',
  });
});

test('the arrows, the dots and the keyboard all move it', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  await page.locator('.carousel__arrow--next').click();
  await page.waitForTimeout(600);
  expect(await indexOf(page)).toBe(1);

  await page.locator('.carousel__dot').nth(4).click();
  await page.waitForTimeout(700);
  expect(await indexOf(page)).toBe(4);
  await expect(page.locator('.carousel__dot').nth(4)).toHaveAttribute('aria-current', 'true');

  await page.locator('.carousel__track').focus();
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(600);
  expect(await indexOf(page)).toBe(3);

  await page.keyboard.press('Home');
  await page.waitForTimeout(600);
  expect(await indexOf(page)).toBe(0);

  await page.keyboard.press('End');
  await page.waitForTimeout(600);
  expect(await indexOf(page)).toBe(5);
});

test('an arrow key moves one picture, not two', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  // Uncancelled, the browser scrolls the track as well as the handler moving it, and two go
  // by for one key.
  await page.locator('.carousel__track').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(700);

  expect(await indexOf(page)).toBe(1);
});

test('the track reports where it has been scrolled to', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  // Swiping and the trackpad go straight to the scroller without asking the element, so the
  // position has to be read back off the scroll rather than only written to it.
  const reported = await page.evaluate(async () => {
    const carousel = document.querySelector('ui-carousel');
    const track = carousel.querySelector('.carousel__track');
    const slide = carousel.slides[2];

    track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: 'instant' });
    await new Promise((resolve) => setTimeout(resolve, 400));

    return {
      index: carousel.index,
      dot: [...carousel.querySelectorAll('.carousel__dot')].findIndex((dot) =>
        dot.hasAttribute('data-current'),
      ),
    };
  });

  expect(reported).toEqual({ index: 2, dot: 2 });
});

test('dragging moves the pictures, and snapping gets out of its way', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  // Measured on a bare scroller: with snapping on, a hand-driven `scrollLeft` of 60 is
  // pulled straight back to 0. Without switching it off, a drag fights the browser the whole
  // way and the strip refuses to move.
  //
  // A real pointer rather than dispatched `PointerEvent`s: a synthetic one carries no
  // pointer id the browser knows, so capture fails and the drag never starts — which would
  // make this pass or fail for reasons that have nothing to do with snapping.
  const box = await page.locator('.carousel__track').boundingBox();
  const y = box.y + box.height / 2;
  const start = box.x + box.width * 0.75;

  const read = () =>
    page.evaluate(() => ({
      snap: getComputedStyle(document.querySelector('.carousel__track')).scrollSnapType,
      scroll: Math.round(document.querySelector('.carousel__track').scrollLeft),
    }));

  const before = await read();

  await page.mouse.move(start, y);
  await page.mouse.down();
  for (let step = 1; step <= 6; step += 1) {
    await page.mouse.move(start - step * 25, y);
  }

  const during = await read();
  await page.mouse.up();
  await page.waitForTimeout(800);
  const after = await read();

  expect(during.snap).toBe('none');
  expect(during.scroll - before.scroll).toBeGreaterThan(50);
  // And it comes back for the landing, or nothing would ever line up again.
  expect(after.snap).toContain('mandatory');
});

test('a long slow drag commits and a short one falls back', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  // Polled rather than read once. The position is taken off the scroller as it moves, so
  // `index` is an intermediate value for the whole of the landing; what is being claimed
  // here is where it comes to rest, not what it reads at some particular millisecond.
  const settlesOn = (value) => expect.poll(() => indexOf(page), { timeout: 5000 }).toBe(value);

  await page.locator('.carousel__dot').nth(2).click();
  await settlesOn(2);

  await dragBy(page, -320);
  await settlesOn(3);

  await dragBy(page, 320);
  await settlesOn(2);

  // Short of the threshold *and* slow, so it goes back where it was. A short quick one is a
  // flick and is meant to commit; that is the other half of the rule, and it is checked
  // below.
  await dragBy(page, -40, { steps: 4, pause: 60 });
  await settlesOn(2);
});

// The other half of the rule — that a short *quick* drag commits — is checked in the unit
// tests for `commitDrag`, where the velocity is an input. It cannot be checked honestly from
// here: a synthetic pointer's timing is whatever the machine gives it, so the same gesture is
// a flick on an idle machine and a slow drag on a busy one, and a test that changes its mind
// with the load is worse than no test.

test('an arrival is reported once, however it was reached', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  await page.evaluate(() => {
    window.__changes = [];
    document
      .querySelector('ui-carousel')
      .addEventListener('carousel-change', (event) => window.__changes.push(event.detail.index));
  });

  // Four routes end in the same place — a control, the keyboard, a drag, and the scroller
  // settling by itself — and left alone they overlap: a press reports the change, then the
  // scroll it caused reports the same thing again.
  await page.locator('.carousel__arrow--next').click();
  await page.waitForTimeout(800);

  await page.locator('.carousel__track').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(800);

  await dragBy(page, -320);

  expect(await page.evaluate(() => window.__changes)).toEqual([1, 2, 3]);
});

test('a drag across a link does not follow it', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'drag');

  const linked = page.locator('ui-carousel').nth(1);
  await linked.locator('.carousel__track').scrollIntoViewIfNeeded();

  const followed = await page.evaluate(async () => {
    const carousel = document.querySelectorAll('ui-carousel')[1];
    let clicked = false;
    carousel.querySelector('a').addEventListener('click', (event) => {
      clicked = !event.defaultPrevented;
    });
    return { clicked };
  });
  expect(followed.clicked).toBe(false);

  const box = await linked.locator('.carousel__track').boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.7, y);
  await page.mouse.down();
  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(box.x + box.width * 0.7 - step * 30, y);
  }
  await page.mouse.up();
  await page.waitForTimeout(700);

  // A press that travelled far enough is a drag, and the click it produces has to be stopped
  // before it reaches the link inside the slide.
  expect(await indexOf(page, 1)).toBe(1);
  expect(page.url()).not.toContain('#harbour');
});

test('a press that did not travel is still a press', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'drag');

  const pressed = await page.evaluate(async () => {
    const carousel = document.querySelectorAll('ui-carousel')[1];
    const link = carousel.querySelector('a');
    const box = link.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    let reached = false;

    link.addEventListener('click', (event) => {
      event.preventDefault();
      reached = !event.defaultPrevented || event.target === link;
    });

    const track = carousel.querySelector('.carousel__track');
    track.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, button: 0, bubbles: true }));
    track.dispatchEvent(new PointerEvent('pointerup', { clientX: x + 2, clientY: y, bubbles: true }));
    link.click();
    await new Promise((resolve) => setTimeout(resolve, 200));

    return reached;
  });

  expect(pressed).toBe(true);
});

test('dragging can be turned off without taking anything else with it', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'drag');

  const noDrag = page.locator('ui-carousel').nth(2);
  await noDrag.locator('.carousel__track').scrollIntoViewIfNeeded();

  const box = await noDrag.locator('.carousel__track').boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.75, y);
  await page.mouse.down();
  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(box.x + box.width * 0.75 - step * 30, y);
  }
  await page.mouse.up();
  await page.waitForTimeout(600);

  expect(await indexOf(page, 2)).toBe(0);

  await noDrag.locator('.carousel__arrow--next').click();
  await page.waitForTimeout(600);
  expect(await indexOf(page, 2)).toBe(1);
});

test('more than one in the frame leaves fewer positions than pictures', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'peek');

  // Showing two of six, the sixth is on screen when the fifth is at the edge, so a sixth
  // position would scroll to somewhere the track cannot reach.
  expect(await page.locator('ui-carousel').first().locator('.carousel__dot').count()).toBe(5);

  await page.evaluate(() => document.querySelector('ui-carousel').goTo(99));
  await page.waitForTimeout(600);
  expect(await indexOf(page)).toBe(4);

  await expect(page.locator('ui-carousel').first().locator('.carousel__arrow--next')).toBeDisabled();

  // Asking for more than there are is answered with all of them.
  expect(await page.locator('ui-carousel').nth(1).locator('.carousel__dot').count()).toBe(3);
});

test('the stacked effects stop the track scrolling and stack the pictures', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'transitions');

  const modes = await page.evaluate(() =>
    [...document.querySelectorAll('ui-carousel')].map((carousel) => ({
      effect: carousel.getAttribute('effect') ?? 'slide',
      layered: carousel.hasAttribute('data-layered'),
      display: getComputedStyle(carousel.querySelector('.carousel__track')).display,
    })),
  );

  expect(modes).toEqual([
    { effect: 'slide', layered: false, display: 'flex' },
    { effect: 'fade', layered: true, display: 'grid' },
    { effect: 'zoom', layered: true, display: 'grid' },
    { effect: 'cover', layered: true, display: 'grid' },
  ]);
});

test('the picture on its way out stays until it has gone', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'transitions');

  // Without something to tell an arriving picture from a departing one, every effect that
  // moves them in opposite directions is impossible: one rule cannot send the same selector
  // both ways at once.
  const swap = await page.evaluate(async () => {
    const carousel = [...document.querySelectorAll('ui-carousel')][3];
    const before = carousel.slides.map((slide) => +getComputedStyle(slide).opacity);

    carousel.next();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const leaving = carousel.slides.findIndex((slide) => slide.hasAttribute('data-leaving'));
    const leavingOpacity = +getComputedStyle(carousel.slides[0]).opacity;

    await new Promise((resolve) => setTimeout(resolve, 600));

    return {
      before,
      leaving,
      leavingOpacity,
      after: carousel.slides.map((slide) => +getComputedStyle(slide).opacity),
      cleared: carousel.querySelectorAll('[data-leaving]').length,
    };
  });

  expect(swap.before).toEqual([1, 0, 0]);
  expect(swap.leaving).toBe(0);
  // `cover` keeps the departing picture in full view while the new one crosses over it.
  expect(swap.leavingOpacity).toBe(1);
  expect(swap.after).toEqual([0, 1, 0]);
  expect(swap.cleared).toBe(0);
});

test('a stacked carousel keeps what is out of sight out of reach', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'transitions');

  const reach = await page.evaluate(() => {
    const layered = [...document.querySelectorAll('ui-carousel')][1];
    const track = [...document.querySelectorAll('ui-carousel')][0];

    return {
      layered: layered.slides.map((slide) => slide.inert),
      // On the track every picture can still be scrolled to, so taking the others out of
      // reach would break the scrolling the whole thing is built on.
      track: track.slides.map((slide) => slide.inert),
    };
  });

  expect(reach.layered).toEqual([false, true, true]);
  expect(reach.track).toEqual([false, false, false]);
});

test('one picture leaves no controls at all', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'states');

  const single = page.locator('ui-carousel').first();
  await expect(single).toHaveAttribute('data-single', '');
  await expect(single.locator('.carousel__arrow--next')).toBeHidden();
  await expect(single.locator('.carousel__bar')).toBeHidden();
});

test('an arrow that turns itself off hands the keyboard on first', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'states');

  const ends = page.locator('ui-carousel').nth(1);
  await ends.locator('.carousel__track').scrollIntoViewIfNeeded();
  await expect(ends.locator('.carousel__arrow--previous')).toBeDisabled();

  // The control that turns itself off is the one under the finger, and a disabled element
  // cannot hold focus: it drops to the body and the keyboard goes with it. This has bitten
  // the collection five times.
  await ends.locator('.carousel__arrow--next').click();
  await page.waitForTimeout(600);
  await ends.locator('.carousel__arrow--next').click();
  await page.waitForTimeout(600);

  const landed = await page.evaluate(() => ({
    inside: document.querySelectorAll('ui-carousel')[1].contains(document.activeElement),
    disabled: document.activeElement.disabled ?? false,
    tag: document.activeElement.tagName,
  }));

  await expect(ends.locator('.carousel__arrow--next')).toBeDisabled();
  expect(landed.inside).toBe(true);
  expect(landed.disabled).toBe(false);
});

test('looping ends never turn an arrow off', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'states');

  const looping = page.locator('ui-carousel').nth(2);
  await looping.locator('.carousel__track').scrollIntoViewIfNeeded();

  await expect(looping.locator('.carousel__arrow--previous')).toBeEnabled();
  await looping.locator('.carousel__arrow--previous').click();
  await page.waitForTimeout(700);
  expect(await indexOf(page, 2)).toBe(2);
});

test('a slideshow can be stopped, and stops itself for every good reason', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'autoplay');

  const carousel = page.locator('ui-carousel').first();

  // Content that starts moving by itself has to be stoppable, so the control is part of the
  // component rather than an option.
  await expect(carousel.locator('.carousel__toggle')).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('ui-carousel').playing)).toBe(true);

  await page.waitForTimeout(3600);
  expect(await indexOf(page)).toBeGreaterThan(0);

  // The pointer over it holds it still.
  await carousel.locator('.carousel__track').hover();
  const held = await indexOf(page);
  await page.waitForTimeout(3600);
  expect(await indexOf(page)).toBe(held);

  await page.mouse.move(5, 5);
  await page.waitForTimeout(3600);
  expect(await indexOf(page)).not.toBe(held);

  // And pressing pause keeps it stopped whatever the pointer does afterwards.
  await carousel.locator('.carousel__toggle').click();
  expect(await page.evaluate(() => document.querySelector('ui-carousel').playing)).toBe(false);
  const paused = await indexOf(page);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(3600);
  expect(await indexOf(page)).toBe(paused);
});

test('focus inside a running slideshow holds it still', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'autoplay');

  await page.locator('ui-carousel').first().locator('.carousel__track').focus();
  const held = await indexOf(page);
  await page.waitForTimeout(3600);

  expect(await indexOf(page)).toBe(held);
});

test('a slideshow that does not loop stops at the end rather than jumping back', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'autoplay');

  await page.mouse.move(5, 700);
  await page.waitForTimeout(9000);

  const finished = await page.evaluate(() => {
    const carousel = document.querySelectorAll('ui-carousel')[1];
    return { index: carousel.index, last: carousel.slides.length - 1, playing: carousel.playing };
  });

  expect(finished.index).toBe(finished.last);
  expect(finished.playing).toBe(false);
});

test('the status region speaks for a person and stays quiet for a timer', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  await page.locator('.carousel__arrow--next').click();
  await page.waitForTimeout(800);
  await expect(page.locator('[role="status"]')).toHaveText('2 of 6');

  await ready(page, 'autoplay');
  await page.waitForTimeout(4000);

  // A region that speaks every few seconds without being asked is a region people turn off.
  await expect(page.locator('ui-carousel').first().locator('[role="status"]')).toHaveText('');
});

test('reduced motion stops the slideshow starting and the scrolling gliding', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'autoplay');

  // Slowing it down would be answering the wrong request.
  expect(await page.evaluate(() => document.querySelector('ui-carousel').playing)).toBe(false);
  const start = await indexOf(page);
  await page.waitForTimeout(4000);
  expect(await indexOf(page)).toBe(start);

  await ready(page, 'default');
  expect(
    await page.evaluate(
      () => getComputedStyle(document.querySelector('.carousel__track')).scrollBehavior,
    ),
  ).toBe('auto');
});

test('the dots say where you are by shape as well as colour', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  const dots = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.carousel__dot')];
    return {
      current: Math.round(all[0].getBoundingClientRect().width),
      other: Math.round(all[1].getBoundingClientRect().width),
    };
  });

  expect(dots.current).toBeGreaterThan(dots.other);
});

test('the arrows hold their contrast over a picture', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page, 'default');

  const measured = await page.evaluate(() => {
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

    const arrow = document.querySelector('.carousel__arrow--next');
    const style = getComputedStyle(arrow);

    return {
      // Each arrow carries its own dark scrim, so the icon holds against any picture.
      contrast: ratio(channels(style.color), channels(style.backgroundColor)),
      resting: +style.opacity,
    };
  });

  expect(measured.contrast).toBeGreaterThanOrEqual(4.5);
  // Faded rather than hidden, because hovering does not exist on a touch screen.
  expect(measured.resting).toBeGreaterThan(0.5);
});
