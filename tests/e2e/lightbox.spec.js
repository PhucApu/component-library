import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/lightbox/source/variants';
const VARIANTS = ['default', 'zoom', 'navigation', 'captions', 'aspect', 'single'];

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
  await page.waitForFunction(() => customElements.get('ui-lightbox'));
}

async function openAt(page, index = 0) {
  await page.locator('.lightbox__item').nth(index).click();
  await expect(page.locator('.lightbox__panel')).toBeVisible();
  await page.waitForTimeout(350);
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
    for (const width of [1000, 360]) {
      await page.setViewportSize({ width, height: 720 });
      await ready(page, variant);

      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('.lightbox__item').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('the viewer opens on the picture that was pressed', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'default');
  await openAt(page, 2);

  const state = await page.evaluate(() => {
    const host = document.querySelector('ui-lightbox');
    return {
      index: host.index,
      modal: host.querySelector('.lightbox__panel').matches(':modal'),
      counter: host.querySelector('.lightbox__counter').textContent,
      status: host.querySelector('[role="status"]').textContent,
      active: host.querySelector('.lightbox__thumb[data-active]')?.dataset.index,
    };
  });

  expect(state).toEqual({
    index: 2,
    modal: true,
    counter: '3 of 6',
    status: '3 of 6: Rolling desert dunes under a high midday sun',
    active: '2',
  });
});

test('focus cannot leave the viewer and comes back to the picture pressed', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'default');
  await openAt(page, 0);

  for (let index = 0; index < 14; index += 1) {
    await page.keyboard.press('Tab');
  }

  expect(
    await page.evaluate(() =>
      document.querySelector('.lightbox__panel').contains(document.activeElement),
    ),
  ).toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.locator('.lightbox__panel')).toBeHidden();

  // The dialog hands focus back to whatever it took it from, which is not necessarily the
  // picture that was pressed.
  expect(await page.evaluate(() => document.activeElement.getAttribute('href'))).toBe(
    '../../assets/harbour-sunrise.svg',
  );
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
});

test('opening lands focus on a control that is actually available', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'default');
  await openAt(page, 0);

  // `showModal()` lands on the first focusable control, which at life size is the shrink
  // button — and rendering immediately turns that button off. A disabled element cannot
  // hold focus, so it falls to the body and every key stops working.
  const landed = await page.evaluate(() => ({
    inside: document.querySelector('.lightbox__panel').contains(document.activeElement),
    disabled: document.activeElement.disabled ?? null,
    name: document.activeElement.getAttribute('aria-label'),
  }));

  expect(landed).toEqual({ inside: true, disabled: false, name: 'Close viewer' });

  // Which is what makes the keyboard work at all from the moment it opens.
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => document.querySelector('ui-lightbox').index)).toBe(1);
});

test('the wheel magnifies the picture and leaves the page where it was', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'zoom');
  await openAt(page, 0);

  // Watching `scrollY` alone would prove nothing: the page is already held still while the
  // viewer is open, so it cannot move whichever way the listener was registered. What the
  // claim is really about is the gesture being cancelled, so that is what this reads.
  await page.evaluate(() => {
    window.__wheel = [];
    document.addEventListener(
      'wheel',
      (event) => window.__wheel.push(event.defaultPrevented),
      { passive: true },
    );
  });

  await page.locator('.lightbox__frame').hover();
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(250);

  const after = await page.evaluate(() => ({
    scale: document.querySelector('ui-lightbox').scale,
    scrollY: window.scrollY,
    cancelled: window.__wheel,
  }));

  expect(after.scale).toBeGreaterThan(1);
  expect(after.scrollY).toBe(0);
  // A passive listener cannot cancel anything, and would leave this false.
  expect(after.cancelled).toContain(true);
});

test('the point under the pointer stays under the pointer', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'default');
  await openAt(page, 0);

  const measured = await page.evaluate(async () => {
    const host = document.querySelector('ui-lightbox');
    const frame = host.querySelector('.lightbox__frame');
    const image = host.querySelector('.lightbox__image');

    host.resetZoom();
    // Settle before reading, or the previous transition is caught mid-flight and reports
    // a drift that is not there.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const rect = frame.getBoundingClientRect();
    const pointer = { x: 120, y: -60 };
    const screen = {
      x: rect.left + rect.width / 2 + pointer.x,
      y: rect.top + rect.height / 2 + pointer.y,
    };
    const where = () => {
      const box = image.getBoundingClientRect();
      return {
        u: +((screen.x - box.left) / box.width).toFixed(3),
        v: +((screen.y - box.top) / box.height).toFixed(3),
      };
    };

    const before = where();
    host.setZoom(2, pointer);
    await new Promise((resolve) => setTimeout(resolve, 300));

    return {
      before,
      after: where(),
      applied: getComputedStyle(image).translate,
      scale: host.scale,
      // What the rule predicts, worked out from the scale that was actually reached.
      expected: `${pointer.x - pointer.x * host.scale}px ${pointer.y - pointer.y * host.scale}px`,
    };
  });

  expect(measured.scale).toBe(2);
  expect(measured.after).toEqual(measured.before);
  expect(measured.applied).toBe(measured.expected);
  expect(measured.applied).toBe('-120px 60px');
});

