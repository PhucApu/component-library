import { createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import {
  DEFAULT_COMPONENTS_DIRECTORY,
  PROJECT_ROOT,
  isExecutedDirectly,
  readAndValidateComponents,
} from './lib/component-tools.mjs';
import { DEFAULT_BUNDLES_DIRECTORY, bundleComponent } from './bundle-component.mjs';

export const DEFAULT_DOWNLOADS_DIRECTORY = path.join(PROJECT_ROOT, 'dist', 'downloads');

async function createArchive(record, outputDirectory, bundlesDirectory) {
  const { componentDirectory, manifest } = record;
  const outputFile = path.join(outputDirectory, `${manifest.id}-${manifest.version}.zip`);

  await fs.mkdir(outputDirectory, { recursive: true });
  // The three ready-to-use files sit at the archive root so unzipping lands a consumer
  // straight on them; the full source tree stays available one level down.
  const bundle = await bundleComponent(record, { outputDirectory: bundlesDirectory });

  try {
    await new Promise((resolve, reject) => {
      const output = createWriteStream(outputFile);
      const archive = new ZipArchive({ zlib: { level: 9 } });

      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);
      archive.on('warning', (warning) => {
        if (warning.code === 'ENOENT') {
          reject(warning);
          return;
        }
        console.warn(warning.message);
      });

      archive.pipe(output);
      bundle.files.forEach((name) => {
        archive.file(path.join(bundle.directory, name), { name });
      });

      // README is the only authoring document a consumer needs, and the only one the
      // detail page does not offer as its own download. DESIGN and PROMPT stay out
      // because they describe how the component was built, not how to use it, and the
      // source tree stays out because the bundle already contains the same code.
      archive.file(path.join(componentDirectory, 'README.md'), { name: 'README.md' });

      if (bundle.hasAssets) {
        archive.directory(path.join(bundle.directory, 'assets'), 'assets');
      }

      archive.finalize();
    });
  } catch (error) {
    await fs.rm(outputFile, { force: true });
    throw error;
  }

  return outputFile;
}

export async function packageComponent(
  componentId,
  {
    componentsDirectory = DEFAULT_COMPONENTS_DIRECTORY,
    outputDirectory = DEFAULT_DOWNLOADS_DIRECTORY,
    bundlesDirectory = DEFAULT_BUNDLES_DIRECTORY,
  } = {},
) {
  const records = await readAndValidateComponents({ componentsDirectory });
  const record = records.find(({ manifest }) => manifest.id === componentId);

  if (!record) {
    throw new Error(`Unknown component id "${componentId}".`);
  }

  return createArchive(record, outputDirectory, bundlesDirectory);
}

export async function packageAllComponents({
  componentsDirectory = DEFAULT_COMPONENTS_DIRECTORY,
  outputDirectory = DEFAULT_DOWNLOADS_DIRECTORY,
  bundlesDirectory = DEFAULT_BUNDLES_DIRECTORY,
} = {}) {
  const records = await readAndValidateComponents({ componentsDirectory });
  return Promise.all(
    records.map((record) => createArchive(record, outputDirectory, bundlesDirectory)),
  );
}

if (isExecutedDirectly(import.meta.url)) {
  const componentId = process.argv[2];

  if (!componentId) {
    console.error('Usage: pnpm run package:component <component-id>');
    process.exitCode = 1;
  } else {
    try {
      const outputFile = await packageComponent(componentId);
      console.log(`Created ${path.relative(PROJECT_ROOT, outputFile)}.`);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
