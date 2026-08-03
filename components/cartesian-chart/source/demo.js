/**
 * Wires the demo output.
 *
 * The chart reports what it read; this only reads it back and drives the buttons the variants
 * put outside it.
 */
export function initializeCartesianChartDemo() {
  const output = document.querySelector('output');
  const chart = document.querySelector('ui-cartesian-chart');

  document.querySelectorAll('[data-demo-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.demoTarget
        ? document.getElementById(button.dataset.demoTarget)
        : chart;

      if (!target) {
        return;
      }

      const actions = {
        type: () => {
          target.setAttribute('type', button.dataset.demoType ?? 'line');
          mark(button, 'type');
        },
        stacked: () => {
          target.toggleAttribute('stacked');
          button.toggleAttribute('data-current', target.hasAttribute('stacked'));
        },
        loading: () => {
          target.toggleAttribute('loading');
          button.toggleAttribute('data-current', target.hasAttribute('loading'));
        },
        error: () => {
          if (target.hasAttribute('error')) {
            target.removeAttribute('error');
          } else {
            target.setAttribute('error', 'That report could not be loaded');
          }

          button.toggleAttribute('data-current', target.hasAttribute('error'));
        },
        fold: () => {
          target.toggleAttribute('fold-others');
          button.toggleAttribute('data-current', target.hasAttribute('fold-others'));
        },
      };

      actions[button.dataset.demoAction]?.();
    });
  });

  function mark(pressed, group) {
    document
      .querySelectorAll(`[data-demo-action="${group}"]`)
      .forEach((other) => other.toggleAttribute('data-current', other === pressed));
  }

  if (!output || !chart) {
    return;
  }

  let note = 'Point at the chart, or tab to it and use the arrow keys.';

  const report = () => {
    output.textContent = [
      note,
      `type: ${chart.getAttribute('type') ?? 'line'}${chart.hasAttribute('stacked') ? ', stacked' : ''}`,
      `${chart.visible.length} of ${chart.series.length} series shown`,
    ].join('\n');
  };

  report();

  document.addEventListener('chart-read', (event) => {
    const values = event.detail.values
      .map((entry) => `${entry.name} ${entry.text || entry.value}`)
      .join(' · ');

    note = `${event.detail.category} — ${values || 'nothing recorded'}`;
    report();
  });

  document.addEventListener('chart-series-toggle', (event) => {
    note = `${event.detail.hidden ? 'hid' : 'showed'} ${event.detail.name}`;
    report();
  });
}