test('arrows change picture at rest and drag once magnified', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'default');
  await openAt(page, 0);

  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => document.querySelector('ui-lightbox').index)).toBe(1);

  await page.evaluate(() => document.querySelector('ui-lightbox').setZoom(3));
  await page.waitForTimeout(250);

  const before = await page.evaluate(() => getComputedStyle(document.querySelector('.lightbox__image')).translate);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => ({
    translate: getComputedStyle(document.querySelector('.lightbox__image')).translate,
    index: document.querySelector('ui-lightbox').index,
  }));

  // Magnifying is what switches the mode, so the picture must not change here.
  expect(after.index).toBe(1);
  expect(after.translate).not.toBe(before);
});

const stripState = (page) =>
  page.evaluate(() => {
    const entries = [...document.querySelectorAll('.lightbox__thumbs li')];
    return {
      total: entries.length,
      shown: entries.filter((entry) => !entry.hasAttribute('hidden')).length,
      range: entries
        .map((entry, position) => (entry.hasAttribute('hidden') ? null : position))
        .filter((position) => position !== null),
      index: document.querySelector('ui-lightbox').index,
      prevOff: document.querySelector('[data-action="strip-prev"]').disabled,
      nextOff: document.querySelector('[data-action="strip-next"]').disabled,
    };
  });

test('only six thumbnails stand on the strip at once', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'navigation');
  await openAt(page, 0);

  const start = await stripState(page);
  expect(start).toMatchObject({ total: 14, shown: 6, range: [0, 1, 2, 3, 4, 5] });

  // Hidden rather than merely scrolled past, so they leave the tab order with it.
  const reachable = await page.evaluate(
    () => document.querySelectorAll('.lightbox__thumbs li:not([hidden]) button').length,
  );
  expect(reachable).toBe(6);
});

test('the strip arrows step the picture one at a time', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'navigation');
  await openAt(page, 0);

  const next = page.locator('[data-action="strip-next"]');

  // The first few leave the window where it is: the picture is still well inside it.
  await next.click();
  await page.waitForTimeout(120);
  expect(await stripState(page)).toMatchObject({ range: [0, 1, 2, 3, 4, 5], index: 1 });

  await next.click();
  await next.click();
  await next.click();
  await page.waitForTimeout(120);
  expect(await stripState(page)).toMatchObject({ range: [0, 1, 2, 3, 4, 5], index: 4 });

  // The fifth reaches the last thumbnail on show, and the window starts moving with it.
  await next.click();
  await page.waitForTimeout(120);
  expect(await stripState(page)).toMatchObject({ range: [1, 2, 3, 4, 5, 6], index: 5 });

  await next.click();
  await page.waitForTimeout(120);
  expect(await stripState(page)).toMatchObject({ range: [2, 3, 4, 5, 6, 7], index: 6 });

  await page.locator('[data-action="strip-prev"]').click();
  await page.waitForTimeout(120);
  expect(await stripState(page)).toMatchObject({ range: [2, 3, 4, 5, 6, 7], index: 5 });
});

test('the strip arrows run out at the ends of the set, not of the window', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'navigation');
  await openAt(page, 0);

  // This variant loops, so neither end is real and neither arrow ever turns off.
  expect(await stripState(page)).toMatchObject({ index: 0, prevOff: false, nextOff: false });

  await page.evaluate(() => document.querySelector('ui-lightbox').removeAttribute('loop'));
  await page.waitForTimeout(200);
  expect(await stripState(page)).toMatchObject({ index: 0, prevOff: true, nextOff: false });

  await page.evaluate(() => document.querySelector('ui-lightbox').goTo(13));
  await page.waitForTimeout(200);
  expect(await stripState(page)).toMatchObject({ index: 13, prevOff: false, nextOff: true });
});

