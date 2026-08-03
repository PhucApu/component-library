/**
 * Reports what the viewer decided. Opening, moving, and zooming are the component's job;
 * this only writes down what happened.
 */
export function initializeLightboxDemo() {
  const output = document.querySelector('output');

  if (!output) {
    return;
  }

  const lines = [];
  const record = (line) => {
    lines.unshift(line);
    lines.splice(5);
    output.textContent = lines.join('\n');
  };

  record('waiting');

  document.addEventListener('lightbox-open', (event) => {
    record(`opened at image ${event.detail.index + 1}`);
  });

  document.addEventListener('lightbox-change', (event) => {
    record(`image ${event.detail.index + 1} of ${event.detail.total}`);
  });

  document.addEventListener('lightbox-close', (event) => {
    record(`closed via ${event.detail.reason}`);
  });
}

/**
 * Lets an embedding page pin the demo to one theme.
 *
 * The stylesheet resolves every colour through `light-dark()`, so a page that says
 * nothing keeps following the operating system. A host that shows this file in a frame
 * posts the theme it is displaying, and narrowing `color-scheme` to a single keyword
 * repoints every pair at once. The message names no host and carries nothing but a theme
 * keyword, so answering it adds no dependency on whoever sent it.
 */
function applyPreviewTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.style.colorScheme = theme;
  }
}

// Guarded because these demo modules are also imported by unit tests, which run in Node
// where there is no window to listen on.
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    // Only the embedder may pin the theme. An unframed page has itself as its parent, and
    // the worst a stray message can do is repaint the demo.
    if (event.source === window.parent && event.data?.type === 'ui-theme') {
      applyPreviewTheme(event.data.theme);
    }
  });
}
