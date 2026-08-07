/**
 * Wires the demo output and the buttons the variants put beside the funnel.
 */
export function initializeFunnelChartDemo() {
  const output = document.querySelector('output');
  const chart = document.querySelector('ui-funnel-chart');

  document.querySelectorAll('[data-demo-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.demoTarget
        ? document.getElementById(button.dataset.demoTarget)
        : chart;

      if (!target) {
        return;
      }

      const actions = {
        shade: () => {
          target.setAttribute('shade', button.dataset.demoShade ?? 'single');
          mark(button, 'shade');
        },
        rates: () => {
          target.setAttribute('rates', button.dataset.demoRates ?? 'both');
          mark(button, 'rates');
        },
        max: () => {
          document.querySelectorAll('ui-funnel-chart').forEach((each) => {
            if (each.hasAttribute('max')) {
              each.removeAttribute('max');
            } else {
              each.setAttribute('max', button.dataset.demoMax ?? '100');
            }
          });

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
            target.setAttribute('error', 'That funnel could not be loaded');
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

  let note = 'Point at a stage, or tab to the funnel and use the up and down arrows.';

  function report() {
    if (!output || !chart) {
      return;
    }

    const worst = chart.largestDrop;
    const overall = chart.overall;

    output.textContent = [
      note,
      `overall: ${overall === null ? 'not enough stages' : `${(overall * 100).toFixed(1)}%`}`,
      `largest drop: ${worst ? `${worst.name}, ${worst.drop.toLocaleString('en-US')} lost` : 'none'}`,
    ].join('\n');
  }

  document.addEventListener('pointerover', (event) => {
    const stage = event.target.closest?.('.funnel__stage');

    if (!stage) {
      return;
    }

    const owner = stage.closest('ui-funnel-chart');
    const found = owner.stages[Number.parseInt(stage.dataset.index, 10)];

    note = `${found.name}: ${found.value.toLocaleString('en-US')}${
      found.stepRate === null ? '' : `, ${(found.stepRate * 100).toFixed(1)}% of previous`
    }`;
    report();
  });

  report();
}
