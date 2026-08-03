import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function readRegistry() {
  return JSON.parse(
    await readFile(path.resolve('generated', 'components-index.json'), 'utf8'),
  );
}

function countLabel(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

const MOCK_PROMPT =
  '# Prompt\n\nCreate a small accessible button for a tooling test fixture.\n';
const MOCK_DESIGN =
  '# Design\n\nThis fixture uses a minimal design to verify the component and packaging contracts.\n';
const MOCK_ZIP = Buffer.from('mock-component-zip');

const MOCK_COMPONENT = {
  schemaVersion: 2,
  id: 'mock-button',
  version: '0.2.0',
  name: 'Mock Button',
  description: 'A registry-shaped fixture for detail page and download testing.',
  group: 'inputs',
  categories: ['button'],
  tags: ['fixture'],
  technologies: ['html', 'css', 'javascript'],
  variants: [
    {
      id: 'default',
      name: 'Default',
      description: 'A minimal default button used for browser contract tests.',
      entry: 'source/variants/default/index.html',
    },
  ],
  preview: {
    variant: 'default',
    thumbnail: 'tests/fixtures/components/test-button/preview/thumbnail.svg',
    viewport: { width: 800, height: 600 },
    durationMs: 1000,
  },
  docs: {
    readme: 'tests/fixtures/components/test-button/README.md',
    design: 'tests/fixtures/components/test-button/DESIGN.md',
    prompt: 'tests/fixtures/components/test-button/PROMPT.md',
  },
  source: {
    files: [
      {
        path: 'source/shared.css',
        url: 'tests/fixtures/components/test-button/source/shared.css',
        language: 'css',
      },
      {
        path: 'source/variants/default/index.html',
        url: 'tests/fixtures/components/test-button/source/variants/default/index.html',
        language: 'html',
      },
    ],
  },
  distribution: {
    files: [
      {
        path: 'mock-button.css',
        url: 'tests/fixtures/components/test-button/source/shared.css',
        language: 'css',
      },
      {
        path: 'mock-button.html',
        url: 'tests/fixtures/components/test-button/source/variants/default/index.html',
        language: 'html',
      },
    ],
  },
  download: 'downloads/mock-button-0.2.0.zip',
};

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

async function mountMockDetail(page) {
  await page.route('**/downloads/mock-button-0.2.0.zip', (route) =>
    route.fulfill({ body: MOCK_ZIP, contentType: 'application/zip' }),
  );
  await page.goto('/component.html?id=mock-browser-fixture');
  await page.evaluate(async (component) => {
    const { renderComponent } = await import('/catalog/scripts/component-page.js');
    renderComponent(component);
  }, MOCK_COMPONENT);
}

test('homepage is English, grouped, searchable, and free of external requests', async ({
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

  await page.goto('/index.html');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(
    page.getByRole('heading', {
      name: 'Discover components. Use them when you need them.',
      level: 1,
    }),
  ).toBeVisible();
  // Counts come from the registry so publishing another component does not fail this.
  const registry = await readRegistry();
  const inputs = registry.filter((component) => component.group === 'inputs');

  await expect(page.locator('#inputs')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inputs', level: 2 })).toBeVisible();
  await expect(page.locator('#inputs .component-card')).toHaveCount(inputs.length);
  await expect(page.locator('#component-count')).toHaveText(countLabel(registry.length, 'component'));
  await expect(page.locator('#result-summary')).toHaveText(countLabel(registry.length, 'result'));
  await expect(runtimeErrors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test('search matches group metadata, hides empty groups, and supports the slash shortcut', async ({
  page,
}) => {
  await page.goto('/index.html');
  const search = page.getByRole('searchbox');

  await expect(search).toHaveAttribute('placeholder', 'Search by component name or slug...');
  await page.keyboard.press('/');
  await expect(search).toBeFocused();

  const inputs = (await readRegistry()).filter((component) => component.group === 'inputs');
  await search.fill('Inputs');
  await expect(page.locator('#inputs')).toBeVisible();
  await expect(page.locator('#result-summary')).toHaveText(countLabel(inputs.length, 'result'));

  await search.fill('missing-query');
  await expect(page.locator('.component-group')).toHaveCount(0);
  await expect(page.getByText('No matching components')).toBeVisible();
  await expect(page.locator('#result-summary')).toHaveText('0 results');

  await search.fill('');
  await expect(page.locator('#inputs')).toBeVisible();
});

test('homepage cards use static SVG thumbnails and no media playback element', async ({
  page,
}) => {
  await page.goto('/index.html');
  const card = page.locator('.component-card').filter({ hasText: 'Temporal Picker' });

  await expect(card.locator('[data-component-thumbnail]')).toBeVisible();
  await expect(card.locator('[data-component-thumbnail]')).toHaveAttribute(
    'src',
    /\/components\/temporal-picker\/preview\/thumbnail\.svg$/,
  );
  await expect(card.locator('[data-component-technology]')).toHaveText('HTML · CSS · JS');
  await expect(card.locator('video')).toHaveCount(0);
  await expect(card.locator('[data-component-link]')).toHaveAttribute(
    'href',
    './component.html?id=temporal-picker',
  );
  await expect(card.locator('[data-component-link]')).toHaveAccessibleName(
    'View Temporal Picker',
  );
});

test('thumbnail failure keeps a stable fallback without changing card height', async ({
  page,
}) => {
  await page.goto('/index.html');
  const dimensions = await page.evaluate(async () => {
    const { createComponentCard } = await import('/catalog/scripts/app.js');
    const card = createComponentCard({
      id: 'broken-thumbnail',
      name: 'Broken Thumbnail',
      technologies: ['html'],
      preview: { thumbnail: 'data:image/svg+xml,not-valid-svg' },
    });
    // Scoped to one grid: the homepage renders a section per taxonomy group, so an
    // unscoped selector matches every group once a second one exists.
    const grid = document.querySelector('#inputs .component-group__grid');
    grid.append(card);
    const preview = card.querySelector('.component-card__preview');
    return {
      before: preview.getBoundingClientRect().height,
      cardSelector: '#inputs .component-card:last-child',
    };
  });

  const fallbackCard = page.locator(dimensions.cardSelector);
  await expect(fallbackCard.locator('[data-preview-fallback]')).toBeVisible();
  await expect(fallbackCard.locator('[data-component-thumbnail]')).toBeHidden();
  const after = await fallbackCard
    .locator('.component-card__preview')
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(Math.abs(after - dimensions.before)).toBeLessThan(1);
});

test('catalog grid remains responsive and the sticky header does not overflow', async ({
  page,
}) => {
  const cases = [
    { width: 390, height: 844, columns: 1 },
    { width: 768, height: 1024, columns: 2 },
    { width: 1440, height: 900, columns: 3 },
  ];

  for (const viewport of cases) {
    await page.setViewportSize(viewport);
    await page.goto('/index.html');

    const columnCount = await page
      .locator('.component-group__grid')
      .first()
      .evaluate((grid) =>
        getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
      );
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );

    expect(columnCount).toBe(viewport.columns);
    expect(hasHorizontalOverflow).toBe(false);
    await expect(page.locator('.site-header')).toHaveCSS('position', 'sticky');
  }
});

test('Geist fonts load locally and technical metadata uses Geist Mono', async ({ page }) => {
  const fontRequests = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font') {
      fontRequests.push(request.url());
    }
  });

  await page.goto('/index.html');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.fonts.load('400 16px Geist', 'Discover components'));
  await page.evaluate(() => document.fonts.load('400 12px "Geist Mono"', 'HTML CSS JS'));

  const families = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    technical: getComputedStyle(
      document.querySelector('[data-component-technology]'),
    ).fontFamily,
  }));

  expect(families.body).toContain('Geist');
  expect(families.technical).toContain('Geist Mono');
  expect(fontRequests.every((url) => new URL(url).origin === 'http://127.0.0.1:5173')).toBe(true);
});

