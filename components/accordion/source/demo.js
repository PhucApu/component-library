/**
 * Wires the demo output.
 *
 * The panels need no script to open, so this only reports what the component decided, and
 * drives the controls the Controlled variant puts outside the group.
 */
export function initializeAccordionDemo() {
  const groups = [...document.querySelectorAll('ui-accordion')];
  const output = document.querySelector('output');

  document.querySelectorAll('[data-demo-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const group = document.querySelector(button.dataset.demoTarget ?? 'ui-accordion');

      if (!group) {
        return;
      }

      const actions = {
        'expand-all': () => group.expandAll(),
        'collapse-all': () => group.collapseAll(),
        first: () => group.expand(0),
        last: () => group.expand(group.items.length - 1),
      };

      actions[button.dataset.demoAction]?.();
    });
  });

  if (!output) {
    return;
  }

  const describe = (group) => {
    const open = group.expanded;
    const titles = open.map((index) =>
      group.items[index]?.querySelector('.accordion__title')?.textContent?.trim(),
    );

    return open.length === 0 ? 'nothing open' : `open: ${titles.join(', ')}`;
  };

  const report = (event) => {
    const lines = groups.map((group, index) =>
      groups.length > 1 ? `group ${index + 1}: ${describe(group)}` : describe(group),
    );

    if (event?.type === 'accordion-toggle') {
      lines.push(
        `${event.detail.expanded ? 'opened' : 'closed'} panel ${event.detail.index + 1} (${event.detail.reason})`,
      );
    }

    output.textContent = lines.join('\n');
  };

  report();
  document.addEventListener('accordion-toggle', report);
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