test('the window keeps what is coming next already on the strip', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'navigation');
  await openAt(page, 0);

  // Asking for the next picture should never be a leap in the dark: the thumbnail after
  // the current one is on the strip before it is needed.
  for (const index of [5, 8, 11]) {
    await page.evaluate((target) => document.querySelector('ui-lightbox').goTo(target), index);
    await page.waitForTimeout(200);

    const state = await stripState(page);
    expect(state.shown).toBe(6);
    expect(state.range).toContain(index);
    expect(state.range).toContain(index + 1);
  }

  const marked = await page.evaluate(() => {
    const active = document.querySelector('.lightbox__thumb[data-active]');
    return { index: active?.dataset.index, visible: !active?.closest('li').hasAttribute('hidden') };
  });
  expect(marked).toEqual({ index: '11', visible: true });
});

test('a short set needs no window and no arrows', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'default');
  await openAt(page, 0);

  const state = await stripState(page);
  expect(state).toMatchObject({ total: 6, shown: 6 });
  await expect(page.locator('[data-action="strip-prev"]')).toBeHidden();
  await expect(page.locator('[data-action="strip-next"]')).toBeHidden();
});

test('the zoom controls are one group with the reset outside it', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'zoom');
  await openAt(page, 0);

  const cluster = await page.evaluate(() => {
    const group = document.querySelector('.lightbox__zoom');
    const style = getComputedStyle(group);
    return {
      order: [...group.children].map(
        (child) => child.dataset.action ?? child.className.split(' ')[0],
      ),
      border: `${style.borderTopWidth} ${style.borderTopStyle}`,
      rounded: Number.parseFloat(style.borderTopLeftRadius) > 0,
      resetOutside: !group.contains(document.querySelector('[data-action="zoom-reset"]')),
    };
  });

  expect(cluster).toEqual({
    order: ['zoom-out', 'lightbox__zoom-field', 'lightbox__zoom-suffix', 'zoom-in'],
    border: '1px solid',
    rounded: true,
    resetOutside: true,
  });
});

test('the zoom level can be typed, and only settles when it is committed', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'zoom');
  await openAt(page, 0);

  const field = page.locator('.lightbox__zoom-field');
  await expect(field).toHaveValue('100');

  // Clamping on every keystroke is what makes such a field impossible to type into: the
  // `1` of `150` would become `100` and the rest would have nowhere to go.
  await field.click();
  await field.press('Control+a');
  await field.type('150');
  expect(await page.evaluate(() => document.querySelector('ui-lightbox').scale)).toBe(1);

  await field.press('Enter');
  expect(await page.evaluate(() => document.querySelector('ui-lightbox').scale)).toBe(1.5);

  // Three figures, and the field is wide enough to show them.
  await field.fill('325');
  await field.press('Enter');
  expect(await page.evaluate(() => document.querySelector('ui-lightbox').scale)).toBe(3.25);
  await expect(field).toHaveValue('325');
  expect(
    await page.evaluate(() => {
      const box = document.querySelector('.lightbox__zoom-field');
      return box.scrollWidth <= box.clientWidth;
    }),
  ).toBe(true);

  // Over the limit clamps rather than refusing.
  await field.fill('900');
  await field.press('Enter');
  expect(await page.evaluate(() => document.querySelector('ui-lightbox').scale)).toBe(4);
  await expect(field).toHaveValue('400');

  // Nonsense leaves the picture alone and puts the real level back.
  await field.fill('abc');
  await field.press('Enter');
  expect(await page.evaluate(() => document.querySelector('ui-lightbox').scale)).toBe(4);
  await expect(field).toHaveValue('400');
});

test('a zoom control that turns itself off does not take the keyboard with it', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'zoom');
  await openAt(page, 0);

  const host = () => page.evaluate(() => document.querySelector('ui-lightbox').scale);
  const focused = () =>
    page.evaluate(() => ({
      inside: document.querySelector('.lightbox__panel').contains(document.activeElement),
      action: document.activeElement.dataset?.action ?? document.activeElement.tagName,
      disabled: document.activeElement.disabled ?? false,
    }));

  // Every one of these turns itself off as a direct result of being pressed, so the control
  // being disabled is the one under the finger. A disabled element cannot hold focus, and
  // focus on the body is focus outside the panel, where the keydown listener never sees it.
  for (const [setUp, press] of [
    [async () => page.locator('[data-action="zoom-in"]').click(), 'zoom-reset'],
    [async () => page.locator('[data-action="zoom-in"]').click(), 'zoom-out'],
    [
      async () => {
        for (let index = 0; index < 6; index += 1) {
          await page.locator('[data-action="zoom-in"]').click();
        }
      },
      null,
    ],
  ]) {
    await page.evaluate(() => document.querySelector('ui-lightbox').resetZoom());
    await setUp();
    if (press) {
      await page.locator(`[data-action="${press}"]`).click();
    }
    await page.waitForTimeout(200);

    const landed = await focused();
    expect(landed.inside).toBe(true);
    expect(landed.disabled).toBe(false);

    // And the proof that it matters: the keyboard still reaches the panel.
    const before = await host();
    await page.keyboard.press(before >= 4 ? '-' : '+');
    await page.waitForTimeout(150);
    expect(await host()).not.toBe(before);
  }
});

