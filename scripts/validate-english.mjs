import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ENGLISH_ROOT = path.resolve(MODULE_DIRECTORY, '..');

const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.gitnexus',
  'dist',
  'generated',
  'node_modules',
]);

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.svg',
  '.txt',
  '.yaml',
  '.yml',
]);

const NON_ENGLISH_PATTERNS = [
  {
    code: 'accented-latin',
    pattern: /[\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f\u1e00-\u1eff]/u,
    message: 'contains accented Latin text',
  },
  {
    code: 'vietnamese-document-language',
    pattern: new RegExp(`lang\\s*=\\s*["']vi(?:["'-])`, 'i'),
    message: 'declares a Vietnamese document language',
  },
  {
    code: 'vietnamese-locale',
    pattern: new RegExp(`\\bvi${'-'}VN\\b`, 'i'),
    message: 'contains a hardcoded Vietnamese locale',
  },
  {
    code: 'vietnamese-label-pack',
    pattern: new RegExp(`LABEL_PACKS(?:\\.|\\[['"])vi(?:['"]\\])?`, 'i'),
    message: 'contains a hardcoded Vietnamese label pack',
  },
  {
    code: 'vietnamese-locale-branch',
    pattern: new RegExp(`startsWith\\(["']vi["']\\)`, 'i'),
    message: 'contains a hardcoded Vietnamese locale branch',
  },
];

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

async function listTextFiles(rootDirectory) {
  const files = [];

  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(entryPath);
      }
    }
  }

  await visit(rootDirectory);
  return files.sort((left, right) => left.localeCompare(right, 'en'));
}

export async function findEnglishContentViolations({
  rootDirectory = DEFAULT_ENGLISH_ROOT,
} = {}) {
  const files = await listTextFiles(rootDirectory);
  const violations = [];

  for (const filePath of files) {
    const contents = await fs.readFile(filePath, 'utf8');
    const lines = contents.split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const rule of NON_ENGLISH_PATTERNS) {
        if (rule.pattern.test(line)) {
          violations.push({
            code: rule.code,
            file: toPosixPath(path.relative(rootDirectory, filePath)),
            line: index + 1,
            message: rule.message,
          });
        }
      }
    });
  }

  return violations;
}

export async function validateEnglishContent(options) {
  const violations = await findEnglishContentViolations(options);

  if (violations.length > 0) {
    const details = violations
      .map(({ file, line, message }) => `- ${file}:${line} ${message}`)
      .join('\n');
    throw new Error(`English content validation failed:\n${details}`);
  }

  return true;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    await validateEnglishContent();
    console.log('English content validation passed.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
