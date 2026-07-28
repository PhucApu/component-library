import {
  DEFAULT_COMPONENTS_DIRECTORY,
  DEFAULT_GENERATED_INDEX,
  isExecutedDirectly,
  readAndValidateComponents,
  writeJson,
} from './lib/component-tools.mjs';

function toRegistryEntry(manifest) {
  const componentRoot = `components/${manifest.id}`;

  return {
    schemaVersion: manifest.schemaVersion,
    id: manifest.id,
    version: manifest.version,
    name: manifest.name,
    description: manifest.description,
    categories: manifest.categories,
    tags: manifest.tags,
    technologies: manifest.technologies,
    variants: manifest.variants,
    preview: {
      ...manifest.preview,
      poster: `${componentRoot}/preview/poster.png`,
      motion: `${componentRoot}/preview/demo.webm`,
    },
    docs: {
      readme: `${componentRoot}/README.md`,
      design: `${componentRoot}/DESIGN.md`,
      prompt: `${componentRoot}/PROMPT.md`,
    },
    download: `downloads/${manifest.id}-${manifest.version}.zip`,
  };
}

export async function generateComponentIndex({
  componentsDirectory = DEFAULT_COMPONENTS_DIRECTORY,
  outputFile = DEFAULT_GENERATED_INDEX,
} = {}) {
  const records = await readAndValidateComponents({ componentsDirectory });
  const registry = records
    .map(({ manifest }) => toRegistryEntry(manifest))
    .sort((left, right) => left.id.localeCompare(right.id, 'en'));

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
