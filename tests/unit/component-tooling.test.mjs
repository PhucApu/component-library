import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { generateComponentIndex } from '../../scripts/generate-component-index.mjs';
import { generatePreviews } from '../../scripts/generate-previews.mjs';
import { packageComponent } from '../../scripts/package-component.mjs';
import {
  ComponentValidationError,
  readAndValidateComponents,
} from '../../scripts/lib/component-tools.mjs';

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_COMPONENTS_DIRECTORY = path.resolve(
  TEST_DIRECTORY,
  '..',
  'fixtures',
  'components',
);

async function createTemporaryDirectory(t, prefix = 'component-ui-test-') {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });
  return directory;
}

async function copyFixtureComponents(t) {
  const temporaryDirectory = await createTemporaryDirectory(t);
  const componentsDirectory = path.join(temporaryDirectory, 'components');
  await fs.cp(FIXTURE_COMPONENTS_DIRECTORY, componentsDirectory, { recursive: true });
  return { temporaryDirectory, componentsDirectory };
}

test('an empty components directory is valid', async (t) => {
  const temporaryDirectory = await createTemporaryDirectory(t);
  const componentsDirectory = path.join(temporaryDirectory, 'components');
  await fs.mkdir(componentsDirectory);

  const records = await readAndValidateComponents({ componentsDirectory });
  assert.deepEqual(records, []);
});

test('a valid component fixture satisfies schema and semantic checks', async () => {
  const records = await readAndValidateComponents({
    componentsDirectory: FIXTURE_COMPONENTS_DIRECTORY,
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].manifest.id, 'test-button');
});

test('missing required documents are rejected', async (t) => {
  const { componentsDirectory } = await copyFixtureComponents(t);
  await fs.rm(path.join(componentsDirectory, 'test-button', 'PROMPT.md'));

  await assert.rejects(
    readAndValidateComponents({ componentsDirectory }),
    (error) =>
      error instanceof ComponentValidationError &&
      error.errors.some((message) => message.includes('missing required document PROMPT.md')),
  );
});

test('unsafe variant paths are rejected', async (t) => {
  const { componentsDirectory } = await copyFixtureComponents(t);
  const manifestPath = path.join(componentsDirectory, 'test-button', 'component.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  manifest.variants[0].entry = '../outside/index.html';
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  await assert.rejects(
    readAndValidateComponents({ componentsDirectory }),
    (error) =>
      error instanceof ComponentValidationError &&
      error.errors.some((message) => message.includes('must match pattern')),
  );
});

test('duplicate component and variant IDs are reported', async (t) => {
  const { componentsDirectory } = await copyFixtureComponents(t);
  const originalDirectory = path.join(componentsDirectory, 'test-button');
  const duplicateDirectory = path.join(componentsDirectory, 'duplicate-folder');
  await fs.cp(originalDirectory, duplicateDirectory, { recursive: true });

  const manifestPath = path.join(originalDirectory, 'component.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  manifest.variants.push({ ...manifest.variants[0] });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  await assert.rejects(
    readAndValidateComponents({ componentsDirectory }),
    (error) =>
      error instanceof ComponentValidationError &&
      error.errors.some((message) => message.includes('duplicate component id "test-button"')) &&
      error.errors.some((message) => message.includes('duplicate variant id "default"')),
  );
});

test('registry generation is deterministic and supports an empty catalog', async (t) => {
  const temporaryDirectory = await createTemporaryDirectory(t);
  const componentsDirectory = path.join(temporaryDirectory, 'components');
  const outputFile = path.join(temporaryDirectory, 'generated', 'components-index.json');
  await fs.mkdir(componentsDirectory);

  const registry = await generateComponentIndex({ componentsDirectory, outputFile });
  assert.deepEqual(registry, []);
  assert.equal(await fs.readFile(outputFile, 'utf8'), '[]\n');
});

test('registry contains normalized runtime paths', async (t) => {
  const temporaryDirectory = await createTemporaryDirectory(t);
  const outputFile = path.join(temporaryDirectory, 'components-index.json');

  const registry = await generateComponentIndex({
    componentsDirectory: FIXTURE_COMPONENTS_DIRECTORY,
    outputFile,
  });

  assert.equal(registry[0].preview.motion, 'components/test-button/preview/demo.webm');
  assert.equal(registry[0].docs.design, 'components/test-button/DESIGN.md');
  assert.equal(registry[0].download, 'downloads/test-button-0.1.0.zip');
});

test('component package contains only the declared distributable files', async (t) => {
  const temporaryDirectory = await createTemporaryDirectory(t);
  const outputDirectory = path.join(temporaryDirectory, 'downloads');

  const outputFile = await packageComponent('test-button', {
    componentsDirectory: FIXTURE_COMPONENTS_DIRECTORY,
    outputDirectory,
  });
  const zip = new AdmZip(outputFile);
  const entries = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory)
    .map((entry) => entry.entryName)
    .sort();

  assert.deepEqual(entries, [
    'DESIGN.md',
    'PROMPT.md',
    'README.md',
    'component.json',
    'source/shared.css',
    'source/variants/default/index.html',
  ]);
  assert.ok((await fs.stat(outputFile)).size > 0);
});

test('preview generator captures a poster and an animated WebM', async (t) => {
  const { componentsDirectory } = await copyFixtureComponents(t);
  const previewDirectory = path.join(componentsDirectory, 'test-button', 'preview');

  const count = await generatePreviews({ componentsDirectory });
  const poster = await fs.readFile(path.join(previewDirectory, 'poster.png'));
  const motion = await fs.readFile(path.join(previewDirectory, 'demo.webm'));

  assert.equal(count, 1);
  assert.deepEqual([...poster.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(motion.length > 1_000);
});

test('packaging an unknown component fails without creating an archive', async (t) => {
  const temporaryDirectory = await createTemporaryDirectory(t);
  const outputDirectory = path.join(temporaryDirectory, 'downloads');

  await assert.rejects(
    packageComponent('missing-component', {
      componentsDirectory: FIXTURE_COMPONENTS_DIRECTORY,
      outputDirectory,
    }),
    /Unknown component id/,
  );
});
