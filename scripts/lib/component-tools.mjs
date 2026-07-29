import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv from 'ajv';

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(MODULE_DIRECTORY, '..', '..');
export const DEFAULT_COMPONENTS_DIRECTORY = path.join(PROJECT_ROOT, 'components');
export const DEFAULT_GENERATED_INDEX = path.join(
  PROJECT_ROOT,
  'generated',
  'components-index.json',
);
export const DEFAULT_SCHEMA_FILE = path.join(PROJECT_ROOT, 'schemas', 'component.schema.json');
export const REQUIRED_DOCUMENTS = ['README.md', 'DESIGN.md', 'PROMPT.md'];
export const PREVIEW_FILES = ['preview/poster.png', 'preview/demo.webm'];

let validatorPromise;

export class ComponentValidationError extends Error {
  constructor(errors) {
    super(`Component validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
    this.name = 'ComponentValidationError';
    this.errors = errors;
  }
}

async function getSchemaValidator() {
  if (!validatorPromise) {
    validatorPromise = fs.readFile(DEFAULT_SCHEMA_FILE, 'utf8').then((contents) => {
      const schema = JSON.parse(contents);
      const ajv = new Ajv({
        allErrors: true,
        strict: true,
      });
      return ajv.compile(schema);
    });
  }

  return validatorPromise;
}

async function isFile(filePath) {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

export function isSafeRelativePath(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  const normalized = value.replaceAll('\\', '/');

  if (
    normalized.startsWith('/') ||
    normalized.startsWith('./') ||
    /^[a-zA-Z]:\//.test(normalized)
  ) {
    return false;
  }

  return normalized.split('/').every((segment) => segment && segment !== '..' && segment !== '.');
}

function resolveInside(componentDirectory, relativePath) {
  if (!isSafeRelativePath(relativePath)) {
    return null;
  }

  const root = path.resolve(componentDirectory);
  const resolved = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return resolved;
}

function formatSchemaErrors(componentLabel, schemaErrors = []) {
  return schemaErrors.map((error) => {
    const location = error.instancePath || '(root)';
    return `${componentLabel}: ${location} ${error.message}`;
  });
}

export async function listComponentDirectories(componentsDirectory = DEFAULT_COMPONENTS_DIRECTORY) {
  let entries;

  try {
    entries = await fs.readdir(componentsDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => path.join(componentsDirectory, entry.name))
    .sort((left, right) => left.localeCompare(right, 'en'));
}

export async function inspectComponentDirectory(
  componentDirectory,
  { requirePreviewAssets = false } = {},
) {
  const folderName = path.basename(componentDirectory);
  const manifestPath = path.join(componentDirectory, 'component.json');
  const errors = [];
  let manifest;

  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch (error) {
    errors.push(
      `${folderName}: cannot read component.json (${error instanceof SyntaxError ? 'invalid JSON' : error.message})`,
    );
    return { componentDirectory, errors, manifest: null };
  }

  const validateSchema = await getSchemaValidator();
  const schemaValid = validateSchema(manifest);

  if (!schemaValid) {
    errors.push(...formatSchemaErrors(folderName, validateSchema.errors));
  }

  if (schemaValid) {
    if (manifest.id !== folderName) {
      errors.push(`${folderName}: folder name must match manifest id "${manifest.id}"`);
    }

    const variantIds = new Set();

    for (const variant of manifest.variants) {
      if (variantIds.has(variant.id)) {
        errors.push(`${folderName}: duplicate variant id "${variant.id}"`);
      }
      variantIds.add(variant.id);

      const expectedEntry = `source/variants/${variant.id}/index.html`;
      if (variant.entry !== expectedEntry) {
        errors.push(`${folderName}: variant "${variant.id}" entry must be "${expectedEntry}"`);
      }

      const entryPath = resolveInside(componentDirectory, variant.entry);
      if (!entryPath || !(await isFile(entryPath))) {
        errors.push(`${folderName}: variant entry does not exist or is unsafe: ${variant.entry}`);
      }
    }

    if (!variantIds.has(manifest.preview.variant)) {
      errors.push(
        `${folderName}: preview.variant "${manifest.preview.variant}" does not match a variant id`,
      );
    }

    const thumbnailPath = resolveInside(componentDirectory, manifest.preview.thumbnail);
    if (!thumbnailPath || !(await isFile(thumbnailPath))) {
      errors.push(
        `${folderName}: preview thumbnail does not exist or is unsafe: ${manifest.preview.thumbnail}`,
      );
    }

    for (const documentName of REQUIRED_DOCUMENTS) {
      if (!(await isFile(path.join(componentDirectory, documentName)))) {
        errors.push(`${folderName}: missing required document ${documentName}`);
      }
    }

    if (requirePreviewAssets) {
      for (const previewFile of PREVIEW_FILES) {
        if (!(await isFile(path.join(componentDirectory, ...previewFile.split('/'))))) {
          errors.push(`${folderName}: missing generated preview ${previewFile}`);
        }
      }
    }
  }

  return {
    componentDirectory,
    errors,
    manifest,
  };
}

export async function readAndValidateComponents({
  componentsDirectory = DEFAULT_COMPONENTS_DIRECTORY,
  requirePreviewAssets = false,
} = {}) {
  const directories = await listComponentDirectories(componentsDirectory);
  const inspections = await Promise.all(
    directories.map((directory) =>
      inspectComponentDirectory(directory, {
        requirePreviewAssets,
      }),
    ),
  );
  const errors = inspections.flatMap((inspection) => inspection.errors);
  const records = inspections
    .filter(({ manifest }) => manifest)
    .map(({ componentDirectory, manifest }) => ({
    componentDirectory,
    manifest,
    }));

  const duplicateIds = records
    .map(({ manifest }) => manifest.id)
    .filter((id) => typeof id === 'string')
    .filter((id, index, ids) => ids.indexOf(id) !== index);

  if (duplicateIds.length > 0) {
    errors.push(...[...new Set(duplicateIds)].map((id) => `duplicate component id "${id}"`));
  }

  if (errors.length > 0) {
    throw new ComponentValidationError(errors);
  }

  return records;
}

export async function writeJson(outputFile, value) {
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function isExecutedDirectly(moduleUrl) {
  return Boolean(process.argv[1]) && pathToFileURL(path.resolve(process.argv[1])).href === moduleUrl;
}
