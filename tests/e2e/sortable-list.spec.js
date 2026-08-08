import { expect, test } from '@playwright/test';

const COMPONENT_BASE = '/components/sortable-list/source/variants';
const VARIANTS = ['default', 'table', 'connected', 'keyboard', 'commit', 'markup', 'states'];

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
  await page.waitForFunction(() => customElements.get('ui-sortable-list'));
  await page.waitForFunction(() => document.querySelector('.sortable__handle') !== null);
}

/** Drags a handle with a real pointer, through real pointer capture. */
async function dragBy(page, handle, dy, { steps = 12, release = true } = {}) {
  const box = await handle.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy, { steps });

  if (release) {
    await page.mouse.up();
  }

  return { x, y };
}

/** The gap between two rows' bottom edges, which is what a downward swap has to cover. */
function travelBetween(page, listSelector, fromIndex, toIndex) {
  return page.evaluate(
    ([selector, from, to]) => {
      const rows = document.querySelectorAll(`${selector} .sortable__row`);
      return rows[to].getBoundingClientRect().bottom - rows[from].getBoundingClientRect().bottom;
    },
    [listSelector, fromIndex, toIndex],
  );
}

test('all seven variants run independently without external requests or overflow', async ({
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
      await expect(page.locator('ui-sortable-list').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('with no script the rows are still an ordered list', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${COMPONENT_BASE}/default/index.html`);

  const items = page.locator('ui-sortable-list ol li');
  await expect(items).toHaveCount(5);
  await expect(items.first()).toHaveText('Review pull requests');
  // Reordering is the enhancement, not the content.
  await expect(page.locator('.sortable__handle')).toHaveCount(0);

  await context.close();
});

test('a pointer drag reorders, and nothing moves before the threshold', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  const list = page.locator('ui-sortable-list');
  const handle = page.locator('.sortable__handle').first();

  // Under the threshold nothing is picked up at all. Without this, pressing a button inside a
  // row registers a one-pixel drag and the click never lands.
  await dragBy(page, handle, 3, { steps: 2, release: false });
  await expect(list).not.toHaveAttribute('data-sortable-dragging', '');
  await page.mouse.up();

  const before = await list.evaluate((node) => node.order);
  const travel = await travelBetween(page, 'ui-sortable-list', 0, 2);
  await dragBy(page, handle, travel);

  const after = await list.evaluate((node) => node.order);
  expect(after).toEqual([before[1], before[2], before[0], before[3], before[4]]);
  await expect(list.locator('[role="status"]')).toContainText('position 3 of 5');
});

test('a touch drag does the same thing as a mouse drag', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  // The whole reason this component does not use the HTML5 drag-and-drop API: that API does
  // not fire on touch in most mobile browsers, so on a phone the feature is simply absent.
  const result = await page.evaluate(async () => {
    const list = document.querySelector('ui-sortable-list');
    const handle = list.querySelector('.sortable__handle');
    const box = handle.getBoundingClientRect();
    const rows = list.querySelectorAll('.sortable__row');
    const travel = rows[1].getBoundingClientRect().bottom - rows[0].getBoundingClientRect().bottom;
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;

    const fire = (type, clientY) =>
      handle.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 7,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
          clientX: x,
          clientY,
        }),
      );

    const before = list.order;
    fire('pointerdown', y);
    fire('pointermove', y + travel);
    fire('pointerup', y + travel);

    return { before, after: list.order };
  });

  expect(result.after).toEqual([result.before[1], result.before[0], ...result.before.slice(2)]);
});

test('a touch drag on the handle does not scroll the page instead', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  // Without `touch-action: none` the browser claims the gesture for scrolling and the
  // component never sees it.
  const touchAction = await page
    .locator('.sortable__handle')
    .first()
    .evaluate((node) => getComputedStyle(node).touchAction);

  expect(touchAction).toBe('none');
});

test('the keyboard moves a row and keeps focus on the handle it moved', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'keyboard');

  const list = page.locator('ui-sortable-list');
  const status = list.locator('[role="status"]');
  const handle = page.locator('.sortable__handle').first();

  await handle.focus();
  await page.keyboard.press(' ');
  await expect(status).toContainText('Grabbed');
  await expect(status).toContainText('position 1 of 6');

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(status).toContainText('position 3 of 6');

  await page.keyboard.press(' ');
  await expect(status).toContainText('Dropped');

  expect(await list.evaluate((node) => node.order[2])).toBe('Draft the announcement');

  // Re-inserting a node removes it first, and removing the focused element blurs it. Being the
  // same node is not enough — somebody reordering by keyboard would be dropped on the body
  // after every move.
  expect(
    await page.evaluate(() => {
      const active = document.activeElement;
      const row = active?.closest('.sortable__row');
      return {
        isHandle: active?.classList.contains('sortable__handle') ?? false,
        rowIndex: row ? [...row.parentElement.children].indexOf(row) : -1,
      };
    }),
  ).toEqual({ isHandle: true, rowIndex: 2 });
});

test('escape puts the row back where it started, it does not drop it', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'keyboard');

  const list = page.locator('ui-sortable-list');
  const before = await list.evaluate((node) => node.order);

  await page.locator('.sortable__handle').first().focus();
  await page.keyboard.press(' ');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');

  // Held three places down: the announcement has moved even though nothing has committed.
  await expect(list.locator('[role="status"]')).toContainText('position 4 of 6');

  await page.keyboard.press('Escape');

  await expect(list.locator('[role="status"]')).toContainText('Reorder cancelled');
  expect(await list.evaluate((node) => node.order)).toEqual(before);

  // And the same three presses without the escape really would have moved it, so the test
  // above is not passing because the arrows did nothing.
  await page.locator('.sortable__handle').first().focus();
  await page.keyboard.press(' ');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press(' ');
  expect(await list.evaluate((node) => node.order)).not.toEqual(before);
});

test('a locked row is a wall, and the refusal names it', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  const stages = page.locator('#stages');
  const status = stages.locator('[role="status"]');

  // Marked with a lock rather than a colour, and positively rather than by an absent handle.
  const marks = await stages.evaluate((node) =>
    [...node.querySelectorAll('.sortable__row')].map((row) => ({
      locked: row.hasAttribute('data-sortable-locked'),
      lock: Boolean(row.querySelector('.sortable__lock')),
      handle: Boolean(row.querySelector('.sortable__handle')),
    })),
  );

  expect(marks[0]).toEqual({ locked: true, lock: true, handle: false });
  expect(marks[4]).toEqual({ locked: true, lock: true, handle: false });
  expect(marks[1]).toEqual({ locked: false, lock: false, handle: true });

  await stages.locator('.sortable__handle').first().focus();
  await page.keyboard.press(' ');
  await page.keyboard.press('ArrowUp');
  await expect(status).toHaveText('In progress cannot move past Triage.');

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(status).toHaveText('In progress cannot move past Closed.');
  await page.keyboard.press(' ');

  const order = await stages.evaluate((node) => node.order);
  expect(order[0]).toBe('Triage');
  expect(order[4]).toBe('Closed');

  // The same wall holds for a page driving the list itself.
  expect(await stages.evaluate((node) => node.move(1, 0))).toBe(false);
  expect(await stages.evaluate((node) => node.move(1, 3))).toBe(true);
});

test('table rows reorder without inventing a column', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'table');

  const list = page.locator('ui-sortable-list');

  // A component cannot invent a table column: a new cell would leave the header one heading
  // short and every row misaligned from it.
  const shape = await list.evaluate((node) => ({
    head: node.querySelectorAll('thead th').length,
    body: node.querySelector('tbody tr').children.length,
    handleInFirstCell: node.querySelector('tbody td').contains(node.querySelector('.sortable__handle')),
    // A row cannot carry a shadow while the table collapses its borders.
    collapse: getComputedStyle(node.querySelector('table')).borderCollapse,
  }));

  expect(shape.head).toBe(shape.body);
  expect(shape.handleInFirstCell).toBe(true);
  expect(shape.collapse).toBe('separate');

  const before = await list.evaluate((node) => node.order);
  const travel = await travelBetween(page, 'ui-sortable-list', 0, 1);
  await dragBy(page, page.locator('.sortable__handle').first(), travel);

  expect(await list.evaluate((node) => node.order)).toEqual([
    before[1],
    before[0],
    ...before.slice(2),
  ]);
});

test('a short row swaps at the tall row it is passing, not at half its own height', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'table');

  const list = page.locator('ui-sortable-list');
  const measured = await list.evaluate((node) => {
    const rows = [...node.querySelectorAll('.sortable__row')];
    return {
      heights: rows.map((row) => Math.round(row.getBoundingClientRect().height)),
      travel: rows[1].getBoundingClientRect().bottom - rows[0].getBoundingClientRect().bottom,
    };
  });

  // The demo data has to actually be ragged, or this test proves nothing.
  expect(new Set(measured.heights).size).toBeGreaterThan(1);

  const half = measured.travel / 2;
  const ownHalf = measured.heights[0] / 2;
  expect(Math.round(half)).not.toBe(Math.round(ownHalf));

  const handle = page.locator('.sortable__handle').first();

  // Just short of the neighbour's midpoint — but well past the dragged row's own — nothing has
  // moved. A formula built on the dragged row's size commits here, a place early.
  await dragBy(page, handle, half - 3, { release: false });
  expect(await list.evaluate((node) => node.querySelectorAll('[data-sortable-shifted]').length)).toBe(0);

  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + half + 3, { steps: 3 });
  expect(
    await list.evaluate((node) => node.querySelectorAll('[data-sortable-shifted]').length),
  ).toBeGreaterThan(0);

  await page.mouse.up();
});

/**
 * Replaces the demo's timer-based commit with one the test settles by hand.
 *
 * `pending` is a transient state, and asserting it against a fixed delay is a race the test
 * only wins on an idle machine — under the full suite the drag itself can outlast the timer.
 * Holding the promise open makes the window as long as the assertion needs.
 */
async function holdTheCommit(list) {
  await list.evaluate((node) => {
    node.commit = () =>
      new Promise((resolve, reject) => {
        window.__settleCommit = { resolve, reject };
      });
  });
}

test('a refused save puts the list back and says why', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'commit');

  const list = page.locator('#queue');
  const status = list.locator('[role="status"]');
  const before = await list.evaluate((node) => node.order);

  await holdTheCommit(list);

  const travel = await travelBetween(page, '#queue', 0, 1);
  await dragBy(page, page.locator('.sortable__handle').first(), travel);

  // Held while the request is out rather than pretending it already landed. The row is already
  // in its new place — that is the promise a refusal then has to take back.
  await expect(list).toHaveAttribute('pending', '');
  await expect(status).toHaveText('Saving the new order.');
  expect(await list.evaluate((node) => node.order)).toEqual([
    before[1],
    before[0],
    ...before.slice(2),
  ]);

  await page.evaluate(() => window.__settleCommit.reject(new Error('refused')));

  await expect(list).not.toHaveAttribute('pending', '');
  await expect(status).toContainText('could not be saved');
  expect(await list.evaluate((node) => node.order)).toEqual(before);
});

test('an accepted save keeps the new order', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'commit');

  const list = page.locator('#queue');
  const before = await list.evaluate((node) => node.order);

  await holdTheCommit(list);

  const travel = await travelBetween(page, '#queue', 0, 1);
  await dragBy(page, page.locator('.sortable__handle').first(), travel);

  await expect(list).toHaveAttribute('pending', '');
  await page.evaluate(() => window.__settleCommit.resolve());

  await expect(list.locator('[role="status"]')).toHaveText('Order saved.');
  await expect(list).not.toHaveAttribute('pending', '');
  expect(await list.evaluate((node) => node.order)).toEqual([
    before[1],
    before[0],
    ...before.slice(2),
  ]);
});

test('a disabled list disables its handles rather than swallowing the events', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'states');

  const stages = page.locator('#stages');
  await page.locator('[data-demo-action="disabled"]').click();

  // A control that looks operable and does nothing is worse than one that says it is off.
  const handles = stages.locator('.sortable__handle');
  await expect(handles.first()).toBeDisabled();

  const before = await stages.evaluate((node) => node.order);
  await stages.evaluate((node) => {
    node.querySelector('.sortable__handle').dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
    );
  });
  expect(await stages.evaluate((node) => node.order)).toEqual(before);
});

/** The three lists of the Connected variant: To do, In progress, Done. */
const orders = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('ui-sortable-list')].map((list) => ({
      name: list.listName,
      rows: list.order,
    })),
  );

test('a pointer drag moves a row into another list', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await ready(page, 'connected');

  const before = await orders(page);
  expect(before.map((list) => list.name)).toEqual(['To do', 'In progress', 'Done']);

  const handle = page.locator('ui-sortable-list').first().locator('.sortable__handle').first();
  const start = await handle.boundingBox();
  const done = await page.locator('ui-sortable-list').nth(2).boundingBox();

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2 + 10);
  await page.mouse.move(done.x + done.width / 2, done.y + done.height / 2, { steps: 12 });

  // While the drag is over it, the destination says so — and never only in colour: the
  // announcement has already named it, and the rows inside have opened a slot.
  await expect(page.locator('ui-sortable-list').nth(2)).toHaveAttribute(
    'data-sortable-target',
    '',
  );

  await page.mouse.up();

  const after = await orders(page);
  expect(after[0].rows).not.toContain(before[0].rows[0]);
  expect(after[2].rows).toEqual([before[0].rows[0]]);

  // Nothing left behind: no marks, no transforms.
  expect(
    await page.evaluate(() => ({
      marks: document.querySelectorAll('[data-sortable-target]').length,
      transforms: [...document.querySelectorAll('.sortable__row')].filter(
        (row) => row.style.transform,
      ).length,
    })),
  ).toEqual({ marks: 0, transforms: 0 });
});

test('the keyboard crosses lists, and the announcement names where it went', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await ready(page, 'connected');

  const first = page.locator('ui-sortable-list').first();
  const status = first.locator('[role="status"]');

  await first.locator('.sortable__handle').first().focus();
  await page.keyboard.press(' ');
  await expect(status).toContainText('Grabbed Review pull requests');

  // A cross-list move that says only "position 2 of 4" has left out the one thing that changed.
  await page.keyboard.press('ArrowRight');
  await expect(status).toHaveText('Review pull requests, In progress, position 1 of 3.');

  await page.keyboard.press('ArrowDown');
  await expect(status).toHaveText('Review pull requests, In progress, position 2 of 3.');

  await page.keyboard.press('ArrowRight');
  await expect(status).toHaveText('Review pull requests, Done, position 1 of 1.');

  // Running out of lists says so rather than going quiet.
  await page.keyboard.press('ArrowRight');
  await expect(status).toHaveText('There is no list that way for Review pull requests.');

  await page.keyboard.press(' ');

  const after = await orders(page);
  expect(after[2].rows).toEqual(['Review pull requests']);
  expect(after[0].rows).not.toContain('Review pull requests');

  // The row carried its focused handle across the border.
  expect(
    await page.evaluate(() => {
      const active = document.activeElement;
      const list = active?.closest('ui-sortable-list');
      return { isHandle: active?.classList.contains('sortable__handle'), list: list?.listName };
    }),
  ).toEqual({ isHandle: true, list: 'Done' });
});

test('cancelling over another list leaves no mark on it', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await ready(page, 'connected');

  const before = await orders(page);
  const first = page.locator('ui-sortable-list').first();

  await first.locator('.sortable__handle').first().focus();
  await page.keyboard.press(' ');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');

  // Held over Done, which is outlined as the destination.
  await expect(page.locator('ui-sortable-list').nth(2)).toHaveAttribute(
    'data-sortable-target',
    '',
  );

  await page.keyboard.press('Escape');

  // Tidying only the destination leaves the list the drag was *over* still outlined for a move
  // that never happened — the destination on a cancel is home, which is a different list.
  expect(
    await page.evaluate(() => ({
      marks: document.querySelectorAll('[data-sortable-target]').length,
      transforms: [...document.querySelectorAll('.sortable__row')].filter(
        (row) => row.style.transform,
      ).length,
    })),
  ).toEqual({ marks: 0, transforms: 0 });

  expect(await orders(page)).toEqual(before);
});

test('left and right stay unclaimed on a list with nowhere sideways to go', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  const list = page.locator('ui-sortable-list');
  const before = await list.evaluate((node) => node.order);

  await list.locator('.sortable__handle').first().focus();
  await page.keyboard.press(' ');

  // Binding them would imply a direction that does not exist and send a keyboard user looking
  // for it. The key events are left for the page to do whatever it already did with them.
  const claimed = await page.evaluate(() =>
    ['ArrowLeft', 'ArrowRight'].map((key) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      document.activeElement.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  );

  expect(claimed).toEqual([false, false]);
  expect(await list.evaluate((node) => node.order)).toEqual(before);

  // Up and down are untouched by any of this.
  await page.keyboard.press('ArrowDown');
  await expect(list.locator('[role="status"]')).toContainText('position 2 of 5');
});

test('an empty list is a target, and it is one before the drag starts', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await ready(page, 'connected');

  const done = page.locator('ui-sortable-list').nth(2);
  const slot = done.locator('[data-sortable-slot]');

  // Present at rest. A zone that appears the moment somebody picks a row up shoves the rest of
  // the board aside at the exact moment they are aiming at it.
  await expect(slot).toBeVisible();
  await expect(slot).toHaveText('Drop a row here');

  const restingHeight = await done.evaluate((node) =>
    Math.round(node.getBoundingClientRect().height),
  );

  const handle = page.locator('ui-sortable-list').first().locator('.sortable__handle').first();
  const start = await handle.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2 + 10);

  expect(
    await done.evaluate((node) => Math.round(node.getBoundingClientRect().height)),
  ).toBe(restingHeight);

  await page.mouse.up();
});

test('a locked row does not emigrate', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await ready(page, 'connected');

  const locked = page.locator('ui-sortable-list').first().locator('[data-sortable-locked]');

  await expect(locked).toHaveCount(1);
  await expect(locked).toContainText('Sign off the invoice');
  // It is a wall inside its own list, and it has no handle to leave by in any direction.
  await expect(locked.locator('.sortable__handle')).toHaveCount(0);
  await expect(locked.locator('.sortable__lock')).toHaveCount(1);
});

test('a refused save sends the row back across the border', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await ready(page, 'connected');

  const before = await orders(page);

  // The receiving list is the one making a claim about new state, so it is the one asked to
  // stand behind it.
  await page.evaluate(() => {
    document.querySelectorAll('ui-sortable-list')[2].commit = () =>
      new Promise((resolve, reject) => {
        window.__settleCommit = { resolve, reject };
      });
  });

  const first = page.locator('ui-sortable-list').first();
  await first.locator('.sortable__handle').first().focus();
  await page.keyboard.press(' ');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press(' ');

  const done = page.locator('ui-sortable-list').nth(2);
  await expect(done).toHaveAttribute('pending', '');
  expect((await orders(page))[2].rows).toEqual(['Review pull requests']);

  await page.evaluate(() => window.__settleCommit.reject(new Error('refused')));

  // Undoing a transfer is not undoing a reorder: the row has to go back across the border and
  // to the index it left, not merely restore this list's own order.
  await expect(done).not.toHaveAttribute('pending', '');
  await expect(done.locator('[role="status"]')).toContainText('back in To do at position 1');
  expect(await orders(page)).toEqual(before);
});

test('reduced motion drops the travel, not the reorder', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page, 'default');

  const list = page.locator('ui-sortable-list');
  expect(
    await list.evaluate((node) => getComputedStyle(node.querySelector('.sortable__row')).transitionDuration),
  ).toBe('0s');

  const before = await list.evaluate((node) => node.order);
  await page.locator('.sortable__handle').first().focus();
  await page.keyboard.press(' ');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press(' ');

  expect(await list.evaluate((node) => node.order)).toEqual([
    before[1],
    before[0],
    ...before.slice(2),
  ]);

  await page.emulateMedia({ reducedMotion: null });
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
    await ready(page, 'default');

    // Grab a row so the grabbed fill is really painted rather than read off a token.
    await page.locator('.sortable__handle').first().focus();
    await page.keyboard.press(' ');

    const painted = await page.evaluate(() => {
      const hex = (colour) =>
        `#${colour
          .match(/\d+/g)
          .slice(0, 3)
          .map((n) => Number(n).toString(16).padStart(2, '0'))
          .join('')}`;
      const list = document.querySelector('ui-sortable-list');
      const rows = [...list.querySelectorAll('.sortable__row')];

      return {
        row: hex(getComputedStyle(rows[1]).backgroundColor),
        grabbed: hex(getComputedStyle(rows[0]).backgroundColor),
        outline: hex(getComputedStyle(rows[0]).borderTopColor),
        ink: hex(getComputedStyle(rows[1]).color),
        handle: hex(getComputedStyle(list.querySelector('.sortable__handle')).color),
      };
    });

    await page.keyboard.press('Escape');

    // Words on a row.
    expect(contrast(painted.ink, painted.row)).toBeGreaterThanOrEqual(4.5);
    // The handle is a control somebody has to find and hit.
    expect(contrast(painted.handle, painted.row)).toBeGreaterThanOrEqual(3);
    // The grabbed row is a state, never carried by fill alone, but the fill still has to read.
    expect(contrast(painted.grabbed, painted.row)).toBeGreaterThanOrEqual(1.2);
    expect(contrast(painted.outline, painted.grabbed)).toBeGreaterThanOrEqual(3);
  }

  await page.emulateMedia({ colorScheme: null });
});
