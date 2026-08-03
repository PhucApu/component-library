/**
 * Wires the demo controls. Everything here is the application's side of the contract:
 * the snackbar itself is summoned, never written into the page.
 */
export function initializeSnackbarDemo() {
  const bar = document.querySelector('ui-snackbar');
  const output = document.querySelector('output');

  if (!bar) {
    return;
  }

  const lines = [];
  const record = (line) => {
    lines.unshift(line);
    lines.splice(6);

    if (output) {
      output.textContent = lines.join('\n');
    }
  };

  const configure = (dataset) => ({
    message: dataset.message,
    severity: dataset.severity,
    duration: dataset.duration === undefined ? undefined : Number(dataset.duration),
    action: dataset.action
      ? { label: dataset.action, onSelect: () => record(`chose "${dataset.action}"`) }
      : null,
  });

  document.querySelectorAll('[data-demo-show]').forEach((button) => {
    button.addEventListener('click', () => {
      bar.show(configure(button.dataset));
    });
  });

  document.querySelectorAll('[data-demo-placement]').forEach((button) => {
    button.addEventListener('click', () => {
      bar.setAttribute('placement', button.dataset.demoPlacement);
      bar.clear();
      bar.show({ message: `Anchored ${button.dataset.demoPlacement}` });
    });
  });

  document.querySelector('[data-demo-burst]')?.addEventListener('click', () => {
    // Fired together on purpose: they have to arrive one at a time, in order.
    ['First in', 'Second in', 'Third in', 'Fourth in'].forEach((message, index) => {
      bar.show({ message, severity: index === 3 ? 'success' : 'info', duration: 1600 });
    });
    record(`queued 4, ${bar.pending} waiting`);
  });

  document.querySelector('[data-demo-clear]')?.addEventListener('click', () => {
    bar.clear();
  });

  document.addEventListener('snackbar-show', (event) => {
    record(`show: ${event.detail.message}`);
  });

  document.addEventListener('snackbar-dismiss', (event) => {
    record(`dismiss: ${event.detail.reason}`);
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