test('the picture goes to four times life size by every route', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'zoom');
  await openAt(page, 0);

  const scale = () => page.evaluate(() => document.querySelector('ui-lightbox').scale);
  const grow = page.locator('[data-action="zoom-in"]');
  const reset = page.locator('[data-action="zoom-reset"]');

  // The button, and the number of presses it takes — a ceiling that cannot be reached
  // without wearing the pointer out is not really a ceiling.
  let presses = 0;
  while ((await scale()) < 4 && presses < 20) {
    await grow.click();
    presses += 1;
  }
  expect(await scale()).toBe(4);
  expect(presses).toBe(6);
  await expect(grow).toBeDisabled();

  // The picture is really drawn four times the size, not merely reporting it. Let the
  // transition settle first, or the reading is caught in flight and lands somewhere in the
  // middle — `2.91613` the first time this was measured.
  await page.waitForTimeout(300);
  const drawn = await page.evaluate(() => getComputedStyle(document.querySelector('.lightbox__image')).scale);
  expect(drawn).toBe('4');

  await reset.click();
  expect(await scale()).toBe(1);

  // The keyboard.
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press('+');
  }
  expect(await scale()).toBe(4);

  await page.keyboard.press('0');
  expect(await scale()).toBe(1);

  // The wheel.
  await page.locator('.lightbox__frame').hover();
  for (let index = 0; index < 14; index += 1) {
    await page.mouse.wheel(0, -120);
  }
  await page.waitForTimeout(200);
  expect(await scale()).toBe(4);
});

test('the picture keeps the whole width and the arrows sit over it', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'default');
  await openAt(page, 1);

  const measured = await page.evaluate(() => {
    const linear = (channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    const ratio = (a, b) => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (light + 0.05) / (dark + 0.05);
    };
    const over = (colour, alpha, behind) =>
      colour.map((channel, index) => channel * alpha + behind[index] * (1 - alpha));

    const stage = document.querySelector('.lightbox__stage').getBoundingClientRect();
    const frame = document.querySelector('.lightbox__frame').getBoundingClientRect();
    const next = document.querySelector('.lightbox__nav--next');
    const style = getComputedStyle(next);
    const alpha = Number(style.opacity);
    const scrim = style.backgroundColor.match(/[\d.]+/g).map(Number);
    const white = [255, 255, 255];

    // The worst a faded control can face: a white photograph behind it.
    const scrimOverWhite = over(scrim.slice(0, 3), scrim[3] ?? 1, white);

    return {
      fillsStage: Math.round(frame.width) === Math.round(stage.width),
      position: style.position,
      overPicture: next.getBoundingClientRect().right <= frame.right,
      restingOpacity: alpha,
      // Faded, not hidden: something nobody can find is not a control.
      contrast: ratio(over(white, alpha, white), over(scrimOverWhite, alpha, white)),
    };
  });

  expect(measured.fillsStage).toBe(true);
  expect(measured.position).toBe('absolute');
  expect(measured.overPicture).toBe(true);
  expect(measured.restingOpacity).toBeGreaterThan(0);
  expect(measured.contrast).toBeGreaterThanOrEqual(3);
});

test('hovering a thumbnail grows it and pushes its neighbours along', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'navigation');
  await openAt(page, 0);

  const positions = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.lightbox__thumbs li:not([hidden]) button')].map((button) =>
        Math.round(button.getBoundingClientRect().x),
      ),
    );
  const widthOf = (position) =>
    page.evaluate(
      (index) =>
        Math.round(document.querySelectorAll('.lightbox__thumb')[index].getBoundingClientRect().width),
      position,
    );

  const boxes = () =>
    page.evaluate(() => {
      const round = (element) => {
        const rect = element.getBoundingClientRect();
        return { height: Math.round(rect.height), top: Math.round(rect.top) };
      };
      return {
        strip: round(document.querySelector('.lightbox__strip')),
        stage: round(document.querySelector('.lightbox__stage')),
      };
    });

  const restWidth = await widthOf(1);
  const before = await positions();
  const restBoxes = await boxes();

  await page.locator('.lightbox__thumbs li:not([hidden]) button').nth(1).hover();
  await page.waitForTimeout(350);

  const hoverWidth = await widthOf(1);
  const after = await positions();
  const hoverBoxes = await boxes();

  expect(hoverWidth).toBeGreaterThan(restWidth);
  // Width rather than a transform, because only real width pushes the neighbours.
  expect(after.slice(2).every((x, index) => x > before.slice(2)[index])).toBe(true);

  // And nothing above it moves. A strip that grew with its thumbnails would shove the
  // picture upwards every time the pointer crossed it.
  expect(hoverBoxes).toEqual(restBoxes);
});