test('detail renderer exposes English documents, source selection, downloads, and exclusive accordions', async ({
  page,
}) => {
  const runtimeErrors = trackRuntimeErrors(page);
  await mountMockDetail(page);

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('link', { name: 'Inputs' })).toHaveAttribute(
    'href',
    './index.html#inputs',
  );
  await expect(page.getByRole('heading', { name: 'Mock Button', level: 1 })).toBeVisible();
  await expect(page.locator('#component-preview')).toHaveCSS('height', '600px');
  await expect(page.locator('#active-variant-description')).toHaveText(
    'A minimal default button used for browser contract tests.',
  );

  const accordions = page.locator('[data-source-accordion]');
  await expect(accordions).toHaveCount(3);
  // Source Code starts open so the download button inside it stays discoverable.
  await expect(accordions.filter({ hasText: 'Source Code' })).toHaveAttribute('open', '');

  // The picker lists the distributable files by name, not the whole source tree.
  await expect(page.locator('#source-file-select')).toHaveAttribute(
    'data-value',
    'mock-button.css',
  );
  await page.locator('#source-file-select').click();
  await expect(page.locator('.file-select__option')).toHaveText([
    'mock-button.css',
    'mock-button.html',
  ]);
  await page.locator('.file-select__option', { hasText: 'mock-button.html' }).click();
  await expect(page.locator('#source-content')).toContainText('<!doctype html>');

  await page.getByText('Prompt', { exact: true }).click();
  await expect
    .poll(() =>
      accordions.filter({ hasText: 'Source Code' }).evaluate((element) => element.open),
    )
    .toBe(false);
  await expect(page.locator('#prompt-content')).toHaveText(MOCK_PROMPT.trim());

  const promptLink = page.getByRole('link', { name: 'Download PROMPT.md' });
  await expect(promptLink).toHaveAttribute('download', 'mock-button-PROMPT.md');

  const promptDownloadEvent = page.waitForEvent('download');
  await promptLink.click();
  const promptDownload = await promptDownloadEvent;
  expect(promptDownload.suggestedFilename()).toBe('mock-button-PROMPT.md');
  expect(await readFile(await promptDownload.path(), 'utf8')).toBe(MOCK_PROMPT);

  await page.getByText('Design System', { exact: true }).click();
  await expect(accordions.filter({ hasText: 'Prompt' })).not.toHaveAttribute('open');
  await expect(page.locator('#design-content')).toHaveText(MOCK_DESIGN.trim());

  const designLink = page.getByRole('link', { name: 'Download DESIGN.md' });
  await expect(designLink).toHaveAttribute('download', 'mock-button-DESIGN.md');

  const designDownloadEvent = page.waitForEvent('download');
  await designLink.click();
  const designDownload = await designDownloadEvent;
  expect(designDownload.suggestedFilename()).toBe('mock-button-DESIGN.md');
  expect(await readFile(await designDownload.path(), 'utf8')).toBe(MOCK_DESIGN);

  // The ZIP button lives inside Source Code, so reopening it is part of the flow.
  await page.getByText('Source Code', { exact: true }).click();
  const zipLink = page.getByRole('link', { name: 'Download component ZIP' });
  await expect(zipLink).toHaveAttribute('download', 'mock-button-0.2.0.zip');

  const zipDownloadEvent = page.waitForEvent('download');
  await zipLink.click();
  const zipDownload = await zipDownloadEvent;
  expect(zipDownload.suggestedFilename()).toBe('mock-button-0.2.0.zip');
  await expect(runtimeErrors).toEqual([]);
});

