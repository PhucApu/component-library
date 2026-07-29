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
import {
  findEnglishContentViolations,
  validateEnglishContent,
} from '../../scripts/validate-english.mjs';

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

async function mutateFixtureManifest(componentsDirectory, mutate) {
  const manifestPath = path.join(componentsDirectory, 'test-button', 'component.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  mutate(manifest);
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

test('an empty components directory is valid', async (t) => {
  const temporaryDirectory = await createTemporaryDirectory(t);
  const componentsDirectory = path.join(temporaryDirectory, 'components');
  await fs.mkdir(componentsDirectory);

  const records = await readAndValidateComponents({ componentsDirectory });
  assert.deepEqual(records, []);
});

test('a schema version 2 fixture satisfies taxonomy and preview contracts', async () => {
  const records = await readAndValidateComponents({
    componentsDirectory: FIXTURE_COMPONENTS_DIRECTORY,
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].manifest.schemaVersion, 2);
  assert.equal(records[0].manifest.group, 'inputs');
  assert.ok(records[0].manifest.variants[0].description);
  assert.equal(records[0].manifest.preview.thumbnail, 'preview/thumbnail.svg');
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

test('unsafe variant and thumbnail paths are rejected', async (t) => {
  const { componentsDirectory } = await copyFixtureComponents(t);
  await mutateFixtureManifest(componentsDirectory, (manifest) => {
    manifest.variants[0].entry = '../outside/index.html';
    manifest.preview.thumbnail = '../thumbnail.svg';
  });

  await assert.rejects(
    readAndValidateComponents({ componentsDirectory }),
    (error) =>
      error instanceof ComponentValidationError &&
      error.errors.filter((message) => message.includes('must match pattern')).length >= 2,
  );
});

test('missing thumbnails, invalid groups, and missing variant descriptions fail validation', async (t) => {
  const missingThumbnail = await copyFixtureComponents(t);
  await fs.rm(
    path.join(missingThumbnail.componentsDirectory, 'test-button', 'preview', 'thumbnail.svg'),
  );
  await assert.rejects(
    readAndValidateComponents({ componentsDirectory: missingThumbnail.componentsDirectory }),
    /preview thumbnail does not exist/,
  );

  const invalidGroup = await copyFixtureComponents(t);
  await mutateFixtureManifest(invalidGroup.componentsDirectory, (manifest) => {
    manifest.group = 'unknown';
  });
  await assert.rejects(
    readAndValidateComponents({ componentsDirectory: invalidGroup.componentsDirectory }),
    /must be equal to one of the allowed values/,
  );

  const missingDescription = await copyFixtureComponents(t);
  await mutateFixtureManifest(missingDescription.componentsDirectory, (manifest) => {
    delete manifest.variants[0].description;
  });
  await assert.rejects(
    readAndValidateComponents({ componentsDirectory: missingDescription.componentsDirectory }),
    /must have required property 'description'/,
  );
});

test('duplicate component and variant IDs are reported', async (t) => {
  const { componentsDirectory } = await copyFixtureComponents(t);
  const originalDirectory = path.join(componentsDirectory, 'test-button');
  const duplicateDirectory = path.join(componentsDirectory, 'duplicate-folder');
  await fs.cp(originalDirectory, duplicateDirectory, { recursive: true });
  await mutateFixtureManifest(componentsDirectory, (manifest) => {
    manifest.variants.push({ ...manifest.variants[0] });
  });

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

test('registry contains taxonomy, thumbnail, documents, and deterministic source files', async (t) => {
  const temporaryDirectory = await createTemporaryDirectory(t);
  const outputFile = path.join(temporaryDirectory, 'components-index.json');

  const registry = await generateComponentIndex({
    componentsDirectory: FIXTURE_COMPONENTS_DIRECTORY,
    outputFile,
  });
  const [component] = registry;

  assert.equal(component.group, 'inputs');
  assert.equal(
    component.preview.thumbnail,
    'components/test-button/preview/thumbnail.svg',
  );
  assert.equal(component.docs.design, 'components/test-button/DESIGN.md');
  assert.equal(component.docs.prompt, 'components/test-button/PROMPT.md');
  assert.equal(component.download, 'downloads/test-button-0.1.0.zip');
  assert.deepEqual(component.source.files, [
    {
      path: 'source/shared.css',
      url: 'components/test-button/source/shared.css',
      language: 'css',
    },
    {
      path: 'source/variants/default/index.html',
      url: 'components/test-button/source/variants/default/index.html',
      language: 'html',
    },
  ]);
  assert.ok(component.source.files.every((file) => !file.path.includes('..')));
});

test('component package contains docs, source, manifest, and the authored thumbnail', async (t) => {
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
    'preview/thumbnail.svg',
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

test('English validation passes for the repository and rejects accented fixture text', async (t) => {
  await validateEnglishContent();

  const temporaryDirectory = await createTemporaryDirectory(t);
  const disallowedText = String.fromCodePoint(0x54, 0x69, 0x1ebf, 0x6e, 0x67);
  await fs.writeFile(path.join(temporaryDirectory, 'fixture.md'), disallowedText);

  const violations = await findEnglishContentViolations({
    rootDirectory: temporaryDirectory,
  });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].code, 'accented-latin');
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
