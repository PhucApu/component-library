import {
  DEFAULT_COMPONENTS_DIRECTORY,
  isExecutedDirectly,
  readAndValidateComponents,
} from './lib/component-tools.mjs';

export async function validateComponents({
  componentsDirectory = DEFAULT_COMPONENTS_DIRECTORY,
  requirePreviewAssets = false,
} = {}) {
  return readAndValidateComponents({
    componentsDirectory,
    requirePreviewAssets,
  });
}

if (isExecutedDirectly(import.meta.url)) {
  try {
    // The generated poster and WebM are gitignored, so only a local verification run can
    // require them. Asking for them by flag keeps the same script usable as the plain
    // contract check that a clean clone has to pass.
    const requirePreviewAssets = process.argv.includes('--require-previews');
    const records = await validateComponents({ requirePreviewAssets });
    console.log(
      `Validated ${records.length} component${records.length === 1 ? '' : 's'}${
        requirePreviewAssets ? ' including generated previews' : ''
      }.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
