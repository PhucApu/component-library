import { createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import {
  DEFAULT_COMPONENTS_DIRECTORY,
  PROJECT_ROOT,
  REQUIRED_DOCUMENTS,
  isExecutedDirectly,
  readAndValidateComponents,
} from './lib/component-tools.mjs';

export const DEFAULT_DOWNLOADS_DIRECTORY = path.join(PROJECT_ROOT, 'dist', 'downloads');

async function createArchive(record, outputDirectory) {
  const { componentDirectory, manifest } = record;
  const outputFile = path.join(outputDirectory, `${manifest.id}-${manifest.version}.zip`);

  await fs.mkdir(outputDirectory, { recursive: true });

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
      archive.file(path.join(componentDirectory, 'component.json'), { name: 'component.json' });
      REQUIRED_DOCUMENTS.forEach((documentName) => {
        archive.file(path.join(componentDirectory, documentName), { name: documentName });
      });
      archive.file(
        path.join(componentDirectory, ...manifest.preview.thumbnail.split('/')),
        { name: manifest.preview.thumbnail },
      );
      archive.directory(path.join(componentDirectory, 'source'), 'source');
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
  } = {},
) {
  const records = await readAndValidateComponents({ componentsDirectory });
  const record = records.find(({ manifest }) => manifest.id === componentId);

  if (!record) {
    throw new Error(`Unknown component id "${componentId}".`);
  }

  return createArchive(record, outputDirectory);
}

export async function packageAllComponents({
  componentsDirectory = DEFAULT_COMPONENTS_DIRECTORY,
  outputDirectory = DEFAULT_DOWNLOADS_DIRECTORY,
} = {}) {
  const records = await readAndValidateComponents({ componentsDirectory });
  return Promise.all(records.map((record) => createArchive(record, outputDirectory)));
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
