/**
 * Wires the demo.
 *
 * The component reports; the page decides. Everything below is the page deciding: it turns
 * a room on, it swaps a panel's colour scheme, and it prints what it heard — none of which
 * the component knows anything about.
 */
export function initializeLightPullDemo() {
  const output = document.querySelector('output');

  document.querySelectorAll('[data-lit-by]').forEach((room) => {
    const pull = document.querySelector(room.dataset.litBy);

    if (!pull) {
      return;
    }

    const apply = () => {
      room.toggleAttribute('data-lit', pull.on);
    };

    apply();
    pull.addEventListener('light-pull-change', apply);
  });

  document.querySelectorAll('[data-scheme-by]').forEach((panel) => {
    const pull = document.querySelector(panel.dataset.schemeBy);

    if (!pull) {
      return;
    }

    const apply = () => {
      panel.style.colorScheme = pull.on ? 'light' : 'dark';
    };

    apply();
    pull.addEventListener('light-pull-change', apply);
  });

  document.querySelectorAll('[data-demo-action]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll(button.dataset.demoTarget ?? 'ui-light-pull').forEach((pull) => {
        const actions = {
          pull: () => pull.pull(),
          on: () => {
            pull.on = true;
          },
          off: () => {
            pull.on = false;
          },
        };

        actions[button.dataset.demoAction]?.();
      });
    });
  });

  if (!output) {
    return;
  }

  const pulls = [...document.querySelectorAll('ui-light-pull')];

  const report = () => {
    output.textContent = pulls
      .map((pull, index) => `pull ${index + 1}: ${pull.on ? 'on' : 'off'}`)
      .join('\n');
  };

  report();
  document.addEventListener('light-pull-change', report);
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
function applyLightPullPreviewTheme(theme) {
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
      applyLightPullPreviewTheme(event.data.theme);
    }
  });
}
