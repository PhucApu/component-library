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
