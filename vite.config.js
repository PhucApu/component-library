import { promises as fs } from 'node:fs';
import { resolve, sep } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const PROJECT_ROOT = import.meta.dirname;

/**
 * Serves the byte-for-byte file behind a `?source-view` request.
 *
 * The dev server otherwise runs every `.js` request through its transform pipeline and
 * appends an inline source map, so the source inspector would show hundreds of kilobytes
 * of generated base64 instead of the real file. Requests without the marker are left
 * alone because the preview iframes need the executable module, not text.
 */
function sourceViewPlugin() {
  return {
    name: 'catalog-source-view',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url, 'http://127.0.0.1');

        if (!url.searchParams.has('source-view')) {
          next();
          return;
        }

        const filePath = resolve(PROJECT_ROOT, `.${decodeURIComponent(url.pathname)}`);

        if (filePath !== PROJECT_ROOT && !filePath.startsWith(`${PROJECT_ROOT}${sep}`)) {
          response.statusCode = 403;
          response.end('Forbidden');
          return;
        }

        try {
          const contents = await fs.readFile(filePath);
          response.setHeader('Content-Type', 'text/plain; charset=utf-8');
          response.end(contents);
        } catch {
          next();
        }
      });
    },
  };
}

/**
 * Serves packaged archives during development.
 *
 * Archives are written to `dist/downloads`, but the detail page resolves them relative
 * to the page, which points at `/downloads` on the dev server. Without this the request
 * falls through to the SPA fallback and the browser saves `index.html` under a `.zip`
 * name, which then fails to open. A missing archive answers 404 for the same reason:
 * a silent HTML fallback is what made the failure look like a corrupt file.
 */
function downloadsPlugin() {
  const downloadsRoot = resolve(PROJECT_ROOT, 'dist', 'downloads');

  return {
    name: 'catalog-downloads',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url, 'http://127.0.0.1');

        if (!url.pathname.startsWith('/downloads/')) {
          next();
          return;
        }

        const fileName = decodeURIComponent(url.pathname.slice('/downloads/'.length));
        const filePath = resolve(downloadsRoot, fileName);

        if (!filePath.startsWith(`${downloadsRoot}${sep}`)) {
          response.statusCode = 403;
          response.end('Forbidden');
          return;
        }

        try {
          const archive = await fs.readFile(filePath);
          response.setHeader('Content-Type', 'application/zip');
          response.setHeader('Content-Length', archive.length);
          response.end(archive);
        } catch {
          response.statusCode = 404;
          response.setHeader('Content-Type', 'text/plain; charset=utf-8');
          response.end(
            `Archive ${fileName} is not built yet. Run "pnpm run build" or "pnpm run package:component <id>".`,
          );
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [tailwindcss(), sourceViewPlugin(), downloadsPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        component: resolve(import.meta.dirname, 'component.html'),
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
});
