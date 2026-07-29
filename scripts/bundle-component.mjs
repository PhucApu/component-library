import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_COMPONENTS_DIRECTORY,
  PROJECT_ROOT,
  isExecutedDirectly,
  readAndValidateComponents,
} from './lib/component-tools.mjs';

export const DEFAULT_BUNDLES_DIRECTORY = path.join(PROJECT_ROOT, 'generated', 'bundles');
export const BUNDLES_URL_PREFIX = 'generated/bundles';

const LOCAL_IMPORT = /^import\s*\{[^}]*\}\s*from\s*'\.\/([^']+)';?\s*$/gm;
const BARE_IMPORT = /^import\s+'\.\/([^']+)';?\s*$/gm;
const TOP_LEVEL_DECLARATION =
  /^(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;

/**
 * Collects local module specifiers in depth-first order so a module always appears
 * after everything it imports.
 */
async function collectModuleOrder(sourceDirectory, entrySpecifier, seen = new Set(), order = []) {
  if (seen.has(entrySpecifier)) {
    return order;
  }
  seen.add(entrySpecifier);

  const filePath = path.join(sourceDirectory, entrySpecifier);
  const code = await fs.readFile(filePath, 'utf8');

  for (const pattern of [LOCAL_IMPORT, BARE_IMPORT]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(code)) !== null) {
      await collectModuleOrder(sourceDirectory, match[1], seen, order);
    }
  }

  order.push({ specifier: entrySpecifier, code });
  return order;
}

/**
 * Concatenates local ES modules into one readable file. A bundler is deliberately not
 * used: the result is published as human-readable source on the detail page, so the
 * original formatting and comments have to survive untouched. Exports are kept so the
 * bundle stays importable as a module rather than only a side-effecting script.
 */
export function concatenateModules(modules, componentId) {
  const declarations = new Map();

  for (const { specifier, code } of modules) {
    TOP_LEVEL_DECLARATION.lastIndex = 0;
    let match;
    while ((match = TOP_LEVEL_DECLARATION.exec(code)) !== null) {
      const name = match[1];
      const owner = declarations.get(name);

      // Concatenated modules share one top-level scope. Duplicate lexical names are a
      // SyntaxError at runtime, so fail here with the exact collision instead.
      if (owner && owner !== specifier) {
        throw new Error(
          `${componentId}: cannot bundle, "${name}" is declared in both ${owner} and ${specifier}. ` +
            'Move the shared declaration into one module and import it.',
        );
      }

      declarations.set(name, specifier);
    }
  }

  const chunks = modules.map(({ specifier, code }) => {
    const stripped = code.replace(LOCAL_IMPORT, '').replace(BARE_IMPORT, '').trim();
    return `/* ---- ${specifier} ---- */\n\n${stripped}\n`;
  });

  return chunks.join('\n');
}

function reindent(markup, indent) {
  const lines = markup.replace(/\r\n/g, '\n').split('\n');
  const widths = lines
    .filter((line) => line.trim())
    .map((line) => line.match(/^ */)[0].length);
  const shortest = widths.length ? Math.min(...widths) : 0;

  return lines
    .map((line) => (line.trim() ? `${indent}${line.slice(shortest)}` : ''))
    .join('\n')
    .trim();
}

function buildDemoDocument({ manifest, variantHtml, cssName, jsName }) {
  // Reuse the published variant markup so the demo cannot drift from the real preview.
  const bodyMatch = variantHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  const htmlMatch = variantHtml.match(/<html([^>]*)>/);
  const body = (bodyMatch ? bodyMatch[1] : variantHtml)
    // The bundle replaces every local module, so demo imports point at it instead.
    .replace(/from\s+'(?:\.\.\/)+[^']+'/g, `from './${jsName}'`)
    // Variant pages sit two levels below source/, so their asset references climb out.
    // The bundle is flat, which puts assets/ right next to the document.
    .replace(/(?:\.\.\/)+assets\//g, 'assets/');

  return `<!doctype html>
<html${htmlMatch ? htmlMatch[1] : ' lang="en"'}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${manifest.name}</title>
    <link rel="stylesheet" href="./${cssName}" />
    <script type="module" src="./${jsName}"></script>
  </head>
  <body>
    ${reindent(body, '    ')}
  </body>
</html>
`;
}

export async function bundleComponent(record, { outputDirectory = DEFAULT_BUNDLES_DIRECTORY } = {}) {
  const { componentDirectory, manifest } = record;
  const sourceDirectory = path.join(componentDirectory, 'source');
  const destination = path.join(outputDirectory, manifest.id);
  const cssName = `${manifest.id}.css`;
  const jsName = `${manifest.id}.js`;
  const htmlName = `${manifest.id}.html`;

  const entries = await fs.readdir(sourceDirectory, { withFileTypes: true });
  const rootFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));

  // Every root-level module is an entry point: variant pages import some of them
  // directly, so reachability from one file alone would miss the rest.
  const scriptEntries = rootFiles.filter((name) => name.endsWith('.js'));
  const styleEntry = rootFiles.find((name) => name.endsWith('.css')) ?? null;

  const previewVariant =
    manifest.variants.find((variant) => variant.id === manifest.preview.variant) ??
    manifest.variants[0];
  const variantHtml = await fs.readFile(
    path.join(componentDirectory, ...previewVariant.entry.split('/')),
    'utf8',
  );

  await fs.mkdir(destination, { recursive: true });
  const written = [];

  if (styleEntry) {
    await fs.writeFile(
      path.join(destination, cssName),
      await fs.readFile(path.join(sourceDirectory, styleEntry), 'utf8'),
    );
    written.push(cssName);
  }

  if (scriptEntries.length) {
    const seen = new Set();
    const modules = [];
    for (const entry of scriptEntries) {
      await collectModuleOrder(sourceDirectory, entry, seen, modules);
    }

    await fs.writeFile(
      path.join(destination, jsName),
      concatenateModules(modules, manifest.id),
    );
    written.push(jsName);
  }

  await fs.writeFile(
    path.join(destination, htmlName),
    buildDemoDocument({ manifest, variantHtml, cssName, jsName }),
  );
  written.push(htmlName);

  // Assets travel next to the flat bundle, which is the layout the rewritten references
  // above expect. Reported separately: they are payload, not inspectable source.
  const assetsSource = path.join(sourceDirectory, 'assets');
  let hasAssets = false;

  try {
    await fs.cp(assetsSource, path.join(destination, 'assets'), { recursive: true });
    hasAssets = true;
  } catch {
    // A component without assets is the common case.
  }

  return {
    id: manifest.id,
    directory: destination,
    hasAssets,
    // Names only. Callers own the public URL shape, which stays stable even when the
    // bundle is written somewhere else (a temporary directory under test, for example).
    files: written.sort((left, right) => left.localeCompare(right, 'en')),
  };
}

export async function bundleAllComponents({
  componentsDirectory = DEFAULT_COMPONENTS_DIRECTORY,
  outputDirectory = DEFAULT_BUNDLES_DIRECTORY,
} = {}) {
  const records = await readAndValidateComponents({ componentsDirectory });
  return Promise.all(records.map((record) => bundleComponent(record, { outputDirectory })));
}

if (isExecutedDirectly(import.meta.url)) {
  try {
    const bundles = await bundleAllComponents();
    console.log(
      `Bundled ${bundles.length} component${bundles.length === 1 ? '' : 's'} into three files each.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