test('the bottom section folds away and stays folded', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'navigation');
  await openAt(page, 0);

  const toggle = page.locator('[data-action="strip-toggle"]');
  const strip = page.locator('.lightbox__strip');
  const stageHeight = () =>
    page.evaluate(() =>
      Math.round(document.querySelector('.lightbox__stage').getBoundingClientRect().height),
    );

  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(strip).toBeVisible();
  const opened = await stageHeight();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toHaveAttribute('aria-label', 'Show thumbnails');
  await expect(strip).toBeHidden();
  expect(await stageHeight()).toBeGreaterThan(opened);

  // Changing picture must not undo a decision somebody made.
  await page.evaluate(() => document.querySelector('ui-lightbox').step(1));
  await page.waitForTimeout(200);
  await expect(strip).toBeHidden();

  // Folded, the tab has to be called back before it can be pressed — which is the point of
  // it, and the same thing a person does with the pointer.
  await page.mouse.move(500, 700);
  await page.waitForTimeout(300);
  await toggle.click();
  await expect(strip).toBeVisible();
});

test('the toggle is a notch on the strip rather than a button in the toolbar', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'navigation');
  await openAt(page, 0);

  const placed = await page.evaluate(() => {
    const toggle = document.querySelector('[data-action="strip-toggle"]');
    const strip = document.querySelector('.lightbox__strip');
    const bar = document.querySelector('.lightbox__bar');
    const t = toggle.getBoundingClientRect();
    const s = strip.getBoundingClientRect();

    return {
      inToolbar: bar.contains(toggle),
      onTheDock: toggle.closest('.lightbox__dock') !== null,
      above: Math.round(t.bottom - s.top),
      offCentre: Math.round(Math.abs(t.left + t.width / 2 - (s.left + s.width / 2))),
      radius: getComputedStyle(toggle).borderBottomLeftRadius,
      bottomBorder: getComputedStyle(toggle).borderBottomWidth,
    };
  });

  expect(placed.inToolbar).toBe(false);
  expect(placed.onTheDock).toBe(true);
  // Standing on the strip's top edge and overlapping it, so the two read as one surface.
  expect(placed.above).toBeLessThanOrEqual(1);
  expect(placed.above).toBeGreaterThanOrEqual(0);
  expect(placed.offCentre).toBeLessThanOrEqual(1);
  expect(placed.radius).toBe('0px');
  expect(placed.bottomBorder).toBe('0px');
});

test('every icon in the viewer is a stroked outline, none a black fill', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'navigation');
  await openAt(page, 0);

  // A path left out of the icon rule is not merely unstyled: SVG falls back to `fill: black`
  // and `stroke: none`, which on a dark panel reads as a dark smudge. That is a silent
  // failure, so it is checked for every icon rather than for the one that was noticed.
  const icons = await page.evaluate(() => {
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
    const contrast = (a, b) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const behind = (element) => {
      for (let node = element; node; node = node.parentElement) {
        const paint = getComputedStyle(node).backgroundColor;
        if (paint && paint !== 'rgba(0, 0, 0, 0)' && paint !== 'transparent') {
          return paint;
        }
      }
      return 'rgb(0, 0, 0)';
    };

    return [...document.querySelectorAll('.lightbox__panel svg path')].map((path) => {
      const style = getComputedStyle(path);
      const owner = path.closest('button');
      return {
        action: owner?.dataset.action ?? owner?.className ?? 'unknown',
        stroked: style.stroke !== 'none' && style.fill === 'none',
        contrast: +contrast(channels(style.stroke), channels(behind(owner ?? path))).toFixed(2),
      };
    });
  });

  expect(icons.length).toBeGreaterThan(6);
  expect(icons.filter((icon) => !icon.stroked)).toEqual([]);
  // Well past the 3:1 a user interface component needs; these are plain light-on-dark.
  // `!(x >= 4.5)` rather than `x < 4.5`, so an unmeasurable icon fails instead of slipping
  // through on a `NaN` comparison that is false either way.
  expect(icons.filter((icon) => !(icon.contrast >= 4.5))).toEqual([]);
});

