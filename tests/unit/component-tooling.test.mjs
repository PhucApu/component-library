import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { concatenateModules } from '../../scripts/bundle-component.mjs';
import { generateComponentIndex } from '../../scripts/generate-component-index.mjs';
import { generatePreviews } from '../../scripts/generate-previews.mjs';
import { packageComponent } from '../../scripts/package-component.mjs';
import { publishComponents } from '../../scripts/publish-components.mjs';
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

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

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

test('a component reading a custom property it never defines is rejected', async (t) => {
  const { componentsDirectory } = await copyFixtureComponents(t);
  const styleFile = path.join(componentsDirectory, 'test-button', 'source', 'shared.css');

  // A borrowed catalog token: valid CSS, but the download would lose its styling.
  await fs.appendFile(styleFile, '\n.test-button { color: var(--text-primary); }\n');

  await assert.rejects(
    readAndValidateComponents({ componentsDirectory }),
    (error) =>
      error instanceof ComponentValidationError &&
      error.errors.some((message) =>
        message.includes('reads "--text-primary" but the component never defines it'),
      ),
  );
});

test('a component pointing at a catalog path is rejected', async (t) => {
  const { componentsDirectory } = await copyFixtureComponents(t);
  const variantFile = path.join(
    componentsDirectory,
    'test-button',
    'source',
    'variants',
    'default',
    'index.html',
  );

  const markup = await fs.readFile(variantFile, 'utf8');
  await fs.writeFile(
    variantFile,
    markup.replace(
      '<title>',
      '<link rel="stylesheet" href="/catalog/styles/main.css" />\n    <title>',
    ),
  );

  // Same origin, so the "no external requests" browser check would never see this.
  await assert.rejects(
    readAndValidateComponents({ componentsDirectory }),
    (error) =>
      error instanceof ComponentValidationError &&
      error.errors.some((message) => message.includes('references a catalog path')),
  );
});

test('a component defining every property it reads passes', async (t) => {
  const { componentsDirectory } = await copyFixtureComponents(t);
  const styleFile = path.join(componentsDirectory, 'test-button', 'source', 'shared.css');

  await fs.appendFile(
    styleFile,
    '\n.test-button { --test-button-ink: #fff; color: var(--test-button-ink); }\n',
  );

  const records = await readAndValidateComponents({ componentsDirectory });
  assert.equal(records.length, 1);
});

test('publishing ships the thumbnail but leaves the QA poster and WebM behind', async (t) => {
  const { temporaryDirectory, componentsDirectory } = await copyFixtureComponents(t);
  const previewDirectory = path.join(componentsDirectory, 'test-button', 'preview');
  const distDirectory = path.join(temporaryDirectory, 'dist');

  // Stand in for the assets the preview generator would produce.
  await fs.writeFile(path.join(previewDirectory, 'poster.png'), 'poster');
  await fs.writeFile(path.join(previewDirectory, 'demo.webm'), 'motion');

  await publishComponents({ componentsDirectory, distDirectory });

  const published = path.join(distDirectory, 'components', 'test-button', 'preview');
  assert.ok(await fileExists(path.join(published, 'thumbnail.svg')));
  assert.equal(await fileExists(path.join(published, 'poster.png')), false);
  assert.equal(await fileExists(path.join(published, 'demo.webm')), false);
});

test('bundling refuses to merge modules that declare the same top-level name', () => {
  const modules = [
    { specifier: 'core.js', code: 'export function pad(value) {\n  return value;\n}\n' },
    { specifier: 'shared.js', code: 'function pad(value) {\n  return value;\n}\n' },
  ];

  // Concatenated modules share one scope, so a duplicate would be a runtime SyntaxError.
  assert.throws(
    () => concatenateModules(modules, 'demo'),
    /"pad" is declared in both core\.js and shared\.js/,
  );
});

test('bundling keeps exports and drops only local import statements', () => {
  const modules = [
    { specifier: 'core.js', code: "export const ONE = 1;\n" },
    {
      specifier: 'shared.js',
      code: "import { ONE } from './core.js';\n\nexport const TWO = ONE + 1;\n",
    },
  ];

  const bundle = concatenateModules(modules, 'demo');
  assert.ok(!bundle.includes('import {'));
  assert.ok(bundle.includes('export const ONE = 1;'));
  assert.ok(bundle.includes('export const TWO = ONE + 1;'));
  assert.ok(bundle.indexOf('ONE = 1') < bundle.indexOf('TWO = ONE'));
});

test('packaging carries assets across and rewrites their references for the flat layout', async (t) => {
  const { temporaryDirectory, componentsDirectory } = await copyFixtureComponents(t);
  const componentDirectory = path.join(componentsDirectory, 'test-button');
  const variantFile = path.join(
    componentDirectory,
    'source',
    'variants',
    'default',
    'index.html',
  );

  await fs.mkdir(path.join(componentDirectory, 'source', 'assets'), { recursive: true });
  await fs.writeFile(
    path.join(componentDirectory, 'source', 'assets', 'logo.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"></svg>\n',
  );

  const variantHtml = await fs.readFile(variantFile, 'utf8');
  await fs.writeFile(
    variantFile,
    variantHtml.replace(
      '<button type="button">Test button</button>',
      '<img src="../../assets/logo.svg" alt="" />\n    <button type="button">Test button</button>',
    ),
  );

  const outputFile = await packageComponent('test-button', {
    componentsDirectory,
    outputDirectory: path.join(temporaryDirectory, 'downloads'),
    bundlesDirectory: path.join(temporaryDirectory, 'bundles'),
  });
  const zip = new AdmZip(outputFile);
  const entries = zip
    .getEntries()
    .filter((zipEntry) => !zipEntry.isDirectory)
    .map((zipEntry) => zipEntry.entryName)
    .sort();

  assert.ok(entries.includes('assets/logo.svg'));

  // A variant page climbs two levels to reach assets; the flat bundle puts them beside
  // the document, so an unrewritten reference would point outside the archive.
  const bundledHtml = zip.readAsText('test-button.html');
  assert.ok(bundledHtml.includes('src="assets/logo.svg"'));
  assert.ok(!bundledHtml.includes('../../assets/'));
});

test('component package contains only the ready-to-use files and integration notes', async (t) => {
  const temporaryDirectory = await createTemporaryDirectory(t);
  const outputDirectory = path.join(temporaryDirectory, 'downloads');

  const outputFile = await packageComponent('test-button', {
    componentsDirectory: FIXTURE_COMPONENTS_DIRECTORY,
    outputDirectory,
    bundlesDirectory: path.join(temporaryDirectory, 'bundles'),
  });
  const zip = new AdmZip(outputFile);
  const entries = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory)
    .map((entry) => entry.entryName)
    .sort();

  // The fixture ships no JavaScript, so only the stylesheet and the demo page are
  // bundled. Authoring documents and the source tree stay out of the archive.
  assert.deepEqual(entries, [
    'README.md',
    'test-button.css',
    'test-button.html',
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
