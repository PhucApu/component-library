/**
 * Wires the demo output. The switches need no script to render or toggle, so this only
 * mirrors their state and, where a form is shown, reports what a submit would carry.
 */
export function initializeSwitchDemo({ reportForm = false } = {}) {
  const output = document.querySelector('output');

  if (!output) {
    return;
  }

  const switches = [...document.querySelectorAll('ui-switch')];

  const report = () => {
    if (reportForm) {
      const form = document.querySelector('form');
      const entries = [...new FormData(form).entries()].map(([key, value]) => `${key}=${value}`);
      output.textContent = entries.length ? entries.join('\n') : 'nothing would be submitted';
      return;
    }

    output.textContent = switches
      .map((element) => {
        const control = element.control;
        const name = control?.name || control?.id || 'switch';
        return `${name}: ${element.checked ? 'on' : 'off'}`;
      })
      .join('\n');
  };

  report();
  document.addEventListener('change', report);
  document.addEventListener('switch-pending', report);
  document.addEventListener('switch-error', report);
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

/**
 * Stands in for a server call. `failing` switches reject, which is how the demo shows a
 * switch returning to its previous state instead of lying about what was saved.
 */
export function attachDemoCommit({ delayMs = 900 } = {}) {
  const note = document.querySelector('[data-demo-note]');

  document.querySelectorAll('ui-switch[data-demo-commit]').forEach((element) => {
    const failing = element.dataset.demoCommit === 'failing';

    element.commit = () =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          if (failing) {
            reject(new Error('The network refused the change.'));
            return;
          }

          resolve();
        }, delayMs);
      });
  });

  if (!note) {
    return;
  }

  document.addEventListener('switch-error', (event) => {
    note.textContent = event.detail.reason.message;
  });

  document.addEventListener('switch-pending', (event) => {
    if (event.detail.pending) {
      note.textContent = '';
    }
  });
}
