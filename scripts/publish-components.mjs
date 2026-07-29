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
import { BUNDLES_URL_PREFIX, DEFAULT_BUNDLES_DIRECTORY } from './bundle-component.mjs';

const DEFAULT_DIST_DIRECTORY = path.join(PROJECT_ROOT, 'dist');
const OPTIONAL_DOCUMENTS = ['PROMPT-STANDALONE.md'];

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

    // Optional documents the registry may link to, so the published site can serve them.
    for (const documentName of OPTIONAL_DOCUMENTS) {
      try {
        await fs.copyFile(
          path.join(componentDirectory, documentName),
          path.join(destination, documentName),
        );
      } catch {
        // A component that does not ship this document is the common case.
      }
    }

    await fs.cp(path.join(componentDirectory, 'source'), path.join(destination, 'source'), {
      recursive: true,
    });

    // Only the thumbnail is served: the catalog cards read it. The generated poster and
    // WebM are QA evidence and a build gate, and nothing requests them at runtime, so
    // publishing them would ship hundreds of unused kilobytes.
    const thumbnailSegments = manifest.preview.thumbnail.split('/');
    await fs.mkdir(path.join(destination, ...thumbnailSegments.slice(0, -1)), {
      recursive: true,
    });
    await fs.copyFile(
      path.join(componentDirectory, ...thumbnailSegments),
      path.join(destination, ...thumbnailSegments),
    );
  }

  await packageAllComponents({
    componentsDirectory,
    outputDirectory: downloadsDirectory,
  });

  // The registry points the detail page at generated/bundles, so the published site
  // needs those files served from the same relative location. Copy per component rather
  // than the whole directory: it also holds bundles from test fixture runs.
  const publishedBundlesDirectory = path.join(distDirectory, ...BUNDLES_URL_PREFIX.split('/'));
  for (const { manifest } of records) {
    await fs.cp(
      path.join(DEFAULT_BUNDLES_DIRECTORY, manifest.id),
      path.join(publishedBundlesDirectory, manifest.id),
      { recursive: true },
    );
  }

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
