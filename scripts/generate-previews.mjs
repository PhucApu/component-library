import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import {
  DEFAULT_COMPONENTS_DIRECTORY,
  PROJECT_ROOT,
  isExecutedDirectly,
  readAndValidateComponents,
} from './lib/component-tools.mjs';

async function captureComponentPreview(browser, baseUrl, record) {
  const { componentDirectory, manifest } = record;
  const variant = manifest.variants.find(({ id }) => id === manifest.preview.variant);
  const previewDirectory = path.join(componentDirectory, 'preview');
  const temporaryVideoDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), `component-preview-${manifest.id}-`),
  );

  await fs.mkdir(previewDirectory, { recursive: true });

  try {
    const context = await browser.newContext({
      viewport: manifest.preview.viewport,
      recordVideo: {
        dir: temporaryVideoDirectory,
        size: manifest.preview.viewport,
      },
    });
    const page = await context.newPage();
    const video = page.video();
    const absoluteEntryPath = path.join(componentDirectory, ...variant.entry.split('/'));
    const relativeProjectPath = path.relative(PROJECT_ROOT, absoluteEntryPath);
    const entryPath =
      !relativeProjectPath.startsWith('..') && !path.isAbsolute(relativeProjectPath)
        ? relativeProjectPath.replaceAll('\\', '/')
        : `/@fs/${absoluteEntryPath.replaceAll('\\', '/')}`;
    const entryUrl = new URL(entryPath, baseUrl);

    await page.goto(entryUrl.href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(previewDirectory, 'poster.png'),
      animations: 'allow',
    });
    await page.waitForTimeout(manifest.preview.durationMs);
    await context.close();

    if (!video) {
      throw new Error(`Playwright did not create a video for ${manifest.id}.`);
    }

    await video.saveAs(path.join(previewDirectory, 'demo.webm'));
  } finally {
    const resolvedTemporaryDirectory = path.resolve(temporaryVideoDirectory);
    const resolvedSystemTemp = path.resolve(os.tmpdir());

    if (resolvedTemporaryDirectory.startsWith(`${resolvedSystemTemp}${path.sep}`)) {
      await fs.rm(resolvedTemporaryDirectory, { recursive: true, force: true });
    }
  }
}

export async function generatePreviews({
  componentsDirectory = DEFAULT_COMPONENTS_DIRECTORY,
} = {}) {
  const records = await readAndValidateComponents({ componentsDirectory });

  if (records.length === 0) {
    return 0;
  }

  const server = await createServer({
    configFile: path.join(PROJECT_ROOT, 'vite.config.js'),
    server: {
      fs: {
        allow: [PROJECT_ROOT, componentsDirectory],
      },
      host: '127.0.0.1',
      port: 0,
    },
  });
  let browser;

  try {
    await server.listen();
    const baseUrl = server.resolvedUrls?.local?.[0];

    if (!baseUrl) {
      throw new Error('Vite did not expose a local URL for preview generation.');
    }

    browser = await chromium.launch({ headless: true });

    for (const record of records) {
      await captureComponentPreview(browser, baseUrl, record);
    }
  } finally {
    await browser?.close();
    await server.close();
  }

  return records.length;
}

if (isExecutedDirectly(import.meta.url)) {
  try {
    const count = await generatePreviews();
    console.log(
      count === 0
        ? 'No components found; preview generation skipped.'
        : `Generated previews for ${count} component${count === 1 ? '' : 's'}.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
