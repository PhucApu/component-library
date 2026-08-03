/**
 * Wires the demo output and the buttons the variants put beside the grid.
 */
export function initializeHeatmapChartDemo() {
  const output = document.querySelector('output');
  const chart = document.querySelector('ui-heatmap-chart');

  document.querySelectorAll('[data-demo-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.demoTarget
        ? document.getElementById(button.dataset.demoTarget)
        : chart;

      if (!target) {
        return;
      }

      const actions = {
        scale: () => {
          target.setAttribute('scale', button.dataset.demoScale ?? 'linear');
          mark(button, 'scale');
        },
        max: () => {
          if (target.hasAttribute('max')) {
            target.removeAttribute('max');
          } else {
            target.setAttribute('max', button.dataset.demoMax ?? '100');
          }

          button.toggleAttribute('data-current', target.hasAttribute('max'));
        },
        loading: () => {
          target.toggleAttribute('loading');
          button.toggleAttribute('data-current', target.hasAttribute('loading'));
        },
        error: () => {
          if (target.hasAttribute('error')) {
            target.removeAttribute('error');
          } else {
            target.setAttribute('error', 'That grid could not be loaded');
          }

          button.toggleAttribute('data-current', target.hasAttribute('error'));
        },
      };

      actions[button.dataset.demoAction]?.();
      report();
    });
  });

  function mark(pressed, group) {
    document
      .querySelectorAll(`[data-demo-action="${group}"]`)
      .forEach((other) => other.toggleAttribute('data-current', other === pressed));
  }

  let note = 'Point at a cell, or tab to the grid and use the arrow keys.';

  function report() {
    if (!output || !chart) {
      return;
    }

    output.textContent = [
      note,
      `scale: ${chart.scale}`,
      `steps end at ${chart.thresholds.join(', ') || 'nothing yet'}`,
    ].join('\n');
  }

  document.addEventListener('pointerover', (event) => {
    const cell = event.target.closest?.('.heat__cell:not([data-outside])');

    if (!cell) {
      return;
    }

    const owner = cell.closest('ui-heatmap-chart');
    const row = owner.rows[Number.parseInt(cell.dataset.row, 10)];
    const column = owner.columns[Number.parseInt(cell.dataset.column, 10)];

    note = `${row.name}, ${column}: ${row.values[Number.parseInt(cell.dataset.column, 10)]}`;
    report();
  });

  report();
}