const dockState = (page) =>
  page.evaluate(() => {
    const round = (selector) =>
      +document.querySelector(selector).getBoundingClientRect().height.toFixed(1);
    const tab = document.querySelector('.lightbox__dock-tab');
    const stage = document.querySelector('.lightbox__stage');
    const panel = document.querySelector('.lightbox__panel');
    return {
      dock: round('.lightbox__dock'),
      stage: round('.lightbox__stage'),
      opacity: +getComputedStyle(tab).opacity,
      hits: getComputedStyle(tab).pointerEvents,
      // The picture must reach the very bottom of the panel with nothing under it.
      gapBelowStage: +(
        panel.getBoundingClientRect().bottom - stage.getBoundingClientRect().bottom
      ).toFixed(1),
      tabOverPicture:
        tab.getBoundingClientRect().top < stage.getBoundingClientRect().bottom,
    };
  });

test('folded away, the bottom section gives the picture the whole frame', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'navigation');
  await openAt(page, 0);

  const open = await dockState(page);
  expect(open.dock).toBeGreaterThan(100);

  await page.locator('[data-action="strip-toggle"]').click();
  await page.waitForTimeout(500);
  await page.mouse.move(500, 150);
  await page.waitForTimeout(350);

  const shut = await dockState(page);
  // Nothing left over: not the strip, not its border, not the tab.
  expect(shut.dock).toBe(0);
  expect(shut.gapBelowStage).toBe(0);
  expect(shut.stage).toBeGreaterThan(open.stage);
  expect(shut.stage - open.stage).toBeCloseTo(open.dock, 0);

  // The tab is drawn over the picture rather than beside it, and is invisible until wanted.
  expect(shut.tabOverPicture).toBe(true);
  expect(shut.opacity).toBe(0);
  // And while invisible it must not eat presses meant for the picture.
  expect(shut.hits).toBe('none');
});

test('the folded tab comes back for the pointer, the keyboard and a touch', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'navigation');
  await openAt(page, 0);

  await page.locator('[data-action="strip-toggle"]').click();
  await page.waitForTimeout(500);

  const opacity = () =>
    page.evaluate(() => +getComputedStyle(document.querySelector('.lightbox__dock-tab')).opacity);

  // Halfway up the picture is not near enough.
  await page.mouse.move(500, 250);
  await page.waitForTimeout(350);
  expect(await opacity()).toBe(0);

  // Near the foot of the picture it appears.
  await page.mouse.move(500, 700);
  await page.waitForTimeout(350);
  expect(await opacity()).toBe(1);
  expect(
    await page.evaluate(
      () => getComputedStyle(document.querySelector('.lightbox__dock-tab')).pointerEvents,
    ),
  ).toBe('auto');

  // And away again.
  await page.mouse.move(500, 200);
  await page.waitForTimeout(350);
  expect(await opacity()).toBe(0);

  // The keyboard. An invisible control with no keyboard route is a dead end, so this is the
  // assertion that keeps the feature honest rather than merely pretty.
  let hops = 0;
  let reached = false;
  while (hops < 25 && !reached) {
    await page.keyboard.press('Tab');
    hops += 1;
    reached = await page.evaluate(
      () => document.activeElement?.dataset?.action === 'strip-toggle',
    );
  }
  expect(reached).toBe(true);
  await page.waitForTimeout(300);
  expect(await opacity()).toBe(1);

  // And pressing it brings the strip back.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  expect((await dockState(page)).dock).toBeGreaterThan(100);
});

test('a touch screen can find the folded tab, which never hovers', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 420, height: 760 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();

  await ready(page, 'navigation');
  await page.locator('.lightbox__item').first().tap();
  await expect(page.locator('.lightbox__panel')).toBeVisible();
  await page.waitForTimeout(400);

  await page.locator('[data-action="strip-toggle"]').tap();
  await page.waitForTimeout(500);

  // A touch always "leaves" the instant it lifts: the browser sends `pointerleave` straight
  // after `pointerup`. Treating that as "gone" undid the reveal in the same breath as the
  // tap that asked for it.
  const foot = await page.evaluate(
    () => document.querySelector('.lightbox__stage').getBoundingClientRect().bottom - 40,
  );
  await page.touchscreen.tap(210, foot);
  await page.waitForTimeout(400);

  expect(
    await page.evaluate(() => +getComputedStyle(document.querySelector('.lightbox__dock-tab')).opacity),
  ).toBe(1);

  await context.close();
});

test('the strip folds gradually rather than vanishing', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'navigation');
  await openAt(page, 0);

  const heights = await page.evaluate(async () => {
    const strip = document.querySelector('.lightbox__strip');
    const open = strip.getBoundingClientRect().height;
    const samples = [];

    document.querySelector('[data-action="strip-toggle"]').click();

    for (let frame = 0; frame < 14; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      samples.push(strip.getBoundingClientRect().height);
    }

    return { open, samples };
  });

  expect(heights.open).toBeGreaterThan(0);

  // Between full height and nothing there have to be real intermediate heights, or it is
  // not an animation, it is a disappearance.
  const between = heights.samples.filter((value) => value > 1 && value < heights.open - 1);
  expect(between.length).toBeGreaterThanOrEqual(4);
  expect(heights.samples.every((value, i) => i === 0 || value <= heights.samples[i - 1] + 0.5)).toBe(
    true,
  );
});