test('detail not-found states stay English and recover through catalog navigation', async ({
  page,
}) => {
  await page.goto('/component.html');
  await expect(page.getByRole('heading', { name: 'Component not found' })).toBeVisible();
  await expect(page.getByText(/missing an id parameter/i)).toBeVisible();

  await page.goto('/component.html?id=unknown-component');
  await expect(page.getByText(/No component with the ID/i)).toBeVisible();
  await page.getByRole('link', { name: 'Back to catalog' }).last().click();
  await expect(page).toHaveURL(/\/index\.html$/);
});

test('the catalog follows the operating system until a choice is stored', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 12, 14)');

  // A stored choice outranks the system, including after the system changes again.
  const toggle = page.getByRole('button', { name: 'Switch to light theme' });
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('component-ui-theme'))).toBe('light');

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('the theme is resolved before the first paint rather than after it', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  // Reading during head parsing proves the bootstrap ran ahead of the body, which is the
  // difference between a themed first paint and a visible flash of the other theme.
  await page.addInitScript(() => {
    document.addEventListener(
      'readystatechange',
      () => {
        if (document.readyState === 'interactive') {
          window.__themeAtParse = document.documentElement.dataset.theme;
        }
      },
      { once: true },
    );
  });
  await page.goto('/index.html');
  expect(await page.evaluate(() => window.__themeAtParse)).toBe('light');
});

