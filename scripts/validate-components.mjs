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
    const records = await validateComponents();
    console.log(`Validated ${records.length} component${records.length === 1 ? '' : 's'}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
