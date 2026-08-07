/**
 * Wires the demo output.
 *
 * The ring turns itself, so this only drives the buttons the variants put outside it and
 * reports where each ring has stopped.
 */
export function initializeOrbitDemo() {
  const output = document.querySelector('output');

  document.querySelectorAll('[data-demo-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const gallery = document.querySelector(button.dataset.demoTarget ?? 'ui-orbit-gallery');

      if (!gallery) {
        return;
      }

      const actions = {
        pause: () => gallery.pause(),
        resume: () => gallery.resume(),
        first: () => gallery.rotateTo(0),
        last: () => gallery.rotateTo(gallery.items.length - 1),
      };

      actions[button.dataset.demoAction]?.();
    });
  });

  if (!output) {
    return;
  }

  const galleries = [...document.querySelectorAll('ui-orbit-gallery')];

  const describeOrbit = (gallery) => {
    const label = gallery.getAttribute('label') ?? 'orbit';
    const alt = gallery.items[gallery.index]?.querySelector('img')?.alt ?? '';
    return `${label}: ${gallery.index + 1} of ${gallery.items.length}${alt ? ` — ${alt}` : ''}`;
  };

  const report = () => {
    output.textContent = galleries.map(describeOrbit).join('\n');
  };

  report();
  document.addEventListener('orbit-change', report);

  // Links in a demo would leave the page; what is on show is the ring.
  document.addEventListener('click', (event) => {
    if (event.target.closest('ui-orbit-gallery a')) {
      event.preventDefault();
    }
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
function applyOrbitPreviewTheme(theme) {
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
      applyOrbitPreviewTheme(event.data.theme);
    }
  });
}