test('a link out of a preview actually goes somewhere', async ({ page, context }) => {
  // Nothing may reach Google here; what is on trial is whether the click was allowed to try.
  await context.route(/google\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>away</title>' }),
  );

  const blocked = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('sandboxed frame')) {
      blocked.push(message.text());
    }
  });

  await page.goto('/component.html?id=locator-map');

  const frame = page.frameLocator('#component-preview');
  const link = frame.locator('.locator-map__directions').first();
  await expect(link).toHaveAttribute('target', '_blank');

  const opened = context.waitForEvent('page');
  await link.click();
  const away = await opened;

  // The preview iframe is sandboxed, and a sandbox without `allow-popups` swallows every
  // `target="_blank"` in every preview — silently, apart from one console line. Components
  // that offer a way out to a map, a spec or a repository all lose it at once.
  expect(blocked).toEqual([]);
  expect(away.url()).toContain('google.com/maps');

  // And it escapes the sandbox rather than inheriting it: a tab that cannot navigate itself
  // is a tab where nothing on the far side works.
  expect(await away.evaluate(() => document.title)).toBe('away');
  await away.close();
});

test('a preview is told which theme the catalog is showing', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/component.html?id=switch');

  const frame = page.frameLocator('#component-preview');
  await expect(frame.locator('.switch-demo')).toHaveCSS(
    'background-color',
    'rgb(244, 246, 250)',
  );
  await expect(page.locator('#component-preview')).toHaveCSS('color-scheme', 'light');

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  // No reload: the running preview answers the message and repaints in place.
  await expect(frame.locator('.switch-demo')).toHaveCSS(
    'background-color',
    'rgb(15, 17, 21)',
  );
  await expect(page.locator('#component-preview')).toHaveCSS('color-scheme', 'dark');
});

// Every converted component resolves its colours through light-dark(), so a page loaded
// under each colour scheme has to come back with a different surface. This is the guard
// against a component being converted in the stylesheet but pinned somewhere else.
const THEMED_PREVIEWS = [
  { id: 'accordion', root: '.accordion-demo' },
  { id: 'autocomplete', root: '.autocomplete-demo' },
  { id: 'breadcrumbs', root: '.breadcrumbs-demo' },
  { id: 'carousel', root: '.carousel-demo' },
  { id: 'card', root: '.card-demo' },
  { id: 'chip', root: '.chip-demo' },
  { id: 'drawer', root: '.drawer-demo' },
  { id: 'lightbox', root: '.lightbox-demo' },
  { id: 'locator-map', root: '.locator-map-demo' },
  { id: 'pagination', root: '.pagination-demo' },
  { id: 'radio-group', root: '.radio-group-demo' },
  { id: 'snackbar', root: '.snackbar-demo' },
  { id: 'switch', root: '.switch-demo' },
  { id: 'table', root: '.table-demo' },
  { id: 'temporal-picker', root: '.temporal-demo' },
  { id: 'text-field', root: '.text-field-demo' },
];

// One test per component rather than one loop over all of them: two navigations each
// spread across the workers, instead of sixteen queued behind a single worker while the
// rest of the suite waits on the same server.
for (const { id, root } of THEMED_PREVIEWS) {
  test(`the ${id} preview answers the colour scheme on its own`, async ({ page }) => {
    const registry = await readRegistry();
    const component = registry.find((entry) => entry.id === id);
    expect(component, `${id} is in the registry`).toBeTruthy();
    const variant =
      component.variants.find((item) => item.id === component.preview.variant) ??
      component.variants[0];
    const url = `/components/${id}/${variant.entry}`;

    const surfaceUnder = async (colorScheme) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(url);
      return page.locator(root).evaluate((node) => {
        const [r, g, b] = getComputedStyle(node)
          .backgroundColor.match(/[\d.]+/g)
          .map(Number);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      });
    };

    const light = await surfaceUnder('light');
    const dark = await surfaceUnder('dark');

    // Named in the message because a bare number tells you nothing about what failed.
    expect(light, `${id} light surface is lighter than its dark one`).toBeGreaterThan(dark);
    expect(light, `${id} light surface is actually light`).toBeGreaterThan(180);
    expect(dark, `${id} dark surface is actually dark`).toBeLessThan(60);
  });
}
