import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_COMPONENTS_DIRECTORY,
  PROJECT_ROOT,
  REQUIRED_DOCUMENTS,
  isExecutedDirectly,
  readAndValidateComponents,
} from './lib/component-tools.mjs';
import { packageAllComponents } from './package-component.mjs';

const DEFAULT_DIST_DIRECTORY = path.join(PROJECT_ROOT, 'dist');

export async function publishComponents({
  componentsDirectory = DEFAULT_COMPONENTS_DIRECTORY,
  distDirectory = DEFAULT_DIST_DIRECTORY,
} = {}) {
  const records = await readAndValidateComponents({
    componentsDirectory,
    requirePreviewAssets: true,
  });
  const publishedComponentsDirectory = path.join(distDirectory, 'components');
  const downloadsDirectory = path.join(distDirectory, 'downloads');

  await fs.mkdir(publishedComponentsDirectory, { recursive: true });
  await fs.mkdir(downloadsDirectory, { recursive: true });

  for (const { componentDirectory, manifest } of records) {
    const destination = path.join(publishedComponentsDirectory, manifest.id);
    await fs.mkdir(destination, { recursive: true });

    await fs.copyFile(
      path.join(componentDirectory, 'component.json'),
      path.join(destination, 'component.json'),
    );

    for (const documentName of REQUIRED_DOCUMENTS) {
      await fs.copyFile(
        path.join(componentDirectory, documentName),
        path.join(destination, documentName),
      );
    }

    await fs.cp(path.join(componentDirectory, 'source'), path.join(destination, 'source'), {
      recursive: true,
    });
    await fs.cp(path.join(componentDirectory, 'preview'), path.join(destination, 'preview'), {
      recursive: true,
    });
  }

  await packageAllComponents({
    componentsDirectory,
    outputDirectory: downloadsDirectory,
  });

  return records.length;
}

if (isExecutedDirectly(import.meta.url)) {
  try {
    const count = await publishComponents();
    console.log(`Published ${count} component${count === 1 ? '' : 's'} to dist.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
