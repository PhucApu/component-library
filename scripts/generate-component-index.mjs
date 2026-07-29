import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_COMPONENTS_DIRECTORY,
  DEFAULT_GENERATED_INDEX,
  isExecutedDirectly,
  readAndValidateComponents,
  writeJson,
} from './lib/component-tools.mjs';

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

async function toRegistryEntry({ componentDirectory, manifest }) {
  const componentRoot = `components/${manifest.id}`;

  return {
    schemaVersion: manifest.schemaVersion,
    id: manifest.id,
    version: manifest.version,
    name: manifest.name,
    description: manifest.description,
    group: manifest.group,
    categories: manifest.categories,
    tags: manifest.tags,
    technologies: manifest.technologies,
    variants: manifest.variants,
    preview: {
      ...manifest.preview,
      thumbnail: `${componentRoot}/${manifest.preview.thumbnail}`,
      poster: `${componentRoot}/preview/poster.png`,
      motion: `${componentRoot}/preview/demo.webm`,
    },
    docs: {
      readme: `${componentRoot}/README.md`,
      design: `${componentRoot}/DESIGN.md`,
      prompt: `${componentRoot}/PROMPT.md`,
    },
    source: {
      files: await listSourceFiles(componentDirectory, manifest.id),
    },
    download: `downloads/${manifest.id}-${manifest.version}.zip`,
  };
}

export async function generateComponentIndex({
  componentsDirectory = DEFAULT_COMPONENTS_DIRECTORY,
  outputFile = DEFAULT_GENERATED_INDEX,
} = {}) {
  const records = await readAndValidateComponents({ componentsDirectory });
  const registry = (await Promise.all(records.map(toRegistryEntry))).sort((left, right) =>
    left.id.localeCompare(right.id, 'en'),
  );

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
