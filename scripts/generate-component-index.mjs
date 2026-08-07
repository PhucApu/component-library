import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_COMPONENTS_DIRECTORY,
  DEFAULT_GENERATED_INDEX,
  isExecutedDirectly,
  readAndValidateComponents,
  writeJson,
} from './lib/component-tools.mjs';
import { BUNDLES_URL_PREFIX, bundleComponent } from './bundle-component.mjs';

const SOURCE_LANGUAGE_BY_EXTENSION = new Map([
  ['.css', 'css'],
  ['.html', 'html'],
  ['.js', 'javascript'],
  ['.json', 'json'],
  ['.md', 'markdown'],
  ['.mjs', 'javascript'],
  ['.svg', 'svg'],
  ['.txt', 'text'],
]);

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

async function listSourceFiles(componentDirectory, componentId) {
  const sourceDirectory = path.join(componentDirectory, 'source');
  const files = [];

  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      const language = SOURCE_LANGUAGE_BY_EXTENSION.get(extension);

      if (!language) {
        continue;
      }

      const sourcePath = toPosixPath(path.relative(componentDirectory, entryPath));
      files.push({
        path: sourcePath,
        url: `components/${componentId}/${sourcePath}`,
        language,
      });
    }
  }

  await visit(sourceDirectory);
  return files.sort((left, right) => left.path.localeCompare(right.path, 'en'));
}

async function hasFile(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function toRegistryEntry({ componentDirectory, manifest }, bundle) {
  const componentRoot = `components/${manifest.id}`;
  // Optional: a component may ship a prompt that targets the distributable three files
  // instead of the repository layout.
  const standalonePrompt = (await hasFile(path.join(componentDirectory, 'PROMPT-STANDALONE.md')))
    ? `${componentRoot}/PROMPT-STANDALONE.md`
    : null;

  return {
    schemaVersion: manifest.schemaVersion,
    id: manifest.id,
    // The homepage splits its two tabs on this. An absent kind means a regular
    // component, so every manifest written before the animations tab existed keeps
    // landing where it already did.
    kind: manifest.kind ?? 'component',
    version: manifest.version,
    name: manifest.name,
    description: manifest.description,
    group: manifest.group,
    categories: manifest.categories,
    tags: manifest.tags,
    technologies: manifest.technologies,
    variants: manifest.variants,
    // The generated poster and WebM stay out: they are QA evidence, nothing requests
    // them at runtime, and the published site does not carry them.
    preview: {
      ...manifest.preview,
      thumbnail: `${componentRoot}/${manifest.preview.thumbnail}`,
    },
    docs: {
      readme: `${componentRoot}/README.md`,
      design: `${componentRoot}/DESIGN.md`,
      prompt: `${componentRoot}/PROMPT.md`,
      ...(standalonePrompt ? { standalonePrompt } : {}),
    },
    source: {
      files: await listSourceFiles(componentDirectory, manifest.id),
    },
    // The three files a consumer actually copies into their project. The detail page
    // shows these instead of the full source tree.
    distribution: {
      files: bundle.files.map((name) => ({
        path: name,
        url: `${BUNDLES_URL_PREFIX}/${manifest.id}/${name}`,
        language: SOURCE_LANGUAGE_BY_EXTENSION.get(path.extname(name).toLowerCase()) ?? 'text',
      })),
    },
    download: `downloads/${manifest.id}-${manifest.version}.zip`,
  };
}

export async function generateComponentIndex({
  componentsDirectory = DEFAULT_COMPONENTS_DIRECTORY,
  outputFile = DEFAULT_GENERATED_INDEX,
  // Bundles sit next to the registry so a caller writing to a temporary directory keeps
  // its generated artifacts together instead of touching the repository output.
  bundlesDirectory = path.join(path.dirname(outputFile), 'bundles'),
} = {}) {
  const records = await readAndValidateComponents({ componentsDirectory });
  const registry = (
    await Promise.all(
      records.map(async (record) =>
        toRegistryEntry(
          record,
          await bundleComponent(record, { outputDirectory: bundlesDirectory }),
        ),
      ),
    )
  ).sort((left, right) => left.id.localeCompare(right.id, 'en'));

  await writeJson(outputFile, registry);
  return registry;
}

if (isExecutedDirectly(import.meta.url)) {
  try {
    const registry = await generateComponentIndex();
    console.log(
      `Generated component registry with ${registry.length} entr${registry.length === 1 ? 'y' : 'ies'}.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
