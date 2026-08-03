/**
 * Wires the demo output.
 *
 * A tile has no events of its own — it is there to be read, not to report. This only drives
 * the buttons the variants put beside it and reads back what the tile decided.
 */
export function initializeStatTileDemo() {
  const output = document.querySelector('output');

  document.querySelectorAll('[data-demo-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.demoTarget
        ? document.getElementById(button.dataset.demoTarget)
        : document.querySelector('ui-stat-tile');

      if (!target) {
        return;
      }

      const actions = {
        polarity: () => {
          target.setAttribute('up', button.dataset.demoUp ?? 'good');
          mark(button, 'polarity');
        },
        usage: () => {
          const limit = target.querySelector('.stat-tile__limit');
          const value = target.querySelector('.stat-tile__value');
          const share = Number.parseFloat(button.dataset.demoShare ?? '0.4');
          const ceiling = Number.parseFloat(limit.dataset.value);
          const used = Math.round(ceiling * share);

          value.dataset.value = String(used);
          value.textContent = `${used.toLocaleString('en-US')} GB`;
          // The numbers live in text nodes, so rewriting them is invisible to the element
          // until it is told. This is what a real page does too.
          target.refresh();
          mark(button, 'usage');
        },
        loading: () => {
          target.toggleAttribute('loading');
          button.toggleAttribute('data-current', target.hasAttribute('loading'));
        },
        error: () => {
          if (target.hasAttribute('error')) {
            target.removeAttribute('error');
          } else {
            target.setAttribute('error', 'That figure could not be loaded');
          }

          button.toggleAttribute('data-current', target.hasAttribute('error'));
        },
        trend: () => {
          target.toggleAttribute('no-trend');
          button.toggleAttribute('data-current', target.hasAttribute('no-trend'));
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

  function report() {
    if (!output) {
      return;
    }

    const tile = document.querySelector('ui-stat-tile');

    if (!tile) {
      return;
    }

    output.textContent = [
      `value: ${tile.value ?? 'unknown'}`,
      `change: ${tile.change ?? 'none'} (up is ${tile.polarity}) -> ${tile.tone}`,
      tile.limit ? `limit: ${tile.limit}` : `trend: ${tile.trend.length} readings`,
    ].join('\n');
  }

  report();
}