test('nothing in the chrome can be selected by pressing quickly', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'navigation');
  await openAt(page, 0);

  const selectable = await page.evaluate(() =>
    ['.lightbox__panel', '.lightbox__bar', '.lightbox__counter', '.lightbox__strip'].map(
      (selector) => getComputedStyle(document.querySelector(selector)).userSelect,
    ),
  );
  expect(selectable).toEqual(['none', 'none', 'none', 'none']);

  // A fast second press on a control is a double-click, and a double-click on unprotected
  // chrome runs a selection out across the whole panel.
  const next = page.locator('.lightbox__nav--next');
  await next.dblclick();
  await next.dblclick();
  expect(await page.evaluate(() => String(getSelection()))).toBe('');
});

test('the caption stays selectable', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'captions');
  await openAt(page, 0);

  expect(
    await page.evaluate(() => getComputedStyle(document.querySelector('.lightbox__caption')).userSelect),
  ).toBe('text');
});

test('a new picture slides in from the side it came from', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await ready(page, 'navigation');
  await openAt(page, 2);

  // Measured as a real position rather than a computed style: the slide is moved with the
  // `translate` property, which never appears in `transform`.
  const displacement = () =>
    page.evaluate(
      () =>
        document.querySelector('.lightbox__slide').getBoundingClientRect().left -
        document.querySelector('.lightbox__frame').getBoundingClientRect().left,
    );

  const travel = (action) =>
    page.evaluate(async (which) => {
      const slide = document.querySelector('.lightbox__slide');
      const frame = document.querySelector('.lightbox__frame');
      document.querySelector(`.lightbox__nav--${which}`).click();

      const samples = [];
      for (let step = 0; step < 12; step += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        samples.push(slide.getBoundingClientRect().left - frame.getBoundingClientRect().left);
      }

      return samples;
    }, action);

  expect(await displacement()).toBeCloseTo(0, 0);

  const forward = await travel('next');
  // Coming from the right: it starts to the right of home and walks back to nothing.
  expect(Math.max(...forward)).toBeGreaterThan(8);
  expect(forward.at(-1)).toBeLessThan(Math.max(...forward));

  await page.waitForTimeout(400);
  expect(await displacement()).toBeCloseTo(0, 0);

  const backward = await travel('prev');
  expect(Math.min(...backward)).toBeLessThan(-8);
  expect(backward.at(-1)).toBeGreaterThan(Math.min(...backward));

  await page.waitForTimeout(400);
  expect(await displacement()).toBeCloseTo(0, 0);
});

test('a thumbnail changes the picture', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'default');
  await openAt(page, 0);

  await page.locator('.lightbox__thumb').nth(4).click();
  await page.waitForTimeout(200);

  expect(
    await page.evaluate(() => ({
      index: document.querySelector('ui-lightbox').index,
      counter: document.querySelector('.lightbox__counter').textContent,
    })),
  ).toEqual({ index: 4, counter: '5 of 6' });
});

test('the ends are real ends unless the set loops', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });

  await ready(page, 'default');
  await openAt(page, 0);
  await expect(page.locator('[data-action="previous"]')).toBeDisabled();

  await ready(page, 'navigation');
  await openAt(page, 0);
  await expect(page.locator('[data-action="previous"]')).toBeEnabled();

  await page.locator('[data-action="previous"]').click();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.querySelector('ui-lightbox').index)).toBe(13);
});

test('the picture is fitted whole rather than clipped, at any shape', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'aspect');

  for (const index of [0, 1, 2]) {
    await openAt(page, index);

    const fits = await page.evaluate(() => {
      const frame = document.querySelector('.lightbox__frame').getBoundingClientRect();
      const image = document.querySelector('.lightbox__image').getBoundingClientRect();
      return {
        width: image.width <= frame.width + 1,
        height: image.height <= frame.height + 1,
      };
    });

    expect(fits, `picture ${index}`).toEqual({ width: true, height: true });

    await page.keyboard.press('Escape');
    await expect(page.locator('.lightbox__panel')).toBeHidden();
  }
});

test('one picture leaves no arrows and no strip', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'single');
  await openAt(page, 0);

  // Controls that could never do anything are furniture, and they take tab stops with them.
  await expect(page.locator('[data-action="previous"]')).toBeHidden();
  await expect(page.locator('[data-action="next"]')).toBeHidden();
  await expect(page.locator('.lightbox__strip')).toBeHidden();

  // Magnifying is about this picture rather than about the set, so it still works.
  await page.locator('[data-action="zoom-in"]').click();
  expect(await page.evaluate(() => document.querySelector('ui-lightbox').scale)).toBeGreaterThan(1);
});

