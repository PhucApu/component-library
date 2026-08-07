/**
 * Wires the demo output.
 *
 * The surface answers the pointer on its own, so this only drives the buttons the variants
 * put beside it and reports how much water is still moving.
 */
export function initializeRippleDemo() {
  const output = document.querySelector('output');

  document.querySelectorAll('[data-demo-action]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const surface = document.querySelector(button.dataset.demoTarget ?? 'ui-ripple-surface');

      if (!surface) {
        return;
      }

      if (button.dataset.demoAction === 'clear') {
        surface.clear();
        return;
      }

      // A drop asked for by a button lands in the middle rather than under the pointer:
      // the pointer is on the button, which is somewhere else entirely.
      if (button.dataset.demoAction === 'drop') {
        const box = surface.getBoundingClientRect();
        surface.drop(box.width / 2, box.height / 2);
      }

      if (button.dataset.demoAction === 'drop-corner') {
        surface.drop(24, 24);
      }

      event.currentTarget.blur();
    });
  });

  if (!output) {
    return;
  }

  const surfaces = [...document.querySelectorAll('ui-ripple-surface')];
  let watching = false;

  // The same discipline the element keeps: report while there is water moving, and stop
  // asking for frames once there is not. A demo that idled at 60fps would undo the point
  // the component is making.
  const report = () => {
    output.textContent = surfaces
      .map((surface, index) => `surface ${index + 1}: ${surface.count} ripples alive`)
      .join('\n');

    watching = surfaces.some((surface) => surface.count > 0);

    if (watching) {
      requestAnimationFrame(report);
    }
  };

  const watch = () => {
    if (!watching) {
      watching = true;
      requestAnimationFrame(report);
    }
  };

  report();
  document.addEventListener('pointerdown', watch);
  document.addEventListener('pointermove', watch);
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
function applyRipplePreviewTheme(theme) {
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
      applyRipplePreviewTheme(event.data.theme);
    }
  });
}
