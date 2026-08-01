/**
 * Wires the demo output. The table itself is already readable and scrollable without any
 * of this; the log only shows what the component decided.
 */
export function initializeTableDemo() {
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

  const table = document.querySelector('ui-table');

  const describe = () => {
    const parts = [];
    const sort = table?.sort;

    if (sort) {
      parts.push(`sorted by ${sort.column} ${sort.state}`);
    } else {
      parts.push('source order');
    }

    if (table?.hasAttribute('selectable')) {
      parts.push(`${table.selected.length} selected (${table.dataset.selection})`);
    }

    if (table?.hasAttribute('data-overflowing')) {
      parts.push('scroll region is focusable');
    }

    return parts.join(' | ');
  };

  record(describe());

  document.addEventListener('table-sort', (event) => {
    record(`sort: ${event.detail.column || '(none)'} ${event.detail.state}`);
  });

  document.addEventListener('table-selection-change', (event) => {
    record(`selection: ${event.detail.state} [${event.detail.selected.join(', ')}]`);
  });

  document.addEventListener('table-row-toggle', (event) => {
    record(`row ${event.detail.key}: ${event.detail.expanded ? 'expanded' : 'collapsed'}`);
  });

  window.addEventListener('resize', () => record(describe()));
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

window.addEventListener('message', (event) => {
  // Only the embedder may pin the theme. An unframed page has itself as its parent, and
  // the worst a stray message can do is repaint the demo.
  if (event.source === window.parent && event.data?.type === 'ui-theme') {
    applyPreviewTheme(event.data.theme);
  }
});