test('a caption sits beside the alternative text rather than replacing it', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'captions');
  await openAt(page, 0);

  await expect(page.locator('.lightbox__caption')).toHaveText(
    'Bergsee Pass, 2,140 m. Shot at first light in early June.',
  );
  await expect(page.locator('.lightbox__image')).toHaveAttribute(
    'alt',
    'A glacier pass between two snow-streaked peaks',
  );

  // The third picture carries no caption, so nothing is shown for it.
  await page.evaluate(() => document.querySelector('ui-lightbox').goTo(2));
  await expect(page.locator('.lightbox__caption')).toBeHidden();
});

test('a press on the backdrop closes and one on the picture does not', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'default');
  await openAt(page, 0);

  const geometry = await page.evaluate(() => {
    const frame = document.querySelector('.lightbox__frame').getBoundingClientRect();
    const host = document.querySelector('ui-lightbox');
    const image = document.querySelector('.lightbox__image');
    const fit = Math.min(frame.width / image.naturalWidth, frame.height / image.naturalHeight);
    void host;
    return {
      centre: { x: frame.left + frame.width / 2, y: frame.top + frame.height / 2 },
      drawn: { width: image.naturalWidth * fit, height: image.naturalHeight * fit },
      frame: { width: frame.width, height: frame.height },
    };
  });

  // On the picture itself: nothing happens.
  await page.mouse.click(geometry.centre.x, geometry.centre.y);
  await page.waitForTimeout(200);
  await expect(page.locator('.lightbox__panel')).toBeVisible();

  // On the dark surround beside it. The element fills the frame, so this press still
  // arrives on the image and only the drawn rectangle tells them apart.
  const beside = geometry.centre.x + geometry.drawn.width / 2 + 20;
  expect(beside).toBeLessThan(geometry.centre.x + geometry.frame.width / 2);

  await page.mouse.click(beside, geometry.centre.y);
  await page.waitForTimeout(250);
  await expect(page.locator('.lightbox__panel')).toBeHidden();
});

test('the gallery still works with scripting disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1000, height: 720 });
  await page.goto(`${COMPONENT_BASE}/default/index.html`);

  // Links to the full pictures, which is the fallback worth keeping.
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('.lightbox__item')].map((item) => ({
      tag: item.tagName,
      href: item.getAttribute('href'),
      alt: item.querySelector('img')?.getAttribute('alt'),
    })),
  );

  expect(links).toHaveLength(6);
  expect(links[0]).toEqual({
    tag: 'A',
    href: '../../assets/harbour-sunrise.svg',
    alt: 'Sunrise over a quiet harbour, two moored boats in silhouette',
  });

  // And no viewer is left lying visible over the page.
  expect(await page.locator('.lightbox__panel').count()).toBe(0);

  await context.close();
});

test('reduced motion removes the movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1000, height: 720 });
  await ready(page, 'default');
  await openAt(page, 0);

  const motion = await page.evaluate(() => ({
    panel: getComputedStyle(document.querySelector('.lightbox__panel')).transitionDuration,
    image: getComputedStyle(document.querySelector('.lightbox__image')).transitionDuration,
    slide: getComputedStyle(document.querySelector('.lightbox__slide')).transitionDuration,
    strip: getComputedStyle(document.querySelector('.lightbox__strip')).transitionDuration,
  }));

  expect(motion.panel).toBe('0s');
  expect(motion.image).toBe('0s');
  // The slide and the fold both work by clearing an inline transition, so what the
  // stylesheet says at that moment is the whole of it.
  expect(motion.slide).toBe('0s');
  expect(motion.strip).toBe('0s');

  // Folded as well as unfolded: the collapsed rule carries its own timing.
  await page.evaluate(() => document.querySelector('ui-lightbox').toggleStrip(false));
  expect(
    await page.evaluate(
      () => getComputedStyle(document.querySelector('.lightbox__strip')).transitionDuration,
    ),
  ).toBe('0s');

  // And the picture arrives without travelling.
  const stops = await page.evaluate(async () => {
    const slide = document.querySelector('.lightbox__slide');
    const frame = document.querySelector('.lightbox__frame');
    document.querySelector('ui-lightbox').step(1);

    const samples = [];
    for (let step = 0; step < 5; step += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      samples.push(slide.getBoundingClientRect().left - frame.getBoundingClientRect().left);
    }

    return samples;
  });
  expect(stops.every((value) => Math.abs(value) < 1)).toBe(true);
});
