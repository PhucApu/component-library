/**
 * Wires the demo controls. Opening and closing is the component's job; this only reports
 * what happened and which way out was taken.
 */
export function initializeDrawerDemo() {
  const output = document.querySelector('output');
  const lines = [];

  const record = (line) => {
    lines.unshift(line);
    lines.splice(5);

    if (output) {
      output.textContent = lines.join('\n');
    }
  };

  // A drawer with a `trigger` already listens to that button. Wiring it a second time
  // here would toggle twice on one press, and the panel would look dead.
  const alreadyWired = new Set(
    [...document.querySelectorAll('ui-drawer[trigger]')].map((drawer) =>
      drawer.getAttribute('trigger'),
    ),
  );

  document.querySelectorAll('[data-drawer-open]').forEach((button) => {
    if (alreadyWired.has(button.id)) {
      return;
    }

    button.addEventListener('click', () => {
      document.getElementById(button.dataset.drawerOpen)?.show();
    });
  });

  document.querySelectorAll('[data-drawer-toggle]').forEach((button) => {
    if (alreadyWired.has(button.id)) {
      return;
    }

    button.addEventListener('click', () => {
      document.getElementById(button.dataset.drawerToggle)?.toggle();
    });
  });

  // Links inside a demo drawer would leave the page.
  document.addEventListener('click', (event) => {
    if (event.target.closest('.drawer__nav a')) {
      event.preventDefault();
    }
  });

  document.addEventListener('drawer-open', (event) => {
    record(`open: ${event.target.id || 'drawer'} (${event.target.dataset.mode})`);
  });

  document.addEventListener('drawer-close', (event) => {
    record(`close: ${event.target.id || 'drawer'} via ${event.detail.reason}`);
  });

  record('waiting');
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
