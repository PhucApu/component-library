/**
 * Wires the demo output and the buttons the variants put beside the ring.
 */
export function initializeDonutChartDemo() {
  const output = document.querySelector('output');
  const chart = document.querySelector('ui-donut-chart');

  document.querySelectorAll('[data-demo-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.demoTarget
        ? document.getElementById(button.dataset.demoTarget)
        : chart;

      if (!target) {
        return;
      }

      const actions = {
        rows: () => {
          const body = target.querySelector('tbody');
          const wanted = Number.parseInt(button.dataset.demoRows ?? '5', 10);

          [...body.rows].forEach((row, index) => {
            row.hidden = index >= wanted;
          });

          // Hidden rows are still rows; the element reads what is in the table, so they are
          // taken out rather than covered up.
          [...body.rows].forEach((row) => {
            if (row.hidden) {
              row.remove();
            }
          });

          target.refresh();
          mark(button, 'rows');
        },
        loading: () => {
          target.toggleAttribute('loading');
          button.toggleAttribute('data-current', target.hasAttribute('loading'));
        },
        error: () => {
          if (target.hasAttribute('error')) {
            target.removeAttribute('error');
          } else {
            target.setAttribute('error', 'That breakdown could not be loaded');
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

  let note = 'Point at a wedge, or tab to the ring and use the arrow keys.';

  function report() {
    if (!output || !chart) {
      return;
    }

    output.textContent = [
      note,
      `total: ${chart.total.toLocaleString('en-US')}`,
      `${chart.slices.length} of ${chart.rows.length} rows drawn`,
    ].join('\n');
  }

  document.addEventListener('pointerover', (event) => {
    const wedge = event.target.closest?.('.donut__slice');

    if (wedge) {
      note = wedge.getAttribute('aria-label');
      report();
    }
  });

  report();
}
